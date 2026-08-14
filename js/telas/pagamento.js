// ============================================================
// telas/pagamento.js — registrar pagamento de uma parcela
// (aceita pagamento parcial e foto de comprovante) e o
// detalhe de parcelas, com recibo.
// ============================================================

import * as dados from '../dados.js';
import * as calc from '../calculos.js';
import {
  esc, fmtMoeda, fmtData, hojeISO, ehISOValido,
  toast, confirmar, confirmarExclusao, abrirModal,
  ativarCampoMoeda, lerCentavos,
} from '../util.js';
import { comprimirParaBase64, mostrarComprovante } from '../comprovante.js';
import { desenharRecibo, compartilharRecibo } from '../recibo.js';

// ---------- Miniaturas de comprovantes já guardados ----------

// Carrega as miniaturas dos comprovantes de uma parcela dentro de "area".
function montarMiniaturas(area, emprestimo, parcela) {
  area.innerHTML = '';
  (async () => {
    for (const comprovanteId of parcela.comprovanteIds || []) {
      try {
        const comprovante = await dados.obterComprovante(comprovanteId);
        if (!comprovante || !area.isConnected) continue;
        const miniatura = document.createElement('img');
        miniatura.className = 'miniatura';
        miniatura.alt = 'Comprovante guardado';
        miniatura.src = comprovante.imagemBase64;
        miniatura.addEventListener('click', () => {
          mostrarComprovante({
            imagemBase64: comprovante.imagemBase64,
            nomeArquivo: `comprovante-parcela-${parcela.numero}.jpg`,
            aoExcluir: async () => {
              const quer = await confirmarExclusao({
                titulo: 'Excluir este comprovante?',
                mensagem: 'A foto será apagada de vez.',
              });
              if (!quer) return;
              dados.excluirComprovante(emprestimo.id, parcela, comprovante.id);
              parcela.comprovanteIds = (parcela.comprovanteIds || []).filter((c) => c !== comprovante.id);
              toast('Comprovante excluído.');
              montarMiniaturas(area, emprestimo, parcela);
            },
          });
        });
        area.appendChild(miniatura);
      } catch (erro) {
        console.error('Erro ao carregar comprovante:', erro);
      }
    }
  })();
}

// ---------- Registrar pagamento ----------

export function abrirRegistroPagamento({ emprestimo, parcelas, parcela }) {
  const restante = calc.restanteParcela(parcela);
  const temComprovantesAntigos = (parcela.comprovanteIds || []).length > 0;

  const { el, fechar } = abrirModal(`
    <h2 class="titulo-modal">Receber parcela ${parcela.numero}</h2>
    <p class="subtexto" style="margin-bottom:0.9rem">
      Vencimento ${fmtData(parcela.vencimento)} · Valor ${fmtMoeda(parcela.valor)}
      ${parcela.valorPago > 0 ? ` · Já pagou ${fmtMoeda(parcela.valorPago)}` : ''}
    </p>
    ${temComprovantesAntigos ? `
      <p class="subtexto">Comprovantes já guardados (toque para ver):</p>
      <div id="area-comprovantes-antigos" class="fileira-miniaturas" style="margin-bottom:0.9rem"></div>` : ''}
    <div class="campo">
      <label for="campo-valor-pagamento">Valor recebido</label>
      <input id="campo-valor-pagamento" type="text">
      <p class="dica">Pode ser menor que a parcela (pagamento em partes).</p>
    </div>
    <div class="campo">
      <label for="campo-data-pagamento">Data do pagamento</label>
      <input id="campo-data-pagamento" type="date" value="${hojeISO()}">
    </div>
    <div class="campo">
      <label>Comprovante (foto)</label>
      <input id="campo-foto" type="file" accept="image/*" class="escondido">
      <button type="button" class="botao botao-neutro" id="botao-foto">📷 Anexar foto do comprovante</button>
      <div id="area-foto" class="fileira-miniaturas"></div>
    </div>
    <div class="aviso-erro escondido" id="erro-pagamento" role="alert"></div>
    <button class="botao botao-primario" id="botao-salvar-pagamento">Salvar pagamento</button>
    <button class="botao botao-neutro" id="botao-cancelar-pagamento">Cancelar</button>
  `);

  if (temComprovantesAntigos) {
    montarMiniaturas(el.querySelector('#area-comprovantes-antigos'), emprestimo, parcela);
  }

  const campoValor = el.querySelector('#campo-valor-pagamento');
  ativarCampoMoeda(campoValor, restante);

  const caixaErro = el.querySelector('#erro-pagamento');
  const mostrarErro = (mensagem) => {
    caixaErro.textContent = mensagem;
    caixaErro.classList.toggle('escondido', !mensagem);
  };

  // Foto do comprovante
  let fotoBase64 = null;
  const campoFoto = el.querySelector('#campo-foto');
  const botaoFoto = el.querySelector('#botao-foto');
  const areaFoto = el.querySelector('#area-foto');

  botaoFoto.addEventListener('click', () => campoFoto.click());
  campoFoto.addEventListener('change', async () => {
    const arquivo = campoFoto.files && campoFoto.files[0];
    if (!arquivo) return;
    botaoFoto.disabled = true;
    botaoFoto.textContent = 'Preparando a foto…';
    try {
      fotoBase64 = await comprimirParaBase64(arquivo);
      areaFoto.innerHTML = '';
      const miniatura = document.createElement('img');
      miniatura.className = 'miniatura';
      miniatura.alt = 'Comprovante anexado';
      miniatura.src = fotoBase64;
      miniatura.addEventListener('click', () => mostrarComprovante({ imagemBase64: fotoBase64 }));
      areaFoto.appendChild(miniatura);
      botaoFoto.textContent = '📷 Trocar a foto';
    } catch (erro) {
      fotoBase64 = null;
      mostrarErro(erro.message || 'Não deu para usar essa foto. Tente de novo.');
      botaoFoto.textContent = '📷 Anexar foto do comprovante';
    }
    botaoFoto.disabled = false;
    campoFoto.value = '';
  });

  el.querySelector('#botao-cancelar-pagamento').addEventListener('click', fechar);

  el.querySelector('#botao-salvar-pagamento').addEventListener('click', async () => {
    mostrarErro('');
    const valor = lerCentavos(campoValor);
    const data = el.querySelector('#campo-data-pagamento').value;
    if (valor <= 0) return mostrarErro('Digite o valor que você recebeu.');
    if (!ehISOValido(data)) return mostrarErro('Confira a data do pagamento.');

    let abaterProximas = false;
    if (valor > restante) {
      const escolha = await escolherDestinoDaSobra(valor - restante);
      if (!escolha) return; // desistiu
      abaterProximas = escolha === 'abater';
    }

    const resultado = dados.registrarPagamento({
      emprestimo,
      parcelas,
      numeroParcela: parcela.numero,
      valorCentavos: valor,
      dataISO: data,
      imagemBase64: fotoBase64,
      abaterProximas,
    });

    fechar();
    toast(resultado.quitou ? 'Pagamento salvo ✓ Empréstimo quitado 🎉' : 'Pagamento salvo ✓');

    oferecerRecibo({
      emprestimo,
      valorCentavos: valor,
      dataISO: data,
      numerosDasParcelas: resultado.alocacoes.map((a) => a.numero),
    });
  });
}

