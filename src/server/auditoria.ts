import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type Cliente = PrismaClient | Prisma.TransactionClient;

export async function registrarAuditoria(
  cliente: Cliente,
  dados: {
    usuarioId?: string | null;
    acao: string;
    entidade: string;
    entidadeId?: string | null;
    detalhes?: Prisma.InputJsonValue;
    ip?: string | null;
  },
) {
  await cliente.auditLog.create({
    data: {
      usuarioId: dados.usuarioId ?? null,
      acao: dados.acao,
      entidade: dados.entidade,
      entidadeId: dados.entidadeId ?? null,
      dados: dados.detalhes,
      ip: dados.ip ?? null,
    },
  });
}
