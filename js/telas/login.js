// ============================================================
// telas/login.js — tela de entrada.
// Não existe cadastro pelo app: as contas são criadas pelo
// administrador no painel do Firebase.
// ============================================================

import * as dados from '../dados.js';
import { esc, toast, confirmar, gravarSessaoDemo } from '../util.js';

export function render(el) {
  el.innerHTML = `
    <div class="tela-login">
      <div class="logo">
        <img src="./icones/icone.svg" alt="">
        <h1>Caderneta</h1>
        <p>Seu caderninho de empréstimos,<br>agora na palma da mão.</p>
      </div>
      <form id="form-login" novalidate>
        <div class="campo">
          <label for="campo-email">E-mail</label>
          <input id="campo-email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false">
        </div>
        <div class="campo">
          <label for="campo-senha">Senha</label>
          <input id="campo-senha" type="password" autocomplete="current-password">
        </div>
        <label class="caixa-marcar">
          <input type="checkbox" id="campo-manter" checked>
          Continuar conectado neste aparelho
        </label>
        <div class="aviso-erro escondido" id="erro-login" role="alert"></div>
        <button class="botao botao-primario espaco-cima" id="botao-entrar" type="submit">Entrar</button>
      </form>
      <p class="texto-central espaco-cima">
        <button class="botao-linha" id="botao-esqueci" type="button">Esqueci minha senha</button>
      </p>
      <p class="texto-central">
        <button class="botao-linha" id="botao-demo" type="button">Ver demonstração com dados de exemplo</button>
      </p>
    </div>
  `;

  const campoEmail = el.querySelector('#campo-email');
  const campoSenha = el.querySelector('#campo-senha');
  const caixaErro = el.querySelector('#erro-login');
  const botaoEntrar = el.querySelector('#botao-entrar');

  function mostrarErro(mensagem) {
    caixaErro.textContent = mensagem;
    caixaErro.classList.toggle('escondido', !mensagem);
  }

  el.querySelector('#form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarErro('');
    const email = campoEmail.value.trim();
    const senha = campoSenha.value;
    if (!email || !senha) {
      mostrarErro('Preencha o e-mail e a senha para entrar.');
      return;
    }
    botaoEntrar.disabled = true;
    botaoEntrar.textContent = 'Entrando…';
    try {
      await dados.entrar(email, senha, el.querySelector('#campo-manter').checked);
      // Quando o login dá certo, o app troca de tela sozinho.
    } catch (erro) {
      mostrarErro(mensagemDeErro(erro));
      botaoEntrar.disabled = false;
      botaoEntrar.textContent = 'Entrar';
    }
  });

  el.querySelector('#botao-esqueci').addEventListener('click', async () => {
    const email = campoEmail.value.trim();
    if (!email) {
      mostrarErro('Digite o seu e-mail no campo acima e toque de novo em "Esqueci minha senha".');
      campoEmail.focus();
      return;
    }
    const quer = await confirmar({
      titulo: 'Redefinir a senha?',
      mensagem: `Vamos enviar um e-mail para <strong>${esc(email)}</strong> com o passo a passo para criar uma senha nova.`,
      textoConfirmar: 'Enviar e-mail',
    });
    if (!quer) return;
    // A resposta é sempre a mesma, exista a conta ou não — assim
    // ninguém consegue descobrir quais e-mails têm conta no app.
    const respostaNeutra = 'Se este e-mail tiver uma conta, a mensagem para redefinir a senha já foi enviada.';
    try {
      await dados.recuperarSenha(email);
      toast(respostaNeutra);
    } catch (erro) {
      const codigo = String(erro?.code || '');
      if (codigo.includes('user-not-found') || codigo.includes('invalid-credential')) {
        toast(respostaNeutra);
      } else {
        mostrarErro(mensagemDeErro(erro));
      }
    }
  });

  el.querySelector('#botao-demo').addEventListener('click', () => {
    gravarSessaoDemo(true);
    location.reload();
  });
}

function mensagemDeErro(erro) {
  const codigo = String(erro?.code || '');
  if (codigo.includes('invalid-email')) return 'Este e-mail não parece certo. Confira se digitou direitinho.';
  if (
    codigo.includes('user-not-found') ||
    codigo.includes('wrong-password') ||
    codigo.includes('invalid-credential') ||
    codigo.includes('invalid-login-credentials')
  ) {
    return 'E-mail ou senha incorretos.';
  }
  if (codigo.includes('too-many-requests')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (codigo.includes('network-request-failed')) return 'Sem internet. Verifique a conexão e tente de novo.';
  if (codigo.includes('user-disabled')) return 'Esta conta foi desativada.';
  console.error('Erro de login:', erro);
  return 'Não deu para entrar agora. Tente de novo em instantes.';
}
