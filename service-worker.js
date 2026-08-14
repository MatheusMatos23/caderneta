// ============================================================
// service-worker.js — faz o aplicativo abrir sem internet.
//
// Como funciona:
// - Na instalação, guarda uma cópia de todos os arquivos do app
//   (e das bibliotecas do Firebase) no aparelho.
// - Depois, sempre responde primeiro com a cópia guardada e
//   busca uma versão nova por trás (na próxima abertura, a
//   versão nova já aparece).
// - As conversas com o Firebase (login e dados) passam direto:
//   o próprio Firestore tem o seu modo offline.
//
// Se você mudar algum arquivo do app, troque o número da versão
// abaixo (v1 → v2) para forçar a atualização da cópia guardada.
// ============================================================

const VERSAO_CACHE = 'caderneta-v3';

const ARQUIVOS_DO_APP = [
  './',
  './index.html',
  './manifest.json',
  './css/estilos.css',
  './firebase-config.js',
  './js/app.js',
  './js/util.js',
  './js/preferencias.js',
  './js/calculos.js',
  './js/dados.js',
  './js/dados-firebase.js',
  './js/dados-demo.js',
  './js/comprovante.js',
  './js/assinatura.js',
  './js/recibo.js',
  './js/backup.js',
  './js/telas/login.js',
  './js/telas/inicio.js',
  './js/telas/clientes.js',
  './js/telas/cliente.js',
  './js/telas/cliente-form.js',
  './js/telas/emprestimo-novo.js',
  './js/telas/emprestimo.js',
  './js/telas/pagamento.js',
  './js/telas/comprovante-emprestimo.js',
  './js/telas/ajustes.js',
  './icones/icone.svg',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png',
];

const ARQUIVOS_DE_FORA = [
  'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO_CACHE);
    // cache: 'reload' ignora o cache HTTP do navegador — garante que uma
    // versão nova (v2) seja preenchida com arquivos realmente novos.
    await cache.addAll(ARQUIVOS_DO_APP.map((url) => new Request(url, { cache: 'reload' })));
    // As bibliotecas de fora não podem impedir a instalação
    // se estiverem fora do ar; por isso, cada uma é tentada à parte.
    await Promise.allSettled(
      ARQUIVOS_DE_FORA.map(async (url) => {
        const resposta = await fetch(new Request(url, { mode: 'cors' }));
        if (resposta.ok) await cache.put(url, resposta);
      })
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    // Apaga só as cópias de versões antigas DESTE app — no GitHub Pages,
    // outros sites do mesmo usuário dividem o mesmo espaço de caches.
    const nomes = await caches.keys();
    await Promise.all(
      nomes
        .filter((n) => n.startsWith('caderneta-') && n !== VERSAO_CACHE)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);

  // Firebase (login e dados) fala direto com a internet.
  if (url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('google.com')) {
    return;
  }

  // Abrir o aplicativo: devolve a página principal guardada.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(paginaPrincipal(evento));
    return;
  }

  // Arquivos do app e bibliotecas (gstatic, jsdelivr):
  // responde com a cópia guardada e atualiza por trás.
  const mesmaOrigem = url.origin === self.location.origin;
  const cdnConhecida = url.hostname === 'www.gstatic.com' || url.hostname === 'cdn.jsdelivr.net';
  if (mesmaOrigem || cdnConhecida) {
    evento.respondWith(guardadoPrimeiro(evento, requisicao));
  }
});

async function guardadoPrimeiro(evento, requisicao) {
  const cache = await caches.open(VERSAO_CACHE);
  const guardado = await cache.match(requisicao);
  const atualizacao = fetch(requisicao)
    .then(async (resposta) => {
      if (resposta && resposta.ok) {
        await cache.put(requisicao, resposta.clone()).catch(() => {});
      }
      return resposta;
    })
    .catch(() => null);
  // Mantém o service worker vivo até a atualização terminar de gravar.
  evento.waitUntil(atualizacao.then(() => {}));
  if (guardado) return guardado;
  const daInternet = await atualizacao;
  if (daInternet) return daInternet;
  return Response.error();
}

async function paginaPrincipal(evento) {
  const cache = await caches.open(VERSAO_CACHE);
  const atualizacao = fetch('./index.html')
    .then(async (resposta) => {
      if (resposta && resposta.ok) {
        await cache.put('./index.html', resposta.clone()).catch(() => {});
      }
      return resposta;
    })
    .catch(() => null);
  evento.waitUntil(atualizacao.then(() => {}));
  const guardada = await cache.match('./index.html');
  if (guardada) return guardada;
  const daInternet = await atualizacao;
  if (daInternet) return daInternet;
  return Response.error();
}
