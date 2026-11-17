"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { obterSessao } from "@/server/auth";
import { registrarAuditoria } from "@/server/auditoria";
import { esquemaNovaSenha } from "@/lib/senha";
import { AVISO_DEMO, protegidoNaDemo } from "@/lib/demo";

export type EstadoTrocaSenha = { erro?: string };

const esquema = z
  .object({ atual: z.string().min(1, "Informe a senha atual"), nova: esquemaNovaSenha, confirmacao: z.string() })
  .refine((d) => d.nova === d.confirmacao, { message: "A confirmação não confere com a nova senha" })
  .refine((d) => d.nova !== d.atual, { message: "A nova senha deve ser diferente da atual" });

export async function trocarSenha(_: EstadoTrocaSenha, form: FormData): Promise<EstadoTrocaSenha> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (protegidoNaDemo(sessao.usuario.login)) return { erro: AVISO_DEMO };

  const dados = esquema.safeParse(Object.fromEntries(form));
  if (!dados.success) return { erro: dados.error.issues[0].message };

  if (!(await bcrypt.compare(dados.data.atual, sessao.usuario.senhaHash))) {
    return { erro: "Senha atual incorreta." };
  }

  await db.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: sessao.usuario.id },
      data: { senhaHash: await bcrypt.hash(dados.data.nova, 12), trocarSenha: false },
    });
    // Encerra as outras sessões abertas com a senha antiga.
    await tx.sessao.deleteMany({ where: { usuarioId: sessao.usuario.id, id: { not: sessao.id } } });
    await registrarAuditoria(tx, { usuarioId: sessao.usuario.id, acao: "SENHA_ALTERADA", entidade: "Usuario", entidadeId: sessao.usuario.id });
  });

  redirect("/");
}
