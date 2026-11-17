import { redirect } from "next/navigation";
import { obterSessao } from "@/server/auth";
import { FormTrocaSenha } from "./form";

export const dynamic = "force-dynamic";

export default async function PaginaTrocarSenha() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-borda bg-superficie p-6 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold">Defina sua senha</h1>
        <p className="mt-1 mb-5 text-sm text-texto-suave">
          {sessao.usuario.trocarSenha
            ? "Por segurança, troque a senha provisória antes de continuar."
            : "Escolha uma nova senha de acesso."}
        </p>
        <FormTrocaSenha />
      </div>
    </main>
  );
}
