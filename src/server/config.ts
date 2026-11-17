import "server-only";
import { db } from "./db";

/** Lê uma configuração numérica da tabela Configuracao, com valor padrão. */
export async function configNumero(chave: string, padrao: number) {
  const c = await db.configuracao.findUnique({ where: { chave } });
  const n = Number(c?.valor);
  return Number.isFinite(n) ? n : padrao;
}
