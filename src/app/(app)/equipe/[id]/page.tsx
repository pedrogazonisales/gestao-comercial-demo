import { notFound } from "next/navigation";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { acaoAtualizarUsuario, acaoRedefinirSenha } from "../actions";
import { FormRedefinirSenha, FormUsuario } from "../form-usuario";

export default async function EditarUsuario({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao("usuario.gerenciar");
  const { id } = await params;
  const [usuario, lojas] = await Promise.all([
    db.usuario.findUnique({ where: { id }, include: { vendedor: true } }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!usuario) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CabecalhoPagina titulo="Editar usuário" subtitulo={usuario.nome} />
      <FormUsuario
        acao={acaoAtualizarUsuario.bind(null, usuario.id)}
        lojas={lojas}
        inicial={{
          nome: usuario.nome,
          login: usuario.login,
          email: usuario.email,
          perfil: usuario.perfil,
          lojaPadraoId: usuario.lojaPadraoId,
          ativo: usuario.ativo,
          realizaVendas: usuario.vendedor?.ativo ?? false,
          cpf: usuario.vendedor?.cpf ?? null,
          telefone: usuario.vendedor?.telefone ?? null,
          dataAdmissao: usuario.vendedor?.dataAdmissao.toISOString().slice(0, 10) ?? null,
        }}
      />
      <Cartao>
        <h2 className="mb-3 font-serif text-xl font-semibold">Senha</h2>
        <FormRedefinirSenha acao={acaoRedefinirSenha.bind(null, usuario.id)} />
      </Cartao>
    </div>
  );
}
