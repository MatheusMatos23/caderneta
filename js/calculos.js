// ============================================================
// calculos.js — regras de negócio puras (sem banco, sem tela).
// Tudo aqui recebe dados e devolve dados; fácil de conferir.
// Valores monetários sempre em centavos (número inteiro).
// ============================================================

import { somarDias, somarMeses, diasEntre } from './util.js';

// ---------- Criação de empréstimo ----------

// Calcula o resumo de um empréstimo novo a partir do que foi digitado.
// entrada = {
//   modo: 'parcelas_combinadas' | 'juros_mensal',
//   valorEmprestadoCentavos, numParcelas, periodicidade,
//   valorParcelaCentavos (modo combinado), taxaMensal (modo juros)
// }
// Devolve { valores: [centavos por parcela], totalCentavos,
//           acrescimoCentavos, percentual, valorParcelaBaseCentavos }
export function resumoNovoEmprestimo(entrada) {
  const n = Math.max(1, Math.floor(Number(entrada.numParcelas) || 0));
  const valorEmprestado = Number(entrada.valorEmprestadoCentavos) || 0;
  let valores = [];
  let totalCentavos = 0;

  if (entrada.modo === 'juros_mensal') {
    // Juros simples: o período total depende da periodicidade das parcelas.
    const taxa = Number(entrada.taxaMensal) || 0;
    const meses = mesesDoPeriodo(entrada.periodicidade, n);
    const jurosCentavos = Math.round(valorEmprestado * (taxa / 100) * meses);
    totalCentavos = valorEmprestado + jurosCentavos;
    const base = Math.floor(totalCentavos / n);
    valores = Array(n).fill(base);
    valores[n - 1] = totalCentavos - base * (n - 1); // ajuste de centavos na última
  } else {
    const vp = Number(entrada.valorParcelaCentavos) || 0;
    valores = Array(n).fill(vp);
    totalCentavos = vp * n;
  }

  const acrescimoCentavos = totalCentavos - valorEmprestado;
  const percentual = valorEmprestado > 0 ? (acrescimoCentavos / valorEmprestado) * 100 : 0;
  return {
    valores,
    totalCentavos,
    acrescimoCentavos,
    percentual,
    valorParcelaBaseCentavos: valores[0] || 0,
  };
}

// Quantos meses o carnê dura, para o cálculo de juros simples.
export function mesesDoPeriodo(periodicidade, numParcelas) {
  if (periodicidade === 'quinzenal') return numParcelas / 2; // 15 em 15 dias
  if (periodicidade === 'semanal') return (numParcelas * 7) / 30;
  return numParcelas; // mensal
}

// Gera a lista de parcelas com vencimentos.
// entrada = { valores: [centavos], periodicidade, primeiroVencimento: 'AAAA-MM-DD' }
export function gerarParcelas({ valores, periodicidade, primeiroVencimento }) {
  return valores.map((valor, i) => ({
    numero: i + 1,
    vencimento: vencimentoDaParcela(primeiroVencimento, periodicidade, i),
    valor,
    valorPago: 0,
    status: 'pendente',
    dataPagamento: null,
    temComprovante: false,
    comprovanteIds: [],
  }));
}

export function vencimentoDaParcela(primeiroVencimento, periodicidade, indice) {
  if (periodicidade === 'quinzenal') return somarDias(primeiroVencimento, 15 * indice);
  if (periodicidade === 'semanal') return somarDias(primeiroVencimento, 7 * indice);
  return somarMeses(primeiroVencimento, indice); // mensal, sem "escorregar" o dia
}

export const NOMES_PERIODICIDADE = {
  mensal: 'Mensal',
  quinzenal: 'Quinzenal (a cada 15 dias)',
  semanal: 'Semanal',
};

// ---------- Situação das parcelas ----------

export function restanteParcela(parcela) {
  if (parcela.status === 'paga') return 0;
  return Math.max(0, (parcela.valor || 0) - (parcela.valorPago || 0));
}