// Pergunta o que fazer quando a pessoa paga mais que a parcela.
function escolherDestinoDaSobra(sobraCentavos) {
  return new Promise((resolver) => {
    const { el, fechar } = abrirModal(`
      <h2 class="titulo-modal">Pagou a mais</h2>
      <p style="margin-bottom:1rem">Sobram <strong>${fmtMoeda(sobraCentavos)}</strong> além desta parcela.
        O que fazer com essa sobra?</p>
      <button class="botao botao-primario" data-acao="abater">Abater das próximas parcelas</button>
      <button class="botao botao-neutro" data-acao="nesta">Deixar tudo nesta parcela</button>
      <button class="botao botao-linha" data-acao="voltar" style="width:100%">Voltar</button>
    `, { centralizado: true, aoFechar: () => resolver(null) });

    // resolver() só vale na primeira chamada; o resolver(null) do
    // aoFechar depois disso não tem efeito.
    el.querySelector('[data-acao="abater"]').addEventListener('click', () => { resolver('abater'); fechar(); });
    el.querySelector('[data-acao="nesta"]').addEventListener('click', () => { resolver('nesta'); fechar(); });
    el.querySelector('[data-acao="voltar"]').addEventListener('click', () => { resolver(null); fechar(); });
  });
}

// ---------- Recibo ----------

// Monta o texto "à parcela 4 de 12" ou "às parcelas 4, 5 e 6 de 12",
// para o recibo dizer exatamente o que o dinheiro cobriu.
function textoReferenciaParcelas(numeros, totalParcelas) {
  const lista = [...numeros].sort((a, b) => a - b);
  if (lista.length <= 1) {
    return `à parcela ${lista[0] ?? '?'} de ${totalParcelas}`;
  }
  const ultimo = lista[lista.length - 1];
  return `às parcelas ${lista.slice(0, -1).join(', ')} e ${ultimo} de ${totalParcelas}`;
}

async function oferecerRecibo({ emprestimo, valorCentavos, dataISO, numerosDasParcelas }) {
  const quer = await confirmar({
    titulo: 'Gerar recibo?',
    mensagem: 'Você pode enviar a imagem do recibo pelo WhatsApp ou guardar no celular.',
    textoConfirmar: 'Gerar recibo',
    textoCancelar: 'Agora não',
  });
  if (!quer) return;
  mostrarRecibo({ emprestimo, valorCentavos, dataISO, numerosDasParcelas });
}

