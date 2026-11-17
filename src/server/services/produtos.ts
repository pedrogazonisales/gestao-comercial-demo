import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { lerValorMonetario } from "@/lib/formato";
import { vazioParaUndefined } from "@/lib/acao";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";
import { movimentarEstoque } from "./estoque";

export class ErroProduto extends Error {}

const dinheiro = (rotulo: string, minimo: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : lerValorMonetario(v)))
    .refine((n) => Number.isFinite(n) && n >= minimo, `${rotulo} inválido`)
    .transform((n) => Math.round(n * 100) / 100);

const esquemaVariacao = z.object({
  id: z.string().optional(),
  descricao: z.string().trim().min(1, "Descreva a variação").max(80),
  cor: z.preprocess(vazioParaUndefined, z.string().trim().max(40).optional()),
  tamanho: z.preprocess(vazioParaUndefined, z.string().trim().max(40).optional()),
  sku: z.preprocess(vazioParaUndefined, z.string().trim().toUpperCase().max(40).optional()),
  codigoBarras: z.preprocess(vazioParaUndefined, z.string().trim().regex(/^\d{8,14}$/, "Código de barras: 8 a 14 dígitos").optional()),
  precoCusto: dinheiro("Preço de custo", 0),
  precoVenda: dinheiro("Preço de venda", 0.01),
  ativo: z.boolean().default(true),
  estoqueInicial: z.coerce.number().int().min(0).default(0),
});

export const esquemaProduto = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{1,30}$/, "Use até 30 letras, números, ponto ou hífen"),
  nome: z.string().trim().min(2, "Informe o nome").max(150),
  categoria: z.string().trim().min(2, "Informe a categoria").max(60),
  marca: z.preprocess(vazioParaUndefined, z.string().trim().max(60).optional()),
  descricao: z.preprocess(vazioParaUndefined, z.string().trim().max(2000).optional()),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  estoqueMinimo: z.coerce.number().int().min(0, "Estoque mínimo inválido").default(0),
  variacoes: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        return undefined;
      }
    },
    z.array(esquemaVariacao).min(1, "Cadastre pelo menos uma variação"),
  ),
});

export type DadosProduto = z.infer<typeof esquemaProduto>;

const FOTO_TIPOS = ["image/webp", "image/jpeg", "image/png"];
const FOTO_MAX_BYTES = 500_000;

export function validarFoto(arquivo: FormDataEntryValue | null): File | null {
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  if (!FOTO_TIPOS.includes(arquivo.type)) throw new ErroProduto("A foto deve ser JPG, PNG ou WebP.");
  if (arquivo.size > FOTO_MAX_BYTES) throw new ErroProduto("Foto muito grande. Tente outra imagem.");
  return arquivo;
}

function nomeCanonico(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

async function resolverCategoriaMarca(tx: Prisma.TransactionClient, d: DadosProduto) {
  // Reaproveita o cadastro existente mesmo com diferença de maiúsculas/minúsculas.
  const nomeCat = nomeCanonico(d.categoria);
  const categoria =
    (await tx.categoria.findFirst({ where: { nome: { equals: nomeCat, mode: "insensitive" } } })) ??
    (await tx.categoria.create({ data: { nome: nomeCat } }));
  let marcaId: string | null = null;
  if (d.marca) {
    const nomeMarca = nomeCanonico(d.marca);
    const marca =
      (await tx.marca.findFirst({ where: { nome: { equals: nomeMarca, mode: "insensitive" } } })) ??
      (await tx.marca.create({ data: { nome: nomeMarca } }));
    marcaId = marca.id;
  }
  return { categoriaId: categoria.id, marcaId };
}

function skuPadrao(codigo: string, indice: number, total: number) {
  return total === 1 && indice === 0 ? codigo : `${codigo}-${indice + 1}`;
}

function traduzirUnico(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const alvo = String((e.meta?.target as string[] | undefined)?.join(",") ?? "");
    if (alvo.includes("codigoBarras")) throw new ErroProduto("Código de barras já usado em outro produto.");
    if (alvo.includes("sku")) throw new ErroProduto("SKU já usado em outro produto.");
    if (alvo.includes("codigo")) throw new ErroProduto("Já existe um produto com este código.");
  }
  throw e;
}

async function salvarFoto(tx: Prisma.TransactionClient, produtoId: string, foto: File | null, remover: boolean) {
  if (foto) {
    const dados = Buffer.from(await foto.arrayBuffer());
    await tx.produtoFoto.upsert({
      where: { produtoId },
      update: { mime: foto.type, dados },
      create: { produtoId, mime: foto.type, dados },
    });
  } else if (remover) {
    await tx.produtoFoto.deleteMany({ where: { produtoId } });
  }
}

