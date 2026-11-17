import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { vazioParaUndefined } from "@/lib/acao";
import { hojeSP } from "@/lib/venda";
import { diasAtraso, estaVencida, hojeComoData, saldoCentavos } from "@/lib/cobranca";
import { lerValorMonetario } from "@/lib/formato";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";

export class ErroCobranca extends Error {}

export type FiltrosInadimplencia = { q?: string; vendedor?: string; loja?: string; status?: string; de?: string; ate?: string };

export type LinhaInadimplencia = {
  vendaId: string;
  numero: number;
  dataVenda: Date;
  cliente: { id: string; nome: string; cpf: string; celular: string | null };
  vendedor: string;
  loja: string;
  valorVenda: number;
  emAbertoCentavos: number; // tudo que falta pagar na venda (vencido + a vencer)
  emAtrasoCentavos: number;
  parcelasAtrasadas: { numero: number; vencimento: Date; saldoCentavos: number; dias: number }[];
  diasAtraso: number; // da parcela mais antiga
  cobranca: {
    status: string;
    responsavel: string | null;
    ultimoContato: Date | null;
    promessa: { valor: number | null; data: Date | null } | null;
  } | null;
};

/** Vendas com parcelas efetivamente vencidas e não pagas (crediário/carnê), agrupadas por venda. */
export async function listarInadimplentes(f: FiltrosInadimplencia): Promise<LinhaInadimplencia[]> {
  const hoje = hojeComoData(hojeSP());
  const termo = (f.q ?? "").trim();
  const digitos = termo.replace(/\D/g, "");
  const vendaWhere: Prisma.VendaWhereInput = {
    status: "CONFIRMADA",
    ...(f.vendedor && { vendedorId: f.vendedor }),
    ...(f.loja && { lojaId: f.loja }),
    ...(termo && {
      cliente: { OR: [{ nome: { contains: termo, mode: "insensitive" } }, ...(digitos.length >= 3 ? [{ cpf: { startsWith: digitos } }] : [])] },
    }),
  };
  const parcelasVencidas = await db.parcela.findMany({
    where: {
      status: { in: ["ABERTA", "PARCIAL"] },
      vencimento: { lt: hoje, ...(f.de && { gte: new Date(`${f.de}T00:00:00Z`) }), ...(f.ate && { lte: new Date(`${f.ate}T00:00:00Z`) }) },
      venda: vendaWhere,
    },
    select: { vendaId: true },
    distinct: ["vendaId"],
  });
  if (!parcelasVencidas.length) return [];

  const vendas = await db.venda.findMany({
    where: { id: { in: parcelasVencidas.map((p) => p.vendaId) } },
    include: {
      cliente: { select: { id: true, nome: true, nomeSocial: true, cpf: true, celular: true } },
      vendedor: { select: { nome: true } },
      loja: { select: { nome: true } },
      parcelas: { orderBy: { numero: "asc" } },
      cobranca: {
        include: {
          responsavel: { select: { nome: true } },
          interacoes: { orderBy: { data: "desc" }, take: 5, select: { data: true, canal: true, valorPrometido: true, dataPromessa: true, statusNovo: true } },
        },
      },
    },
  });

  const linhas = vendas.map((v): LinhaInadimplencia => {
    const abertas = v.parcelas.filter((p) => p.status === "ABERTA" || p.status === "PARCIAL");
    const atrasadas = abertas.filter((p) => estaVencida(p, hoje));
    // Interação automática do sistema (canal OUTRO ao receber) não conta como contato de cobrança.
    const contatos = v.cobranca?.interacoes.filter((i) => i.canal !== "OUTRO") ?? [];
    const promessa = v.cobranca?.interacoes.find((i) => i.dataPromessa);
    return {
      vendaId: v.id,
      numero: v.numero,
      dataVenda: v.dataHora,
      cliente: { id: v.cliente.id, nome: v.cliente.nomeSocial || v.cliente.nome, cpf: v.cliente.cpf, celular: v.cliente.celular },
      vendedor: v.vendedor.nome,
      loja: v.loja.nome,
      valorVenda: Number(v.valorLiquido),
      emAbertoCentavos: abertas.reduce((s, p) => s + saldoCentavos(p), 0),
      emAtrasoCentavos: atrasadas.reduce((s, p) => s + saldoCentavos(p), 0),
      parcelasAtrasadas: atrasadas.map((p) => ({ numero: p.numero, vencimento: p.vencimento, saldoCentavos: saldoCentavos(p), dias: diasAtraso(p.vencimento, hoje) })),
      diasAtraso: Math.max(...atrasadas.map((p) => diasAtraso(p.vencimento, hoje))),
      cobranca: v.cobranca && {
        status: v.cobranca.status,
        responsavel: v.cobranca.responsavel?.nome ?? null,
        ultimoContato: contatos[0]?.data ?? null,
        promessa: promessa ? { valor: promessa.valorPrometido ? Number(promessa.valorPrometido) : null, data: promessa.dataPromessa } : null,
      },
    };
  });

  const filtradas = f.status ? linhas.filter((l) => (l.cobranca?.status ?? "PENDENTE") === f.status) : linhas;
  // Maior atraso primeiro.
  return filtradas.sort((a, b) => b.diasAtraso - a.diasAtraso || b.emAtrasoCentavos - a.emAtrasoCentavos);
}