// Situação para exibição: "atrasada" nunca é gravada no banco,
// é calculada na hora de mostrar.
export function situacaoParcela(parcela, hoje) {
  if (parcela.status === 'paga') return 'paga';
  if (parcela.vencimento && parcela.vencimento < hoje) return 'atrasada';
  return parcela.status === 'parcial' ? 'parcial' : 'pendente';
}

export const NOMES_SITUACAO = {
  paga: 'Paga',
  parcial: 'Pagou parte',
  atrasada: 'Atrasada',
  pendente: 'A vencer',
};

// Resumo de um empréstimo a partir das parcelas.
export function resumoEmprestimo(parcelas) {
  const total = parcelas.length;
  const pagas = parcelas.filter((p) => p.status === 'paga').length;
  const totalCentavos = soma(parcelas.map((p) => p.valor || 0));
  const pagoCentavos = soma(parcelas.map((p) => p.valorPago || 0));
  const faltaCentavos = soma(parcelas.map(restanteParcela));
  const progresso = totalCentavos > 0 ? Math.min(100, Math.round((1 - faltaCentavos / totalCentavos) * 100)) : 0;
  return { total, pagas, totalCentavos, pagoCentavos, faltaCentavos, progresso };
}

function soma(numeros) {
  return numeros.reduce((acumulado, n) => acumulado + (Number(n) || 0), 0);
}

// ---------- Registro de pagamento ----------

// Distribui um pagamento recebido a partir de uma parcela.
// - Se o valor cobre a parcela e sobra, e abaterProximas = true,
//   a sobra vai abatendo as próximas parcelas em aberto, na ordem.
// - Se abaterProximas = false, tudo fica registrado na própria parcela.
// Devolve { alocacoes: [{numero, valorAplicado, valorPagoNovo, statusNovo}] }
export function distribuirPagamento(parcelas, numeroInicial, valorCentavos, abaterProximas) {
  const alocacoes = [];
  const alvo = parcelas.find((p) => p.numero === numeroInicial);
  const valor = Math.max(0, Math.floor(Number(valorCentavos) || 0));
  if (!alvo || valor <= 0) return { alocacoes };

  if (!abaterProximas) {
    const pagoNovo = (alvo.valorPago || 0) + valor;
    alocacoes.push({
      numero: alvo.numero,
      valorAplicado: valor,
      valorPagoNovo: pagoNovo,
      statusNovo: statusPorValor(pagoNovo, alvo.valor),
    });
    return { alocacoes };
  }

  let restante = valor;

  // Primeiro a própria parcela, até completar o valor dela.
  const faltaAlvo = Math.max(0, (alvo.valor || 0) - (alvo.valorPago || 0));
  const aplicarAlvo = Math.min(restante, faltaAlvo);
  if (aplicarAlvo > 0) {
    const pagoNovo = (alvo.valorPago || 0) + aplicarAlvo;
    alocacoes.push({
      numero: alvo.numero,
      valorAplicado: aplicarAlvo,
      valorPagoNovo: pagoNovo,
      statusNovo: statusPorValor(pagoNovo, alvo.valor),
    });
    restante -= aplicarAlvo;
  }

  // Depois as PRÓXIMAS parcelas em aberto (números maiores), na ordem
  // do carnê — é o que o botão "abater das próximas" promete.
  const proximas = parcelas
    .filter((p) => p.numero > numeroInicial && p.status !== 'paga')
    .sort((a, b) => a.numero - b.numero);

  for (const p of proximas) {
    if (restante <= 0) break;
    const falta = Math.max(0, (p.valor || 0) - (p.valorPago || 0));
    if (falta <= 0) continue;
    const aplicar = Math.min(restante, falta);
    const pagoNovo = (p.valorPago || 0) + aplicar;
    alocacoes.push({
      numero: p.numero,
      valorAplicado: aplicar,
      valorPagoNovo: pagoNovo,
      statusNovo: statusPorValor(pagoNovo, p.valor),
    });
    restante -= aplicar;
  }

  // Se ainda sobrou (pagou mais do que devia no total),
  // registra o excedente na última alocação para não perder dinheiro.
  if (restante > 0) {
    const ultima = alocacoes[alocacoes.length - 1];
    if (ultima) {
      ultima.valorAplicado += restante;
      ultima.valorPagoNovo += restante;
    } else {
      const pagoNovo = (alvo.valorPago || 0) + restante;
      alocacoes.push({
        numero: alvo.numero,
        valorAplicado: restante,
        valorPagoNovo: pagoNovo,
        statusNovo: statusPorValor(pagoNovo, alvo.valor),
      });
    }
  }

  return { alocacoes };
}

