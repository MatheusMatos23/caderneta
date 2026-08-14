// ============================================================
// app.js — ponto de partida do aplicativo:
// liga a camada de dados, cuida do login, das rotas (telas),
// da barra de navegação e do indicador de conexão.
// ============================================================

import * as dados from './dados.js';
import { toast, abrirModal, fecharTodosModais, lerSessaoDemo, gravarSessaoDemo } from './util.js';
import { aplicarPreferencias } from './preferencias.js';

import * as telaLogin from './telas/login.js';
import * as telaInicio from './telas/inicio.js';
import * as telaClientes from './telas/clientes.js';
import * as telaCliente from './telas/cliente.js';
import * as telaClienteForm from './telas/cliente-form.js';
import * as telaEmprestimoNovo from './telas/emprestimo-novo.js';
import * as telaEmprestimo from './telas/emprestimo.js';
import * as telaAjustes from './telas/ajustes.js';

// ---------- Rotas ----------

const rotas = [
  { padrao: /^#\/inicio$/, tela: telaInicio, aba: 'inicio' },
  { padrao: /^#\/clientes$/, tela: telaClientes, aba: 'clientes' },
  { padrao: /^#\/clientes\/novo$/, tela: telaClienteForm, aba: 'clientes' },
  { padrao: /^#\/cliente\/([^/]+)\/editar$/, tela: telaClienteForm, aba: 'clientes', params: (m) => ({ id: m[1] }) },
  { padrao: /^#\/cliente\/([^/]+)$/, tela: telaCliente, aba: 'clientes', params: (m) => ({ id: m[1] }) },
  {
    padrao: /^#\/emprestimos\/novo(\?.*)?$/,
    tela: telaEmprestimoNovo,
    aba: 'novo',
    params: (m) => Object.fromEntries(new URLSearchParams((m[1] || '').slice(1))),
  },
  { padrao: /^#\/emprestimo\/([^/]+)$/, tela: telaEmprestimo, aba: 'inicio', params: (m) => ({ id: m[1] }) },
  { padrao: /^#\/ajustes$/, tela: telaAjustes, aba: 'ajustes' },
];

let limparTelaAtual = null;

function mostrarTela(modulo, params = {}, aba = '') {
  fecharTodosModais();
  if (limparTelaAtual) {
    try { limparTelaAtual(); } catch (erro) { console.error(erro); }
    limparTelaAtual = null;
  }
  const area = document.getElementById('tela');
  window.scrollTo(0, 0);
  const limpar = modulo.render(area, params);
  if (typeof limpar === 'function') limparTelaAtual = limpar;
  marcarAba(aba);
}

function renderRota() {
  if (!dados.estado.usuario) return;
  const hash = location.hash || '#/inicio';
  const rota = rotas.find((r) => r.padrao.test(hash));
  if (!rota) {
    location.hash = '#/inicio';
    return;
  }
  const m = hash.match(rota.padrao);
  mostrarTela(rota.tela, rota.params ? rota.params(m) : {}, rota.aba);
}

function marcarAba(aba) {
  document.querySelectorAll('#navegacao .item-nav').forEach((botao) => {
    botao.classList.toggle('ativo', botao.dataset.aba === aba);
  });
}

// ---------- Barra de navegação ----------

function ligarNavegacao() {
  document.querySelectorAll('#navegacao .item-nav').forEach((botao) => {
    botao.addEventListener('click', () => {
      const aba = botao.dataset.aba;
      if (aba === 'inicio') location.hash = '#/inicio';
      else if (aba === 'clientes') location.hash = '#/clientes';
      else if (aba === 'ajustes') location.hash = '#/ajustes';
      else if (aba === 'novo') abrirMenuNovo();
    });
  });
}

function abrirMenuNovo() {
  const { el, fechar } = abrirModal(`
    <h2 class="titulo-modal">O que você quer anotar?</h2>
    <button class="botao botao-primario" data-acao="emprestimo">💰 Novo empréstimo</button>
    <button class="botao botao-secundario" data-acao="cliente">👤 Novo cliente</button>
    <button class="botao botao-neutro" data-acao="fechar">Voltar</button>
  `);
  el.querySelector('[data-acao="emprestimo"]').addEventListener('click', () => {
    fechar();
    location.hash = '#/emprestimos/novo';
  });
  el.querySelector('[data-acao="cliente"]').addEventListener('click', () => {
    fechar();
    location.hash = '#/clientes/novo';
  });
  el.querySelector('[data-acao="fechar"]').addEventListener('click', fechar);
}

// ---------- Indicador de conexão / gravação ----------

let temporizadorSalvo = null;

function atualizarIndicador(detalhe = {}) {
  const el = document.getElementById('indicador-conexao');
  if (!el) return;
  const pendentes = detalhe.pendentes ?? dados.gravacoesPendentes();
  const texto = el.querySelector('.texto');

  el.classList.remove('estado-offline', 'estado-salvando');

  if (!navigator.onLine) {
    el.classList.add('estado-offline');
    texto.textContent = pendentes > 0 ? 'Sem internet — será salvo quando conectar' : 'Sem internet';
    return;
  }
  if (pendentes > 0) {
    el.classList.add('estado-salvando');
    texto.textContent = 'Salvando…';
    return;
  }
  if (detalhe.salvou) {
    texto.textContent = 'Salvo ✓';
    clearTimeout(temporizadorSalvo);
    temporizadorSalvo = setTimeout(() => atualizarIndicador(), 2500);
    return;
  }
  texto.textContent = 'Conectado';
}

function ligarIndicador() {
  document.addEventListener('conexao-mudou', (evento) => atualizarIndicador(evento.detail || {}));
  window.addEventListener('online', () => atualizarIndicador());
  window.addEventListener('offline', () => atualizarIndicador());
  document.addEventListener('erro-gravacao', () => {
    toast('Algo deu errado ao salvar. Confira a internet e tente de novo.', 'erro');
  });
  atualizarIndicador();
}

// ---------- Telas especiais ----------

function mostrarLogin() {
  document.getElementById('topo').hidden = true;
  document.getElementById('navegacao').hidden = true;
  mostrarTela(telaLogin, {}, '');
}

function mostrarTelaDeConfiguracao() {
  document.getElementById('tela').innerHTML = `
    <div class="tela-login">
      <div class="logo">
        <img src="./icones/icone.svg" alt="">
        <h1>Caderneta</h1>
      </div>
      <div class="aviso-info">
        O aplicativo está quase pronto! Falta só ligar o Firebase — o serviço
        gratuito onde as anotações ficam guardadas.
      </div>
      <p style="margin-bottom:0.8rem">Quem estiver publicando o aplicativo deve:</p>
      <ol style="margin:0 0 1rem 1.2rem; padding:0; line-height:1.7">
        <li>Seguir o passo a passo do arquivo <strong>GUIA-PUBLICACAO.md</strong>;</li>
        <li>Preencher o arquivo <strong>firebase-config.js</strong> com os dados do projeto;</li>
        <li>Publicar os arquivos de novo.</li>
      </ol>
      <button class="botao botao-primario" id="botao-ver-demo">Ver demonstração com dados de exemplo</button>
    </div>
  `;
  document.getElementById('botao-ver-demo').addEventListener('click', () => {
    gravarSessaoDemo(true);
    location.reload();
  });
}

function mostrarFaixaDemo() {
  const faixa = document.createElement('div');
  faixa.className = 'faixa-demo';
  faixa.innerHTML = 'Modo demonstração — nada fica salvo. <button type="button">Sair da demonstração</button>';
  faixa.querySelector('button').addEventListener('click', () => {
    gravarSessaoDemo(false);
    location.hash = '';
    location.reload();
  });
  document.body.insertBefore(faixa, document.getElementById('topo'));
}

function esconderAbertura() {
  const abertura = document.getElementById('carregando');
  if (abertura) abertura.remove();
}

// ---------- Aplicativo instalável (service worker) ----------

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((erro) => {
      console.error('Não deu para preparar o modo offline:', erro);
    });
  });
}

// ---------- Início ----------

async function iniciarAplicativo() {
  aplicarPreferencias();
  registrarServiceWorker();
  ligarNavegacao();
  ligarIndicador();

  const querDemo = lerSessaoDemo();

  let resultado;
  try {
    resultado = await dados.iniciar(querDemo);
  } catch (erro) {
    console.error(erro);
    esconderAbertura();
    document.getElementById('tela').innerHTML = `
      <div class="tela-login">
        <div class="aviso-erro">Não deu para abrir o aplicativo.
        No primeiro acesso é preciso estar com internet. Verifique a conexão e tente de novo.</div>
        <button class="botao botao-primario" onclick="location.reload()">Tentar de novo</button>
      </div>`;
    return;
  }

  if (!resultado.configurado) {
    esconderAbertura();
    mostrarTelaDeConfiguracao();
    return;
  }

  if (querDemo) {
    mostrarFaixaDemo();
    await dados.entrar();
  }

  window.addEventListener('hashchange', renderRota);

  dados.ouvirSessao((usuario) => {
    esconderAbertura();
    if (usuario) {
      document.getElementById('topo').hidden = false;
      document.getElementById('navegacao').hidden = false;
      dados.iniciarOuvintes();
      if (!location.hash || !rotas.some((r) => r.padrao.test(location.hash))) {
        // Mudar o hash já dispara o hashchange, que renderiza a tela;
        // chamar renderRota() aqui também renderizaria duas vezes.
        location.hash = '#/inicio';
      } else {
        renderRota();
      }
    } else {
      dados.pararOuvintes();
      mostrarLogin();
    }
  });
}

iniciarAplicativo();
