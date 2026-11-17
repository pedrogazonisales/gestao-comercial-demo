import Link from "next/link";
import { LogOut } from "lucide-react";
import { MarcaEmpresa } from "@/components/marca";
import { EMPRESA } from "@/lib/empresa";
import { MODO_DEMO } from "@/lib/demo";
import { db } from "@/server/db";
import { exigirSessao } from "@/server/auth";
import { NOME_PERFIL } from "@/server/permissoes";
import { sair } from "./actions";
import { Navegacao } from "./navegacao";
import { SeletorLoja } from "./seletor-loja";
import { SuporteChat } from "./suporte-chat";
import { SUGESTOES_SUPORTE } from "@/server/suporte/prompt";

export const dynamic = "force-dynamic";

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  const lojas = await db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr] print:block">
      <aside className="border-b border-borda bg-superficie lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 print:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:block lg:px-5 lg:pt-6">
          <Link href="/" className="block">
            <MarcaEmpresa />
          </Link>
          <div className="lg:hidden">
            <SeletorLoja id="loja-atual-movel" lojas={lojas} atual={sessao.loja?.id} />
          </div>
        </div>
        <div className="px-3 py-3 lg:mt-6">
          <Navegacao perfil={sessao.usuario.perfil} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {MODO_DEMO && (
          <p className="bg-marca px-4 py-1.5 text-center text-xs text-white lg:px-8 print:hidden">
            Demonstração com dados fictícios. Fique à vontade para testar: os dados são restaurados periodicamente.
          </p>
        )}
        <header className="flex items-center justify-between gap-4 border-b border-borda bg-superficie/80 px-4 py-3 backdrop-blur lg:px-8 print:hidden">
          <div className="hidden items-center gap-2 text-sm text-texto-suave lg:flex">
            <span>Loja</span>
            <SeletorLoja id="loja-atual" lojas={lojas} atual={sessao.loja?.id} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{sessao.usuario.nome}</p>
              <p className="text-xs text-ouro-texto">{NOME_PERFIL[sessao.usuario.perfil]}</p>
            </div>
            <form action={sair}>
              <button
                type="submit"
                className="flex size-9 items-center justify-center rounded-lg text-texto-suave hover:bg-marca-claro hover:text-marca"
                title="Sair"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>
        </header>
        {/* pb-24: espaço para a bolinha de suporte não cobrir o fim das páginas */}
        <main className="flex-1 px-4 pt-6 pb-24 lg:px-8 lg:pt-8 print:p-0">{children}</main>
      </div>
      <SuporteChat empresa={EMPRESA.nome} nome={sessao.usuario.nome} perfilRotulo={NOME_PERFIL[sessao.usuario.perfil]} sugestoes={SUGESTOES_SUPORTE[sessao.usuario.perfil]} />
    </div>
  );
}
