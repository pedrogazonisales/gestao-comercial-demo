import { CabecalhoPagina } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { acaoCriarUsuario } from "../actions";
import { FormUsuario } from "../form-usuario";

export default async function NovoUsuario() {
  await exigirSessao("usuario.gerenciar");
  const lojas = await db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina titulo="Novo usuário" />
      <FormUsuario acao={acaoCriarUsuario} lojas={lojas} novo />
    </div>
  );
}
