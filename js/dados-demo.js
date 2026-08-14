// ============================================================
// dados-demo.js — modo demonstração.
// Guarda tudo apenas na memória, com dados de exemplo, para a
// pessoa conhecer o aplicativo antes de configurar o Firebase.
// Nada é enviado para a internet e nada fica salvo.
// ============================================================

import { hojeISO, somarDias, somarMeses } from './util.js';
import { gerarParcelas, vencimentoDaParcela } from './calculos.js';

export const configurado = true;

const dados = {
  clientes: new Map(),
  emprestimos: new Map(),
  parcelas: new Map(), // emprestimoId -> Map(numero -> parcela)
  pagamentos: new Map(),
  comprovantes: new Map(),
  assinaturas: new Map(),
};

const ouvintes = new Set();
let usuario = null;
let avisarSessao = null;

export function iniciar() {
  semear();
}

// ---------- Sessão de demonstração ----------

export function ouvirSessao(retorno) {
  avisarSessao = retorno;
  retorno(usuario);
  return () => { avisarSessao = null; };
}

export async function entrar() {
  usuario = { uid: 'demonstracao', email: 'demonstração' };
  if (avisarSessao) avisarSessao(usuario);
}

export async function sair() {
  usuario = null;
  if (avisarSessao) avisarSessao(usuario);
}

export async function recuperarSenha() {}

export function carimbo() {
  return new Date().toISOString();
}

// ---------- Leitura ----------

function clonar(valor) {
  return structuredClone(valor);
}

function registrar(retorno, montar) {
  const avisa = () => retorno(clonar(montar()));
  ouvintes.add(avisa);
  avisa();
  return () => ouvintes.delete(avisa);
}

function avisarTodos() {
  for (const avisa of [...ouvintes]) avisa();
}

function listaParcelas(emprestimoId) {
  const mapa = dados.parcelas.get(emprestimoId);
  return mapa ? [...mapa.values()].sort((a, b) => a.numero - b.numero) : [];
}

