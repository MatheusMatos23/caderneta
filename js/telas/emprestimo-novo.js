// ============================================================
// telas/emprestimo-novo.js — cadastro de empréstimo, com dois
// modos:
// - Parcelas combinadas (padrão): valor de cada parcela digitado
//   à mão, como no caderno.
// - Juros ao mês: o app calcula o valor da parcela (juros simples).
// Antes de salvar, mostra a tabela de parcelas para conferência.
// ============================================================

import * as dados from '../dados.js';
import * as calc from '../calculos.js';
import {
  esc, fmtMoeda, fmtPorcentagem, fmtData, hojeISO,
  somarDias, somarMeses, ehISOValido,
  ativarCampoMoeda, lerCentavos, toast, abrirModal,
} from '../util.js';
import { coletarAssinatura } from '../assinatura.js';
import { mostrarComprovanteEmprestimo } from './comprovante-emprestimo.js';

export function render(el, params = {}) {
  // Espera a lista de clientes chegar antes de montar o formulário.
  if (!dados.estado.carregouClientes) {
    el.innerHTML = '<p class="carregando-area">Carregando…</p>';
    const aoCarregar = () => {
      if (dados.estado.carregouClientes) {
        document.removeEventListener('dados-mudaram', aoCarregar);
        render(el, params);
      }
    };
    document.addEventListener('dados-mudaram', aoCarregar);
    return () => document.removeEventListener('dados-mudaram', aoCarregar);
  }

  if (!dados.estado.clientes.length) {
    el.innerHTML = `
      <h1 class="titulo-tela">Novo empréstimo</h1>
      <div class="aviso-info">Para anotar um empréstimo, primeiro cadastre o cliente.</div>
      <button class="botao botao-primario" id="botao-criar-cliente">+ Cadastrar cliente</button>
    `;
    el.querySelector('#botao-criar-cliente').addEventListener('click', () => {
      location.hash = '#/clientes/novo';
    });
    return;
  }

  const hoje = hojeISO();
  const opcoesClientes = dados.estado.clientes
    .map((c) => `<option value="${esc(c.id)}" ${c.id === params.cliente ? 'selected' : ''}>${esc(c.nome)}${c.apelido ? ` (${esc(c.apelido)})` : ''}</option>`)
    .join('');

  el.innerHTML = `
    <div class="cabecalho-tela">
      <button class="botao-voltar" id="botao-voltar" aria-label="Voltar">‹</button>
      <h1 class="titulo-tela" style="margin:0">Novo empréstimo</h1>
    </div>

    <form id="form-emprestimo" novalidate>
      <div class="campo">
        <label for="campo-cliente">Para quem?</label>
        <select id="campo-cliente">
          <option value="">Escolha o cliente…</option>
          ${opcoesClientes}
        </select>
      </div>

      <div class="campo">
        <label>Como combinar?</label>
        <div class="grupo-opcoes duas-colunas">
          <label class="cartao-opcao">
            <input type="radio" name="modo" value="parcelas_combinadas" checked>
            Parcelas combinadas
            <span class="descricao">Você diz o valor de cada parcela</span>
          </label>
          <label class="cartao-opcao">
            <input type="radio" name="modo" value="juros_mensal">
            Juros ao mês
            <span class="descricao">O app calcula a parcela</span>
          </label>
        </div>
      </div>

      <div class="campo">
        <label for="campo-valor">Valor emprestado</label>
        <input id="campo-valor" type="text" placeholder="R$ 0,00">
      </div>

      <div class="campo">
        <label for="campo-data">Data do empréstimo</label>
        <input id="campo-data" type="date" value="${hoje}">
      </div>

      <div class="campo" id="area-taxa" hidden>
        <label for="campo-taxa">Juros ao mês (%)</label>
        <input id="campo-taxa" type="number" inputmode="decimal" min="0" step="0.5" placeholder="Ex.: 5">
        <p class="dica">Juros simples sobre o valor emprestado, pelo tempo do carnê.</p>
      </div>

      <div class="campo">
        <label for="campo-parcelas">Quantas parcelas?</label>
        <input id="campo-parcelas" type="number" inputmode="numeric" min="1" max="120" step="1" placeholder="Ex.: 12">
      </div>

      <div class="campo" id="area-valor-parcela">
        <label for="campo-valor-parcela">Valor de cada parcela</label>
        <input id="campo-valor-parcela" type="text" placeholder="R$ 0,00">
      </div>

      <div class="campo">
        <label for="campo-periodicidade">De quanto em quanto tempo?</label>
        <select id="campo-periodicidade">
          <option value="mensal" selected>Todo mês</option>
          <option value="quinzenal">A cada 15 dias</option>
          <option value="semanal">Toda semana</option>
        </select>
      </div>

      <div class="campo">
        <label for="campo-primeiro">Primeira parcela vence em</label>
        <input id="campo-primeiro" type="date" value="${somarMeses(hoje, 1)}">
      </div>

      <div class="campo">
        <label for="campo-observacoes">Observações</label>
        <textarea id="campo-observacoes" placeholder="Qualquer anotação sua…"></textarea>
      </div>

      <div class="resumo-caixa" id="caixa-resumo"></div>

      <div class="aviso-erro escondido" id="erro-emprestimo" role="alert"></div>
      <button class="botao botao-primario" type="submit">Conferir parcelas e salvar</button>
    </form>
  `;

  const campoCliente = el.querySelector('#campo-cliente');
  const campoValor = el.querySelector('#campo-valor');
  const campoData = el.querySelector('#campo-data');
  const campoTaxa = el.querySelector('#campo-taxa');
  const campoParcelas = el.querySelector('#campo-parcelas');
  const campoValorParcela = el.querySelector('#campo-valor-parcela');
  const campoPeriodicidade = el.querySelector('#campo-periodicidade');
  const campoPrimeiro = el.querySelector('#campo-primeiro');
  const caixaResumo = el.querySelector('#caixa-resumo');
  const caixaErro = el.querySelector('#erro-emprestimo');

  ativarCampoMoeda(campoValor);
  ativarCampoMoeda(campoValorParcela);

  el.querySelector('#botao-voltar').addEventListener('click', () => history.back());

  // ---------- Modo ----------

  const modoAtual = () => el.querySelector('input[name="modo"]:checked').value;

  const aplicarModo = () => {
    const juros = modoAtual() === 'juros_mensal';
    el.querySelector('#area-taxa').hidden = !juros;
    el.querySelector('#area-valor-parcela').hidden = juros;
    atualizarResumo();
  };
  el.querySelectorAll('input[name="modo"]').forEach((radio) => radio.addEventListener('change', aplicarModo));

  // ---------- Primeira parcela sugerida ----------
  // Sugere a data conforme a periodicidade; se a pessoa mexer
  // no campo, a sugestão para de interferir.

  let primeiroFoiEditado = false;
  campoPrimeiro.addEventListener('input', () => { primeiroFoiEditado = true; });

  const sugerirPrimeiroVencimento = () => {
    if (primeiroFoiEditado) return;
    const base = ehISOValido(campoData.value) ? campoData.value : hoje;
    const p = campoPeriodicidade.value;
    campoPrimeiro.value = p === 'mensal' ? somarMeses(base, 1) : somarDias(base, p === 'quinzenal' ? 15 : 7);
  };
  campoData.addEventListener('input', () => { sugerirPrimeiroVencimento(); atualizarResumo(); });
  campoPeriodicidade.addEventListener('input', () => { sugerirPrimeiroVencimento(); atualizarResumo(); });

  // ---------- Resumo ao vivo ----------

  const entradaAtual = () => ({
    modo: modoAtual(),
    valorEmprestadoCentavos: lerCentavos(campoValor),
    numParcelas: parseInt(campoParcelas.value, 10) || 0,
    valorParcelaCentavos: lerCentavos(campoValorParcela),
    taxaMensal: parseFloat(String(campoTaxa.value).replace(',', '.')) || 0,
    periodicidade: campoPeriodicidade.value,
  });

  const atualizarResumo = () => {
    const entrada = entradaAtual();
    const pronto = entrada.valorEmprestadoCentavos > 0 && entrada.numParcelas >= 1 &&
      (entrada.modo === 'juros_mensal' ? entrada.taxaMensal >= 0 && campoTaxa.value !== '' : entrada.valorParcelaCentavos > 0);
    if (!pronto) {
      caixaResumo.innerHTML = '<p class="subtexto">Preencha os campos acima para ver o total a receber.</p>';
      return;
    }
    const resumo = calc.resumoNovoEmprestimo(entrada);
    caixaResumo.innerHTML = `
      ${entrada.modo === 'juros_mensal' ? `
        <div class="linha-info"><span class="rotulo">Valor de cada parcela</span>
          <span class="valor">${fmtMoeda(resumo.valorParcelaBaseCentavos)}</span></div>` : ''}
      <div class="linha-info"><span class="rotulo">Total a receber</span>
        <span class="valor">${fmtMoeda(resumo.totalCentavos)}</span></div>
      <div class="linha-info"><span class="rotulo">Acréscimo</span>
        <span class="valor">${fmtMoeda(resumo.acrescimoCentavos)} (${fmtPorcentagem(resumo.percentual)})</span></div>
    `;
  };

  [campoValor, campoParcelas, campoValorParcela, campoTaxa].forEach((campo) =>
    campo.addEventListener('input', atualizarResumo)
  );

  aplicarModo();

  // ---------- Conferência e gravação ----------

  const mostrarErro = (mensagem) => {
    caixaErro.textContent = mensagem;
    caixaErro.classList.toggle('escondido', !mensagem);
    if (mensagem) caixaErro.scrollIntoView({ block: 'center' });
  };

  el.querySelector('#form-emprestimo').addEventListener('submit', (evento) => {
    evento.preventDefault();
    mostrarErro('');

    const entrada = entradaAtual();
    if (!campoCliente.value) return mostrarErro('Escolha para quem é o empréstimo.');
    if (entrada.valorEmprestadoCentavos <= 0) return mostrarErro('Digite o valor emprestado.');
    if (!ehISOValido(campoData.value)) return mostrarErro('Confira a data do empréstimo.');
    if (entrada.numParcelas < 1) return mostrarErro('Digite quantas parcelas serão.');
    if (entrada.numParcelas > 120) return mostrarErro('O máximo é 120 parcelas.');
    if (entrada.modo === 'parcelas_combinadas' && entrada.valorParcelaCentavos <= 0) {
      return mostrarErro('Digite o valor de cada parcela.');
    }
    if (entrada.modo === 'juros_mensal' && campoTaxa.value === '') {
      return mostrarErro('Digite os juros ao mês (pode ser 0).');
    }
    if (!ehISOValido(campoPrimeiro.value)) return mostrarErro('Confira a data da primeira parcela.');

    const resumo = calc.resumoNovoEmprestimo(entrada);
    const parcelas = calc.gerarParcelas({
      valores: resumo.valores,
      periodicidade: entrada.periodicidade,
      primeiroVencimento: campoPrimeiro.value,
    });

    abrirConferencia({ entrada, resumo, parcelas });
  });

  function abrirConferencia({ entrada, resumo, parcelas }) {
    const cliente = dados.obterCliente(campoCliente.value);
    const linhas = parcelas.map((p) => `
      <tr>
        <td>${p.numero}ª</td>
        <td>${fmtData(p.vencimento)}</td>
        <td class="num">${fmtMoeda(p.valor)}</td>
      </tr>`).join('');

    const { el: modal, fechar } = abrirModal(`
      <h2 class="titulo-modal">Confira antes de salvar</h2>
      <p style="margin-bottom:0.8rem"><strong>${esc(cliente?.nome || '')}</strong> ·
        ${fmtMoeda(entrada.valorEmprestadoCentavos)} emprestado ·
        total a receber <strong>${fmtMoeda(resumo.totalCentavos)}</strong></p>
      <div class="cartao"><div class="rolagem-horizontal">
        <table class="tabela">
          <thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div></div>
      <div class="espaco-cima">
        <button class="botao botao-primario" data-acao="salvar">Está certo, pedir assinatura</button>
        <button class="botao botao-neutro" data-acao="ajustar">Voltar e ajustar</button>
      </div>
    `);

    modal.querySelector('[data-acao="ajustar"]').addEventListener('click', fechar);
    modal.querySelector('[data-acao="salvar"]').addEventListener('click', async () => {
      fechar();

      // Passo da assinatura: o celular vai para a mão de quem
      // está pegando o dinheiro, como no caderno de papel.
      const assinatura = await coletarAssinatura({ nome: cliente.nome });
      if (assinatura.acao === 'cancelou') {
        toast('O empréstimo ainda não foi salvo.');
        return;
      }

      const emprestimoNovo = {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        valorEmprestadoCentavos: entrada.valorEmprestadoCentavos,
        dataEmprestimo: campoData.value,
        modo: entrada.modo,
        taxaMensal: entrada.taxaMensal,
        periodicidade: entrada.periodicidade,
        primeiroVencimento: campoPrimeiro.value,
        observacoes: el.querySelector('#campo-observacoes').value.trim(),
        valores: resumo.valores,
        totalCentavos: resumo.totalCentavos,
        valorParcelaBaseCentavos: resumo.valorParcelaBaseCentavos,
        assinaturaBase64: assinatura.imagemBase64 || null,
      };

      const id = dados.criarEmprestimo(emprestimoNovo);
      toast('Empréstimo salvo ✓');

      if (assinatura.acao === 'assinou') {
        // Mostra o comprovante na hora, para mandar no WhatsApp.
        await mostrarComprovanteEmprestimo({
          emprestimo: {
            id,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            valorEmprestado: entrada.valorEmprestadoCentavos,
            dataEmprestimo: campoData.value,
            numParcelas: parcelas.length,
            valorParcela: resumo.valorParcelaBaseCentavos,
            periodicidade: entrada.periodicidade,
            primeiroVencimento: campoPrimeiro.value,
            totalAReceber: resumo.totalCentavos,
          },
          assinaturaBase64: assinatura.imagemBase64,
          aoFechar: () => { location.hash = '#/emprestimo/' + id; },
        });
      } else {
        location.hash = '#/emprestimo/' + id;
      }
    });
  }
}
