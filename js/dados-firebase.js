// ============================================================
// dados-firebase.js — conversa com o Firebase:
// login (Authentication) e dados (Cloud Firestore, com
// funcionamento offline ativado).
// Toda a estrutura fica em usuarios/{uid}/..., conforme as
// regras de segurança do arquivo firestore.rules.
// ============================================================

import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  terminate,
  clearIndexedDbPersistence,
  waitForPendingWrites,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// O app só liga o Firebase depois que o arquivo firebase-config.js
// for preenchido com os dados do projeto.
export const configurado = !Object.values(firebaseConfig).some((v) => String(v).includes('COLE_AQUI'));

let app = null;
let auth = null;
let db = null;
let uid = null;

export function iniciar() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    // Guarda os dados no aparelho: o app abre e funciona sem internet,
    // e envia tudo sozinho quando a conexão voltar.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  auth = getAuth(app);
}

// ---------- Sessão ----------

export function ouvirSessao(retorno) {
  return onAuthStateChanged(auth, (usuario) => {
    uid = usuario ? usuario.uid : null;
    retorno(usuario ? { uid: usuario.uid, email: usuario.email } : null);
  });
}

export async function entrar(email, senha, manterConectado) {
  await setPersistence(auth, manterConectado ? browserLocalPersistence : browserSessionPersistence);
  // Guarda a escolha para o "Sair" saber se deve limpar os dados do aparelho.
  try { sessionStorage.setItem('caderneta-sessao-temporaria', manterConectado ? '0' : '1'); } catch {}
  await signInWithEmailAndPassword(auth, email, senha);
}

export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function sair() {
  let sessaoTemporaria = false;
  try { sessaoTemporaria = sessionStorage.getItem('caderneta-sessao-temporaria') === '1'; } catch {}

  await signOut(auth);

  // Se a pessoa entrou SEM "continuar conectado" (aparelho emprestado),
  // apaga também a cópia local dos dados, para não deixar nada para trás.
  if (sessaoTemporaria && db) {
    try {
      // Dá alguns segundos para terminar de enviar o que estiver pendente.
      await Promise.race([
        waitForPendingWrites(db),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (erro) {
      console.error('Não deu para limpar a cópia local:', erro);
    }
    // Recarrega para o Firestore recomeçar do zero.
    location.reload();
  }
}

// ---------- Caminhos ----------

function refDoc(caminho) {
  // caminho: ['clientes', id] ou ['emprestimos', id, 'parcelas', '3']
  return doc(db, 'usuarios', uid, ...caminho);
}

function refColecao(...caminho) {
  return collection(db, 'usuarios', uid, ...caminho);
}

function listaDe(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function aoFalharOuvinte(erro) {
  console.error('Erro ao receber dados do Firestore:', erro);
}

export function carimbo() {
  return serverTimestamp();
}

// ---------- Leitura ao vivo ----------

export function ouvirClientes(retorno) {
  return onSnapshot(query(refColecao('clientes'), orderBy('nome')), (s) => retorno(listaDe(s)), aoFalharOuvinte);
}

export function ouvirEmprestimos(retorno) {
  return onSnapshot(refColecao('emprestimos'), (s) => retorno(listaDe(s)), aoFalharOuvinte);
}

export function ouvirParcelas(emprestimoId, retorno) {
  return onSnapshot(
    query(refColecao('emprestimos', emprestimoId, 'parcelas'), orderBy('numero')),
    (s) => retorno(listaDe(s)),
    aoFalharOuvinte
  );
}

export function ouvirPagamentosDesde(dataISO, retorno) {
  return onSnapshot(
    query(refColecao('pagamentos'), where('data', '>=', dataISO)),
    (s) => retorno(listaDe(s)),
    aoFalharOuvinte
  );
}

// ---------- Leitura pontual ----------

export async function obterDoc(caminho) {
  const s = await getDoc(refDoc(caminho));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function listarColecao(nome) {
  return listaDe(await getDocs(refColecao(nome)));
}

export async function listarParcelas(emprestimoId) {
  return listaDe(await getDocs(query(refColecao('emprestimos', emprestimoId, 'parcelas'), orderBy('numero'))));
}

export async function listarPagamentosDe(emprestimoId) {
  return listaDe(await getDocs(query(refColecao('pagamentos'), where('emprestimoId', '==', emprestimoId))));
}

// ---------- Gravação ----------

// Executa várias gravações de uma vez só (tudo ou nada).
// Funciona offline: o Firestore guarda e envia quando a internet voltar.
// operacoes: [{ tipo: 'set' | 'atualizar' | 'excluir', caminho: [...], dados }]
export async function gravarLote(operacoes) {
  const lote = writeBatch(db);
  for (const op of operacoes) {
    if (op.tipo === 'set') lote.set(refDoc(op.caminho), op.dados);
    else if (op.tipo === 'atualizar') lote.update(refDoc(op.caminho), op.dados);
    else if (op.tipo === 'excluir') lote.delete(refDoc(op.caminho));
  }
  await lote.commit();
}
