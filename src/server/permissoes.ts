import type { Perfil } from "@prisma/client";

// Fonte única das permissões. Toda checagem (tela e servidor) consulta esta tabela.
export const PERMISSOES = {
  "venda.registrar": ["ADMIN", "GERENTE", "VENDEDOR"],
  "venda.cancelar": ["ADMIN", "GERENTE"],
  "venda.verTodas": ["ADMIN", "GERENTE"],
  "cliente.editar": ["ADMIN", "GERENTE", "VENDEDOR"],
  "produto.editar": ["ADMIN", "GERENTE"],
  "produto.verCusto": ["ADMIN", "GERENTE"],
  "estoque.ajustar": ["ADMIN", "GERENTE"],
  "estoque.negativo": ["ADMIN"],
  "posvenda.ajustarPrazo": ["ADMIN", "GERENTE"],
  "parcela.receber": ["ADMIN", "GERENTE", "VENDEDOR"],
  "parcela.estornar": ["ADMIN", "GERENTE"],
  "cobranca.gerenciar": ["ADMIN", "GERENTE"],
  "relatorio.ver": ["ADMIN", "GERENTE"],
  "usuario.gerenciar": ["ADMIN"],
  "config.editar": ["ADMIN"],
} as const satisfies Record<string, readonly Perfil[]>;

export type Permissao = keyof typeof PERMISSOES;

export function pode(perfil: Perfil, permissao: Permissao): boolean {
  return (PERMISSOES[permissao] as readonly Perfil[]).includes(perfil);
}

export const NOME_PERFIL: Record<Perfil, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  VENDEDOR: "Vendedor",
};
