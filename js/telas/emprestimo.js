// ============================================================
// telas/emprestimo.js — detalhe do empréstimo: progresso,
// lista de parcelas com cores por situação, quitação,
// cancelamento e exclusão.
// ============================================================

import * as dados from '../dados.js';
import * as calc from '../calculos.js';
import {
  esc, fmtMoeda, fmtData, fmtPorcentagem, hojeISO,
  toast, confirmar, confirmarExclusao, abrirModal,
  ativarCampoMoeda, lerCentavos, ehISOValido,
} from '../util.js';
import { abrirRegistroPagamento, abrirDetalheParcelaPaga } from './pagamento.js';
import { coletarAssinatura } from '../assinatura.js';
import { mostrarComprovanteEmprestimo } from './comprovante-emprestimo.js';

const NOMES_MODO = {
  parcelas_combinadas: 'Parcelas combinadas',
  juros_mensal: 'Juros ao mês',
};

const NOMES_PERIODICIDADE = {
  mensal: 'Todo mês',
  quinzenal: 'A cada 15 dias',
  semanal: 'Toda semana',
};

export function render(el, { id }) {
  let parcelas = null;

  const desenhar = () => {
    const emprestimo = dados.obterEmprestimo(id);
    if (!emprestimo) {
      el.innerHTML = dados.estado.carregouEmprestimos
        ? '<p class="carregando-area">Empréstimo não encontrado.</p>'
        : '<p class="carregando-area">Carregando…</p>';
      return;
    }
    if (!parcelas) {
      el.innerHTML = '<p class="carregando-area">Carregando parcelas…</p>';
      return;
    }

    const resumo = calc.resumoEmprestimo(parcelas);
    const hoje = hojeISO();
    const ativo = emprestimo.status === 'ativo';

    const chipStatus = emprestimo.status === 'quitado'
      ? '<span class="chip chip-quitado">Quitado</span>'
      : emprestimo.status === 'cancelado'
        ? '<span class="chip chip-cancelado">Cancelado</span>'
        : '';

    el.innerHTML = `
      <div class="cabecalho-tela">
        <button class="botao-voltar" id="botao-voltar" aria-label="Voltar">‹</button>
        <div>
          <h1 class="titulo-tela" style="margin:0">${esc(emprestimo.clienteNome)} ${chipStatus}</h1>
          <p class="subtexto">${fmtMoeda(emprestimo.valorEmprestado)} emprestado em ${fmtData(emprestimo.dataEmprestimo)}</p>
        </div>
      </div>

      <div class="cartao"><div class="cartao-conteudo">
        <p style="margin-bottom:0.5rem"><strong>Pagas ${resumo.pagas} de ${resumo.total}</strong> · Falta ${fmtMoeda(resumo.faltaCentavos)}</p>
        <div class="barra-progresso" role="progressbar" aria-valuenow="${resumo.progresso}" aria-valuemin="0" aria-valuemax="100">
          <div style="width:${resumo.progresso}%"></div>
        </div>
      </div></div>

      ${ativo ? '<button class="botao botao-secundario espaco-cima" id="botao-quitar">Quitar empréstimo</button>' : ''}

      <h2 class="titulo-secao">Parcelas</h2>
      <p class="subtexto" style="margin-bottom:0.5rem">Toque na parcela para registrar um pagamento.</p>
      <div class="cartao"><ul class="lista">
        ${parcelas.map((p) => itemParcela(p, hoje)).join('')}
      </ul></div>

      <h2 class="titulo-secao">Combinado</h2>
      <div class="cartao"><div class="cartao-conteudo">
        <div class="linha-info"><span class="rotulo">Modo</span><span class="valor">${NOMES_MODO[emprestimo.modo] || ''}</span></div>
        ${emprestimo.modo === 'juros_mensal' ? `
          <div class="linha-info"><span class="rotulo">Juros</span><span class="valor">${fmtPorcentagem(emprestimo.taxaMensal || 0)} ao mês</span></div>` : ''}
        <div class="linha-info"><span class="rotulo">Parcelas</span><span class="valor">${emprestimo.numParcelas}x de ${fmtMoeda(emprestimo.valorParcela)}</span></div>
        <div class="linha-info"><span class="rotulo">Quando</span><span class="valor">${NOMES_PERIODICIDADE[emprestimo.periodicidade] || ''}</span></div>
        <div class="linha-info"><span class="rotulo">1ª parcela</span><span class="valor">${fmtData(emprestimo.primeiroVencimento)}</span></div>
        <div class="linha-info"><span class="rotulo">Total a receber</span><span class="valor">${fmtMoeda(emprestimo.totalAReceber)}</span></div>
        ${emprestimo.observacoes ? `
          <div class="linha-info"><span class="rotulo">Observações</span>
          <span class="valor" style="font-weight:500">${esc(emprestimo.observacoes).replaceAll('\n', '<br>')}</span></div>` : ''}
      </div></div>

      <h2 class="titulo-secao">Comprovante e assinatura</h2>
      <div class="cartao"><div class="cartao-conteudo">
        <div id="area-assinatura">
          ${emprestimo.assinaturaId
            ? '<p class="subtexto">Carregando a assinatura…</p>'
            : '<p class="subtexto">Este empréstimo ainda não tem a assinatura de quem recebeu.</p>'}
        </div>
        <button class="botao botao-secundario" id="botao-comprovante">Ver / enviar comprovante</button>
        ${emprestimo.assinaturaId ? '' : '<button class="botao botao-neutro" id="botao-assinar">✍️ Colher assinatura agora</button>'}
      </div></div>

      <div class="espaco-cima-2">
        ${ativo ? '<button class="botao botao-linha" id="botao-cancelar" style="width:100%">Marcar como cancelado</button>' : ''}
        <button class="botao botao-perigo-claro" id="botao-excluir">Excluir empréstimo</button>
      </div>
    `;

    el.querySelector('#botao-voltar').addEventListener('click', () => {
      location.hash = '#/cliente/' + emprestimo.clienteId;
    });

    // Toque nas parcelas
    el.querySelectorAll('[data-parcela]').forEach((item) => {
      item.addEventListener('click', () => {
        const parcela = parcelas.find((p) => String(p.numero) === item.dataset.parcela);
        if (!parcela) return;
        if (parcela.status === 'paga' || !ativo) {
          // Parcela paga (ou empréstimo quitado/cancelado): abre a
          // consulta, com comprovantes e recibo.
          abrirDetalheParcelaPaga({ emprestimo, parcelas, parcela });
        } else {
          abrirRegistroPagamento({ emprestimo, parcelas, parcela });
        }
      });
    });

    if (ativo) {
      el.querySelector('#botao-quitar').addEventListener('click', () => abrirQuitacao(emprestimo, parcelas, resumo));
      el.querySelector('#botao-cancelar').addEventListener('click', async () => {
        const quer = await confirmar({
          titulo: 'Marcar como cancelado?',
          mensagem: 'O empréstimo sai dos totais e das cobranças, mas continua guardado no histórico do cliente.',
          textoConfirmar: 'Sim, cancelar empréstimo',
          perigo: true,
        });
        if (!quer) return;
        dados.cancelarEmprestimo(emprestimo);
        toast('Empréstimo marcado como cancelado.');
      });
    }

    // ---------- Comprovante e assinatura ----------

    const areaAssinatura = el.querySelector('#area-assinatura');
    if (emprestimo.assinaturaId) {
      dados.obterAssinatura(emprestimo.assinaturaId).then((assinatura) => {
        if (!areaAssinatura.isConnected) return;
        if (!assinatura) {
          areaAssinatura.innerHTML = '<p class="subtexto">A assinatura não foi encontrada.</p>';
          return;
        }
        areaAssinatura.innerHTML = `
          <p class="subtexto">Assinatura de quem recebeu:</p>
          <img class="assinatura-guardada" alt="Assinatura de ${esc(emprestimo.clienteNome)}" src="${esc(assinatura.imagemBase64)}">`;
      }).catch((erro) => {
        console.error('Não deu para carregar a assinatura:', erro);
      });
    }

    el.querySelector('#botao-comprovante').addEventListener('click', () => {
      mostrarComprovanteEmprestimo({ emprestimo });
    });

    const botaoAssinar = el.querySelector('#botao-assinar');
    if (botaoAssinar) {
      botaoAssinar.addEventListener('click', async () => {
        const assinatura = await coletarAssinatura({
          nome: emprestimo.clienteNome,
          textoPular: 'Agora não',
        });
        if (assinatura.acao !== 'assinou') return;
        dados.anexarAssinatura(emprestimo, assinatura.imagemBase64);
        toast('Assinatura guardada ✓');
      });
    }

    el.querySelector('#botao-excluir').addEventListener('click', async () => {
      const quer = await confirmarExclusao({
        titulo: 'Excluir este empréstimo?',
        mensagem: 'Apaga de vez o empréstimo, as parcelas, os pagamentos e os comprovantes dele. Não tem volta.',
      });
      if (!quer) return;
      await dados.excluirEmprestimo(emprestimo);
      toast('Empréstimo excluído.');
      location.hash = '#/cliente/' + emprestimo.clienteId;
    });
  };

  const pararParcelas = dados.ouvirParcelasDe(id, (lista) => {
    parcelas = lista;
    desenhar();
  });

  desenhar();
  document.addEventListener('dados-mudaram', desenhar);
  return () => {
    document.removeEventListener('dados-mudaram', desenhar);
    pararParcelas();
  };
}

