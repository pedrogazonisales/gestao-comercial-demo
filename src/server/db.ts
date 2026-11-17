import "server-only";
import { PrismaClient } from "@prisma/client";

// Reaproveita a conexão entre recarregamentos do servidor de desenvolvimento.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = db;

export function bancoConfigurado() {
  return Boolean(process.env.DATABASE_URL);
}
