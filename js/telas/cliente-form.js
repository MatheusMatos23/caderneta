// ============================================================
// telas/cliente-form.js — cadastro e edição de cliente.
// ============================================================

import * as dados from '../dados.js';
import { esc, toast, ativarCampoTelefone, lerTelefone, somenteDigitos } from '../util.js';

export function render(el, { id = null } = {}) {
  const editando = !!id;
  const cliente = editando ? dados.obterCliente(id) : null;

  // Ao abrir direto no endereço de edição (ou recarregar a página),
  // os clientes podem ainda não ter chegado — espera antes de decidir.
  if (editando && !cliente && !dados.estado.carregouClientes) {
    el.innerHTML = '<p class="carregando-area">Carregando…</p>';
    const aoCarregar = () => {
      if (dados.estado.carregouClientes) {
        document.removeEventListener('dados-mudaram', aoCarregar);
        render(el, { id });
      }
    };
    document.addEventListener('dados-mudaram', aoCarregar);
    return () => document.removeEventListener('dados-mudaram', aoCarregar);
  }

  if (editando && !cliente) {
    el.innerHTML = '<p class="carregando-area">Cliente não encontrado.</p>';
    return;
  }

  el.innerHTML = `
    <div class="cabecalho-tela">
      <button class="botao-voltar" id="botao-voltar" aria-label="Voltar">‹</button>
      <h1 class="titulo-tela" style="margin:0">${editando ? 'Editar cliente' : 'Novo cliente'}</h1>
    </div>
    <form id="form-cliente" novalidate>
      <div class="campo">
        <label for="campo-nome">Nome completo *</label>
        <input id="campo-nome" type="text" autocomplete="off" value="${esc(cliente?.nome || '')}">
      </div>
      <div class="campo">
        <label for="campo-apelido">Apelido</label>
        <input id="campo-apelido" type="text" autocomplete="off" value="${esc(cliente?.apelido || '')}">
        <p class="dica">Como a pessoa é conhecida (ajuda na busca).</p>
      </div>
      <div class="campo">
        <label for="campo-telefone">Telefone com DDD</label>
        <input id="campo-telefone" type="tel" placeholder="(11) 98888-7777">
        <p class="dica">Usado para ligar e mandar WhatsApp direto do app.</p>
      </div>
      <div class="campo">
        <label for="campo-cpf">CPF (se quiser guardar)</label>
        <input id="campo-cpf" type="text" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00">
      </div>
      <div class="campo">
        <label for="campo-endereco">Endereço (se quiser guardar)</label>
        <input id="campo-endereco" type="text" autocomplete="off" value="${esc(cliente?.endereco || '')}">
      </div>
      <div class="campo">
        <label for="campo-observacoes">Observações</label>
        <textarea id="campo-observacoes">${esc(cliente?.observacoes || '')}</textarea>
      </div>
      <div class="aviso-erro escondido" id="erro-cliente" role="alert"></div>
      <button class="botao botao-primario" type="submit">${editando ? 'Salvar alterações' : 'Salvar cliente'}</button>
    </form>
  `;

  const campoTelefone = el.querySelector('#campo-telefone');
  ativarCampoTelefone(campoTelefone, cliente?.telefone || '');

  const campoCpf = el.querySelector('#campo-cpf');
  const aplicarCpf = () => {
    const d = somenteDigitos(campoCpf.value).slice(0, 11);
    let texto = d;
    if (d.length > 9) texto = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    else if (d.length > 6) texto = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    else if (d.length > 3) texto = `${d.slice(0, 3)}.${d.slice(3)}`;
    campoCpf.value = texto;
    campoCpf.dataset.digitos = d;
  };
  campoCpf.addEventListener('input', aplicarCpf);
  campoCpf.value = cliente?.cpf || '';
  aplicarCpf();

  const caixaErro = el.querySelector('#erro-cliente');
  const mostrarErro = (mensagem) => {
    caixaErro.textContent = mensagem;
    caixaErro.classList.toggle('escondido', !mensagem);
    if (mensagem) caixaErro.scrollIntoView({ block: 'center' });
  };

  el.querySelector('#botao-voltar').addEventListener('click', () => history.back());

  el.querySelector('#form-cliente').addEventListener('submit', (evento) => {
    evento.preventDefault();
    mostrarErro('');

    const nome = el.querySelector('#campo-nome').value.trim();
    if (!nome) {
      mostrarErro('O nome do cliente é obrigatório.');
      return;
    }
    const telefone = lerTelefone(campoTelefone);
    if (telefone && telefone.length < 10) {
      mostrarErro('O telefone precisa ter o DDD e o número. Exemplo: (11) 98888-7777.');
      return;
    }

    const registro = {
      nome,
      apelido: el.querySelector('#campo-apelido').value.trim(),
      telefone,
      cpf: campoCpf.dataset.digitos || '',
      endereco: el.querySelector('#campo-endereco').value.trim(),
      observacoes: el.querySelector('#campo-observacoes').value.trim(),
    };

    const idSalvo = dados.salvarCliente(registro, id);
    toast('Cliente salvo ✓');
    location.hash = '#/cliente/' + idSalvo;
  });
}
