import { CabecalhoPagina } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { somenteDigitos } from "@/lib/cpf";
import { acaoCriarCliente } from "../actions";
import { FormCliente } from "../form-cliente";

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ cpf?: string; voltar?: string }> }) {
  await exigirSessao("cliente.editar");
  const { cpf, voltar } = await searchParams;
  const vendedores = await db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina titulo="Novo cliente" subtitulo="Campos com * são obrigatórios. O restante pode ser completado depois." />
      <FormCliente
        acao={acaoCriarCliente}
        inicial={{ cpf: somenteDigitos(cpf ?? "") }}
        vendedores={vendedores}
        voltar={voltar}
        cancelar={voltar ?? "/clientes"}
      />
    </div>
  );
}
