import "server-only";
import type { Prisma, TipoMovimentacao } from "@prisma/client";

export class ErroEstoque extends Error {}

/**
 * Única porta de alteração de saldo. Sempre roda dentro de uma transação:
 * trava a linha do saldo (FOR UPDATE), impede saldo negativo e grava a movimentação.
 */
export async function movimentarEstoque(
  tx: Prisma.TransactionClient,
  m: {
    variacaoId: string;
    lojaId: string;
    quantidade: number; // positiva = entrada; negativa = saída
    tipo: TipoMovimentacao;
    usuarioId: string;
    justificativa?: string | null;
    vendaId?: string | null;
    transferenciaId?: string | null;
    permitirNegativo?: boolean;
  },
) {
  if (!Number.isInteger(m.quantidade) || m.quantidade === 0) throw new ErroEstoque("Quantidade inválida.");

  await tx.estoqueSaldo.upsert({
    where: { variacaoId_lojaId: { variacaoId: m.variacaoId, lojaId: m.lojaId } },
    update: {},
    create: { variacaoId: m.variacaoId, lojaId: m.lojaId, quantidade: 0 },
  });
  const [linha] = await tx.$queryRaw<{ quantidade: number }[]>`
    SELECT quantidade FROM "EstoqueSaldo"
    WHERE "variacaoId" = ${m.variacaoId} AND "lojaId" = ${m.lojaId}
    FOR UPDATE`;

  const saldoAnterior = linha.quantidade;
  const saldoPosterior = saldoAnterior + m.quantidade;
  if (saldoPosterior < 0 && !m.permitirNegativo) {
    throw new ErroEstoque(`Estoque insuficiente: disponível ${saldoAnterior}, solicitado ${-m.quantidade}.`);
  }

  await tx.estoqueSaldo.update({
    where: { variacaoId_lojaId: { variacaoId: m.variacaoId, lojaId: m.lojaId } },
    data: { quantidade: saldoPosterior },
  });
  return tx.movimentacaoEstoque.create({
    data: {
      variacaoId: m.variacaoId,
      lojaId: m.lojaId,
      tipo: m.tipo,
      quantidade: m.quantidade,
      saldoAnterior,
      saldoPosterior,
      justificativa: m.justificativa ?? null,
      usuarioId: m.usuarioId,
      vendaId: m.vendaId ?? null,
      transferenciaId: m.transferenciaId ?? null,
    },
  });
}

/** Ajuste por contagem física: informa a quantidade real e o sistema lança a diferença. */
export async function ajustarParaContagem(
  tx: Prisma.TransactionClient,
  a: { variacaoId: string; lojaId: string; quantidadeContada: number; usuarioId: string; justificativa: string },
) {
  const saldo = await tx.estoqueSaldo.findUnique({
    where: { variacaoId_lojaId: { variacaoId: a.variacaoId, lojaId: a.lojaId } },
  });
  const diferenca = a.quantidadeContada - (saldo?.quantidade ?? 0);
  if (diferenca === 0) throw new ErroEstoque("A quantidade contada é igual ao saldo atual. Nada a ajustar.");
  return movimentarEstoque(tx, { ...a, quantidade: diferenca, tipo: "AJUSTE" });
}

export async function transferirEntreLojas(
  tx: Prisma.TransactionClient,
  t: { variacaoId: string; origemId: string; destinoId: string; quantidade: number; usuarioId: string; justificativa?: string | null },
) {
  if (t.origemId === t.destinoId) throw new ErroEstoque("A loja de origem e de destino devem ser diferentes.");
  const transferenciaId = crypto.randomUUID();
  await movimentarEstoque(tx, {
    variacaoId: t.variacaoId,
    lojaId: t.origemId,
    quantidade: -t.quantidade,
    tipo: "TRANSFERENCIA_SAIDA",
    usuarioId: t.usuarioId,
    justificativa: t.justificativa,
    transferenciaId,
  });
  await movimentarEstoque(tx, {
    variacaoId: t.variacaoId,
    lojaId: t.destinoId,
    quantidade: t.quantidade,
    tipo: "TRANSFERENCIA_ENTRADA",
    usuarioId: t.usuarioId,
    justificativa: t.justificativa,
    transferenciaId,
  });
}

export const NOME_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  ENTRADA: "Entrada",
  SAIDA_VENDA: "Saída por venda",
  ESTORNO_VENDA: "Estorno de venda",
  DEVOLUCAO: "Devolução",
  AJUSTE: "Ajuste",
  TRANSFERENCIA_SAIDA: "Transferência (saída)",
  TRANSFERENCIA_ENTRADA: "Transferência (entrada)",
};
