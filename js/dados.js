// ============================================================
// dados.js — camada central de dados do aplicativo.
// As telas só conversam com este arquivo. Por baixo, ele usa o
// Firebase (dados-firebase.js) ou o modo demonstração
// (dados-demo.js), os dois com a mesma "cara".
//
// Importante: as gravações NÃO são aguardadas antes de atualizar
// a tela. O Firestore aplica a mudança na hora no aparelho e
// envia para a internet quando der — é isso que faz o app
// funcionar bem sem conexão.
// ============================================================

import * as calc from './calculos.js';
import { hojeISO, inicioDoMesISO, fmtMoeda, fmtData } from './util.js';

let driver = null;
let modoDemo = false;

export const estado = {
  usuario: null,
  clientes: [],
  emprestimos: [],
  parcelasPorEmprestimo: new Map(),
  pagamentosDoMes: [],
  carregouClientes: false,
  carregouEmprestimos: false,
};

export function emModoDemo() {
  return modoDemo;
}

// Liga a camada de dados. Devolve { configurado: false } se o
// arquivo firebase-config.js ainda não foi preenchido.
export async function iniciar(usarDemo = false) {
  modoDemo = !!usarDemo;
  driver = modoDemo ? await import('./dados-demo.js') : await import('./dados-firebase.js');
  if (!driver.configurado) return { configurado: false };
  driver.iniciar();
  return { configurado: true };
}

// ---------- Sessão ----------

export function ouvirSessao(retorno) {
  return driver.ouvirSessao((usuario) => {
    estado.usuario = usuario;
    retorno(usuario);
  });
}

export function entrar(email, senha, manterConectado) {
  return driver.entrar(email, senha, manterConectado);
}

export function recuperarSenha(email) {
  return driver.recuperarSenha(email);
}

export function sair() {
  return driver.sair();
}

// ---------- Ouvintes (dados ao vivo) ----------

let pararGerais = [];
const pararParcelas = new Map(); // emprestimoId -> função para parar
let avisoAgendado = false;

// Junta vários avisos seguidos em um só, para a tela não piscar.
function avisar() {
  if (avisoAgendado) return;
  avisoAgendado = true;
  setTimeout(() => {
    avisoAgendado = false;
    document.dispatchEvent(new CustomEvent('dados-mudaram'));
  }, 0);
}

export function iniciarOuvintes() {
  pararOuvintes();
  pararGerais.push(driver.ouvirClientes((lista) => {
    estado.clientes = lista;
    estado.carregouClientes = true;
    avisar();
  }));
  pararGerais.push(driver.ouvirEmprestimos((lista) => {
    estado.emprestimos = lista;
    estado.carregouEmprestimos = true;
    sincronizarOuvintesDeParcelas();
    avisar();
  }));
  pararGerais.push(driver.ouvirPagamentosDesde(inicioDoMesISO(), (lista) => {
    estado.pagamentosDoMes = lista;
    avisar();
  }));
}

// Mantém um ouvinte de parcelas para cada empréstimo ativo.
function sincronizarOuvintesDeParcelas() {
  const ativos = new Set(estado.emprestimos.filter((e) => e.status === 'ativo').map((e) => e.id));
  for (const [emprestimoId, parar] of pararParcelas) {
    if (!ativos.has(emprestimoId)) {
      parar();
      pararParcelas.delete(emprestimoId);
      estado.parcelasPorEmprestimo.delete(emprestimoId);
    }
  }
  for (const emprestimoId of ativos) {
    if (!pararParcelas.has(emprestimoId)) {
      pararParcelas.set(emprestimoId, driver.ouvirParcelas(emprestimoId, (lista) => {
        estado.parcelasPorEmprestimo.set(emprestimoId, lista);
        avisar();
      }));
    }
  }
}

export function pararOuvintes() {
  for (const parar of pararGerais) parar();
  pararGerais = [];
  for (const [, parar] of pararParcelas) parar();
  pararParcelas.clear();
  estado.clientes = [];
  estado.emprestimos = [];
  estado.parcelasPorEmprestimo = new Map();
  estado.pagamentosDoMes = [];
  estado.carregouClientes = false;
  estado.carregouEmprestimos = false;
}

// Ouvinte avulso, para a tela de detalhe (funciona também para
// empréstimos quitados/cancelados, que não ficam no estado geral).
export function ouvirParcelasDe(emprestimoId, retorno) {
  return driver.ouvirParcelas(emprestimoId, retorno);
}

