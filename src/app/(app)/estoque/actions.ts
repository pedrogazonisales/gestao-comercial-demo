"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { registrarAuditoria } from "@/server/auditoria";
import { ajustarParaContagem, ErroEstoque, movimentarEstoque, transferirEntreLojas } from "@/server/services/estoque";
import { errosDoZod, vazioParaUndefined, type EstadoForm } from "@/lib/acao";

const esquema = z.discriminatedUnion("operacao", [
  z.object({
    operacao: z.literal("ENTRADA"),
    variacaoId: z.string().min(1),
    lojaId: z.string().min(1, "Selecione a loja"),
    quantidade: z.coerce.number().int("Use números inteiros").min(1, "Informe a quantidade"),
    justificativa: z.preprocess(vazioParaUndefined, z.string().trim().max(300).optional()),
  }),
  z.object({
    operacao: z.literal("AJUSTE"),
    variacaoId: z.string().min(1),
    lojaId: z.string().min(1, "Selecione a loja"),
    quantidade: z.coerce.number().int("Use números inteiros").min(0, "A contagem não pode ser negativa"),
    justificativa: z.string().trim().min(5, "Explique o motivo do ajuste").max(300),
  }),
  z.object({
    operacao: z.literal("TRANSFERENCIA"),
    variacaoId: z.string().min(1),
    lojaId: z.string().min(1, "Selecione a loja de origem"),
    destinoId: z.string().min(1, "Selecione a loja de destino"),
    quantidade: z.coerce.number().int("Use números inteiros").min(1, "Informe a quantidade"),
    justificativa: z.preprocess(vazioParaUndefined, z.string().trim().max(300).optional()),
  }),
]);

export async function acaoMovimentar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("estoque.ajustar");
  const dados = esquema.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  const d = dados.data;
  const usuarioId = sessao.usuario.id;

  const variacao = await db.produtoVariacao.findUnique({ where: { id: d.variacaoId }, include: { produto: true } });
  if (!variacao) return { erro: "Produto não encontrado." };

  try {
    await db.$transaction(async (tx) => {
      if (d.operacao === "ENTRADA") {
        await movimentarEstoque(tx, { variacaoId: d.variacaoId, lojaId: d.lojaId, quantidade: d.quantidade, tipo: "ENTRADA", usuarioId, justificativa: d.justificativa });
      } else if (d.operacao === "AJUSTE") {
        const m = await ajustarParaContagem(tx, { variacaoId: d.variacaoId, lojaId: d.lojaId, quantidadeContada: d.quantidade, usuarioId, justificativa: d.justificativa });
        await registrarAuditoria(tx, {
          usuarioId,
          acao: "ESTOQUE_AJUSTADO",
          entidade: "ProdutoVariacao",
          entidadeId: d.variacaoId,
          detalhes: { lojaId: d.lojaId, de: m.saldoAnterior, para: m.saldoPosterior, justificativa: d.justificativa },
        });
      } else {
        await transferirEntreLojas(tx, { variacaoId: d.variacaoId, origemId: d.lojaId, destinoId: d.destinoId, quantidade: d.quantidade, usuarioId, justificativa: d.justificativa });
      }
    });
  } catch (e) {
    if (e instanceof ErroEstoque) return { erro: e.message };
    throw e;
  }

  revalidatePath("/estoque", "layout");
  revalidatePath(`/produtos/${variacao.produtoId}`);
  const rotulo = { ENTRADA: "Entrada registrada", AJUSTE: "Ajuste registrado", TRANSFERENCIA: "Transferência registrada" }[d.operacao];
  return { sucesso: `${rotulo}: ${variacao.produto.nome} (${variacao.descricao}).` };
}

const esquemaMinimo = z.object({
  variacaoId: z.string().min(1),
  lojaId: z.string().min(1),
  estoqueMinimo: z.coerce.number().int().min(0, "Valor inválido"),
});

export async function acaoDefinirMinimo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("estoque.ajustar");
  const dados = esquemaMinimo.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  const { variacaoId, lojaId, estoqueMinimo } = dados.data;
  await db.estoqueSaldo.upsert({
    where: { variacaoId_lojaId: { variacaoId, lojaId } },
    update: { estoqueMinimo },
    create: { variacaoId, lojaId, quantidade: 0, estoqueMinimo },
  });
  await registrarAuditoria(db, { usuarioId: sessao.usuario.id, acao: "ESTOQUE_MINIMO_ALTERADO", entidade: "ProdutoVariacao", entidadeId: variacaoId, detalhes: { lojaId, estoqueMinimo } });
  revalidatePath("/estoque");
  return { sucesso: "Estoque mínimo atualizado." };
}
