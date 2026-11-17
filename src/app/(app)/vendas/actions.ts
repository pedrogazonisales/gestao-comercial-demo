"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { cancelarVenda, ErroVenda, esquemaVenda, registrarVenda } from "@/server/services/vendas";
import { cpfValido, somenteDigitos } from "@/lib/cpf";
import type { EstadoForm } from "@/lib/acao";

export type ClienteVenda = { id: string; nome: string; cpf: string; celular: string | null; consentimentoContato: boolean };

const camposCliente = { id: true, nome: true, nomeSocial: true, cpf: true, celular: true, consentimentoContato: true } as const;

export async function buscarClienteVenda(busca: { cpf?: string; id?: string }): Promise<ClienteVenda | null> {
  await exigirSessao("venda.registrar");
  if (busca.id) {
    const c = await db.cliente.findUnique({ where: { id: busca.id }, select: camposCliente });
    return c && { ...c, nome: c.nomeSocial || c.nome };
  }
  const cpf = somenteDigitos(busca.cpf ?? "");
  if (!cpfValido(cpf)) return null;
  const c = await db.cliente.findUnique({ where: { cpf }, select: camposCliente });
  return c && { ...c, nome: c.nomeSocial || c.nome };
}

export type ProdutoVenda = {
  variacaoId: string;
  nome: string;
  descricao: string;
  sku: string;
  precoCentavos: number;
  estoqueLoja: number;
  outrasLojas: { loja: string; quantidade: number }[];
};

export async function buscarProdutosVenda(termo: string): Promise<ProdutoVenda[]> {
  const sessao = await exigirSessao("venda.registrar");
  const t = termo.trim();
  if (t.length < 2) return [];
  const variacoes = await db.produtoVariacao.findMany({
    where: {
      ativo: true,
      produto: { ativo: true },
      OR: [
        { sku: { equals: t, mode: "insensitive" } },
        { codigoBarras: t },
        { sku: { contains: t, mode: "insensitive" } },
        { descricao: { contains: t, mode: "insensitive" } },
        { produto: { nome: { contains: t, mode: "insensitive" } } },
        { produto: { codigo: { contains: t, mode: "insensitive" } } },
        { produto: { marca: { nome: { contains: t, mode: "insensitive" } } } },
      ],
    },
    take: 15,
    orderBy: [{ produto: { nome: "asc" } }, { sku: "asc" }],
    include: { produto: { select: { nome: true } }, estoques: { include: { loja: { select: { nome: true } } } } },
  });
  // Código exato (leitor de código de barras) vem primeiro.
  variacoes.sort((a, b) => Number(b.codigoBarras === t || b.sku.toUpperCase() === t.toUpperCase()) - Number(a.codigoBarras === t || a.sku.toUpperCase() === t.toUpperCase()));
  return variacoes.map((v) => ({
    variacaoId: v.id,
    nome: v.produto.nome,
    descricao: v.descricao,
    sku: v.sku,
    precoCentavos: Math.round(Number(v.precoVenda) * 100),
    estoqueLoja: v.estoques.find((e) => e.lojaId === sessao.loja?.id)?.quantidade ?? 0,
    outrasLojas: v.estoques.filter((e) => e.lojaId !== sessao.loja?.id && e.quantidade > 0).map((e) => ({ loja: e.loja.nome, quantidade: e.quantidade })),
  }));
}

export async function acaoRegistrarVenda(dadosJson: string): Promise<EstadoForm> {
  const sessao = await exigirSessao("venda.registrar");
  if (!sessao.loja) return { erro: "Selecione a loja atual no topo da tela antes de vender." };

  let bruto: unknown;
  try {
    bruto = JSON.parse(dadosJson);
  } catch {
    return { erro: "Dados da venda inválidos." };
  }
  const dados = esquemaVenda.safeParse(bruto);
  if (!dados.success) return { erro: dados.error.issues[0].message };

  let id: string;
  try {
    id = (await registrarVenda(dados.data, { usuarioId: sessao.usuario.id, perfil: sessao.usuario.perfil, lojaId: sessao.loja.id })).id;
  } catch (e) {
    if (e instanceof ErroVenda) return { erro: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/vendas/${id}?nova=1`);
}

export async function acaoCancelarVenda(vendaId: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("venda.cancelar");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { erro: "Informe o motivo do cancelamento.", campos: { motivo: "Informe o motivo do cancelamento." } };
  try {
    await cancelarVenda(vendaId, motivo, sessao.usuario.id);
  } catch (e) {
    if (e instanceof ErroVenda) return { erro: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { sucesso: "Venda cancelada. O estoque foi devolvido." };
}