// ---------- Acompanhamento das gravações (indicador "salvando…") ----------

let pendentes = 0;

function rastrear(promessa) {
  pendentes += 1;
  avisarConexao(false);
  promessa
    .then(() => {
      pendentes -= 1;
      avisarConexao(true);
    })
    .catch((erro) => {
      pendentes -= 1;
      console.error('Falha ao gravar:', erro);
      avisarConexao(false);
      document.dispatchEvent(new CustomEvent('erro-gravacao', { detail: erro }));
    });
}

export function gravacoesPendentes() {
  return pendentes;
}

function avisarConexao(salvou) {
  document.dispatchEvent(new CustomEvent('conexao-mudou', { detail: { pendentes, salvou } }));
}

// Divide listas grandes de operações (o Firestore aceita até 500 por lote).
function gravar(operacoes) {
  const TAMANHO = 400;
  for (let i = 0; i < operacoes.length; i += TAMANHO) {
    rastrear(driver.gravarLote(operacoes.slice(i, i + TAMANHO)));
  }
}

export function novoId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}

// ---------- Clientes ----------

export function obterCliente(id) {
  return estado.clientes.find((c) => c.id === id) || null;
}

export function clienteTemEmprestimos(id) {
  return estado.emprestimos.some((e) => e.clienteId === id);
}

export function salvarCliente(cliente, idExistente = null) {
  const id = idExistente || novoId();
  const operacoes = [];
  if (idExistente) {
    operacoes.push({ tipo: 'atualizar', caminho: ['clientes', id], dados: cliente });
    // Mantém a cópia do nome nos empréstimos sempre atualizada.
    const comNomeAntigo = estado.emprestimos.filter((e) => e.clienteId === id && e.clienteNome !== cliente.nome);
    for (const e of comNomeAntigo) {
      operacoes.push({ tipo: 'atualizar', caminho: ['emprestimos', e.id], dados: { clienteNome: cliente.nome } });
    }
    // A cópia do nome nos pagamentos também precisa acompanhar.
    if (comNomeAntigo.length) {
      atualizarNomeNosPagamentos(comNomeAntigo.map((e) => e.id), cliente.nome).catch((erro) => {
        console.error('Não deu para atualizar o nome nos pagamentos:', erro);
      });
    }
  } else {
    operacoes.push({
      tipo: 'set',
      caminho: ['clientes', id],
      dados: { ...cliente, ativo: true, criadoEm: driver.carimbo() },
    });
  }
  gravar(operacoes);
  return id;
}

async function atualizarNomeNosPagamentos(idsEmprestimos, nomeNovo) {
  const operacoes = [];
  for (const emprestimoId of idsEmprestimos) {
    const pagamentos = await driver.listarPagamentosDe(emprestimoId);
    for (const pagamento of pagamentos) {
      if (pagamento.clienteNome !== nomeNovo) {
        operacoes.push({ tipo: 'atualizar', caminho: ['pagamentos', pagamento.id], dados: { clienteNome: nomeNovo } });
      }
    }
  }
  if (operacoes.length) gravar(operacoes);
}

export function excluirCliente(id) {
  gravar([{ tipo: 'excluir', caminho: ['clientes', id] }]);
}

// ---------- Empréstimos ----------

export function obterEmprestimo(id) {
  return estado.emprestimos.find((e) => e.id === id) || null;
}

// configuracao: { clienteId, clienteNome, valorEmprestadoCentavos, dataEmprestimo,
//   modo, taxaMensal, periodicidade, primeiroVencimento, observacoes,
//   valores (centavos por parcela), totalCentavos, valorParcelaBaseCentavos }
export function criarEmprestimo(configuracao) {
  const id = novoId();
  const parcelas = calc.gerarParcelas({
    valores: configuracao.valores,
    periodicidade: configuracao.periodicidade,
    primeiroVencimento: configuracao.primeiroVencimento,
  });
  const operacoes = [{
    tipo: 'set',
    caminho: ['emprestimos', id],
    dados: {
      clienteId: configuracao.clienteId,
      clienteNome: configuracao.clienteNome,
      valorEmprestado: configuracao.valorEmprestadoCentavos,
      dataEmprestimo: configuracao.dataEmprestimo,
      modo: configuracao.modo,
      taxaMensal: configuracao.modo === 'juros_mensal' ? configuracao.taxaMensal : null,
      numParcelas: parcelas.length,
      valorParcela: configuracao.valorParcelaBaseCentavos,
      periodicidade: configuracao.periodicidade,
      primeiroVencimento: configuracao.primeiroVencimento,
      totalAReceber: configuracao.totalCentavos,
      status: 'ativo',
      observacoes: configuracao.observacoes || '',
      criadoEm: driver.carimbo(),
    },
  }];
  for (const p of parcelas) {
    operacoes.push({ tipo: 'set', caminho: ['emprestimos', id, 'parcelas', String(p.numero)], dados: p });
  }
  gravar(operacoes);
  return id;
}

