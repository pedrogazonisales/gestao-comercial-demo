"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { criarSessao, ipDaRequisicao } from "@/server/auth";
import { registrarAuditoria } from "@/server/auditoria";
import { MODO_DEMO } from "@/lib/demo";

// login e lojaId voltam para o formulário não perder o que foi digitado após um erro.
export type EstadoLogin = { erro?: string; login?: string; lojaId?: string };

const esquema = z.object({
  login: z.string().trim().toLowerCase().min(1, "Informe o usuário"),
  senha: z.string().min(1, "Informe a senha"),
  lojaId: z.string().min(1, "Selecione a loja"),
});

const MAX_TENTATIVAS = 5;
const JANELA_BLOQUEIO_MIN = 15;
// Hash usado quando o usuário não existe, evitando revelar logins válidos pelo tempo de resposta.
const HASH_FICTICIO = bcrypt.hashSync("usuario-inexistente", 10);

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const preenchido = { login: String(form.get("login") ?? ""), lojaId: String(form.get("lojaId") ?? "") };
  const dados = esquema.safeParse(Object.fromEntries(form));
  if (!dados.success) return { ...preenchido, erro: dados.error.issues[0].message };
  const { login, senha, lojaId } = dados.data;
  const ip = await ipDaRequisicao();

  const desde = new Date(Date.now() - JANELA_BLOQUEIO_MIN * 60_000);
  const falhas = await db.auditLog.count({
    where: { acao: "LOGIN_FALHOU", entidade: "Usuario", entidadeId: login, createdAt: { gte: desde } },
  });
  // Na demonstração a senha é pública: o bloqueio só serviria para um visitante travar o acesso dos outros.
  if (!MODO_DEMO && falhas >= MAX_TENTATIVAS) {
    return { ...preenchido, erro: `Muitas tentativas. Aguarde ${JANELA_BLOQUEIO_MIN} minutos ou peça ajuda ao administrador.` };
  }

  const usuario = await db.usuario.findUnique({ where: { login } });
  const senhaOk = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FICTICIO);
  if (!usuario || !senhaOk || !usuario.ativo) {
    await registrarAuditoria(db, { acao: "LOGIN_FALHOU", entidade: "Usuario", entidadeId: login, ip });
    return { ...preenchido, erro: "Usuário ou senha incorretos." };
  }

  const loja = await db.loja.findFirst({ where: { id: lojaId, ativa: true } });
  if (!loja) return { ...preenchido, erro: "Loja inválida." };

  await criarSessao(usuario.id, loja.id);
  await db.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date(), lojaPadraoId: loja.id } });
  await registrarAuditoria(db, { usuarioId: usuario.id, acao: "LOGIN", entidade: "Usuario", entidadeId: usuario.id, ip });

  redirect(usuario.trocarSenha ? "/trocar-senha" : "/");
}
