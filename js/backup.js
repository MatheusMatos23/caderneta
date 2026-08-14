// ============================================================
// backup.js — exportação dos dados.
// - JSON: arquivo completo, bom para guardar de tempos em tempos.
// - Excel (.xlsx): planilha com abas Clientes, Empréstimos,
//   Parcelas e Pagamentos, usando o SheetJS carregado na hora.
// ============================================================

import { listarTudoParaBackup } from './dados.js';
import { situacaoParcela, NOMES_SITUACAO, NOMES_PERIODICIDADE } from './calculos.js';
import { hojeISO, fmtData, fmtTelefone, baixarArquivo } from './util.js';

// ---------- Backup completo em JSON ----------

export async function exportarJSON(incluirComprovantes) {
  const dados = await listarTudoParaBackup(incluirComprovantes);
  const conteudo = JSON.stringify(
    {
      aplicativo: 'Caderneta',
      geradoEm: new Date().toISOString(),
      incluiComprovantes: !!incluirComprovantes,
      ...dados,
    },
    null,
    2
  );
  baixarArquivo(`caderneta-backup-${hojeISO()}.json`, conteudo, 'application/json');
}

// ---------- Planilha Excel ----------

const URL_SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
// Impressão digital do arquivo: se o conteúdo do CDN mudar (ataque ou
// adulteração), o navegador se recusa a rodar o script.
const INTEGRIDADE_SHEETJS = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';

async function carregarSheetJS() {
  if (window.XLSX) return window.XLSX;
  await new Promise((certo, errado) => {
    const script = document.createElement('script');
    script.src = URL_SHEETJS;
    script.integrity = INTEGRIDADE_SHEETJS;
    // 'anonymous' também faz a resposta entrar no cache offline do app.
    script.crossOrigin = 'anonymous';
    script.onload = certo;
    script.onerror = () => errado(new Error('Não deu para preparar a planilha agora. Verifique a internet e tente de novo.'));
    document.head.appendChild(script);
  });
  return window.XLSX;
}

const NOMES_MODO = {
  parcelas_combinadas: 'Parcelas combinadas',
  juros_mensal: 'Juros ao mês',
};

const NOMES_STATUS_EMPRESTIMO = {
  ativo: 'Ativo',
  quitado: 'Quitado',
  cancelado: 'Cancelado',
};

export async function exportarExcel() {
  const XLSX = await carregarSheetJS();
  const dados = await listarTudoParaBackup(false);
  const hoje = hojeISO();
  const livro = XLSX.utils.book_new();

  // --- Aba Clientes ---
  const linhasClientes = [['Nome', 'Apelido', 'Telefone', 'CPF', 'Endereço', 'Observações']];
  for (const c of ordenar(dados.clientes, 'nome')) {
    linhasClientes.push([c.nome || '', c.apelido || '', fmtTelefone(c.telefone || ''), c.cpf || '', c.endereco || '', c.observacoes || '']);
  }
  adicionarAba(XLSX, livro, 'Clientes', linhasClientes, [], [28, 18, 18, 16, 30, 30]);

  // --- Aba Empréstimos ---
  const linhasEmprestimos = [[
    'Cliente', 'Valor emprestado (R$)', 'Data do empréstimo', 'Modo', 'Taxa ao mês (%)',
    'Nº de parcelas', 'Valor da parcela (R$)', 'Periodicidade', '1º vencimento',
    'Total a receber (R$)', 'Situação', 'Observações',
  ]];
  for (const e of ordenar(dados.emprestimos, 'clienteNome')) {
    linhasEmprestimos.push([
      e.clienteNome || '',
      centavosParaReais(e.valorEmprestado),
      fmtData(e.dataEmprestimo),
      NOMES_MODO[e.modo] || e.modo || '',
      e.taxaMensal ?? '',
      e.numParcelas || 0,
      centavosParaReais(e.valorParcela),
      NOMES_PERIODICIDADE[e.periodicidade] || e.periodicidade || '',
      fmtData(e.primeiroVencimento),
      centavosParaReais(e.totalAReceber),
      NOMES_STATUS_EMPRESTIMO[e.status] || e.status || '',
      e.observacoes || '',
    ]);
  }
  adicionarAba(XLSX, livro, 'Empréstimos', linhasEmprestimos, [1, 6, 9], [26, 16, 14, 18, 12, 10, 14, 20, 14, 16, 12, 30]);

  // --- Aba Parcelas ---
  const linhasParcelas = [['Cliente', 'Empréstimo (data)', 'Parcela', 'Vencimento', 'Valor (R$)', 'Valor pago (R$)', 'Situação', 'Data do pagamento']];
  for (const e of ordenar(dados.emprestimos, 'clienteNome')) {
    for (const p of e.parcelas || []) {
      linhasParcelas.push([
        e.clienteNome || '',
        fmtData(e.dataEmprestimo),
        p.numero,
        fmtData(p.vencimento),
        centavosParaReais(p.valor),
        centavosParaReais(p.valorPago),
        NOMES_SITUACAO[situacaoParcela(p, hoje)] || '',
        p.dataPagamento ? fmtData(p.dataPagamento) : '',
      ]);
    }
  }
  adicionarAba(XLSX, livro, 'Parcelas', linhasParcelas, [4, 5], [26, 14, 8, 12, 12, 14, 12, 14]);

  // --- Aba Pagamentos ---
  const linhasPagamentos = [['Data', 'Cliente', 'Parcela', 'Valor recebido (R$)']];
  const pagamentos = [...dados.pagamentos].sort((a, b) => (a.data < b.data ? 1 : -1));
  for (const p of pagamentos) {
    linhasPagamentos.push([fmtData(p.data), p.clienteNome || '', p.numeroParcela ?? '', centavosParaReais(p.valor)]);
  }
  adicionarAba(XLSX, livro, 'Pagamentos', linhasPagamentos, [3], [14, 26, 8, 16]);

  XLSX.writeFile(livro, `caderneta-planilha-${hoje}.xlsx`);
}

// ---------- Ajudantes ----------

function centavosParaReais(centavos) {
  return Math.round(Number(centavos) || 0) / 100;
}

function ordenar(lista, campo) {
  return [...(lista || [])].sort((a, b) => String(a[campo] || '').localeCompare(String(b[campo] || ''), 'pt-BR'));
}

// Cria a aba, aplica formato de moeda nas colunas indicadas
// e define larguras de coluna amigáveis.
function adicionarAba(XLSX, livro, nome, linhas, colunasMoeda, larguras) {
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  if (linhas.length > 1 && colunasMoeda.length) {
    for (let linha = 1; linha < linhas.length; linha += 1) {
      for (const coluna of colunasMoeda) {
        const endereco = XLSX.utils.encode_cell({ r: linha, c: coluna });
        const celula = aba[endereco];
        if (celula && typeof celula.v === 'number') {
          celula.t = 'n';
          celula.z = '"R$" #,##0.00';
        }
      }
    }
  }
  if (larguras) {
    aba['!cols'] = larguras.map((wch) => ({ wch }));
  }
  XLSX.utils.book_append_sheet(livro, aba, nome);
}
