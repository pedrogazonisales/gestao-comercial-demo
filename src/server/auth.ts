import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { pode, type Permissao } from "./permissoes";

export const COOKIE_SESSAO = "gestao_sessao";
const DURACAO_SESSAO_HORAS = 12;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ipDaRequisicao() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function criarSessao(usuarioId: string, lojaId: string) {
  // O token vai só no cookie; o banco guarda apenas o hash.
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_HORAS * 3600_000);
  await db.sessao.create({
    data: { usuarioId, lojaId, tokenHash: hashToken(token), expiraEm, ip: await ipDaRequisicao() },
  });
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export const obterSessao = cache(async () => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const sessao = await db.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { include: { vendedor: true } } },
  });
  if (!sessao || sessao.expiraEm < new Date() || !sessao.usuario.ativo) return null;
  const loja = sessao.lojaId ? await db.loja.findUnique({ where: { id: sessao.lojaId } }) : null;
  return { id: sessao.id, usuario: sessao.usuario, loja };
});

export type SessaoAtual = NonNullable<Awaited<ReturnType<typeof obterSessao>>>;

/** Exige usuário autenticado (e, opcionalmente, uma permissão). Use em toda página e ação protegida. */
export async function exigirSessao(permissao?: Permissao): Promise<SessaoAtual> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (sessao.usuario.trocarSenha) redirect("/trocar-senha");
  if (permissao && !pode(sessao.usuario.perfil, permissao)) redirect("/?sem-permissao=1");
  return sessao;
}

export async function encerrarSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await db.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE_SESSAO);
}
