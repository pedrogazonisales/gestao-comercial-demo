import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { vazioParaUndefined } from "@/lib/acao";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";
import { pode } from "../permissoes";
import type { SessaoAtual } from "../auth";

export class ErroPosVenda extends Error {}

/** Vendedor só enxerga e atende os próprios pós-vendas; gerente e admin, todos. Vendas canceladas ficam de fora. */
export function escopoPosVenda(sessao: SessaoAtual): Prisma.PosVendaWhereInput {
  const base: Prisma.PosVendaWhereInput = { venda: { status: "CONFIRMADA" } };
  if (pode(sessao.usuario.perfil, "venda.verTodas")) return base;
  return { ...base, vendedorId: sessao.usuario.vendedor?.id ?? "__nenhum__" };
}

async function carregarComPermissao(id: string, sessao: SessaoAtual) {
  const pv = await db.posVenda.findFirst({ where: { AND: [{ id }, escopoPosVenda(sessao)] }, include: { status: true } });
  if (!pv) throw new ErroPosVenda("Pós-venda não encontrado ou sem permissão.");
  return pv;
}

export const esquemaInteracao = z.object({
  canal: z.enum(["WHATSAPP", "TELEFONE", "EMAIL", "PRESENCIAL", "SMS", "OUTRO"], { message: "Selecione o canal" }),
  resultado: z.string().trim().min(5, "Descreva o resultado do contato").max(2000),
  statusId: z.string().min(1, "Selecione o novo status"),
  proximoContato: z.preprocess(vazioParaUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional()),
});

export async function registrarInteracao(id: string, d: z.infer<typeof esquemaInteracao>, sessao: SessaoAtual) {
  const pv = await carregarComPermissao(id, sessao);
  const novo = await db.statusPosVenda.findFirst({ where: { id: d.statusId, ativo: true } });
  if (!novo) throw new ErroPosVenda("Status inválido.");

  // Próximo contato às 18h (fim do expediente) do dia escolhido, no fuso de Brasília.
  const proximo = d.proximoContato && !novo.finaliza ? new Date(`${d.proximoContato}T18:00:00-03:00`) : null;
  if (proximo && proximo.getTime() < Date.now() - 86_400_000) throw new ErroPosVenda("O próximo contato não pode estar no passado.");

  await db.$transaction(async (tx) => {
    await tx.interacaoPosVenda.create({
      data: {
        posVendaId: pv.id,
        usuarioId: sessao.usuario.id,
        canal: d.canal,
        resultado: d.resultado,
        statusAnteriorId: pv.statusId,
        statusNovoId: novo.id,
      },
    });
    await tx.posVenda.update({
      where: { id: pv.id },
      data: {
        statusId: novo.id,
        proximoContato: proximo,
        concluidoEm: novo.finaliza ? new Date() : null,
      },
    });
  });
}

export const esquemaAjustePrazo = z.object({
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a nova data"),
  motivo: z.string().trim().min(5, "Informe o motivo do ajuste").max(300),
});

export async function ajustarPrazo(id: string, d: z.infer<typeof esquemaAjustePrazo>, sessao: SessaoAtual) {
  if (!pode(sessao.usuario.perfil, "posvenda.ajustarPrazo")) throw new ErroPosVenda("Sem permissão para ajustar prazos.");
  const pv = await carregarComPermissao(id, sessao);
  const prazo = new Date(`${d.prazo}T23:59:59-03:00`);
  if (prazo.getTime() < Date.now()) throw new ErroPosVenda("O novo prazo deve ser hoje ou depois.");

  await db.$transaction(async (tx) => {
    await tx.posVenda.update({
      where: { id: pv.id },
      data: { prazo, prazoAjustadoPorId: sessao.usuario.id, motivoAjustePrazo: d.motivo },
    });
    await registrarAuditoria(tx, {
      usuarioId: sessao.usuario.id,
      acao: "POSVENDA_PRAZO_AJUSTADO",
      entidade: "PosVenda",
      entidadeId: pv.id,
      detalhes: { de: pv.prazo.toISOString(), para: prazo.toISOString(), motivo: d.motivo },
    });
  });
}