export function cancelarEmprestimo(emprestimo) {
  gravar([{ tipo: 'atualizar', caminho: ['emprestimos', emprestimo.id], dados: { status: 'cancelado' } }]);
}

export async function excluirEmprestimo(emprestimo) {
  const parcelas = estado.parcelasPorEmprestimo.get(emprestimo.id) || await driver.listarParcelas(emprestimo.id);
  const pagamentos = await driver.listarPagamentosDe(emprestimo.id);
  const operacoes = [];
  for (const p of parcelas) {
    for (const comprovanteId of (p.comprovanteIds || [])) {
      operacoes.push({ tipo: 'excluir', caminho: ['comprovantes', comprovanteId] });
    }
    operacoes.push({ tipo: 'excluir', caminho: ['emprestimos', emprestimo.id, 'parcelas', String(p.numero)] });
  }
  for (const pg of pagamentos) {
    operacoes.push({ tipo: 'excluir', caminho: ['pagamentos', pg.id] });
  }
  operacoes.push({ tipo: 'excluir', caminho: ['emprestimos', emprestimo.id] });
  gravar(operacoes);
}

// ---------- Pagamentos ----------

// Registra um pagamento recebido. Devolve { alocacoes, quitou }.
export function registrarPagamento({ emprestimo, parcelas, numeroParcela, valorCentavos, dataISO, imagemBase64, abaterProximas }) {
  const { alocacoes } = calc.distribuirPagamento(parcelas, numeroParcela, valorCentavos, abaterProximas);
  if (!alocacoes.length) return { alocacoes, quitou: false };

  const operacoes = [];
  let anexouComprovante = false;

  for (const alocacao of alocacoes) {
    const dadosParcela = {
      valorPago: alocacao.valorPagoNovo,
      status: alocacao.statusNovo,
      dataPagamento: dataISO,
    };
    if (alocacao.numero === numeroParcela && imagemBase64) {
      const comprovanteId = novoId();
      const parcelaAlvo = parcelas.find((p) => p.numero === numeroParcela);
      dadosParcela.temComprovante = true;
      dadosParcela.comprovanteIds = [...(parcelaAlvo?.comprovanteIds || []), comprovanteId];
      operacoes.push({
        tipo: 'set',
        caminho: ['comprovantes', comprovanteId],
        dados: { emprestimoId: emprestimo.id, numeroParcela, imagemBase64, criadoEm: driver.carimbo() },
      });
      anexouComprovante = true;
    }
    operacoes.push({
      tipo: 'atualizar',
      caminho: ['emprestimos', emprestimo.id, 'parcelas', String(alocacao.numero)],
      dados: dadosParcela,
    });
    operacoes.push({
      tipo: 'set',
      caminho: ['pagamentos', novoId()],
      dados: {
        emprestimoId: emprestimo.id,
        clienteNome: emprestimo.clienteNome,
        numeroParcela: alocacao.numero,
        valor: alocacao.valorAplicado,
        data: dataISO,
        criadoEm: driver.carimbo(),
      },
    });
  }

  // Se por algum motivo a parcela alvo não recebeu valor, o comprovante
  // é anexado mesmo assim.
  if (imagemBase64 && !anexouComprovante) {
    const parcelaAlvo = parcelas.find((p) => p.numero === numeroParcela);
    if (parcelaAlvo) {
      operacoes.push(...operacoesDeAnexo(emprestimo, parcelaAlvo, imagemBase64));
    }
  }

  const statusNovoPorNumero = new Map(alocacoes.map((a) => [a.numero, a.statusNovo]));
  const quitou = parcelas.every((p) => (statusNovoPorNumero.get(p.numero) || p.status) === 'paga');
  if (quitou) {
    operacoes.push({ tipo: 'atualizar', caminho: ['emprestimos', emprestimo.id], dados: { status: 'quitado' } });
  }

  gravar(operacoes);
  return { alocacoes, quitou };
}

