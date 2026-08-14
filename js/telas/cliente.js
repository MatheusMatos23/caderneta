// ============================================================
// telas/cliente.js — ficha do cliente: dados, atalhos de
// contato, total devido, empréstimos ativos e histórico.
// ============================================================

import * as dados from '../dados.js';
import * as calc from '../calculos.js';
import {
  esc, fmtMoeda, fmtData, fmtTelefone,
  linkWhatsApp, linkLigar, toast, confirmarExclusao,
} from '../util.js';

export function render(el, { id }) {
  const desenhar = () => {
    const cliente = dados.obterCliente(id);
    if (!cliente) {
      el.innerHTML = dados.estado.carregouClientes
        ? '<p class="carregando-area">Cliente não encontrado.</p>'
        : '<p class="carregando-area">Carregando…</p>';
      return;
    }

    const totalDevido = dados.saldoPorCliente().get(id) || 0;
    const doCliente = dados.estado.emprestimos
      .filter((e) => e.clienteId === id)
      .sort((a, b) => String(b.dataEmprestimo || '').localeCompare(String(a.dataEmprestimo || '')));
    const ativos = doCliente.filter((e) => e.status === 'ativo');
    const historico = doCliente.filter((e) => e.status !== 'ativo');

    el.innerHTML = `
      <div class="cabecalho-tela">
        <button class="botao-voltar" id="botao-voltar" aria-label="Voltar">‹</button>
        <div>
          <h1 class="titulo-tela" style="margin:0">${esc(cliente.nome)}</h1>
          ${cliente.apelido ? `<p class="subtexto">${esc(cliente.apelido)}</p>` : ''}
        </div>
      </div>

      <div class="bloco-destaque">
        <div class="rotulo">Total devido</div>
        <div class="numero">${fmtMoeda(totalDevido)}</div>
      </div>

      ${cliente.telefone ? `
        <div class="atalhos-contato">
          <a class="botao botao-neutro" href="${esc(linkLigar(cliente.telefone))}">📞 Ligar</a>
          <a class="botao botao-whatsapp" href="${esc(linkWhatsApp(cliente.telefone, ''))}" target="_blank" rel="noopener">WhatsApp</a>
        </div>` : ''}

      <div class="cartao"><div class="cartao-conteudo">
        ${linhaInfo('Telefone', cliente.telefone ? fmtTelefone(cliente.telefone) : '')}
        ${linhaInfo('CPF', fmtCpf(cliente.cpf))}
        ${linhaInfo('Endereço', cliente.endereco)}
        ${linhaInfo('Observações', cliente.observacoes)}
      </div></div>

      <button class="botao botao-primario espaco-cima" id="botao-novo-emprestimo">+ Novo empréstimo para este cliente</button>

      <h2 class="titulo-secao">Empréstimos ativos</h2>
      ${listaEmprestimos(ativos, 'Nenhum empréstimo ativo.')}

      ${historico.length ? `
        <h2 class="titulo-secao">Histórico</h2>
        ${listaEmprestimos(historico, '')}` : ''}

      <div class="espaco-cima-2">
        <button class="botao botao-secundario" id="botao-editar">Editar dados do cliente</button>
        <button class="botao botao-perigo-claro" id="botao-excluir">Excluir cliente</button>
      </div>
    `;

    el.querySelector('#botao-voltar').addEventListener('click', () => { location.hash = '#/clientes'; });
    el.querySelector('#botao-novo-emprestimo').addEventListener('click', () => {
      location.hash = '#/emprestimos/novo?cliente=' + encodeURIComponent(id);
    });
    el.querySelector('#botao-editar').addEventListener('click', () => {
      location.hash = `#/cliente/${id}/editar`;
    });
    el.querySelector('#botao-excluir').addEventListener('click', async () => {
      if (dados.clienteTemEmprestimos(id)) {
        toast('Este cliente tem empréstimos na caderneta. Exclua os empréstimos dele primeiro.', 'erro');
        return;
      }
      const confirmou = await confirmarExclusao({
        titulo: 'Excluir este cliente?',
        mensagem: `Os dados de <strong>${esc(cliente.nome)}</strong> serão apagados de vez.`,
      });
      if (!confirmou) return;
      dados.excluirCliente(id);
      toast('Cliente excluído.');
      location.hash = '#/clientes';
    });

    el.querySelectorAll('[data-emprestimo]').forEach((item) => {
      item.addEventListener('click', () => {
        location.hash = '#/emprestimo/' + item.dataset.emprestimo;
      });
    });
  };

  desenhar();
  document.addEventListener('dados-mudaram', desenhar);
  return () => document.removeEventListener('dados-mudaram', desenhar);
}

function listaEmprestimos(lista, textoVazio) {
  if (!lista.length) {
    return textoVazio ? `<div class="cartao"><p class="vazio">${textoVazio}</p></div>` : '';
  }
  const itens = lista.map((emprestimo) => {
    const parcelas = dados.estado.parcelasPorEmprestimo.get(emprestimo.id) || [];
    let linha2 = `${fmtMoeda(emprestimo.valorEmprestado)} emprestado em ${fmtData(emprestimo.dataEmprestimo)}`;
    let direita = '';
    if (emprestimo.status === 'ativo' && parcelas.length) {
      const resumo = calc.resumoEmprestimo(parcelas);
      linha2 = `Pagas ${resumo.pagas} de ${resumo.total} · Falta ${fmtMoeda(resumo.faltaCentavos)}`;
      direita = fmtMoeda(resumo.faltaCentavos);
    } else if (emprestimo.status === 'quitado') {
      direita = '<span class="chip chip-quitado">Quitado</span>';
    } else if (emprestimo.status === 'cancelado') {
      direita = '<span class="chip chip-cancelado">Cancelado</span>';
    }
    return `
      <li>
        <button class="item-lista" data-emprestimo="${esc(emprestimo.id)}">
          <div class="meio">
            <div class="titulo">${fmtMoeda(emprestimo.valorEmprestado)} em ${emprestimo.numParcelas}x</div>
            <div class="linha2">${linha2}</div>
          </div>
          <div class="direita">${direita}</div>
          <span class="seta">›</span>
        </button>
      </li>`;
  }).join('');
  return `<div class="cartao"><ul class="lista">${itens}</ul></div>`;
}

function linhaInfo(rotulo, valor) {
  if (!valor) return '';
  return `<div class="linha-info"><span class="rotulo">${rotulo}</span><span class="valor">${esc(valor)}</span></div>`;
}

function fmtCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
