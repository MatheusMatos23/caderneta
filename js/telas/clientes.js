// ============================================================
// telas/clientes.js — lista de clientes com busca por nome ou
// apelido e o saldo devedor de cada um.
// ============================================================

import * as dados from '../dados.js';
import { esc, fmtMoeda, fmtTelefone, normalizar } from '../util.js';

export function render(el) {
  // A moldura (título, busca, botão) é montada uma vez só; a lista
  // é redesenhada quando os dados mudam — assim a busca não perde o foco.
  el.innerHTML = `
    <h1 class="titulo-tela">Clientes</h1>
    <div class="campo">
      <label for="campo-busca" class="escondido">Buscar cliente</label>
      <input id="campo-busca" type="search" placeholder="Buscar por nome ou apelido…" autocomplete="off">
    </div>
    <button class="botao botao-primario" id="botao-novo-cliente">+ Novo cliente</button>
    <div class="espaco-cima" id="area-lista"></div>
  `;

  const campoBusca = el.querySelector('#campo-busca');
  const areaLista = el.querySelector('#area-lista');

  const desenharLista = () => {
    if (!dados.estado.carregouClientes) {
      areaLista.innerHTML = '<p class="carregando-area">Carregando…</p>';
      return;
    }

    const saldos = dados.saldoPorCliente();
    const filtro = normalizar(campoBusca.value.trim());
    const lista = dados.estado.clientes.filter((c) =>
      !filtro || normalizar(`${c.nome} ${c.apelido || ''}`).includes(filtro)
    );

    if (!lista.length) {
      areaLista.innerHTML = `<div class="cartao"><p class="vazio">${
        filtro
          ? 'Nenhum cliente encontrado com esse nome.'
          : 'Nenhum cliente ainda.<br>Toque em <strong>+ Novo cliente</strong> para começar.'
      }</p></div>`;
      return;
    }

    const itens = lista.map((cliente) => {
      const saldo = saldos.get(cliente.id) || 0;
      return `
        <li>
          <button class="item-lista" data-cliente="${esc(cliente.id)}">
            <div class="meio">
              <div class="titulo">${esc(cliente.nome)}${cliente.apelido ? ` <span class="subtexto">(${esc(cliente.apelido)})</span>` : ''}</div>
              <div class="linha2">${cliente.telefone ? esc(fmtTelefone(cliente.telefone)) : 'sem telefone'}</div>
            </div>
            <div class="direita">
              ${saldo > 0 ? fmtMoeda(saldo) : '<span class="chip chip-paga">Em dia</span>'}
              ${saldo > 0 ? '<div class="linha2">deve</div>' : ''}
            </div>
            <span class="seta">›</span>
          </button>
        </li>`;
    }).join('');

    areaLista.innerHTML = `<div class="cartao"><ul class="lista">${itens}</ul></div>`;
    areaLista.querySelectorAll('[data-cliente]').forEach((item) => {
      item.addEventListener('click', () => {
        location.hash = '#/cliente/' + item.dataset.cliente;
      });
    });
  };

  campoBusca.addEventListener('input', desenharLista);
  el.querySelector('#botao-novo-cliente').addEventListener('click', () => {
    location.hash = '#/clientes/novo';
  });

  desenharLista();
  document.addEventListener('dados-mudaram', desenharLista);
  return () => document.removeEventListener('dados-mudaram', desenharLista);
}