function itemParcela(parcela, hoje) {
  const situacao = calc.situacaoParcela(parcela, hoje);
  const restante = calc.restanteParcela(parcela);

  let linha2 = `vence em ${fmtData(parcela.vencimento)}`;
  if (parcela.status === 'paga') {
    linha2 = `paga${parcela.dataPagamento ? ` em ${fmtData(parcela.dataPagamento)}` : ''}`;
  } else if (parcela.valorPago > 0) {
    linha2 = `${situacao === 'atrasada' ? `venceu em ${fmtData(parcela.vencimento)}` : linha2} · pagou ${fmtMoeda(parcela.valorPago)}, falta ${fmtMoeda(restante)}`;
  } else if (situacao === 'atrasada') {
    linha2 = `venceu em ${fmtData(parcela.vencimento)}`;
  }

  return `
    <li>
      <button class="item-lista" data-parcela="${parcela.numero}">
        <div class="bola-parcela bola-${situacao}">${parcela.numero}</div>
        <div class="meio">
          <div class="titulo">${fmtMoeda(parcela.valor)}</div>
          <div class="linha2">${linha2}</div>
        </div>
        <div class="direita">
          <span class="chip chip-${situacao}">${calc.NOMES_SITUACAO[situacao]}</span>
          ${parcela.temComprovante ? '<div class="linha2">📎 comprovante</div>' : ''}
        </div>
      </button>
    </li>`;
}

