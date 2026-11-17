// Backup completo do banco em um arquivo .json.gz (todas as tabelas, inclusive fotos).
// Uso: npm run backup            → salva em ./backups (ou na pasta de BACKUP_DIR)
// O arquivo contém dados pessoais (LGPD): guarde em local protegido e com acesso restrito.
import { createWriteStream, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { Prisma, PrismaClient } from "@prisma/client";
import { ORDEM_TABELAS } from "./tabelas";

try {
  process.loadEnvFile(".env");
} catch {
  /* em servidor as variáveis já vêm do ambiente */
}
const db = new PrismaClient();

// Sessões não entram: são temporárias e forçar novo login após restauração é desejável.
const IGNORAR = new Set(["Sessao"]);

function serializar(valor: unknown): unknown {
  if (valor instanceof Date) return { $data: valor.toISOString() };
  if (valor instanceof Prisma.Decimal) return { $decimal: valor.toString() };
  if (valor instanceof Uint8Array) return { $bytes: Buffer.from(valor).toString("base64") };
  return valor;
}

async function main() {
  const pasta = resolve(process.env.BACKUP_DIR ?? "backups");
  mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const arquivo = join(pasta, `gestao-backup-${carimbo}.json.gz`);

  const conteudo: Record<string, unknown[]> = {};
  const contagem: Record<string, number> = {};
  // SQL direto, e não o modelo do Prisma: o backup precisa funcionar antes de aplicar uma migração nova,
  // quando o código já conhece colunas e tabelas que ainda não existem no banco.
  const existentes = await db.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
  const nomes = new Set(existentes.map((t) => t.table_name));
  for (const tabela of ORDEM_TABELAS) {
    if (IGNORAR.has(tabela) || !nomes.has(tabela)) continue;
    const linhas = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${tabela}"`);
    conteudo[tabela] = linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, serializar(v)])));
    contagem[tabela] = linhas.length;
  }
  const migracoes = await db.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at`;

  const json = JSON.stringify({ versao: 1, geradoEm: new Date().toISOString(), migracoes: migracoes.map((m) => m.migration_name), contagem, tabelas: conteudo });
  await pipeline(Readable.from([json]), createGzip({ level: 9 }), createWriteStream(arquivo));

  console.log(`Backup salvo em: ${arquivo}`);
  console.table(contagem);
}

main()
  .catch((e) => {
    console.error("FALHA NO BACKUP:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
