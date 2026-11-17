"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { registrarAuditoria } from "@/server/auditoria";
import { ajustarPrazo, ErroPosVenda, esquemaAjustePrazo, esquemaInteracao, registrarInteracao } from "@/server/services/posvenda";
import { ErroPresente, esquemaContatoPresente, registrarContatoPresente } from "@/server/services/presentes";
import { errosDoZod, type EstadoForm } from "@/lib/acao";

export async function acaoRegistrarInteracao(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao();
  const dados = esquemaInteracao.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await registrarInteracao(id, dados.data, sessao);
  } catch (e) {
    if (e instanceof ErroPosVenda) return { erro: e.message };
    throw e;
  }
  revalidatePath("/pos-venda", "layout");
  return { sucesso: "Contato registrado." };
}

export async function acaoAjustarPrazo(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("posvenda.ajustarPrazo");
  const dados = esquemaAjustePrazo.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await ajustarPrazo(id, dados.data, sessao);
  } catch (e) {
    if (e instanceof ErroPosVenda) return { erro: e.message };
    throw e;
  }
  revalidatePath("/pos-venda", "layout");
  return { sucesso: "Prazo ajustado." };
}

export async function acaoContatoPresente(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao();
  const dados = esquemaContatoPresente.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await registrarContatoPresente(id, dados.data, sessao);
  } catch (e) {
    if (e instanceof ErroPresente) return { erro: e.message };
    throw e;
  }
  revalidatePath("/pos-venda", "layout");
  return { sucesso: "Contato registrado." };
}

// ── Configuração do fluxo de status (ADMIN) ──

const esquemaStatus = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(3, "Nome muito curto").max(60),
  ordem: z.coerce.number().int().min(1).max(99),
  finaliza: z.preprocess((v) => v === "on", z.boolean()),
  ativo: z.preprocess((v) => v === "on", z.boolean()),
});

export async function acaoSalvarStatus(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("config.editar");
  const dados = esquemaStatus.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  const { id, ...d } = dados.data;

  const duplicado = await db.statusPosVenda.findFirst({ where: { nome: { equals: d.nome, mode: "insensitive" }, ...(id && { id: { not: id } }) } });
  if (duplicado) return { erro: "Já existe um status com este nome." };

  if (id) {
    const atual = await db.statusPosVenda.findUnique({ where: { id } });
    if (!atual) return { erro: "Status não encontrado." };
    if (atual.inicial && (!d.ativo || d.finaliza)) return { erro: "O status inicial não pode ser desativado nem encerrar o atendimento." };
    if (atual.ativo && !d.ativo && (await db.posVenda.count({ where: { statusId: id, venda: { status: "CONFIRMADA" } } })) > 0) {
      return { erro: "Há atendimentos neste status. Mova-os para outro status antes de desativar." };
    }
    await db.statusPosVenda.update({ where: { id }, data: d });
  } else {
    await db.statusPosVenda.create({ data: d });
  }
  if (!(await db.statusPosVenda.count({ where: { ativo: true, finaliza: true } }))) {
    return { erro: "Atenção: nenhum status ativo encerra o atendimento. Marque “Encerra” em pelo menos um." };
  }
  await registrarAuditoria(db, { usuarioId: sessao.usuario.id, acao: "POSVENDA_STATUS_SALVO", entidade: "StatusPosVenda", entidadeId: id ?? null, detalhes: d });
  revalidatePath("/pos-venda", "layout");
  return { sucesso: "Status salvo." };
}
