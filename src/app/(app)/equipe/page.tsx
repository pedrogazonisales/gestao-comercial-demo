import Link from "next/link";
import { Plus } from "lucide-react";
import { CabecalhoPagina, Distintivo, LinkBotao, Tabela } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { NOME_PERFIL } from "@/server/permissoes";
import { formatarDataHora } from "@/lib/formato";

export default async function PaginaEquipe() {
  await exigirSessao("usuario.gerenciar");
  const usuarios = await db.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { vendedor: { select: { ativo: true } }, lojaPadrao: { select: { nome: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina
        titulo="Equipe"
        subtitulo="Usuários do sistema e vendedores"
        acoes={
          <LinkBotao href="/equipe/novo">
            <Plus className="size-4" aria-hidden /> Novo usuário
          </LinkBotao>
        }
      />
      <Tabela>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Login</th>
            <th>Perfil</th>
            <th>Vendedor</th>
            <th>Loja principal</th>
            <th>Último acesso</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className={u.ativo ? "" : "text-texto-suave"}>
              <td>
                <Link href={`/equipe/${u.id}`} className="font-medium text-marca hover:underline">
                  {u.nome}
                </Link>
              </td>
              <td className="font-mono text-xs">{u.login}</td>
              <td>
                <Distintivo tom={u.perfil === "ADMIN" ? "marca" : u.perfil === "GERENTE" ? "ouro" : "neutro"}>{NOME_PERFIL[u.perfil]}</Distintivo>
              </td>
              <td>{u.vendedor?.ativo ? "Sim" : "—"}</td>
              <td>{u.lojaPadrao?.nome ?? "—"}</td>
              <td className="whitespace-nowrap">{formatarDataHora(u.ultimoAcesso)}</td>
              <td>{u.ativo ? <Distintivo tom="sucesso">Ativo</Distintivo> : <Distintivo>Inativo</Distintivo>}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </div>
  );
}
