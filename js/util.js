// ============================================================
// util.js — funções de apoio usadas em todo o aplicativo:
// dinheiro, datas, máscaras de digitação, avisos e modais.
// Valores monetários circulam SEMPRE em centavos (número inteiro),
// para não haver erro de arredondamento.
// ============================================================

// ---------- Texto ----------

// Protege texto digitado pelo usuário antes de ir para o HTML.
export function esc(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Remove acentos e deixa minúsculo, para busca por nome.
// A normalização NFD separa os sinais de acento das letras; os sinais
// ficam na faixa de códigos 768 a 879 e são descartados um a um.
export function normalizar(texto) {
  let saida = '';
  for (const letra of String(texto ?? '').toLowerCase().normalize('NFD')) {
    const codigo = letra.codePointAt(0);
    if (codigo < 768 || codigo > 879) saida += letra;
  }
  return saida;
}

// ---------- Dinheiro ----------

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function fmtMoeda(centavos) {
  return formatoMoeda.format((Number(centavos) || 0) / 100);
}

export function fmtPorcentagem(numero) {
  return (Number(numero) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
}

// Ativa a máscara de moeda em um campo de texto.
// O valor em centavos fica sempre em input.dataset.centavos.
export function ativarCampoMoeda(input, centavosIniciais = 0) {
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('autocomplete', 'off');
  const aplicar = (centavos) => {
    input.dataset.centavos = String(centavos);
    input.value = centavos > 0 ? fmtMoeda(centavos) : '';
  };
  input.addEventListener('input', () => {
    const digitos = input.value.replace(/\D/g, '').slice(0, 12);
    aplicar(digitos ? parseInt(digitos, 10) : 0);
  });
  aplicar(centavosIniciais || 0);
}

export function lerCentavos(input) {
  return parseInt(input?.dataset?.centavos || '0', 10) || 0;
}

// ---------- Datas ----------
// Datas circulam como texto "AAAA-MM-DD" (formato dos campos de data),
// e são mostradas como "DD/MM/AAAA". Nada de fuso horário.

function pad2(n) { return String(n).padStart(2, '0'); }

export function dataParaISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function hojeISO() {
  return dataParaISO(new Date());
}

export function paraData(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function ehISOValido(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''));
}

export function fmtData(iso) {
  if (!ehISOValido(iso)) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function fmtDataExtenso(iso) {
  if (!ehISOValido(iso)) return '—';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function nomeDoMes(iso) {
  const m = Number(String(iso).slice(5, 7));
  return MESES[m - 1] || '';
}

export function somarDias(iso, dias) {
  const d = paraData(iso);
  d.setDate(d.getDate() + dias);
  return dataParaISO(d);
}

// Soma meses mantendo o dia do vencimento; se o mês for mais curto
// (ex.: dia 31 em fevereiro), usa o último dia do mês.
export function somarMeses(iso, meses) {
  const [a, m, dia] = String(iso).split('-').map(Number);
  const mesAlvo = (m - 1) + meses;
  const ultimoDia = new Date(a, mesAlvo + 1, 0).getDate();
  return dataParaISO(new Date(a, mesAlvo, Math.min(dia, ultimoDia)));
}

// Dias entre duas datas (b - a); positivo se b é depois de a.
export function diasEntre(aISO, bISO) {
  return Math.round((paraData(bISO) - paraData(aISO)) / 86400000);
}

export function inicioDoMesISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

// ---------- Telefone / WhatsApp ----------

export function somenteDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

export function fmtTelefone(digitos) {
  const t = somenteDigitos(digitos);
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return t;
}

export function ativarCampoTelefone(input, valorInicial = '') {
  input.setAttribute('inputmode', 'tel');
  input.setAttribute('autocomplete', 'off');
  const aplicar = (digitos) => {
    input.dataset.digitos = digitos;
    input.value = fmtTelefone(digitos);
  };
  input.addEventListener('input', () => {
    aplicar(somenteDigitos(input.value).slice(0, 11));
  });
  aplicar(somenteDigitos(valorInicial).slice(0, 11));
}

export function lerTelefone(input) {
  return input?.dataset?.digitos || somenteDigitos(input?.value);
}

// Monta o número internacional: DDD + número vira 55 + tudo.
export function telefoneInternacional(digitos) {
  const t = somenteDigitos(digitos);
  if (!t) return '';
  return t.startsWith('55') && t.length > 11 ? t : '55' + t;
}

export function linkWhatsApp(digitos, mensagem) {
  const numero = telefoneInternacional(digitos);
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/${numero}${texto}`;
}

export function linkLigar(digitos) {
  return `tel:+${telefoneInternacional(digitos)}`;
}

// Mensagem educada de lembrança de parcela vencida.
export function mensagemCobranca({ nome, numeroParcela, valorCentavos, vencimentoISO }) {
  return `Olá, ${nome}, tudo bem? Passando para lembrar da parcela ${numeroParcela}, ` +
    `no valor de ${fmtMoeda(valorCentavos)}, que venceu em ${fmtData(vencimentoISO)}. ` +
    `Qualquer coisa me chama. Obrigado!`;
}

// ---------- Avisos rápidos (toast) ----------

export function toast(mensagem, tipo = 'ok') {
  const raiz = document.getElementById('raiz-toast');
  if (!raiz) return;
  const el = document.createElement('div');
  el.className = 'toast' + (tipo === 'erro' ? ' toast-erro' : '');
  el.textContent = mensagem;
  raiz.appendChild(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 5000 : 3000);
}

// ---------- Modais ----------

// Registro dos modais abertos, para fecharTodosModais() conseguir
// avisar cada um (senão as promessas de confirmação ficam presas).
const modaisAbertos = new Set();

// Abre um modal (folha que sobe de baixo). Devolve { el, fechar }.
export function abrirModal(html, { centralizado = false, aoFechar = null } = {}) {
  const raiz = document.getElementById('raiz-modal');
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal' + (centralizado ? ' centralizado' : '');
  fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  raiz.appendChild(fundo);

  let fechado = false;
  const fechar = () => {
    if (fechado) return;
    fechado = true;
    modaisAbertos.delete(fechar);
    fundo.remove();
    if (aoFechar) aoFechar();
  };
  modaisAbertos.add(fechar);

  // Tocar fora do modal fecha.
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });

  return { el: fundo.querySelector('.modal'), fundo, fechar };
}

export function fecharTodosModais() {
  for (const fechar of [...modaisAbertos]) fechar();
  document.querySelectorAll('.visualizador').forEach((el) => el.remove());
}

// Caixa de confirmação simples. Devolve true/false.
export function confirmar({ titulo, mensagem = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = false }) {
  return new Promise((resolver) => {
    const { el, fechar } = abrirModal(`
      <h2 class="titulo-modal">${esc(titulo)}</h2>
      ${mensagem ? `<p style="margin-bottom:1rem">${mensagem}</p>` : ''}
      <button class="botao ${perigo ? 'botao-perigo' : 'botao-primario'}" data-acao="sim">${esc(textoConfirmar)}</button>
      <button class="botao botao-neutro" data-acao="nao">${esc(textoCancelar)}</button>
    `, { centralizado: true, aoFechar: () => resolver(false) });
    // resolver() só vale na primeira chamada; o resolver(false) do
    // aoFechar vira um "não aconteceu nada" inofensivo.
    el.querySelector('[data-acao="sim"]').addEventListener('click', () => { resolver(true); fechar(); });
    el.querySelector('[data-acao="nao"]').addEventListener('click', () => { resolver(false); fechar(); });
  });
}

// Confirmação forte: a pessoa precisa digitar a palavra EXCLUIR.
export function confirmarExclusao({ titulo, mensagem = '' }) {
  return new Promise((resolver) => {
    const { el, fechar } = abrirModal(`
      <h2 class="titulo-modal">${esc(titulo)}</h2>
      ${mensagem ? `<p style="margin-bottom:1rem">${mensagem}</p>` : ''}
      <div class="campo">
        <label for="campo-excluir">Para confirmar, digite <strong>EXCLUIR</strong> aqui embaixo:</label>
        <input id="campo-excluir" type="text" autocomplete="off" autocapitalize="characters">
      </div>
      <button class="botao botao-perigo" data-acao="sim" disabled>Excluir de vez</button>
      <button class="botao botao-neutro" data-acao="nao">Cancelar</button>
    `, { centralizado: true, aoFechar: () => resolver(false) });
    const campo = el.querySelector('#campo-excluir');
    const botaoSim = el.querySelector('[data-acao="sim"]');
    campo.addEventListener('input', () => {
      botaoSim.disabled = campo.value.trim().toUpperCase() !== 'EXCLUIR';
    });
    botaoSim.addEventListener('click', () => { resolver(true); fechar(); });
    el.querySelector('[data-acao="nao"]').addEventListener('click', () => { resolver(false); fechar(); });
    campo.focus();
  });
}

// ---------- Armazenamento protegido ----------
// Alguns navegadores com "bloquear cookies" lançam erro só de TOCAR
// no sessionStorage; estes auxiliares nunca deixam o app quebrar.

export function lerSessaoDemo() {
  try { return sessionStorage.getItem('caderneta-demo') === '1'; } catch { return false; }
}

export function gravarSessaoDemo(ativa) {
  try {
    if (ativa) sessionStorage.setItem('caderneta-demo', '1');
    else sessionStorage.removeItem('caderneta-demo');
  } catch {}
}

// ---------- Download de arquivos ----------

export function baixarArquivo(nomeArquivo, conteudo, tipo = 'application/octet-stream') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function baixarDataURL(nomeArquivo, dataURL) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
