// ============================================================
// preferencias.js — tamanho da letra e tema (claro/escuro),
// guardados no próprio aparelho.
// ============================================================

let ouvindoSistema = false;

export function lerFonte() {
  try { return localStorage.getItem('caderneta-fonte') || 'normal'; } catch { return 'normal'; }
}

export function lerTema() {
  try { return localStorage.getItem('caderneta-tema') || 'claro'; } catch { return 'claro'; }
}

export function definirFonte(fonte) {
  try { localStorage.setItem('caderneta-fonte', fonte); } catch {}
  aplicarPreferencias();
}

export function definirTema(tema) {
  try { localStorage.setItem('caderneta-tema', tema); } catch {}
  aplicarPreferencias();
}

export function aplicarPreferencias() {
  document.documentElement.dataset.fonte = lerFonte() === 'grande' ? 'grande' : 'normal';

  let tema = lerTema();
  if (tema === 'automatico') {
    tema = matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  }
  document.documentElement.dataset.tema = tema;

  // No modo automático, acompanha o aparelho mudando de dia/noite.
  if (!ouvindoSistema) {
    ouvindoSistema = true;
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarPreferencias);
  }
}
