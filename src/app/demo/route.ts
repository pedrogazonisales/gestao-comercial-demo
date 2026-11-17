import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { criarSessao, ipDaRequisicao } from "@/server/auth";
import { registrarAuditoria } from "@/server/auditoria";
import { LOGIN_DEMO, MODO_DEMO } from "@/lib/demo";

export const dynamic = "force-dynamic";

// Link público do portfólio: entra como administrador da demonstração na primeira loja, sem digitar nada.
export async function GET(req: NextRequest) {
  if (!MODO_DEMO) return new NextResponse("Não encontrado", { status: 404 });

  const usuario = await db.usuario.findUnique({ where: { login: LOGIN_DEMO } });
  const loja = await db.loja.findFirst({ where: { ativa: true }, orderBy: { nome: "asc" } });
  if (!usuario?.ativo || !loja) return NextResponse.redirect(new URL("/login", req.url));

  await criarSessao(usuario.id, loja.id);
  await db.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date(), lojaPadraoId: loja.id } });
  await registrarAuditoria(db, { usuarioId: usuario.id, acao: "LOGIN", entidade: "Usuario", entidadeId: usuario.id, ip: await ipDaRequisicao(), detalhes: { viaLinkDemo: true } });
  return NextResponse.redirect(new URL("/", req.url));
}