export async function criarProduto(d: DadosProduto, ctx: { usuarioId: string; lojaId: string; foto: File | null }) {
  try {
    return await db.$transaction(async (tx) => {
      const { categoriaId, marcaId } = await resolverCategoriaMarca(tx, d);
      const produto = await tx.produto.create({
        data: { codigo: d.codigo, nome: d.nome, categoriaId, marcaId, descricao: d.descricao ?? null, ativo: d.ativo },
      });
      const lojas = await tx.loja.findMany({ where: { ativa: true }, select: { id: true } });

      for (const [i, v] of d.variacoes.entries()) {
        const variacao = await tx.produtoVariacao.create({
          data: {
            produtoId: produto.id,
            sku: v.sku ?? skuPadrao(d.codigo, i, d.variacoes.length),
            codigoBarras: v.codigoBarras ?? null,
            descricao: v.descricao,
            cor: v.cor ?? null,
            tamanho: v.tamanho ?? null,
            precoCusto: v.precoCusto,
            precoVenda: v.precoVenda,
            ativo: v.ativo,
          },
        });
        await tx.estoqueSaldo.createMany({
          data: lojas.map((l) => ({ variacaoId: variacao.id, lojaId: l.id, quantidade: 0, estoqueMinimo: d.estoqueMinimo })),
        });
        if (v.estoqueInicial > 0) {
          await movimentarEstoque(tx, {
            variacaoId: variacao.id,
            lojaId: ctx.lojaId,
            quantidade: v.estoqueInicial,
            tipo: "ENTRADA",
            usuarioId: ctx.usuarioId,
            justificativa: "Estoque inicial no cadastro do produto",
          });
        }
      }
      await salvarFoto(tx, produto.id, ctx.foto, false);
      await registrarAuditoria(tx, { usuarioId: ctx.usuarioId, acao: "PRODUTO_CRIADO", entidade: "Produto", entidadeId: produto.id });
      return produto;
    });
  } catch (e) {
    traduzirUnico(e);
  }
}

export async function atualizarProduto(
  id: string,
  d: DadosProduto,
  ctx: { usuarioId: string; foto: File | null; removerFoto: boolean },
) {
  const atual = await db.produto.findUnique({ where: { id }, include: { variacoes: true } });
  if (!atual) throw new ErroProduto("Produto não encontrado.");
  const idsExistentes = new Set(atual.variacoes.map((v) => v.id));
  if (d.variacoes.some((v) => v.id && !idsExistentes.has(v.id))) throw new ErroProduto("Variação inválida.");
  if (!d.variacoes.some((v) => v.ativo)) throw new ErroProduto("Mantenha pelo menos uma variação ativa.");

  try {
    await db.$transaction(async (tx) => {
      const { categoriaId, marcaId } = await resolverCategoriaMarca(tx, d);
      await tx.produto.update({
        where: { id },
        data: { codigo: d.codigo, nome: d.nome, categoriaId, marcaId, descricao: d.descricao ?? null, ativo: d.ativo },
      });
      const lojas = await tx.loja.findMany({ where: { ativa: true }, select: { id: true } });
      const precosAlterados: string[] = [];
      let proximoSufixo = atual.variacoes.length + 1;

      for (const v of d.variacoes) {
        const dados = {
          descricao: v.descricao,
          cor: v.cor ?? null,
          tamanho: v.tamanho ?? null,
          codigoBarras: v.codigoBarras ?? null,
          precoCusto: v.precoCusto,
          precoVenda: v.precoVenda,
          ativo: v.ativo,
        };
        if (v.id) {
          const anterior = atual.variacoes.find((x) => x.id === v.id)!;
          if (Number(anterior.precoVenda) !== v.precoVenda || Number(anterior.precoCusto) !== v.precoCusto) {
            precosAlterados.push(`${anterior.sku}: venda ${anterior.precoVenda}→${v.precoVenda}, custo ${anterior.precoCusto}→${v.precoCusto}`);
          }
          // O SKU não muda depois de criado (é referência em vendas e movimentações).
          await tx.produtoVariacao.update({ where: { id: v.id }, data: dados });
        } else {
          const nova = await tx.produtoVariacao.create({
            data: { ...dados, produtoId: id, sku: v.sku ?? `${atual.codigo}-${proximoSufixo++}` },
          });
          await tx.estoqueSaldo.createMany({
            data: lojas.map((l) => ({ variacaoId: nova.id, lojaId: l.id, quantidade: 0, estoqueMinimo: d.estoqueMinimo })),
          });
        }
      }
      await salvarFoto(tx, id, ctx.foto, ctx.removerFoto);
      await registrarAuditoria(tx, {
        usuarioId: ctx.usuarioId,
        acao: "PRODUTO_EDITADO",
        entidade: "Produto",
        entidadeId: id,
        detalhes: precosAlterados.length ? { precos: precosAlterados } : undefined,
      });
    });
  } catch (e) {
    traduzirUnico(e);
  }
}
