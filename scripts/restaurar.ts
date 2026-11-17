// Restaura um backup gerado por scripts/backup.ts em um banco VAZIO (com as tabelas já criadas).
// Uso:
//   1. Aponte o .env (DATABASE_URL/DIRECT_URL) para o banco de destino — nunca para o banco em uso.
//   2. npm run db:deploy            (cria as tabelas)
//   3. npm run restaurar -- caminho/do/gestao-backup-....json.gz
// Por segurança, a restauração é recusada se o banco de destino já tiver dados.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { ORDEM_TABELAS, delegado } from "./tabelas";

try {
  process.loadEnvFile(".env");
} catch {
  /* variáveis do ambiente */
}
// Conexão direta (sem pooler): a restauração é uma transação longa, que o pooler pode interromper.
const URL_BANCO = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const db = new PrismaClient({ datasourceUrl: URL_BANCO });

function desserializar(valor: unknown): unknown {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    const v = valor as Record<string, string>;
    if ("$data" in v) return new Date(v.$data);
    if ("$decimal" in v) return v.$decimal;
    if ("$bytes" in v) return Buffer.from(v.$bytes, "base64");
  }
  return valor;
}

async function main() {
  const caminho = process.argv[2];
  if (!caminho) throw new Error("Informe o arquivo de backup: npm run restaurar -- arquivo.json.gz");
  const backup = JSON.parse(gunzipSync(readFileSync(caminho)).toString("utf8")) as {
    versao: number;
    geradoEm: string;
    contagem: Record<string, number>;
    tabelas: Record<string, Record<string, unknown>[]>;
  };
  if (backup.versao !== 1) throw new Error(`Versão de backup não suportada: ${backup.versao}`);

  for (const tabela of ORDEM_TABELAS) {
    if ((await delegado(db, tabela).count()) > 0) {
      throw new Error(`O banco de destino já tem dados na tabela ${tabela}. A restauração só é feita em banco vazio.`);
    }
  }

  console.log(`Restaurando backup de ${backup.geradoEm}…`);
  await db.$transaction(
    async (tx) => {
      for (const tabela of ORDEM_TABELAS) {
        const linhas = backup.tabelas[tabela];
        if (!linhas?.length) continue;
        const dados = linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, desserializar(v)])));
        // Em lotes para não estourar o tamanho da consulta.
        for (let i = 0; i < dados.length; i += 500) {
          await delegado(tx as unknown as PrismaClient, tabela).createMany({ data: dados.slice(i, i + 500) });
        }
      }
      // O código das vendas é uma sequência: continua do maior número restaurado.
      // O esquema vem da URL (?schema=…); o Prisma não altera o search_path, então o nome precisa ser qualificado.
      const esquema = new URL(URL_BANCO ?? "postgresql://x/x").searchParams.get("schema") ?? "public";
      if (!/^[a-z_][a-z0-9_]*$/i.test(esquema)) throw new Error("Nome de esquema inválido na DATABASE_URL.");
      const tabela = `"${esquema}"."Venda"`;
      await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('${tabela}', 'numero'), COALESCE((SELECT MAX(numero) FROM ${tabela}), 0) + 1, false)`);
    },
    { timeout: 600_000, maxWait: 30_000 },
  );

  // Conferência: a contagem de cada tabela deve bater com a do backup.
  const divergencias: string[] = [];
  for (const [tabela, esperado] of Object.entries(backup.contagem)) {
    const atual = await delegado(db, tabela).count();
    if (atual !== esperado) divergencias.push(`${tabela}: esperado ${esperado}, restaurado ${atual}`);
  }
  if (divergencias.length) throw new Error(`Restauração com divergências:\n${divergencias.join("\n")}`);
  console.log("Restauração concluída e conferida: todas as tabelas batem com o backup.");
}

main()
  .catch((e) => {
    console.error("FALHA NA RESTAURAÇÃO:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