function abrirQuitacao(emprestimo, parcelas, resumo) {
  const { el, fechar } = abrirModal(`
    <h2 class="titulo-modal">Quitar empréstimo</h2>
    <p style="margin-bottom:0.9rem">Falta receber <strong>${fmtMoeda(resumo.faltaCentavos)}</strong>.
      Se vocês combinaram um desconto para quitar agora, é só mudar o valor aqui embaixo.</p>
    <div class="campo">
      <label for="campo-valor-quitacao">Valor recebido para quitar</label>
      <input id="campo-valor-quitacao" type="text">
    </div>
    <div class="campo">
      <label for="campo-data-quitacao">Data</label>
      <input id="campo-data-quitacao" type="date" value="${hojeISO()}">
    </div>
    <button class="botao botao-primario" data-acao="quitar">Quitar agora</button>
    <button class="botao botao-neutro" data-acao="fechar">Cancelar</button>
  `);

  const campoValor = el.querySelector('#campo-valor-quitacao');
  ativarCampoMoeda(campoValor, resumo.faltaCentavos);

  el.querySelector('[data-acao="fechar"]').addEventListener('click', fechar);
  el.querySelector('[data-acao="quitar"]').addEventListener('click', async () => {
    const valor = lerCentavos(campoValor);
    const data = el.querySelector('#campo-data-quitacao').value;
    if (valor <= 0) { toast('Digite o valor recebido.', 'erro'); return; }
    if (!ehISOValido(data)) { toast('Confira a data.', 'erro'); return; }

    const desconto = resumo.faltaCentavos - valor;
    const quer = await confirmar({
      titulo: 'Confirmar quitação?',
      mensagem: `Receber <strong>${fmtMoeda(valor)}</strong> e marcar todas as parcelas como pagas` +
        (desconto > 0 ? `, com desconto de <strong>${fmtMoeda(desconto)}</strong>?` : '?'),
      textoConfirmar: 'Sim, quitar',
    });
    if (!quer) return;

    dados.quitarEmprestimo({ emprestimo, parcelas, valorCentavos: valor, dataISO: data });
    fechar();
    toast('Empréstimo quitado 🎉');
  });
}
