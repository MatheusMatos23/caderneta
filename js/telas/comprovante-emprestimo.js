// ============================================================
// telas/comprovante-emprestimo.js — mostra o comprovante do
// empréstimo (com a assinatura de quem pegou o dinheiro) e
// permite mandar para o cliente pelo WhatsApp.
// ============================================================

import * as dados from '../dados.js';
import * as calc from '../calculos.js';
import { toast, abrirModal, fmtMoeda, fmtData } from '../util.js';
import { desenharComprovanteEmprestimo, compartilharImagem } from '../recibo.js';
import { lerNomeCredor } from '../preferencias.js';

const TEXTO_PERIODICIDADE = {
  mensal: 'uma parcela por mês',
  quinzenal: 'uma parcela a cada 15 dias',
  semanal: 'uma parcela por semana',
};

// Monta as informações do comprovante a partir do empréstimo.
// Aceita a assinatura pronta (logo após cadastrar) ou busca a
// que estiver guardada.
export async function mostrarComprovanteEmprestimo({ emprestimo, assinaturaBase64 = null, aoFechar = null }) {
  let assinatura = assinaturaBase64;
  if (!assinatura && emprestimo.assinaturaId) {
    try {
      const guardada = await dados.obterAssinatura(emprestimo.assinaturaId);
      assinatura = guardada ? guardada.imagemBase64 : null;
    } catch (erro) {
      console.error('Não deu para carregar a assinatura:', erro);
    }
  }

  const cliente = dados.obterCliente(emprestimo.clienteId);
  const ultimoVencimento = calc.vencimentoDaParcela(
    emprestimo.primeiroVencimento,
    emprestimo.periodicidade,
    Math.max(0, (emprestimo.numParcelas || 1) - 1)
  );

  const canvas = await desenharComprovanteEmprestimo({
    credorNome: lerNomeCredor(),
    clienteNome: emprestimo.clienteNome,
    clienteCpf: fmtCpf(cliente?.cpf),
    valorEmprestadoCentavos: emprestimo.valorEmprestado,
    totalAReceberCentavos: emprestimo.totalAReceber,
    numParcelas: emprestimo.numParcelas,
    valorParcelaCentavos: emprestimo.valorParcela,
    periodicidadeTexto: TEXTO_PERIODICIDADE[emprestimo.periodicidade] || '',
    primeiroVencimentoISO: emprestimo.primeiroVencimento,
    ultimoVencimentoISO: ultimoVencimento,
    dataEmprestimoISO: emprestimo.dataEmprestimo,
    assinaturaBase64: assinatura,
  });

  const { el, fechar } = abrirModal(`
    <h2 class="titulo-modal">Comprovante do empréstimo</h2>
    ${assinatura ? '' : `
      <div class="aviso-info">Este empréstimo ainda não tem assinatura.
      O comprovante sai com a linha em branco, para assinar no papel.</div>`}
    <div id="area-comprovante"></div>
    <div class="espaco-cima">
      <button class="botao botao-primario" data-acao="enviar">Enviar para o cliente</button>
      <button class="botao botao-neutro" data-acao="fechar">Fechar</button>
    </div>
  `, { aoFechar });

  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.borderRadius = '12px';
  canvas.style.border = '1px solid var(--borda)';
  el.querySelector('#area-comprovante').appendChild(canvas);

  el.querySelector('[data-acao="fechar"]').addEventListener('click', fechar);
  el.querySelector('[data-acao="enviar"]').addEventListener('click', async () => {
    const resultado = await compartilharImagem(canvas, 'comprovante-emprestimo.jpg');
    if (resultado === 'baixado') toast('Imagem do comprovante baixada.');
    if (resultado === 'compartilhado') toast('Comprovante enviado ✓');
  });
}

// Mensagem sugerida ao mandar o comprovante pelo WhatsApp.
export function mensagemDoComprovante(emprestimo) {
  return `Olá, ${primeiroNome(emprestimo.clienteNome)}! Segue o comprovante do empréstimo de ` +
    `${fmtMoeda(emprestimo.valorEmprestado)} feito em ${fmtData(emprestimo.dataEmprestimo)}, ` +
    `em ${emprestimo.numParcelas}x de ${fmtMoeda(emprestimo.valorParcela)}. Obrigado!`;
}

function primeiroNome(nomeCompleto) {
  return String(nomeCompleto || '').trim().split(/\s+/)[0] || '';
}

function fmtCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
