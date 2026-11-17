import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { configNumero } from "../config";
import { indicadoresPosVenda } from "./indicadores-posvenda";
import { listarInadimplentes } from "./cobranca";
import { hojeSP } from "@/lib/venda";

// Formato comum: a mesma estrutura alimenta a tela e o CSV (nunca divergem).
export type TipoColuna = "texto" | "moeda" | "numero" | "pct" | "data" | "telefone";
export type Coluna = { chave: string; rotulo: string; tipo?: TipoColuna };
export type Linha = Record<string, string | number | Date | null> & { _href?: string };
export type Relatorio = {
  titulo: string;
  descricao: string;
  colunas: Coluna[];
  linhas: Linha[];
  colunaLink?: string; // coluna que vira link para `_href` da linha
  resumo?: { rotulo: string; valor: string | number; tipo?: TipoColuna }[];
  grafico?: { tipo: "colunas" | "ranking"; dados: { nome: string; total: number; detalhe?: string }[] };
};

export type FiltroRelatorio = { de: string; ate: string; lojaId?: string; vendedorId?: string; agrupar?: "dia" | "semana" | "mes" };

export const TIPOS_RELATORIO = [
  { chave: "vendas", rotulo: "Faturamento" },
  { chave: "vendedores", rotulo: "Vendedores" },
  { chave: "produtos", rotulo: "Mais vendidos" },
  { chave: "menos-vendidos", rotulo: "Menos vendidos" },
  { chave: "clientes-recorrentes", rotulo: "Clientes recorrentes" },
  { chave: "clientes-inativos", rotulo: "Sem compras recentes" },
  { chave: "aniversariantes", rotulo: "Aniversariantes" },
  { chave: "pos-venda", rotulo: "Pós-venda" },
  { chave: "inadimplencia", rotulo: "Inadimplência" },
  { chave: "estoque-baixo", rotulo: "Estoque baixo" },
] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]["chave"];

const inicio = (iso: string) => new Date(`${iso}T00:00:00-03:00`);
const fim = (iso: string) => new Date(`${iso}T23:59:59.999-03:00`);
// "dataHora" é timestamp sem fuso gravado em UTC: converte para o dia de Brasília.
const diaSP = Prisma.sql`(("dataHora" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')`;

function filtrosVendaSql(f: FiltroRelatorio, alias = "v") {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`${a}.status = 'CONFIRMADA' AND ${a}."dataHora" >= ${inicio(f.de)} AND ${a}."dataHora" <= ${fim(f.ate)}
    ${f.lojaId ? Prisma.sql`AND ${a}."lojaId" = ${f.lojaId}` : Prisma.empty}
    ${f.vendedorId ? Prisma.sql`AND ${a}."vendedorId" = ${f.vendedorId}` : Prisma.empty}`;
}
const num = (v: unknown) => Number(v ?? 0);

