// ============================================================
// telas/ajustes.js — cópia de segurança (JSON e Excel),
// tamanho da letra, tema e sair da conta.
// ============================================================

import * as dados from '../dados.js';
import { esc, toast, confirmar, abrirModal } from '../util.js';
import { exportarJSON, exportarExcel } from '../backup.js';
import { lerFonte, lerTema, definirFonte, definirTema } from '../preferencias.js';

export function render(el) {
  const fonte = lerFonte();
  const tema = lerTema();

  el.innerHTML = `
    <h1 class="titulo-tela">Ajustes</h1>

    <h2 class="titulo-secao">Cópia de segurança</h2>
    <div class="cartao"><div class="cartao-conteudo">
      <p class="subtexto" style="margin-bottom:0.8rem">
        Baixe um arquivo com tudo o que está na caderneta, para guardar por segurança.
      </p>
      <button class="botao botao-secundario" id="botao-backup-json">Baixar backup completo</button>
      <button class="botao botao-secundario" id="botao-backup-excel">Baixar planilha (Excel)</button>
    </div></div>

    <h2 class="titulo-secao">Tamanho da letra</h2>
    <div class="grupo-opcoes duas-colunas">
      <label class="cartao-opcao">
        <input type="radio" name="opcao-fonte" value="normal" ${fonte !== 'grande' ? 'checked' : ''}>
        Normal
      </label>
      <label class="cartao-opcao">
        <input type="radio" name="opcao-fonte" value="grande" ${fonte === 'grande' ? 'checked' : ''}>
        Grande
      </label>
    </div>

    <h2 class="titulo-secao">Cores</h2>
    <div class="grupo-opcoes tres-colunas">
      <label class="cartao-opcao">
        <input type="radio" name="opcao-tema" value="claro" ${tema === 'claro' ? 'checked' : ''}>
        Claro
      </label>
      <label class="cartao-opcao">
        <input type="radio" name="opcao-tema" value="escuro" ${tema === 'escuro' ? 'checked' : ''}>
        Escuro
      </label>
      <label class="cartao-opcao">
        <input type="radio" name="opcao-tema" value="automatico" ${tema === 'automatico' ? 'checked' : ''}>
        Igual ao celular
      </label>
    </div>

    <h2 class="titulo-secao">Conta</h2>
    <div class="cartao"><div class="cartao-conteudo">
      <p>Conectado como<br><strong>${esc(dados.estado.usuario?.email || '')}</strong></p>
      <button class="botao botao-perigo-claro espaco-cima" id="botao-sair">Sair da conta</button>
    </div></div>

    <p class="subtexto texto-central espaco-cima-2">
      Caderneta — funciona sem internet e envia as anotações sozinho quando a conexão volta.
    </p>
  `;

  // ---------- Backup ----------

  el.querySelector('#botao-backup-json').addEventListener('click', async () => {
    const escolha = await perguntarSobreFotos();
    if (escolha === null) return;
    const botao = el.querySelector('#botao-backup-json');
    botao.disabled = true;
    botao.textContent = 'Preparando o arquivo…';
    try {
      await exportarJSON(escolha);
      toast('Backup baixado ✓');
    } catch (erro) {
      console.error(erro);
      toast('Não deu para gerar o backup agora. Tente de novo.', 'erro');
    }
    botao.disabled = false;
    botao.textContent = 'Baixar backup completo';
  });

  el.querySelector('#botao-backup-excel').addEventListener('click', async () => {
    const botao = el.querySelector('#botao-backup-excel');
    botao.disabled = true;
    botao.textContent = 'Preparando a planilha…';
    try {
      await exportarExcel();
      toast('Planilha baixada ✓');
    } catch (erro) {
      console.error(erro);
      toast(erro.message || 'Não deu para gerar a planilha agora.', 'erro');
    }
    botao.disabled = false;
    botao.textContent = 'Baixar planilha (Excel)';
  });

  // ---------- Letra e tema ----------

  el.querySelectorAll('input[name="opcao-fonte"]').forEach((radio) => {
    radio.addEventListener('change', () => definirFonte(radio.value));
  });
  el.querySelectorAll('input[name="opcao-tema"]').forEach((radio) => {
    radio.addEventListener('change', () => definirTema(radio.value));
  });

  // ---------- Sair ----------

  el.querySelector('#botao-sair').addEventListener('click', async () => {
    const quer = await confirmar({
      titulo: 'Sair da conta?',
      mensagem: dados.emModoDemo()
        ? 'Você vai sair da demonstração.'
        : 'Você vai precisar do e-mail e da senha para entrar de novo.',
      textoConfirmar: 'Sim, sair',
      perigo: true,
    });
    if (!quer) return;
    if (dados.emModoDemo()) {
      sessionStorage.removeItem('caderneta-demo');
      location.hash = '';
      location.reload();
      return;
    }
    await dados.sair();
    location.hash = '';
  });
}

// Pergunta se o backup deve incluir as fotos dos comprovantes.
// Devolve true (com fotos), false (sem fotos) ou null (desistiu).
function perguntarSobreFotos() {
  return new Promise((resolver) => {
    const { el, fechar } = abrirModal(`
      <h2 class="titulo-modal">Incluir as fotos dos comprovantes?</h2>
      <p style="margin-bottom:1rem">Com as fotos o arquivo fica bem maior, mas o backup fica completo.</p>
      <button class="botao botao-primario" data-acao="com">Incluir as fotos</button>
      <button class="botao botao-secundario" data-acao="sem">Só os dados, sem fotos</button>
      <button class="botao botao-linha" data-acao="cancelar" style="width:100%">Cancelar</button>
    `, { centralizado: true, aoFechar: () => resolver(null) });
    const responder = (valor) => {
      resolver(valor); // vale só na primeira chamada
      fechar();
    };
    el.querySelector('[data-acao="com"]').addEventListener('click', () => responder(true));
    el.querySelector('[data-acao="sem"]').addEventListener('click', () => responder(false));
    el.querySelector('[data-acao="cancelar"]').addEventListener('click', () => responder(null));
  });
}