export const esquemaInteracaoCobranca = z
  .object({
    canal: z.enum(["WHATSAPP", "TELEFONE", "EMAIL", "PRESENCIAL", "SMS", "OUTRO"], { message: "Selecione o canal" }),
    descricao: z.string().trim().min(5, "Descreva a tentativa de cobrança").max(2000),
    statusNovo: z.enum(["PENDENTE", "PRIMEIRA_TENTATIVA", "CLIENTE_CONTATADO", "PROMESSA_PAGAMENTO", "PAGAMENTO_PARCIAL", "NEGOCIACAO", "REGULARIZADO", "ANALISE_GERENCIAL"]),
    valorPrometido: z.preprocess(
      (v) => (typeof v === "string" ? (v.trim() ? lerValorMonetario(v) : undefined) : v),
      z.number({ invalid_type_error: "Valor inválido" }).positive("Valor inválido").optional(),
    ),
    dataPromessa: z.preprocess(vazioParaUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    responsavelId: z.preprocess(vazioParaUndefined, z.string().optional()),
  })
  .superRefine((d, ctx) => {
    if (d.statusNovo === "PROMESSA_PAGAMENTO") {
      if (!d.dataPromessa) ctx.addIssue({ code: "custom", path: ["dataPromessa"], message: "Informe a data prometida" });
      if (!d.valorPrometido) ctx.addIssue({ code: "custom", path: ["valorPrometido"], message: "Informe o valor prometido" });
    }
  });

export async function registrarInteracaoCobranca(vendaId: string, d: z.infer<typeof esquemaInteracaoCobranca>, usuarioId: string) {
  const venda = await db.venda.findUnique({ where: { id: vendaId }, select: { status: true, clienteId: true, numero: true } });
  if (!venda || venda.status !== "CONFIRMADA") throw new ErroCobranca("Venda não encontrada ou cancelada.");
  if (d.statusNovo === "REGULARIZADO") {
    const hoje = hojeComoData(hojeSP());
    const vencidas = await db.parcela.findMany({ where: { vendaId, status: { in: ["ABERTA", "PARCIAL"] }, vencimento: { lt: hoje } } });
    if (vencidas.some((p) => saldoCentavos(p) > 0)) throw new ErroCobranca("Ainda há parcelas vencidas em aberto. Registre os recebimentos antes de marcar como regularizado.");
  }

  await db.$transaction(async (tx) => {
    const atual = await tx.cobranca.upsert({
      where: { vendaId },
      update: {},
      create: { vendaId, clienteId: venda.clienteId, responsavelId: d.responsavelId ?? usuarioId },
    });
    await tx.interacaoCobranca.create({
      data: {
        cobrancaId: atual.id,
        usuarioId,
        canal: d.canal,
        descricao: d.descricao,
        statusAnterior: atual.status,
        statusNovo: d.statusNovo,
        valorPrometido: d.valorPrometido ?? null,
        dataPromessa: d.dataPromessa ? new Date(`${d.dataPromessa}T00:00:00Z`) : null,
      },
    });
    await tx.cobranca.update({
      where: { id: atual.id },
      data: { status: d.statusNovo, ...(d.responsavelId && { responsavelId: d.responsavelId }) },
    });
    if (d.statusNovo === "ANALISE_GERENCIAL") {
      await registrarAuditoria(tx, { usuarioId, acao: "COBRANCA_ENCAMINHADA_GERENCIA", entidade: "Venda", entidadeId: vendaId, detalhes: { numero: venda.numero } });
    }
  });
}
