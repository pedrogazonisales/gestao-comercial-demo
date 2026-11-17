import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { configNumero } from "../config";
import { filtroSituacao } from "./consulta-posvenda";
import { escopoPosVenda } from "./posvenda";
import type { SessaoAtual } from "../auth";
import { estaVencida, hojeComoData, saldoCentavos } from "@/lib/cobranca";
import { hojeSP } from "@/lib/venda";

export type FiltroDashboard = { de: string; ate: string; lojaId?: string; vendedorId?: string };

const inicioDia = (iso: string) => new Date(`${iso}T00:00:00-03:00`);
const fimDia = (iso: string) => new Date(`${iso}T23:59:59.999-03:00`);
const somarDiasIso = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

function filtroVendas(f: { de: Date; ate: Date; lojaId?: string; vendedorId?: string }): Prisma.VendaWhereInput {
  return {
    status: "CONFIRMADA",
    dataHora: { gte: f.de, lte: f.ate },
    ...(f.lojaId && { lojaId: f.lojaId }),
    ...(f.vendedorId && { vendedorId: f.vendedorId }),
  };
}

async function totais(where: Prisma.VendaWhereInput) {
  const a = await db.venda.aggregate({ where, _sum: { valorLiquido: true, descontoValor: true, valorBruto: true }, _count: true });
  const faturamento = Number(a._sum.valorLiquido ?? 0);
  return {
    faturamento,
    vendas: a._count,
    ticketMedio: a._count ? faturamento / a._count : 0,
    descontos: Number(a._sum.descontoValor ?? 0),
    bruto: Number(a._sum.valorBruto ?? 0),
  };
}

