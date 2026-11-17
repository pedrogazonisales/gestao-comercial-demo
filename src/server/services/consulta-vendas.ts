import "server-only";
import type { FormaPagamento, Prisma } from "@prisma/client";
import { somenteDigitos } from "@/lib/cpf";
import { FORMAS, numeroDoCodigo } from "@/lib/venda";
import { pode } from "../permissoes";
import type { SessaoAtual } from "../auth";

export type FiltrosVenda = {
  q?: string;
  vendedor?: string;
  loja?: string;
  forma?: string;
  status?: string;
  de?: string;
  ate?: string;
};

/** Monta o filtro do histórico. Vendedor sem permissão "verTodas" só enxerga as próprias vendas. */
export function filtroVendas(f: FiltrosVenda, sessao: SessaoAtual): Prisma.VendaWhereInput {
  const termo = (f.q ?? "").trim();
  const digitos = somenteDigitos(termo);
  const numero = numeroDoCodigo(termo);
  const and: Prisma.VendaWhereInput[] = [];

  if (!pode(sessao.usuario.perfil, "venda.verTodas")) {
    and.push({ vendedorId: sessao.usuario.vendedor?.id ?? "__nenhum__" });
  } else if (f.vendedor) {
    and.push({ vendedorId: f.vendedor });
  }
  if (f.loja) and.push({ lojaId: f.loja });
  if (f.status === "CONFIRMADA" || f.status === "CANCELADA") and.push({ status: f.status });
  if (f.forma && f.forma in FORMAS) and.push({ pagamentos: { some: { forma: f.forma as FormaPagamento } } });
  if (f.de) and.push({ dataHora: { gte: new Date(`${f.de}T00:00:00-03:00`) } });
  if (f.ate) and.push({ dataHora: { lte: new Date(`${f.ate}T23:59:59.999-03:00`) } });
  if (termo) {
    const ou: Prisma.VendaWhereInput[] = [{ cliente: { nome: { contains: termo, mode: "insensitive" } } }];
    if (numero !== null) ou.push({ numero });
    if (digitos.length >= 3) ou.push({ cliente: { cpf: { startsWith: digitos } } });
    and.push({ OR: ou });
  }
  return { AND: and };
}

export const incluirListaVendas = {
  loja: { select: { nome: true } },
  vendedor: { select: { nome: true } },
  cliente: { select: { nome: true, nomeSocial: true, cpf: true } },
  pagamentos: { select: { forma: true, valor: true, numeroParcelas: true } },
  itens: { select: { quantidade: true, variacao: { select: { sku: true, produto: { select: { nome: true } } } } } },
} satisfies Prisma.VendaInclude;
