// ============================================================
// recibo.js — gera a imagem do recibo (canvas de 1080 px de
// largura, fundo branco, letras grandes) e compartilha pelo
// WhatsApp (Web Share) ou baixa a imagem, se não der.
// ============================================================

import { fmtMoeda, fmtData, baixarDataURL } from './util.js';

const LARGURA = 1080;
const ALTURA = 1400;
const COR_TEXTO = '#1E211C';
const COR_SUAVE = '#5A5D55';
const COR_DESTAQUE = '#1E6B3C';

// informacoes = { clienteNome, valorCentavos, textoReferencia,
//                 valorEmprestadoCentavos, dataEmprestimoISO, dataPagamentoISO }
// textoReferencia: "à parcela 4 de 12" ou "às parcelas 4, 5 e 6 de 12".
export function desenharRecibo(informacoes) {
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const c = canvas.getContext('2d');

  // Fundo branco e moldura
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, LARGURA, ALTURA);
  c.strokeStyle = '#D8D7CF';
  c.lineWidth = 6;
  moldura(c, 36, 36, LARGURA - 72, ALTURA - 72, 28);
  c.stroke();

  c.textAlign = 'center';
  c.fillStyle = COR_TEXTO;

  // Título
  c.font = '800 78px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillText('RECIBO', LARGURA / 2, 190);

  // Linha decorativa
  c.strokeStyle = COR_DESTAQUE;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(LARGURA / 2 - 130, 230);
  c.lineTo(LARGURA / 2 + 130, 230);
  c.stroke();

  // Valor em destaque
  c.fillStyle = COR_DESTAQUE;
  c.font = '800 104px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillText(fmtMoeda(informacoes.valorCentavos), LARGURA / 2, 390);

  // Recebi de [cliente]
  c.fillStyle = COR_SUAVE;
  c.font = '400 44px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillText('Recebi de', LARGURA / 2, 500);

  c.fillStyle = COR_TEXTO;
  escreverAjustando(c, informacoes.clienteNome, LARGURA / 2, 578, 900, 62, 800);

  // Referência (a linha encolhe se a lista de parcelas for comprida)
  c.fillStyle = COR_TEXTO;
  escreverAjustando(c, `Referente ${informacoes.textoReferencia}`, LARGURA / 2, 700, 920, 44, 400);
  c.font = '400 44px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillText(
    `do empréstimo de ${fmtMoeda(informacoes.valorEmprestadoCentavos)} feito em ${fmtData(informacoes.dataEmprestimoISO)}`,
    LARGURA / 2,
    765
  );

  // Data do pagamento
  c.font = '700 46px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillText(`Pagamento recebido em ${fmtData(informacoes.dataPagamentoISO)}`, LARGURA / 2, 880);

  // Linha de assinatura
  c.strokeStyle = COR_TEXTO;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(220, 1180);
  c.lineTo(LARGURA - 220, 1180);
  c.stroke();
  c.fillStyle = COR_SUAVE;
  c.font = '400 38px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillText('Assinatura', LARGURA / 2, 1240);

  // Rodapé
  c.font = '400 30px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillStyle = '#9A9D95';
  c.fillText('Gerado pelo aplicativo Caderneta', LARGURA / 2, ALTURA - 80);

  return canvas;
}

// Escreve um texto diminuindo a letra até caber na largura.
function escreverAjustando(c, texto, x, y, larguraMaxima, tamanhoInicial, peso) {
  let tamanho = tamanhoInicial;
  do {
    c.font = `${peso} ${tamanho}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    tamanho -= 4;
  } while (c.measureText(texto).width > larguraMaxima && tamanho > 24);
  c.fillText(texto, x, y);
}

function moldura(c, x, y, largura, altura, raio) {
  c.beginPath();
  c.moveTo(x + raio, y);
  c.arcTo(x + largura, y, x + largura, y + altura, raio);
  c.arcTo(x + largura, y + altura, x, y + altura, raio);
  c.arcTo(x, y + altura, x, y, raio);
  c.arcTo(x, y, x + largura, y, raio);
  c.closePath();
}

// Compartilha a imagem (cai direto no WhatsApp, se instalado).
// Se o aparelho não permitir, baixa o arquivo.
// Devolve 'compartilhado', 'baixado' ou 'cancelado'.
export async function compartilharRecibo(canvas, nomeArquivo) {
  const blob = await new Promise((certo) => canvas.toBlob(certo, 'image/jpeg', 0.92));
  if (blob && navigator.canShare && typeof navigator.share === 'function') {
    const arquivo = new File([blob], nomeArquivo, { type: 'image/jpeg' });
    if (navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Recibo' });
        return 'compartilhado';
      } catch (erro) {
        if (erro && erro.name === 'AbortError') return 'cancelado';
        // se falhar por outro motivo, cai para o download
      }
    }
  }
  baixarDataURL(nomeArquivo, canvas.toDataURL('image/jpeg', 0.92));
  return 'baixado';
}
