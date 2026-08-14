// ============================================================
// assinatura.js — colhe a assinatura de quem está pegando o
// dinheiro emprestado, desenhada com o dedo na tela do celular.
//
// O desenho é guardado como uma lista de traços (pontos), e só
// no fim vira uma imagem recortada bem certinha no tamanho da
// assinatura. Por ser um desenho de linhas, a imagem fica bem
// leve — muito menor que uma foto.
// ============================================================

import { esc, abrirModal } from './util.js';

const COR_TINTA = '#12160F';
const ESPESSURA = 2.6;
const LARGURA_SAIDA = 760; // largura da imagem final, em pontos

// Abre a folha de assinatura. Devolve:
//   { acao: 'assinou', imagemBase64 }  — assinou e confirmou
//   { acao: 'sem' }                    — quis salvar sem assinatura
//   { acao: 'cancelou' }               — desistiu (nada deve ser salvo)
export function coletarAssinatura({ nome = '', textoPular = 'Salvar sem assinatura' } = {}) {
  return new Promise((resolver) => {
    const { el, fechar } = abrirModal(`
      <h2 class="titulo-modal">Assinatura de quem recebeu</h2>
      <p class="subtexto" style="margin-bottom:0.8rem">
        Passe o celular para <strong>${esc(nome)}</strong> assinar com o dedo no quadro abaixo.
      </p>
      <div class="quadro-assinatura">
        <canvas id="tela-assinatura"></canvas>
        <div class="linha-guia"></div>
        <div class="dica-assinatura">assine em cima da linha</div>
      </div>
      <div class="linha-botoes espaco-cima">
        <button class="botao botao-neutro" data-acao="limpar">Limpar</button>
        <button class="botao botao-primario" data-acao="confirmar" disabled>Confirmar</button>
      </div>
      <button class="botao botao-linha" data-acao="pular" style="width:100%">${esc(textoPular)}</button>
    `, { aoFechar: () => resolver({ acao: 'cancelou' }) });

    const canvas = el.querySelector('#tela-assinatura');
    const ctx = canvas.getContext('2d');
    const botaoConfirmar = el.querySelector('[data-acao="confirmar"]');

    const tracos = [];
    let tracoAtual = null;

    // ---------- Preparo do quadro ----------

    function ajustarTamanho() {
      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      if (!largura || !altura) return;
      const densidade = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(largura * densidade);
      canvas.height = Math.round(altura * densidade);
      ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
      prepararTinta(ctx);
      redesenhar();
    }

    function prepararTinta(contexto) {
      contexto.lineWidth = ESPESSURA;
      contexto.lineCap = 'round';
      contexto.lineJoin = 'round';
      contexto.strokeStyle = COR_TINTA;
    }

    function redesenhar() {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (const traco of tracos) desenharTraco(ctx, traco);
    }

    ajustarTamanho();
    // Se a pessoa virar o celular, o quadro se ajusta sem perder o desenho.
    const aoRedimensionar = () => ajustarTamanho();
    window.addEventListener('resize', aoRedimensionar);

    // ---------- Desenho com o dedo ----------

    const pontoDoEvento = (evento) => {
      const area = canvas.getBoundingClientRect();
      return { x: evento.clientX - area.left, y: evento.clientY - area.top };
    };

    canvas.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      try { canvas.setPointerCapture(evento.pointerId); } catch {}
      tracoAtual = [pontoDoEvento(evento)];
      tracos.push(tracoAtual);
      desenharTraco(ctx, tracoAtual); // marca o pontinho inicial
      botaoConfirmar.disabled = false;
    });

    canvas.addEventListener('pointermove', (evento) => {
      if (!tracoAtual) return;
      evento.preventDefault();
      const ponto = pontoDoEvento(evento);
      const anterior = tracoAtual[tracoAtual.length - 1];
      tracoAtual.push(ponto);
      // Desenha só o pedacinho novo: fica leve mesmo em celular simples.
      ctx.beginPath();
      ctx.moveTo(anterior.x, anterior.y);
      ctx.lineTo(ponto.x, ponto.y);
      ctx.stroke();
    });

    const encerrarTraco = () => { tracoAtual = null; };
    canvas.addEventListener('pointerup', encerrarTraco);
    canvas.addEventListener('pointercancel', encerrarTraco);
    canvas.addEventListener('pointerleave', encerrarTraco);

    // ---------- Botões ----------

    el.querySelector('[data-acao="limpar"]').addEventListener('click', () => {
      tracos.length = 0;
      tracoAtual = null;
      redesenhar();
      botaoConfirmar.disabled = true;
    });

    botaoConfirmar.addEventListener('click', () => {
      const imagemBase64 = gerarImagem(tracos);
      if (!imagemBase64) return;
      resolver({ acao: 'assinou', imagemBase64 });
      limpar();
      fechar();
    });

    el.querySelector('[data-acao="pular"]').addEventListener('click', () => {
      resolver({ acao: 'sem' });
      limpar();
      fechar();
    });

    function limpar() {
      window.removeEventListener('resize', aoRedimensionar);
    }
  });
}

function desenharTraco(contexto, traco) {
  if (!traco.length) return;
  contexto.beginPath();
  contexto.moveTo(traco[0].x, traco[0].y);
  if (traco.length === 1) {
    // Um toque só: desenha um pontinho.
    contexto.lineTo(traco[0].x + 0.1, traco[0].y);
  } else {
    for (let i = 1; i < traco.length; i += 1) contexto.lineTo(traco[i].x, traco[i].y);
  }
  contexto.stroke();
}

// Recorta a assinatura no tamanho exato do desenho e devolve a imagem.
function gerarImagem(tracos) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const traco of tracos) {
    for (const ponto of traco) {
      if (ponto.x < minX) minX = ponto.x;
      if (ponto.y < minY) minY = ponto.y;
      if (ponto.x > maxX) maxX = ponto.x;
      if (ponto.y > maxY) maxY = ponto.y;
    }
  }
  if (!Number.isFinite(minX)) return null;

  const margem = ESPESSURA * 3;
  const largura = (maxX - minX) + margem * 2;
  const altura = (maxY - minY) + margem * 2;
  const escala = Math.min(3, Math.max(1, LARGURA_SAIDA / largura));

  const saida = document.createElement('canvas');
  saida.width = Math.round(largura * escala);
  saida.height = Math.round(altura * escala);
  const contexto = saida.getContext('2d');
  contexto.fillStyle = '#FFFFFF';
  contexto.fillRect(0, 0, saida.width, saida.height);
  contexto.setTransform(escala, 0, 0, escala, -(minX - margem) * escala, -(minY - margem) * escala);
  contexto.lineWidth = ESPESSURA;
  contexto.lineCap = 'round';
  contexto.lineJoin = 'round';
  contexto.strokeStyle = COR_TINTA;
  for (const traco of tracos) desenharTraco(contexto, traco);

  return saida.toDataURL('image/png');
}