async function relVendas(f: FiltroRelatorio): Promise<Relatorio> {
  const unidade = f.agrupar ?? "dia";
  const trunc = Prisma.raw(`'${unidade === "semana" ? "week" : unidade === "mes" ? "month" : "day"}'`);
  const linhas = await db.$queryRaw<{ periodo: Date; vendas: bigint; bruto: Prisma.Decimal; desconto: Prisma.Decimal; liquido: Prisma.Decimal }[]>`
    SELECT date_trunc(${trunc}, ${diaSP})::date AS periodo, COUNT(*) AS vendas,
           SUM("valorBruto") AS bruto, SUM("descontoValor") AS desconto, SUM("valorLiquido") AS liquido
    FROM "Venda" v WHERE ${filtrosVendaSql(f)}
    GROUP BY 1 ORDER BY 1`;
  const rotulo = (d: Date) => {
    const iso = d.toISOString().slice(0, 10);
    if (unidade === "mes") return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    const br = `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    return unidade === "semana" ? `Semana de ${br}` : br;
  };
  const dados = linhas.map((l) => ({
    periodo: rotulo(l.periodo),
    vendas: Number(l.vendas),
    bruto: num(l.bruto),
    desconto: num(l.desconto),
    liquido: num(l.liquido),
    ticket: Number(l.vendas) ? num(l.liquido) / Number(l.vendas) : 0,
  }));
  const total = dados.reduce((s, d) => ({ vendas: s.vendas + d.vendas, bruto: s.bruto + d.bruto, desconto: s.desconto + d.desconto, liquido: s.liquido + d.liquido }), { vendas: 0, bruto: 0, desconto: 0, liquido: 0 });
  return {
    titulo: "Faturamento por período",
    descricao: "Vendas confirmadas (canceladas não entram). Desconto = diferença entre valor bruto e líquido.",
    colunas: [
      { chave: "periodo", rotulo: unidade === "mes" ? "Mês" : unidade === "semana" ? "Semana" : "Dia" },
      { chave: "vendas", rotulo: "Vendas", tipo: "numero" },
      { chave: "bruto", rotulo: "Bruto", tipo: "moeda" },
      { chave: "desconto", rotulo: "Descontos", tipo: "moeda" },
      { chave: "liquido", rotulo: "Faturamento", tipo: "moeda" },
      { chave: "ticket", rotulo: "Ticket médio", tipo: "moeda" },
    ],
    linhas: dados,
    resumo: [
      { rotulo: "Faturamento", valor: total.liquido, tipo: "moeda" },
      { rotulo: "Vendas", valor: total.vendas, tipo: "numero" },
      { rotulo: "Ticket médio", valor: total.vendas ? total.liquido / total.vendas : 0, tipo: "moeda" },
      { rotulo: "Descontos", valor: total.desconto, tipo: "moeda" },
    ],
    grafico: { tipo: "colunas", dados: dados.map((d) => ({ nome: d.periodo, total: d.liquido, detalhe: `${d.vendas} vendas` })) },
  };
}

/** Receita líquida rateada por item (desconto da venda distribuído proporcionalmente) e custo congelado na venda. */
const receitaItem = Prisma.sql`i."valorTotal" * v."valorLiquido" / NULLIF(v."valorBruto", 0)`;

async function relVendedores(f: FiltroRelatorio): Promise<Relatorio> {
  const [linhas, pv] = await Promise.all([
    db.$queryRaw<{ id: string; nome: string; vendas: bigint; liquido: Prisma.Decimal; bruto: Prisma.Decimal; desconto: Prisma.Decimal; custo: Prisma.Decimal }[]>`
      SELECT ve.id, ve.nome, COUNT(DISTINCT v.id) AS vendas,
             (SELECT SUM(x."valorLiquido") FROM "Venda" x WHERE x."vendedorId" = ve.id AND ${filtrosVendaSql(f, "x")}) AS liquido,
             (SELECT SUM(x."valorBruto") FROM "Venda" x WHERE x."vendedorId" = ve.id AND ${filtrosVendaSql(f, "x")}) AS bruto,
             (SELECT SUM(x."descontoValor") FROM "Venda" x WHERE x."vendedorId" = ve.id AND ${filtrosVendaSql(f, "x")}) AS desconto,
             SUM(i."custoUnitario" * i.quantidade) AS custo
      FROM "Venda" v JOIN "Vendedor" ve ON ve.id = v."vendedorId" JOIN "VendaItem" i ON i."vendaId" = v.id
      WHERE ${filtrosVendaSql(f)}
      GROUP BY ve.id, ve.nome`,
    indicadoresPosVenda({ de: inicio(f.de), ate: fim(f.ate), lojaId: f.lojaId, vendedorId: f.vendedorId }),
  ]);
  const dados = linhas
    .map((l) => {
      const liquido = num(l.liquido);
      const custo = num(l.custo);
      const p = pv.porVendedor.find((x) => x.vendedorId === l.id);
      return {
        _href: `/relatorios/vendedor/${l.id}`,
        nome: l.nome,
        vendas: Number(l.vendas),
        liquido,
        ticket: Number(l.vendas) ? liquido / Number(l.vendas) : 0,
        desconto: num(l.desconto),
        pctDesconto: num(l.bruto) ? (num(l.desconto) / num(l.bruto)) * 100 : 0,
        margem: liquido - custo,
        pctMargem: liquido ? ((liquido - custo) / liquido) * 100 : 0,
        posVendaNoPrazo: p?.taxaNoPrazo ?? null,
        posVendaPendentes: p?.pendentes ?? 0,
      };
    })
    .sort((a, b) => b.liquido - a.liquido)
    .map((d, i) => ({ posicao: `${i + 1}º`, ...d }));
  return {
    titulo: "Ranking de vendedores",
    descricao: "Clique no vendedor para ver o desempenho individual. Margem = faturamento − custo dos produtos (custo gravado no momento da venda).",
    colunas: [
      { chave: "posicao", rotulo: "#" },
      { chave: "nome", rotulo: "Vendedor" },
      { chave: "vendas", rotulo: "Vendas", tipo: "numero" },
      { chave: "liquido", rotulo: "Faturamento", tipo: "moeda" },
      { chave: "ticket", rotulo: "Ticket médio", tipo: "moeda" },
      { chave: "desconto", rotulo: "Descontos", tipo: "moeda" },
      { chave: "pctDesconto", rotulo: "% desconto", tipo: "pct" },
      { chave: "margem", rotulo: "Margem bruta", tipo: "moeda" },
      { chave: "pctMargem", rotulo: "% margem", tipo: "pct" },
      { chave: "posVendaNoPrazo", rotulo: "Pós-venda no prazo", tipo: "pct" },
      { chave: "posVendaPendentes", rotulo: "Pós-vendas pendentes", tipo: "numero" },
    ],
    linhas: dados,
    grafico: { tipo: "ranking", dados: dados.map((d) => ({ nome: d.nome, total: d.liquido, detalhe: `${d.vendas} vendas` })) },
  };
}

async function relProdutos(f: FiltroRelatorio, ordem: "mais" | "menos"): Promise<Relatorio> {
  const linhas = await db.$queryRaw<{ id: string; codigo: string; nome: string; marca: string | null; categoria: string; qtd: bigint | null; receita: Prisma.Decimal | null; custo: Prisma.Decimal | null; estoque: bigint | null }[]>`
    WITH vendido AS (
      SELECT pv."produtoId", SUM(i.quantidade) AS qtd, SUM(${receitaItem}) AS receita, SUM(i."custoUnitario" * i.quantidade) AS custo
      FROM "VendaItem" i JOIN "Venda" v ON v.id = i."vendaId" JOIN "ProdutoVariacao" pv ON pv.id = i."variacaoId"
      WHERE ${filtrosVendaSql(f)}
      GROUP BY pv."produtoId"
    ), estoque AS (
      SELECT pv."produtoId", SUM(s.quantidade) AS estoque
      FROM "EstoqueSaldo" s JOIN "ProdutoVariacao" pv ON pv.id = s."variacaoId"
      ${f.lojaId ? Prisma.sql`WHERE s."lojaId" = ${f.lojaId}` : Prisma.empty}
      GROUP BY pv."produtoId"
    )
    SELECT p.id, p.codigo, p.nome, m.nome AS marca, c.nome AS categoria, vd.qtd, vd.receita, vd.custo, e.estoque
    FROM "Produto" p
    JOIN "Categoria" c ON c.id = p."categoriaId"
    LEFT JOIN "Marca" m ON m.id = p."marcaId"
    LEFT JOIN vendido vd ON vd."produtoId" = p.id
    LEFT JOIN estoque e ON e."produtoId" = p.id
    WHERE ${ordem === "mais" ? Prisma.sql`vd.qtd > 0` : Prisma.sql`p.ativo`}
    ORDER BY ${ordem === "mais" ? Prisma.sql`vd.qtd DESC, vd.receita DESC` : Prisma.sql`COALESCE(vd.qtd, 0) ASC, e.estoque DESC NULLS LAST`}
    LIMIT 50`;
  const dados = linhas.map((l) => {
    const receita = num(l.receita);
    const custo = num(l.custo);
    return {
      _href: `/produtos/${l.id}`,
      codigo: l.codigo,
      nome: l.nome,
      marca: l.marca ?? "",
      categoria: l.categoria,
      qtd: Number(l.qtd ?? 0),
      receita,
      margem: receita - custo,
      pctMargem: receita ? ((receita - custo) / receita) * 100 : 0,
      estoque: Number(l.estoque ?? 0),
    };
  });
  const total = dados.reduce((s, d) => ({ receita: s.receita + d.receita, margem: s.margem + d.margem }), { receita: 0, margem: 0 });
  return {
    titulo: ordem === "mais" ? "Produtos mais vendidos" : "Produtos menos vendidos",
    descricao:
      ordem === "mais"
        ? "Até 50 produtos, por quantidade. Receita com o desconto da venda rateado entre os itens; margem bruta estimada = receita − custo."
        : "Produtos ativos com menor saída no período (inclui os que não venderam), com o estoque parado. Bom para promoções e para não repor.",
    colunas: [
      { chave: "codigo", rotulo: "Código" },
      { chave: "nome", rotulo: "Produto" },
      { chave: "marca", rotulo: "Marca" },
      { chave: "categoria", rotulo: "Categoria" },
      { chave: "qtd", rotulo: "Qtd. vendida", tipo: "numero" },
      { chave: "receita", rotulo: "Receita", tipo: "moeda" },
      { chave: "margem", rotulo: "Margem bruta", tipo: "moeda" },
      { chave: "pctMargem", rotulo: "% margem", tipo: "pct" },
      { chave: "estoque", rotulo: f.lojaId ? "Estoque na loja" : "Estoque total", tipo: "numero" },
    ],
    linhas: dados,
    resumo: ordem === "mais" ? [
      { rotulo: "Receita (itens listados)", valor: total.receita, tipo: "moeda" },
      { rotulo: "Margem bruta estimada", valor: total.margem, tipo: "moeda" },
      { rotulo: "% margem", valor: total.receita ? (total.margem / total.receita) * 100 : 0, tipo: "pct" },
    ] : undefined,
    grafico: ordem === "mais" ? { tipo: "ranking", dados: dados.slice(0, 10).map((d) => ({ nome: d.nome, total: d.receita, detalhe: `${d.qtd} un.` })) } : undefined,
  };
}

async function relClientesRecorrentes(f: FiltroRelatorio): Promise<Relatorio> {
  const linhas = await db.$queryRaw<{ id: string; nome: string; celular: string | null; compras: bigint; total: Prisma.Decimal; ultima: Date }[]>`
    SELECT c.id, COALESCE(c."nomeSocial", c.nome) AS nome, c.celular, COUNT(*) AS compras, SUM(v."valorLiquido") AS total, MAX(v."dataHora") AS ultima
    FROM "Venda" v JOIN "Cliente" c ON c.id = v."clienteId"
    WHERE ${filtrosVendaSql(f)}
    GROUP BY c.id HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC, SUM(v."valorLiquido") DESC LIMIT 200`;
  return {
    titulo: "Clientes recorrentes",
    descricao: "Clientes com duas ou mais compras no período.",
    colunas: [
      { chave: "nome", rotulo: "Cliente" },
      { chave: "celular", rotulo: "Celular", tipo: "telefone" },
      { chave: "compras", rotulo: "Compras", tipo: "numero" },
      { chave: "total", rotulo: "Total comprado", tipo: "moeda" },
      { chave: "ultima", rotulo: "Última compra", tipo: "data" },
    ],
    linhas: linhas.map((l) => ({ _href: `/clientes/${l.id}`, nome: l.nome, celular: l.celular, compras: Number(l.compras), total: num(l.total), ultima: l.ultima })),
    resumo: [{ rotulo: "Clientes recorrentes", valor: linhas.length, tipo: "numero" }],
  };
}

async function relClientesInativos(): Promise<Relatorio> {
  const dias = await configNumero("cliente.inativoDias", 180);
  const corte = new Date(Date.now() - dias * 86_400_000);
  const linhas = await db.$queryRaw<{ id: string; nome: string; celular: string | null; consentimento: boolean; ultima: Date; compras: bigint; total: Prisma.Decimal; vendedor: string | null }[]>`
    SELECT c.id, COALESCE(c."nomeSocial", c.nome) AS nome, c.celular, c."consentimentoContato" AS consentimento,
           MAX(v."dataHora") AS ultima, COUNT(*) AS compras, SUM(v."valorLiquido") AS total, ve.nome AS vendedor
    FROM "Cliente" c JOIN "Venda" v ON v."clienteId" = c.id AND v.status = 'CONFIRMADA'
    LEFT JOIN "Vendedor" ve ON ve.id = c."vendedorResponsavelId"
    GROUP BY c.id, ve.nome HAVING MAX(v."dataHora") < ${corte}
    ORDER BY SUM(v."valorLiquido") DESC LIMIT 500`;
  return {
    titulo: "Clientes sem compras recentes",
    descricao: `Clientes que já compraram, mas não voltam há mais de ${dias} dias (configuração "cliente.inativoDias"). Ordenados pelo valor já comprado: comece pelos melhores. Só contate quem autorizou.`,
    colunas: [
      { chave: "nome", rotulo: "Cliente" },
      { chave: "celular", rotulo: "Celular", tipo: "telefone" },
      { chave: "contato", rotulo: "Autoriza contato" },
      { chave: "ultima", rotulo: "Última compra", tipo: "data" },
      { chave: "dias", rotulo: "Dias sem comprar", tipo: "numero" },
      { chave: "compras", rotulo: "Compras", tipo: "numero" },
      { chave: "total", rotulo: "Total histórico", tipo: "moeda" },
      { chave: "vendedor", rotulo: "Vendedor responsável" },
    ],
    linhas: linhas.map((l) => ({
      _href: `/clientes/${l.id}`,
      nome: l.nome,
      celular: l.celular,
      contato: l.consentimento ? "Sim" : "Não",
      ultima: l.ultima,
      dias: Math.floor((Date.now() - l.ultima.getTime()) / 86_400_000),
      compras: Number(l.compras),
      total: num(l.total),
      vendedor: l.vendedor ?? "",
    })),
    resumo: [{ rotulo: "Clientes para reativar", valor: linhas.length, tipo: "numero" }],
  };
}

async function relAniversariantes(f: FiltroRelatorio): Promise<Relatorio> {
  const mes = Number(f.ate.slice(5, 7));
  const linhas = await db.$queryRaw<{ id: string; nome: string; celular: string | null; nascimento: Date; consentimento: boolean; ultima: Date | null }[]>`
    SELECT c.id, COALESCE(c."nomeSocial", c.nome) AS nome, c.celular, c."dataNascimento" AS nascimento, c."consentimentoContato" AS consentimento,
           (SELECT MAX(v."dataHora") FROM "Venda" v WHERE v."clienteId" = c.id AND v.status = 'CONFIRMADA') AS ultima
    FROM "Cliente" c
    WHERE c."dataNascimento" IS NOT NULL AND EXTRACT(MONTH FROM c."dataNascimento") = ${mes}
    ORDER BY EXTRACT(DAY FROM c."dataNascimento")`;
  return {
    titulo: `Aniversariantes do mês ${String(mes).padStart(2, "0")}`,
    descricao: "Mês da data final do filtro. Oportunidade de contato e oferta (só para quem autorizou contato).",
    colunas: [
      { chave: "dia", rotulo: "Dia" },
      { chave: "nome", rotulo: "Cliente" },
      { chave: "celular", rotulo: "Celular", tipo: "telefone" },
      { chave: "contato", rotulo: "Autoriza contato" },
      { chave: "ultima", rotulo: "Última compra", tipo: "data" },
    ],
    linhas: linhas.map((l) => ({
      _href: `/clientes/${l.id}`,
      dia: l.nascimento.toISOString().slice(8, 10),
      nome: l.nome,
      celular: l.celular,
      contato: l.consentimento ? "Sim" : "Não",
      ultima: l.ultima,
    })),
    resumo: [{ rotulo: "Aniversariantes", valor: linhas.length, tipo: "numero" }],
  };
}

async function relPosVenda(f: FiltroRelatorio): Promise<Relatorio> {
  const { porVendedor, total } = await indicadoresPosVenda({ de: inicio(f.de), ate: fim(f.ate), lojaId: f.lojaId, vendedorId: f.vendedorId });
  return {
    titulo: "Execução do pós-venda",
    descricao: "Para vendas do período. Contato no prazo = primeiro contato registrado até o prazo, entre os atendimentos já vencidos ou já contatados.",
    colunas: [
      { chave: "vendedor", rotulo: "Vendedor" },
      { chave: "gerados", rotulo: "Gerados", tipo: "numero" },
      { chave: "concluidos", rotulo: "Concluídos", tipo: "numero" },
      { chave: "pendentes", rotulo: "Pendentes", tipo: "numero" },
      { chave: "atrasados", rotulo: "Atrasados", tipo: "numero" },
      { chave: "semContato", rotulo: "Sem nenhum contato", tipo: "numero" },
      { chave: "taxaNoPrazo", rotulo: "Contato no prazo", tipo: "pct" },
    ],
    linhas: porVendedor.map((v) => ({ ...v, _href: `/relatorios/vendedor/${v.vendedorId}` })),
    resumo: [
      { rotulo: "Gerados", valor: total.gerados, tipo: "numero" },
      { rotulo: "Concluídos", valor: total.concluidos, tipo: "numero" },
      { rotulo: "Atrasados", valor: total.atrasados, tipo: "numero" },
      { rotulo: "Taxa de execução no prazo", valor: total.taxaNoPrazo ?? "—", tipo: total.taxaNoPrazo === null ? "texto" : "pct" },
    ],
  };
}

async function relInadimplencia(f: FiltroRelatorio): Promise<Relatorio> {
  // Período = vencimento das parcelas em atraso.
  const linhas = await listarInadimplentes({ de: f.de, ate: f.ate, loja: f.lojaId, vendedor: f.vendedorId });
  const porMes = new Map<string, { parcelas: number; valor: number; clientes: Set<string> }>();
  for (const l of linhas) {
    for (const p of l.parcelasAtrasadas) {
      const chave = p.vencimento.toISOString().slice(0, 7);
      const m = porMes.get(chave) ?? { parcelas: 0, valor: 0, clientes: new Set<string>() };
      m.parcelas++;
      m.valor += p.saldoCentavos / 100;
      m.clientes.add(l.cliente.id);
      porMes.set(chave, m);
    }
  }
  const dados = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => ({ mes: `${mes.slice(5, 7)}/${mes.slice(0, 4)}`, parcelas: m.parcelas, clientes: m.clientes.size, valor: m.valor }));
  const total = dados.reduce((s, d) => s + d.valor, 0);
  return {
    titulo: "Inadimplência por período",
    descricao: "Parcelas de crediário/carnê vencidas e não pagas, agrupadas pelo mês de vencimento (filtro de período = vencimento).",
    colunas: [
      { chave: "mes", rotulo: "Mês de vencimento" },
      { chave: "parcelas", rotulo: "Parcelas em atraso", tipo: "numero" },
      { chave: "clientes", rotulo: "Clientes", tipo: "numero" },
      { chave: "valor", rotulo: "Valor em atraso", tipo: "moeda" },
    ],
    linhas: dados,
    resumo: [
      { rotulo: "Inadimplência total", valor: total, tipo: "moeda" },
      { rotulo: "Clientes inadimplentes", valor: new Set(linhas.map((l) => l.cliente.id)).size, tipo: "numero" },
    ],
    grafico: { tipo: "colunas", dados: dados.map((d) => ({ nome: d.mes, total: d.valor, detalhe: `${d.parcelas} parcelas` })) },
  };
}

async function relEstoqueBaixo(f: FiltroRelatorio): Promise<Relatorio> {
  const linhas = await db.$queryRaw<{ produtoId: string; codigo: string; produto: string; descricao: string; sku: string; loja: string; quantidade: number; minimo: number; outras: bigint }[]>`
    SELECT p.id AS "produtoId", p.codigo, p.nome AS produto, v.descricao, v.sku, l.nome AS loja, s.quantidade, s."estoqueMinimo" AS minimo,
           (SELECT COALESCE(SUM(o.quantidade), 0) FROM "EstoqueSaldo" o WHERE o."variacaoId" = s."variacaoId" AND o."lojaId" <> s."lojaId") AS outras
    FROM "EstoqueSaldo" s
    JOIN "ProdutoVariacao" v ON v.id = s."variacaoId" AND v.ativo
    JOIN "Produto" p ON p.id = v."produtoId" AND p.ativo
    JOIN "Loja" l ON l.id = s."lojaId" AND l.ativa
    WHERE s."estoqueMinimo" > 0 AND s.quantidade <= s."estoqueMinimo" ${f.lojaId ? Prisma.sql`AND s."lojaId" = ${f.lojaId}` : Prisma.empty}
    ORDER BY s.quantidade ASC, p.nome`;
  return {
    titulo: "Produtos com estoque baixo",
    descricao: "No estoque mínimo ou abaixo, por loja. \"Nas outras lojas\" ajuda a decidir entre transferir e comprar.",
    colunas: [
      { chave: "codigo", rotulo: "Código" },
      { chave: "produto", rotulo: "Produto" },
      { chave: "variacao", rotulo: "Variação" },
      { chave: "loja", rotulo: "Loja" },
      { chave: "quantidade", rotulo: "Saldo", tipo: "numero" },
      { chave: "minimo", rotulo: "Mínimo", tipo: "numero" },
      { chave: "repor", rotulo: "Repor p/ sair do alerta", tipo: "numero" },
      { chave: "outras", rotulo: "Nas outras lojas", tipo: "numero" },
    ],
    linhas: linhas.map((l) => ({
      _href: `/produtos/${l.produtoId}`,
      codigo: l.codigo,
      produto: l.produto,
      variacao: l.descricao === "Padrão" ? l.sku : `${l.descricao} (${l.sku})`,
      loja: l.loja,
      quantidade: l.quantidade,
      minimo: l.minimo,
      repor: Math.max(0, l.minimo - l.quantidade + 1),
      outras: Number(l.outras),
    })),
    resumo: [{ rotulo: "Itens em alerta", valor: linhas.length, tipo: "numero" }],
  };
}

const COLUNA_LINK: Partial<Record<TipoRelatorio, string>> = {
  vendedores: "nome",
  produtos: "nome",
  "menos-vendidos": "nome",
  "clientes-recorrentes": "nome",
  "clientes-inativos": "nome",
  aniversariantes: "nome",
  "pos-venda": "vendedor",
  "estoque-baixo": "produto",
};

export async function gerarRelatorio(tipo: TipoRelatorio, f: FiltroRelatorio): Promise<Relatorio> {
  return { ...(await montar(tipo, f)), colunaLink: COLUNA_LINK[tipo] };
}

async function montar(tipo: TipoRelatorio, f: FiltroRelatorio): Promise<Relatorio> {
  switch (tipo) {
    case "vendas":
      return relVendas(f);
    case "vendedores":
      return relVendedores(f);
    case "produtos":
      return relProdutos(f, "mais");
    case "menos-vendidos":
      return relProdutos(f, "menos");
    case "clientes-recorrentes":
      return relClientesRecorrentes(f);
    case "clientes-inativos":
      return relClientesInativos();
    case "aniversariantes":
      return relAniversariantes(f);
    case "pos-venda":
      return relPosVenda(f);
    case "inadimplencia":
      return relInadimplencia(f);
    case "estoque-baixo":
      return relEstoqueBaixo(f);
  }
}

export function periodoPadrao() {
  const hoje = hojeSP();
  return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
}

const dataValida = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

/** Lê os filtros da URL (usado pela página e pela exportação, para gerarem o mesmo resultado). */
export function lerFiltrosRelatorio(sp: { tipo?: string; de?: string; ate?: string; loja?: string; vendedor?: string; agrupar?: string }) {
  const padrao = periodoPadrao();
  const de = dataValida(sp.de) ?? padrao.de;
  const ate = dataValida(sp.ate) ?? padrao.ate;
  const tipo = (TIPOS_RELATORIO.some((t) => t.chave === sp.tipo) ? sp.tipo : "vendas") as TipoRelatorio;
  const agrupar: "dia" | "semana" | "mes" = sp.agrupar === "semana" || sp.agrupar === "mes" ? sp.agrupar : "dia";
  const filtro: FiltroRelatorio = { de: de <= ate ? de : ate, ate, lojaId: sp.loja || undefined, vendedorId: sp.vendedor || undefined, agrupar };
  return { tipo, filtro };
}