export function ouvirClientes(retorno) {
  return registrar(retorno, () => [...dados.clientes.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
}

export function ouvirEmprestimos(retorno) {
  return registrar(retorno, () => [...dados.emprestimos.values()]);
}

export function ouvirParcelas(emprestimoId, retorno) {
  return registrar(retorno, () => listaParcelas(emprestimoId));
}

export function ouvirPagamentosDesde(dataISO, retorno) {
  return registrar(retorno, () => [...dados.pagamentos.values()].filter((p) => p.data >= dataISO));
}

export async function obterDoc(caminho) {
  const { mapa, id } = alvoDe(caminho);
  return mapa.has(id) ? clonar(mapa.get(id)) : null;
}

export async function listarColecao(nome) {
  return clonar([...dados[nome].values()]);
}

export async function listarParcelas(emprestimoId) {
  return clonar(listaParcelas(emprestimoId));
}

export async function listarPagamentosDe(emprestimoId) {
  return clonar([...dados.pagamentos.values()].filter((p) => p.emprestimoId === emprestimoId));
}

// ---------- Gravação ----------

function alvoDe(caminho) {
  if (caminho.length === 2) {
    return { mapa: dados[caminho[0]], id: caminho[1] };
  }
  // ['emprestimos', emprestimoId, 'parcelas', numero]
  const emprestimoId = caminho[1];
  if (!dados.parcelas.has(emprestimoId)) dados.parcelas.set(emprestimoId, new Map());
  return { mapa: dados.parcelas.get(emprestimoId), id: caminho[3] };
}

export async function gravarLote(operacoes) {
  for (const op of operacoes) {
    const { mapa, id } = alvoDe(op.caminho);
    if (op.tipo === 'set') {
      mapa.set(id, { ...clonar(op.dados), id });
    } else if (op.tipo === 'atualizar') {
      mapa.set(id, { ...(mapa.get(id) || { id }), ...clonar(op.dados) });
    } else if (op.tipo === 'excluir') {
      mapa.delete(id);
    }
  }
  avisarTodos();
}

// ---------- Dados de exemplo ----------

function semear() {
  if (dados.clientes.size) return;
  const hoje = hojeISO();
  const agora = carimbo();

  const novoCliente = (id, cliente) => {
    dados.clientes.set(id, { id, ativo: true, criadoEm: agora, cpf: '', endereco: '', observacoes: '', apelido: '', ...cliente });
  };

  const novoEmprestimo = (id, emp, parcelas) => {
    dados.emprestimos.set(id, { id, status: 'ativo', observacoes: '', criadoEm: agora, ...emp });
    const mapa = new Map();
    for (const p of parcelas) mapa.set(String(p.numero), { ...p, id: String(p.numero) });
    dados.parcelas.set(id, mapa);
  };

  let contadorPagamento = 1;
  const pagar = (emprestimoId, clienteNome, numero, valorCentavos, dataISO) => {
    const parcela = dados.parcelas.get(emprestimoId).get(String(numero));
    parcela.valorPago += valorCentavos;
    parcela.status = parcela.valorPago >= parcela.valor ? 'paga' : 'parcial';
    parcela.dataPagamento = dataISO;
    dados.pagamentos.set('pg' + contadorPagamento, {
      id: 'pg' + contadorPagamento,
      emprestimoId,
      clienteNome,
      numeroParcela: numero,
      valor: valorCentavos,
      data: dataISO,
      criadoEm: agora,
    });
    contadorPagamento += 1;
  };

  novoCliente('c1', {
    nome: 'José Carlos da Silva',
    apelido: 'Zé da Padaria',
    telefone: '11987654321',
    endereco: 'Rua das Flores, 12',
    observacoes: 'Prefere pagar às quintas-feiras.',
  });
  novoCliente('c2', { nome: 'Maria Aparecida Souza', telefone: '11976543210' });
  novoCliente('c3', { nome: 'Antônio Ferreira', apelido: 'Tonho', telefone: '21998877665' });

  // Empréstimo 1 — José: 12 parcelas mensais de R$ 120,00.
  // Três pagas, a 4ª venceu há 10 dias e ele só pagou uma parte (fica "atrasada").
  const primeiro1 = somarDias(somarMeses(hoje, -3), -10);
  novoEmprestimo('e1', {
    clienteId: 'c1',
    clienteNome: 'José Carlos da Silva',
    valorEmprestado: 120000,
    dataEmprestimo: somarDias(primeiro1, -30),
    modo: 'parcelas_combinadas',
    taxaMensal: null,
    numParcelas: 12,
    valorParcela: 12000,
    periodicidade: 'mensal',
    primeiroVencimento: primeiro1,
    totalAReceber: 144000,
  }, gerarParcelas({ valores: Array(12).fill(12000), periodicidade: 'mensal', primeiroVencimento: primeiro1 }));
  pagar('e1', 'José Carlos da Silva', 1, 12000, vencimentoDaParcela(primeiro1, 'mensal', 0));
  pagar('e1', 'José Carlos da Silva', 2, 12000, vencimentoDaParcela(primeiro1, 'mensal', 1));
  pagar('e1', 'José Carlos da Silva', 3, 12000, vencimentoDaParcela(primeiro1, 'mensal', 2));
  pagar('e1', 'José Carlos da Silva', 4, 6000, somarDias(hoje, -2)); // pagamento parcial recente

  // Empréstimo 2 — Maria: 10 parcelas semanais de R$ 60,00.
  // Oito pagas; a 9ª vence daqui a 3 dias (aparece em "próximos vencimentos").
  const primeiro2 = somarDias(hoje, 3 - 7 * 8);
  novoEmprestimo('e2', {
    clienteId: 'c2',
    clienteNome: 'Maria Aparecida Souza',
    valorEmprestado: 50000,
    dataEmprestimo: somarDias(primeiro2, -7),
    modo: 'parcelas_combinadas',
    taxaMensal: null,
    numParcelas: 10,
    valorParcela: 6000,
    periodicidade: 'semanal',
    primeiroVencimento: primeiro2,
    totalAReceber: 60000,
  }, gerarParcelas({ valores: Array(10).fill(6000), periodicidade: 'semanal', primeiroVencimento: primeiro2 }));
  for (let n = 1; n <= 8; n += 1) {
    pagar('e2', 'Maria Aparecida Souza', n, 6000, vencimentoDaParcela(primeiro2, 'semanal', n - 1));
  }

  // Empréstimo 3 — Antônio: já quitado (aparece no histórico).
  const primeiro3 = somarMeses(hoje, -5);
  novoEmprestimo('e3', {
    clienteId: 'c3',
    clienteNome: 'Antônio Ferreira',
    valorEmprestado: 80000,
    dataEmprestimo: somarDias(primeiro3, -30),
    modo: 'juros_mensal',
    taxaMensal: 3.75,
    numParcelas: 4,
    valorParcela: 23000,
    periodicidade: 'mensal',
    primeiroVencimento: primeiro3,
    totalAReceber: 92000,
    status: 'quitado',
  }, gerarParcelas({ valores: Array(4).fill(23000), periodicidade: 'mensal', primeiroVencimento: primeiro3 }));
  for (let n = 1; n <= 4; n += 1) {
    pagar('e3', 'Antônio Ferreira', n, 23000, vencimentoDaParcela(primeiro3, 'mensal', n - 1));
  }
}