export async function indicadoresDashboard(f: FiltroDashboard, sessao: SessaoAtual) {
  const hoje = hojeSP();
  const de = inicioDia(f.de);
  const ate = fimDia(f.ate);
  const dias = Math.round((Date.parse(`${f.ate}T00:00:00Z`) - Date.parse(`${f.de}T00:00:00Z`)) / 86_400_000) + 1;
  // Período anterior de mesma duração, para comparação.
  const deAnterior = inicioDia(somarDiasIso(f.de, -dias));
  const ateAnterior = fimDia(somarDiasIso(f.de, -1));
  const base = { lojaId: f.lojaId, vendedorId: f.vendedorId };
  const wherePeriodo = filtroVendas({ de, ate, ...base });
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const filtrosSql = Prisma.sql`${f.lojaId ? Prisma.sql`AND "lojaId" = ${f.lojaId}` : Prisma.empty} ${f.vendedorId ? Prisma.sql`AND "vendedorId" = ${f.vendedorId}` : Prisma.empty}`;

  const [periodo, anterior, doDia, doMes, porDiaBruto, porVendedorBruto, porLojaBruto, itensBruto, vendedores, lojas] = await Promise.all([
    totais(wherePeriodo),
    totais(filtroVendas({ de: deAnterior, ate: ateAnterior, ...base })),
    totais(filtroVendas({ de: inicioDia(hoje), ate: fimDia(hoje), ...base })),
    totais(filtroVendas({ de: inicioDia(inicioMes), ate: fimDia(hoje), ...base })),
    db.$queryRaw<{ dia: string; total: Prisma.Decimal; vendas: bigint }[]>`
      -- "dataHora" é gravado em UTC sem fuso: primeiro marca como UTC, depois converte para Brasília.
      SELECT to_char((("dataHora" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS dia,
             SUM("valorLiquido") AS total, COUNT(*) AS vendas
      FROM "Venda"
      WHERE status = 'CONFIRMADA' AND "dataHora" >= ${de} AND "dataHora" <= ${ate} ${filtrosSql}
      GROUP BY 1 ORDER BY 1`,
    db.venda.groupBy({ by: ["vendedorId"], where: wherePeriodo, _sum: { valorLiquido: true, descontoValor: true }, _count: true }),
    db.venda.groupBy({ by: ["lojaId"], where: wherePeriodo, _sum: { valorLiquido: true }, _count: true }),
    db.vendaItem.groupBy({ by: ["variacaoId"], where: { venda: wherePeriodo }, _sum: { quantidade: true, valorTotal: true } }),
    db.vendedor.findMany({ select: { id: true, nome: true } }),
    db.loja.findMany({ where: { ativa: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  // Série diária completa (dias sem venda = zero).
  const mapaDia = new Map(porDiaBruto.map((d) => [d.dia, { total: Number(d.total), vendas: Number(d.vendas) }]));
  const serieDiaria = Array.from({ length: Math.min(dias, 366) }, (_, i) => {
    const dia = somarDiasIso(f.de, i);
    return { dia, total: mapaDia.get(dia)?.total ?? 0, vendas: mapaDia.get(dia)?.vendas ?? 0 };
  });

  const nomeVendedor = new Map(vendedores.map((v) => [v.id, v.nome]));
  const porVendedor = porVendedorBruto
    .map((v) => {
      const total = Number(v._sum.valorLiquido ?? 0);
      return { id: v.vendedorId, nome: nomeVendedor.get(v.vendedorId) ?? "—", total, vendas: v._count, ticket: v._count ? total / v._count : 0, descontos: Number(v._sum.descontoValor ?? 0) };
    })
    .sort((a, b) => b.total - a.total);

  const porLoja = lojas
    .map((l) => {
      const g = porLojaBruto.find((x) => x.lojaId === l.id);
      return { id: l.id, nome: l.nome, total: Number(g?._sum.valorLiquido ?? 0), vendas: g?._count ?? 0 };
    })
    .sort((a, b) => b.total - a.total);

  // Produtos mais vendidos: soma as variações de cada produto.
  const variacoes = await db.produtoVariacao.findMany({
    where: { id: { in: itensBruto.map((i) => i.variacaoId) } },
    select: { id: true, produto: { select: { id: true, nome: true } } },
  });
  const porProduto = new Map<string, { id: string; nome: string; quantidade: number; total: number }>();
  for (const i of itensBruto) {
    const p = variacoes.find((v) => v.id === i.variacaoId)?.produto;
    if (!p) continue;
    const atual = porProduto.get(p.id) ?? { id: p.id, nome: p.nome, quantidade: 0, total: 0 };
    atual.quantidade += i._sum.quantidade ?? 0;
    atual.total += Number(i._sum.valorTotal ?? 0);
    porProduto.set(p.id, atual);
  }
  const maisVendidos = [...porProduto.values()].sort((a, b) => b.quantidade - a.quantidade || b.total - a.total).slice(0, 8);

  // Operação: estoque baixo, clientes, pós-venda e recebíveis.
  const alertaDias = await configNumero("posvenda.alertaDias", 2);
  const agora = new Date();
  const escopoPv: Prisma.PosVendaWhereInput = {
    AND: [escopoPosVenda(sessao), ...(f.vendedorId ? [{ vendedorId: f.vendedorId }] : []), ...(f.lojaId ? [{ venda: { lojaId: f.lojaId } }] : [])],
  };
  const hojeData = hojeComoData(hoje);
  const [estoqueBaixo, clientes, clientesNovos, pvPendentes, pvAtrasados, parcelasAbertas] = await Promise.all([
    db.$queryRaw<{ variacaoId: string; produtoId: string; produto: string; descricao: string; loja: string; quantidade: number; minimo: number }[]>`
      SELECT s."variacaoId", p.id AS "produtoId", p.nome AS produto, v.descricao, l.nome AS loja, s.quantidade, s."estoqueMinimo" AS minimo
      FROM "EstoqueSaldo" s
      JOIN "ProdutoVariacao" v ON v.id = s."variacaoId" AND v.ativo
      JOIN "Produto" p ON p.id = v."produtoId" AND p.ativo
      JOIN "Loja" l ON l.id = s."lojaId" AND l.ativa
      WHERE s."estoqueMinimo" > 0 AND s.quantidade <= s."estoqueMinimo" ${f.lojaId ? Prisma.sql`AND s."lojaId" = ${f.lojaId}` : Prisma.empty}
      ORDER BY s.quantidade ASC, p.nome ASC`,
    db.cliente.count(),
    db.cliente.count({ where: { createdAt: { gte: de, lte: ate } } }),
    db.posVenda.count({ where: { AND: [escopoPv, filtroSituacao("pendentes", agora, alertaDias)] } }),
    db.posVenda.count({ where: { AND: [escopoPv, filtroSituacao("atrasados", agora, alertaDias)] } }),
    db.parcela.findMany({
      where: {
        status: { in: ["ABERTA", "PARCIAL"] },
        venda: { status: "CONFIRMADA", ...(f.lojaId && { lojaId: f.lojaId }), ...(f.vendedorId && { vendedorId: f.vendedorId }) },
      },
      select: { valor: true, valorPago: true, vencimento: true, status: true, clienteId: true },
    }),
  ]);
  const vencidas = parcelasAbertas.filter((p) => estaVencida(p, hojeData));

  return {
    periodo,
    anterior,
    doDia,
    doMes,
    serieDiaria,
    porVendedor,
    porLoja,
    maisVendidos,
    estoqueBaixo: { total: estoqueBaixo.length, itens: estoqueBaixo.slice(0, 8) },
    clientes: { total: clientes, novos: clientesNovos },
    posVenda: { pendentes: pvPendentes, atrasados: pvAtrasados },
    recebiveis: {
      emAberto: parcelasAbertas.reduce((s, p) => s + saldoCentavos(p), 0) / 100,
      vencido: vencidas.reduce((s, p) => s + saldoCentavos(p), 0) / 100,
      inadimplentes: new Set(vencidas.map((p) => p.clienteId)).size,
    },
  };
}

export type IndicadoresDashboard = Awaited<ReturnType<typeof indicadoresDashboard>>;