export function mostrarRecibo({ emprestimo, valorCentavos, dataISO, numerosDasParcelas }) {
  const canvas = desenharRecibo({
    clienteNome: emprestimo.clienteNome,
    valorCentavos,
    textoReferencia: textoReferenciaParcelas(numerosDasParcelas, emprestimo.numParcelas),
    valorEmprestadoCentavos: emprestimo.valorEmprestado,
    dataEmprestimoISO: emprestimo.dataEmprestimo,
    dataPagamentoISO: dataISO,
  });

  const { el, fechar } = abrirModal(`
    <h2 class="titulo-modal">Recibo pronto</h2>
    <div id="area-recibo"></div>
    <div class="espaco-cima">
      <button class="botao botao-primario" data-acao="enviar">Enviar / compartilhar</button>
      <button class="botao botao-neutro" data-acao="fechar">Fechar</button>
    </div>
  `);

  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.borderRadius = '12px';
  canvas.style.border = '1px solid var(--borda)';
  el.querySelector('#area-recibo').appendChild(canvas);

  el.querySelector('[data-acao="fechar"]').addEventListener('click', fechar);
  el.querySelector('[data-acao="enviar"]').addEventListener('click', async () => {
    const nomeArquivo = `recibo-parcela-${numerosDasParcelas[0] ?? 1}.jpg`;
    const resultado = await compartilharRecibo(canvas, nomeArquivo);
    if (resultado === 'baixado') toast('Imagem do recibo baixada.');
    if (resultado === 'compartilhado') toast('Recibo enviado ✓');
  });
}

// ---------- Detalhe da parcela (paga, ou consulta de empréstimo inativo) ----------

export function abrirDetalheParcelaPaga({ emprestimo, parcelas, parcela }) {
  const paga = parcela.status === 'paga';

  const { el, fechar } = abrirModal(`
    <h2 class="titulo-modal">Parcela ${parcela.numero}${paga ? ' — paga ✓' : ''}</h2>
    <div class="cartao"><div class="cartao-conteudo">
      <div class="linha-info"><span class="rotulo">Valor da parcela</span><span class="valor">${fmtMoeda(parcela.valor)}</span></div>
      <div class="linha-info"><span class="rotulo">Valor pago</span><span class="valor">${fmtMoeda(parcela.valorPago)}</span></div>
      ${parcela.dataPagamento ? `<div class="linha-info"><span class="rotulo">Pago em</span><span class="valor">${fmtData(parcela.dataPagamento)}</span></div>` : ''}
      <div class="linha-info"><span class="rotulo">Vencimento</span><span class="valor">${fmtData(parcela.vencimento)}</span></div>
    </div></div>
    <div class="fileira-miniaturas" id="area-comprovantes"></div>
    <div class="espaco-cima">
      ${parcela.valorPago > 0 ? '<button class="botao botao-secundario" data-acao="recibo">Gerar recibo</button>' : ''}
      <input id="campo-foto-paga" type="file" accept="image/*" class="escondido">
      <button class="botao botao-neutro" data-acao="anexar">📷 Anexar comprovante</button>
      <button class="botao botao-neutro" data-acao="fechar">Fechar</button>
    </div>
  `);

  montarMiniaturas(el.querySelector('#area-comprovantes'), emprestimo, parcela);

  el.querySelector('[data-acao="fechar"]').addEventListener('click', fechar);

  const botaoRecibo = el.querySelector('[data-acao="recibo"]');
  if (botaoRecibo) {
    botaoRecibo.addEventListener('click', () => {
      fechar();
      mostrarRecibo({
        emprestimo,
        valorCentavos: parcela.valorPago,
        dataISO: parcela.dataPagamento || hojeISO(),
        numerosDasParcelas: [parcela.numero],
      });
    });
  }

  const campoFoto = el.querySelector('#campo-foto-paga');
  const botaoAnexar = el.querySelector('[data-acao="anexar"]');
  botaoAnexar.addEventListener('click', () => campoFoto.click());
  campoFoto.addEventListener('change', async () => {
    const arquivo = campoFoto.files && campoFoto.files[0];
    if (!arquivo) return;
    botaoAnexar.disabled = true;
    botaoAnexar.textContent = 'Guardando a foto…';
    try {
      const imagemBase64 = await comprimirParaBase64(arquivo);
      dados.anexarComprovante(emprestimo, parcela, imagemBase64);
      toast('Comprovante guardado ✓');
      fechar();
    } catch (erro) {
      toast(erro.message || 'Não deu para usar essa foto.', 'erro');
      botaoAnexar.disabled = false;
      botaoAnexar.textContent = '📷 Anexar comprovante';
    }
  });
}