function statusPorValor(valorPago, valorParcela) {
  if (valorPago >= (valorParcela || 0)) return 'paga';
  return valorPago > 0 ? 'parcial' : 'pendente';
}

// Quitação do empréstimo: todas as parcelas em aberto ficam "pagas",
// e o valor recebido é distribuído na ordem (pode haver desconto).
export function distribuirQuitacao(parcelas, valorCentavos) {
  const alocacoes = [];
  let restante = Math.max(0, Math.floor(Number(valorCentavos) || 0));
  const abertas = parcelas.filter((p) => p.status !== 'paga').sort((a, b) => a.numero - b.numero);

  for (const p of abertas) {
    const falta = Math.max(0, (p.valor || 0) - (p.valorPago || 0));
    const aplicar = Math.min(restante, falta);
    alocacoes.push({
      numero: p.numero,
      valorAplicado: aplicar,
      valorPagoNovo: (p.valorPago || 0) + aplicar,
      statusNovo: 'paga',
    });
    restante -= aplicar;
  }

  // Excedente (pagou mais do que faltava): fica na última parcela.
  if (restante > 0 && alocacoes.length > 0) {
    const ultima = alocacoes[alocacoes.length - 1];
    ultima.valorAplicado += restante;
    ultima.valorPagoNovo += restante;
  }

  return { alocacoes };
}

// ---------- Painel (tela Início) ----------

// Calcula os números e as listas do painel.
// estado = { emprestimos, parcelasPorEmprestimo (Map), pagamentosDoMes }
export function resumoPainel(estado, hoje) {
  const ativos = estado.emprestimos.filter((e) => e.status === 'ativo');
  let naRuaCentavos = 0;
  const atrasadas = [];
  const proximas = [];

  for (const emp of ativos) {
    const parcelas = estado.parcelasPorEmprestimo.get(emp.id) || [];
    for (const p of parcelas) {
      const restante = restanteParcela(p);
      naRuaCentavos += restante;
      if (p.status === 'paga' || restante <= 0) continue;
      const item = {
        emprestimo: emp,
        parcela: p,
        restanteCentavos: restante,
        diasAtraso: diasEntre(p.vencimento, hoje),
      };
      if (p.vencimento < hoje) {
        atrasadas.push(item);
      } else if (diasEntre(hoje, p.vencimento) <= 7) {
        proximas.push(item);
      }
    }
  }

  atrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso);
  proximas.sort((a, b) => (a.parcela.vencimento < b.parcela.vencimento ? -1 : 1));

  const mesAtual = hoje.slice(0, 7);
  const recebidoMesCentavos = soma(
    estado.pagamentosDoMes.filter((p) => String(p.data || '').startsWith(mesAtual)).map((p) => p.valor)
  );

  return {
    naRuaCentavos,
    recebidoMesCentavos,
    emAtrasoQtd: atrasadas.length,
    emAtrasoCentavos: soma(atrasadas.map((a) => a.restanteCentavos)),
    proximos7Centavos: soma(proximas.map((a) => a.restanteCentavos)),
    proximos7Qtd: proximas.length,
    atrasadas,
    proximas,
  };
}

// Saldo devedor por cliente (só empréstimos ativos).
export function saldoPorCliente(estado) {
  const saldos = new Map();
  for (const emp of estado.emprestimos.filter((e) => e.status === 'ativo')) {
    const parcelas = estado.parcelasPorEmprestimo.get(emp.id) || [];
    const falta = soma(parcelas.map(restanteParcela));
    saldos.set(emp.clienteId, (saldos.get(emp.clienteId) || 0) + falta);
  }
  return saldos;
}
