// ============================================================
// telas/inicio.js — painel principal:
// 4 cartões (Na rua, Recebido no mês, Em atraso, Vence em 7 dias)
// e as listas de atrasados e próximos vencimentos.
// ============================================================

import * as dados from '../dados.js';
import {
  esc, fmtMoeda, fmtData, hojeISO, nomeDoMes,
  linkWhatsApp, mensagemCobranca,
} from '../util.js';

export function render(el) {
  const desenhar = () => {
    if (!dados.estado.carregouEmprestimos) {
      el.innerHTML = '<p class="carregando-area">Abrindo a caderneta…</p>';
      return;
    }

    const resumo = dados.resumoPainel();
    const hoje = hojeISO();

    el.innerHTML = `
      <h1 class="titulo-tela">Início</h1>
      <div class="grade-painel">
        <div class="cartao-painel">
          <div class="rotulo">Na rua</div>
          <div class="numero">${fmtMoeda(resumo.naRuaCentavos)}</div>
          <div class="detalhe">falta receber</div>
        </div>
        <div class="cartao-painel tom-recebido">
          <div class="rotulo">Recebido em ${esc(nomeDoMes(hoje))}</div>
          <div class="numero">${fmtMoeda(resumo.recebidoMesCentavos)}</div>
          <div class="detalhe">neste mês</div>
        </div>
        <div class="cartao-painel tom-atraso">
          <div class="rotulo">Em atraso</div>
          <div class="numero">${fmtMoeda(resumo.emAtrasoCentavos)}</div>
          <div class="detalhe">${resumo.emAtrasoQtd === 1 ? '1 parcela' : `${resumo.emAtrasoQtd} parcelas`}</div>
        </div>
        <div class="cartao-painel">
          <div class="rotulo">Vence em 7 dias</div>
          <div class="numero">${fmtMoeda(resumo.proximos7Centavos)}</div>
          <div class="detalhe">${resumo.proximos7Qtd === 1 ? '1 parcela' : `${resumo.proximos7Qtd} parcelas`}</div>
        </div>
      </div>

      <h2 class="titulo-secao">Atrasados</h2>
      ${listaAtrasados(resumo.atrasadas)}

      <h2 class="titulo-secao">Próximos vencimentos</h2>
      ${listaProximos(resumo.proximas, hoje)}
    `;

    // Toques nos itens abrem o empréstimo (Enter e espaço também,
    // porque aqui o item é um div, não um botão de verdade).
    el.querySelectorAll('[data-emprestimo]').forEach((item) => {
      const abrir = () => {
        location.hash = '#/emprestimo/' + item.dataset.emprestimo;
      };
      item.addEventListener('click', abrir);
      item.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          abrir();
        }
      });
    });
    // O botão do WhatsApp não deve abrir o empréstimo junto.
    el.querySelectorAll('a[data-whatsapp]').forEach((botao) => {
      botao.addEventListener('click', (evento) => evento.stopPropagation());
    });
  };

  desenhar();
  document.addEventListener('dados-mudaram', desenhar);
  return () => document.removeEventListener('dados-mudaram', desenhar);
}

function listaAtrasados(atrasadas) {
  if (!atrasadas.length) {
    return '<div class="cartao"><p class="vazio">Ninguém em atraso. 👍</p></div>';
  }
  const itens = atrasadas.map((item) => {
    const cliente = dados.obterCliente(item.emprestimo.clienteId);
    const telefone = cliente?.telefone || '';
    const mensagem = mensagemCobranca({
      nome: primeiroNome(item.emprestimo.clienteNome),
      numeroParcela: item.parcela.numero,
      valorCentavos: item.restanteCentavos,
      vencimentoISO: item.parcela.vencimento,
    });
    return `
      <li>
        <div class="item-lista" data-emprestimo="${esc(item.emprestimo.id)}" role="button" tabindex="0">
          <div class="meio">
            <div class="titulo">${esc(item.emprestimo.clienteNome)}</div>
            <div class="linha2">Parcela ${item.parcela.numero} · ${textoAtraso(item.diasAtraso)}</div>
          </div>
          <div class="direita">
            ${fmtMoeda(item.restanteCentavos)}
            ${telefone ? `<div class="linha2"><a class="botao botao-whatsapp botao-pequeno" data-whatsapp
              href="${esc(linkWhatsApp(telefone, mensagem))}" target="_blank" rel="noopener">${iconeWhatsApp()} Cobrar</a></div>` : ''}
          </div>
        </div>
      </li>`;
  }).join('');
  return `<div class="cartao"><ul class="lista">${itens}</ul></div>`;
}

function listaProximos(proximas, hoje) {
  if (!proximas.length) {
    return '<div class="cartao"><p class="vazio">Nada vence nos próximos 7 dias.</p></div>';
  }
  const itens = proximas.map((item) => `
      <li>
        <div class="item-lista" data-emprestimo="${esc(item.emprestimo.id)}" role="button" tabindex="0">
          <div class="meio">
            <div class="titulo">${esc(item.emprestimo.clienteNome)}</div>
            <div class="linha2">Parcela ${item.parcela.numero} · ${textoVencimento(item.parcela.vencimento, hoje)}</div>
          </div>
          <div class="direita">${fmtMoeda(item.restanteCentavos)}</div>
          <span class="seta">›</span>
        </div>
      </li>`).join('');
  return `<div class="cartao"><ul class="lista">${itens}</ul></div>`;
}

function textoAtraso(dias) {
  if (dias <= 1) return 'venceu ontem';
  return `${dias} dias de atraso`;
}

function textoVencimento(vencimentoISO, hoje) {
  if (vencimentoISO === hoje) return 'vence hoje';
  const amanha = fmtData(vencimentoISO);
  return `vence em ${amanha}`;
}

function primeiroNome(nomeCompleto) {
  return String(nomeCompleto || '').trim().split(/\s+/)[0] || '';
}

function iconeWhatsApp() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Zm-3 4.3c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2-.1-.4.1-.5l.6-.8c.1-.2.1-.4 0-.6l-.8-1.9c-.1-.3-.3-.4-.6-.4Z"/>
  </svg>`;
}
