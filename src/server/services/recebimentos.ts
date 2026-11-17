import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { hojeSP } from "@/lib/venda";
import { estaVencida, hojeComoData, saldoCentavos, statusAposPagamento } from "@/lib/cobranca";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";

export class ErroRecebimento extends Error {}

export const esquemaRecebimento = z.object({
  valorCentavos: z.number().int().min(1, "Informe o valor recebido"),
  forma: z.enum(["DINHEIRO", "PIX", "DEBITO", "CREDITO"], { message: "Selecione a forma de pagamento" }),
  observacao: z.string().trim().max(300).optional(),
});

type Ctx = { usuarioId: string; lojaId: string | null };

/**
 * Depois de pagamentos, se a venda não tem mais parcelas vencidas, a cobrança aberta é regularizada
 * automaticamente (com registro no histórico). Se ainda há atraso mas houve pagamento, marca "pagamento parcial".
 */
async function atualizarCobranca(tx: Prisma.TransactionClient, vendaId: string, usuarioId: string, descricao: string) {
  const cobranca = await tx.cobranca.findUnique({ where: { vendaId } });
  if (!cobranca || cobranca.status === "REGULARIZADO") return;
  const hoje = hojeComoData(hojeSP());
  const parcelas = await tx.parcela.findMany({ where: { vendaId } });
  const aindaVencida = parcelas.some((p) => estaVencida(p, hoje));
  const statusNovo = aindaVencida ? "PAGAMENTO_PARCIAL" : "REGULARIZADO";
  if (statusNovo === cobranca.status) return;
  await tx.cobranca.update({ where: { id: cobranca.id }, data: { status: statusNovo } });
  await tx.interacaoCobranca.create({
    data: { cobrancaId: cobranca.id, usuarioId, canal: "OUTRO", descricao, statusAnterior: cobranca.status, statusNovo },
  });
}

export async function receberParcela(parcelaId: string, d: z.infer<typeof esquemaRecebimento>, ctx: Ctx) {
  return db.$transaction(async (tx) => {
    // Trava a parcela: dois caixas não conseguem baixar o mesmo valor ao mesmo tempo.
    await tx.$queryRaw`SELECT id FROM "Parcela" WHERE id = ${parcelaId} FOR UPDATE`;
    const parcela = await tx.parcela.findUnique({ where: { id: parcelaId }, include: { venda: { select: { status: true, numero: true } } } });
    if (!parcela) throw new ErroRecebimento("Parcela não encontrada.");
    if (parcela.venda.status !== "CONFIRMADA" || parcela.status === "CANCELADA") throw new ErroRecebimento("Esta parcela pertence a uma venda cancelada.");
    if (parcela.status === "PAGA") throw new ErroRecebimento("Esta parcela já está paga.");
    const saldo = saldoCentavos(parcela);
    if (d.valorCentavos > saldo) throw new ErroRecebimento(`O valor informado é maior que o saldo da parcela (R$ ${(saldo / 100).toFixed(2).replace(".", ",")}).`);

    const pago = Math.round(Number(parcela.valorPago) * 100) + d.valorCentavos;
    const status = statusAposPagamento(Math.round(Number(parcela.valor) * 100), pago);
    const recebimento = await tx.recebimento.create({
      data: { parcelaId, valor: d.valorCentavos / 100, forma: d.forma, usuarioId: ctx.usuarioId, lojaId: ctx.lojaId, observacao: d.observacao || null },
    });
    await tx.parcela.update({ where: { id: parcelaId }, data: { valorPago: pago / 100, status, quitadaEm: status === "PAGA" ? new Date() : null } });
    await atualizarCobranca(tx, parcela.vendaId, ctx.usuarioId, `Recebido R$ ${(d.valorCentavos / 100).toFixed(2).replace(".", ",")} da ${parcela.numero}ª parcela.`);
    await registrarAuditoria(tx, {
      usuarioId: ctx.usuarioId,
      acao: "PARCELA_RECEBIDA",
      entidade: "Parcela",
      entidadeId: parcelaId,
      detalhes: { venda: parcela.venda.numero, parcela: parcela.numero, valor: d.valorCentavos / 100, forma: d.forma },
    });
    return recebimento;
  });
}

export async function estornarRecebimento(recebimentoId: string, motivo: string, usuarioId: string) {
  await db.$transaction(async (tx) => {
    const rec = await tx.recebimento.findUnique({ where: { id: recebimentoId } });
    if (!rec) throw new ErroRecebimento("Recebimento não encontrado.");
    await tx.$queryRaw`SELECT id FROM "Parcela" WHERE id = ${rec.parcelaId} FOR UPDATE`;
    const atual = await tx.recebimento.findUniqueOrThrow({ where: { id: recebimentoId } });
    if (atual.estornadoEm) throw new ErroRecebimento("Este recebimento já foi estornado.");
    const parcela = await tx.parcela.findUniqueOrThrow({ where: { id: rec.parcelaId } });

    const pago = Math.max(0, Math.round(Number(parcela.valorPago) * 100) - Math.round(Number(rec.valor) * 100));
    await tx.recebimento.update({ where: { id: recebimentoId }, data: { estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: motivo } });
    await tx.parcela.update({
      where: { id: parcela.id },
      data: { valorPago: pago / 100, status: parcela.status === "CANCELADA" ? "CANCELADA" : statusAposPagamento(Math.round(Number(parcela.valor) * 100), pago), quitadaEm: null },
    });
    // Se a cobrança tinha sido regularizada e o estorno fez reaparecer atraso, ela é reaberta.
    const cobranca = await tx.cobranca.findUnique({ where: { vendaId: parcela.vendaId } });
    if (cobranca?.status === "REGULARIZADO") {
      const hoje = hojeComoData(hojeSP());
      const parcelas = await tx.parcela.findMany({ where: { vendaId: parcela.vendaId } });
      if (parcelas.some((p) => estaVencida(p, hoje))) {
        await tx.cobranca.update({ where: { id: cobranca.id }, data: { status: "PENDENTE" } });
        await tx.interacaoCobranca.create({
          data: {
            cobrancaId: cobranca.id,
            usuarioId,
            canal: "OUTRO",
            descricao: `Recebimento de R$ ${Number(rec.valor).toFixed(2).replace(".", ",")} estornado (${motivo}). Cobrança reaberta.`,
            statusAnterior: "REGULARIZADO",
            statusNovo: "PENDENTE",
          },
        });
      }
    }
    await registrarAuditoria(tx, {
      usuarioId,
      acao: "RECEBIMENTO_ESTORNADO",
      entidade: "Recebimento",
      entidadeId: recebimentoId,
      detalhes: { parcela: parcela.id, valor: Number(rec.valor), motivo },
    });
  });
}
