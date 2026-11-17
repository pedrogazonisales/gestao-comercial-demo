import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { acaoAtualizarCliente } from "../../actions";
import { FormCliente } from "../../form-cliente";

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao("cliente.editar");
  const { id } = await params;
  const [cliente, vendedores] = await Promise.all([
    db.cliente.findUnique({ where: { id } }),
    db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina titulo="Editar cliente" subtitulo={cliente.nome} />
      <FormCliente
        acao={acaoAtualizarCliente.bind(null, cliente.id)}
        inicial={{ ...cliente, dataNascimento: cliente.dataNascimento?.toISOString().slice(0, 10) ?? null }}
        vendedores={vendedores}
        edicao
        cancelar={`/clientes/${cliente.id}`}
      />
    </div>
  );
}
