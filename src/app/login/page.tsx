import { redirect } from "next/navigation";
import { MarcaEmpresa } from "@/components/marca";
import { Aviso } from "@/components/ui";
import { EMPRESA, NOME_SISTEMA } from "@/lib/empresa";
import { LOGIN_DEMO, MODO_DEMO, SENHA_DEMO } from "@/lib/demo";
import { bancoConfigurado, db } from "@/server/db";
import { obterSessao } from "@/server/auth";
import { FormLogin } from "./form";

export const dynamic = "force-dynamic";

export default async function PaginaLogin() {
  if (!bancoConfigurado()) {
    return (
      <Moldura>
        <Aviso tipo="alerta">
          Banco de dados não configurado. Preencha o arquivo <code>.env</code> conforme o guia de configuração.
        </Aviso>
      </Moldura>
    );
  }

  if (await obterSessao()) redirect("/");
  const lojas = await db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });

  return (
    <Moldura>
      {MODO_DEMO && (
        <div className="mb-5 space-y-3 rounded-lg border border-marca/30 bg-marca-claro p-3 text-sm">
          <p>
            <strong>Demonstração com dados fictícios.</strong> Acesso: usuário <code className="font-semibold">{LOGIN_DEMO}</code>, senha{" "}
            <code className="font-semibold">{SENHA_DEMO}</code>, em qualquer loja.
          </p>
          {/* <a> e não <Link>: o Link pré-carrega a rota e abriria a sessão sem clique. */}
          <a href="/demo" className="flex h-10 items-center justify-center rounded-lg bg-marca px-4 font-medium text-white hover:bg-marca-escuro">
            Entrar na demonstração
          </a>
        </div>
      )}
      <FormLogin lojas={lojas} />
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <MarcaEmpresa tamanho="login" />
          <div className="mt-4 h-px w-16 bg-ouro" />
          {/* Sem empresa configurada, a marca já mostra "Gestão Comercial": não repetir. */}
          {(EMPRESA.nome || EMPRESA.logo) && <h1 className="mt-4 font-serif text-2xl font-semibold text-texto">{NOME_SISTEMA}</h1>}
        </div>
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