function operacoesDeAnexo(emprestimo, parcela, imagemBase64) {
  const comprovanteId = novoId();
  return [
    {
      tipo: 'set',
      caminho: ['comprovantes', comprovanteId],
      dados: { emprestimoId: emprestimo.id, numeroParcela: parcela.numero, imagemBase64, criadoEm: driver.carimbo() },
    },
    {
      tipo: 'atualizar',
      caminho: ['emprestimos', emprestimo.id, 'parcelas', String(parcela.numero)],
      dados: { temComprovante: true, comprovanteIds: [...(parcela.comprovanteIds || []), comprovanteId] },
    },
  ];
}

export function anexarComprovante(emprestimo, parcela, imagemBase64) {
  gravar(operacoesDeAnexo(emprestimo, parcela, imagemBase64));
}

// Quita o empréstimo inteiro (aceita valor negociado, com desconto).
export function quitarEmprestimo({ emprestimo, parcelas, valorCentavos, dataISO }) {
  const { alocacoes } = calc.distribuirQuitacao(parcelas, valorCentavos);
  const faltavaCentavos = parcelas.reduce((soma, p) => soma + calc.restanteParcela(p), 0);
  const operacoes = [];

  for (const alocacao of alocacoes) {
    operacoes.push({
      tipo: 'atualizar',
      caminho: ['emprestimos', emprestimo.id, 'parcelas', String(alocacao.numero)],
      dados: { valorPago: alocacao.valorPagoNovo, status: 'paga', dataPagamento: dataISO },
    });
    if (alocacao.valorAplicado > 0) {
      operacoes.push({
        tipo: 'set',
        caminho: ['pagamentos', novoId()],
        dados: {
          emprestimoId: emprestimo.id,
          clienteNome: emprestimo.clienteNome,
          numeroParcela: alocacao.numero,
          valor: alocacao.valorAplicado,
          data: dataISO,
          criadoEm: driver.carimbo(),
        },
      });
    }
  }

  let observacoes = emprestimo.observacoes || '';
  let nota = `Quitado em ${fmtData(dataISO)} — recebido ${fmtMoeda(valorCentavos)}`;
  if (valorCentavos < faltavaCentavos) {
    nota += ` (desconto de ${fmtMoeda(faltavaCentavos - valorCentavos)})`;
  }
  observacoes = observacoes ? `${observacoes}\n${nota}` : nota;
  operacoes.push({
    tipo: 'atualizar',
    caminho: ['emprestimos', emprestimo.id],
    dados: { status: 'quitado', observacoes },
  });

  gravar(operacoes);
}

// ---------- Comprovantes ----------

export function obterComprovante(id) {
  return driver.obterDoc(['comprovantes', id]);
}

export function excluirComprovante(emprestimoId, parcela, comprovanteId) {
  const restantes = (parcela.comprovanteIds || []).filter((c) => c !== comprovanteId);
  gravar([
    { tipo: 'excluir', caminho: ['comprovantes', comprovanteId] },
    {
      tipo: 'atualizar',
      caminho: ['emprestimos', emprestimoId, 'parcelas', String(parcela.numero)],
      dados: { comprovanteIds: restantes, temComprovante: restantes.length > 0 },
    },
  ]);
}

// ---------- Backup ----------

export async function listarTudoParaBackup(incluirComprovantes) {
  const [clientes, emprestimos, pagamentos] = await Promise.all([
    driver.listarColecao('clientes'),
    driver.listarColecao('emprestimos'),
    driver.listarColecao('pagamentos'),
  ]);
  for (const emprestimo of emprestimos) {
    emprestimo.parcelas = await driver.listarParcelas(emprestimo.id);
  }
  const resultado = { clientes, emprestimos, pagamentos };
  if (incluirComprovantes) {
    resultado.comprovantes = await driver.listarColecao('comprovantes');
  }
  return resultado;
}

// ---------- Resumos prontos para as telas ----------

export function resumoPainel() {
  return calc.resumoPainel(estado, hojeISO());
}

export function saldoPorCliente() {
  return calc.saldoPorCliente(estado);
}
