import type { PrismaClient } from "@prisma/client";

// Ordem que respeita as chaves estrangeiras (pais antes dos filhos). Usada no backup e na restauração.
export const ORDEM_TABELAS = [
  "Loja",
  "Usuario",
  "Sessao",
  "Vendedor",
  "Cliente",
  "Categoria",
  "Marca",
  "Produto",
  "ProdutoFoto",
  "ProdutoVariacao",
  "EstoqueSaldo",
  "Venda",
  "VendaItem",
  "Pagamento",
  "Parcela",
  "Recebimento",
  "MovimentacaoEstoque",
  "StatusPosVenda",
  "PosVenda",
  "InteracaoPosVenda",
  "Cobranca",
  "InteracaoCobranca",
  "PresenteCliente",
  "PresenteContato",
  "Configuracao",
  "AuditLog",
] as const;

type Delegado = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  createMany: (args: { data: unknown[] }) => Promise<{ count: number }>;
  count: () => Promise<number>;
};

/** Acesso genérico ao modelo do Prisma pelo nome da tabela (ex.: "VendaItem" → db.vendaItem). */
export function delegado(db: PrismaClient, tabela: string): Delegado {
  return (db as unknown as Record<string, Delegado>)[tabela[0].toLowerCase() + tabela.slice(1)];
}
