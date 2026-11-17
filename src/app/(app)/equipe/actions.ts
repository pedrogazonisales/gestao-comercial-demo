"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/server/auth";
import {
  atualizarUsuario,
  criarUsuario,
  ErroEquipe,
  esquemaEdicaoUsuario,
  esquemaNovoUsuario,
  redefinirSenha,
} from "@/server/services/equipe";
import { esquemaNovaSenha } from "@/lib/senha";
import { errosDoZod, type EstadoForm } from "@/lib/acao";
import { AVISO_DEMO, MODO_DEMO, protegidoNaDemo } from "@/lib/demo";
import { db } from "@/server/db";

async function alvoProtegido(id: string) {
  if (!MODO_DEMO) return false;
  const alvo = await db.usuario.findUnique({ where: { id }, select: { login: true } });
  return protegidoNaDemo(alvo?.login);
}

export async function acaoCriarUsuario(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("usuario.gerenciar");
  const dados = esquemaNovoUsuario.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await criarUsuario(dados.data, sessao.usuario.id);
  } catch (e) {
    if (e instanceof ErroEquipe) return { erro: e.message };
    throw e;
  }
  revalidatePath("/equipe");
  redirect("/equipe");
}

export async function acaoAtualizarUsuario(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("usuario.gerenciar");
  if (await alvoProtegido(id)) return { erro: AVISO_DEMO };
  const dados = esquemaEdicaoUsuario.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await atualizarUsuario(id, dados.data, sessao.usuario.id);
  } catch (e) {
    if (e instanceof ErroEquipe) return { erro: e.message };
    throw e;
  }
  revalidatePath("/equipe");
  redirect("/equipe");
}

export async function acaoRedefinirSenha(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("usuario.gerenciar");
  if (await alvoProtegido(id)) return { erro: AVISO_DEMO };
  const senha = esquemaNovaSenha.safeParse(form.get("senha"));
  if (!senha.success) return { erro: senha.error.issues[0].message, campos: { senha: senha.error.issues[0].message } };
  await redefinirSenha(id, senha.data, sessao.usuario.id);
  return { sucesso: "Senha provisória definida. O usuário deverá trocá-la no próximo acesso." };
}
