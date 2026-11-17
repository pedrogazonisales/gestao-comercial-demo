import { redirect } from "next/navigation";
import { Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";

export default async function MeuDesempenho() {
  const sessao = await exigirSessao();
  if (sessao.usuario.vendedor?.ativo) redirect(`/relatorios/vendedor/${sessao.usuario.vendedor.id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <Vazio>Seu usuário não está cadastrado como vendedor. Peça ao administrador para marcar “Realiza vendas” em Equipe.</Vazio>
    </div>
  );
}
