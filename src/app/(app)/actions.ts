"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { encerrarSessao, exigirSessao } from "@/server/auth";

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

export async function trocarLoja(form: FormData) {
  const sessao = await exigirSessao();
  const lojaId = String(form.get("lojaId") ?? "");
  const loja = await db.loja.findFirst({ where: { id: lojaId, ativa: true } });
  if (!loja) return;
  await db.sessao.update({ where: { id: sessao.id }, data: { lojaId: loja.id } });
  await db.usuario.update({ where: { id: sessao.usuario.id }, data: { lojaPadraoId: loja.id } });
  revalidatePath("/", "layout");
}
