import { NextResponse, type NextRequest } from "next/server";

// Barreira rápida: sem cookie de sessão, vai para o login.
// A validação real da sessão acontece no servidor (exigirSessao).
// /demo só funciona com MODO_DEMO=1 (a própria rota responde 404 fora da demonstração).
const ROTAS_PUBLICAS = ["/login", "/demo"];

export function middleware(req: NextRequest) {
  const publica = ROTAS_PUBLICAS.some((r) => req.nextUrl.pathname.startsWith(r));
  if (!publica && !req.cookies.has("gestao_sessao")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Ignora arquivos estáticos (qualquer caminho com extensão, ex.: /logo.png).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
