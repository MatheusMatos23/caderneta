// ============================================================
// comprovante.js — fotos de comprovante.
// A foto é diminuída no próprio celular (no máximo 1000 px no
// maior lado, JPEG) até ficar bem leve, e guardada como texto
// base64 num documento próprio da coleção "comprovantes".
// Assim não usamos o Firebase Storage (que pode ser pago) e não
// estouramos o limite de 1 MB por documento do Firestore.
// ============================================================

import { baixarDataURL } from './util.js';

// Tamanho alvo do texto base64 (~199 KB, abaixo dos 200 KB combinados).
const TAMANHO_ALVO = 266000;
// Limite duro de segurança (~500 KB), bem abaixo de 1 MB por documento.
const TAMANHO_MAXIMO = 700000;

export async function comprimirParaBase64(arquivo) {
  const imagem = await carregarImagem(arquivo);

  // Tenta do maior/melhor para o menor, até ficar leve o bastante.
  const tentativas = [
    [1000, 0.7],
    [1000, 0.6],
    [1000, 0.5],
    [800, 0.5],
    [640, 0.45],
    [480, 0.4],
  ];

  let resultado = null;
  for (const [ladoMaximo, qualidade] of tentativas) {
    resultado = desenhar(imagem, ladoMaximo, qualidade);
    if (resultado.length <= TAMANHO_ALVO) break;
  }

  if (!resultado || resultado.length > TAMANHO_MAXIMO) {
    throw new Error('A foto ficou pesada demais. Tente tirar outra foto, um pouco mais de longe.');
  }
  return resultado;
}

async function carregarImagem(arquivo) {
  // createImageBitmap já corrige fotos tiradas com o celular "de lado".
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch (erro) {
      // segue para o caminho alternativo
    }
  }
  return await new Promise((certo, errado) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => { URL.revokeObjectURL(url); certo(imagem); };
    imagem.onerror = () => { URL.revokeObjectURL(url); errado(new Error('Não foi possível ler a foto.')); };
    imagem.src = url;
  });
}

function desenhar(imagem, ladoMaximo, qualidade) {
  const larguraOriginal = imagem.width || imagem.naturalWidth;
  const alturaOriginal = imagem.height || imagem.naturalHeight;
  const escala = Math.min(1, ladoMaximo / Math.max(larguraOriginal, alturaOriginal));
  const largura = Math.max(1, Math.round(larguraOriginal * escala));
  const altura = Math.max(1, Math.round(alturaOriginal * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext('2d');
  contexto.fillStyle = '#FFFFFF'; // JPEG não tem transparência
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return canvas.toDataURL('image/jpeg', qualidade);
}

// Mostra o comprovante em tela cheia, com opções de baixar
// (e de excluir, quando permitido).
export function mostrarComprovante({ imagemBase64, nomeArquivo = 'comprovante.jpg', aoExcluir = null }) {
  const fundo = document.createElement('div');
  fundo.className = 'visualizador';

  const foto = document.createElement('img');
  foto.alt = 'Comprovante de pagamento';
  foto.src = imagemBase64;
  fundo.appendChild(foto);

  const acoes = document.createElement('div');
  acoes.className = 'acoes';

  const botaoBaixar = document.createElement('button');
  botaoBaixar.className = 'botao botao-neutro';
  botaoBaixar.textContent = 'Baixar foto';
  botaoBaixar.addEventListener('click', () => baixarDataURL(nomeArquivo, imagemBase64));
  acoes.appendChild(botaoBaixar);

  if (aoExcluir) {
    const botaoExcluir = document.createElement('button');
    botaoExcluir.className = 'botao botao-perigo-claro';
    botaoExcluir.textContent = 'Excluir';
    botaoExcluir.addEventListener('click', async () => {
      fundo.remove();
      aoExcluir();
    });
    acoes.appendChild(botaoExcluir);
  }

  fundo.appendChild(acoes);

  const botaoFechar = document.createElement('button');
  botaoFechar.className = 'botao botao-secundario';
  botaoFechar.style.maxWidth = '24rem';
  botaoFechar.textContent = 'Fechar';
  botaoFechar.addEventListener('click', () => fundo.remove());
  fundo.appendChild(botaoFechar);

  document.body.appendChild(fundo);
}
