import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { urlFoto, valorParaCampo } from "@/lib/produto";
import { acaoAtualizarProduto } from "../../actions";
import { FormProduto } from "../../form-produto";

export default async function EditarProduto({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao("produto.editar");
  const { id } = await params;
  const [produto, categorias, marcas] = await Promise.all([
    db.produto.findUnique({
      where: { id },
      include: {
        categoria: true,
        marca: true,
        variacoes: { orderBy: { sku: "asc" } },
        foto: { select: { updatedAt: true } },
      },
    }),
    db.categoria.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
    db.marca.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!produto) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina titulo="Editar produto" subtitulo={produto.nome} />
      <FormProduto
        acao={acaoAtualizarProduto.bind(null, produto.id)}
        categorias={categorias.map((c) => c.nome)}
        marcas={marcas.map((m) => m.nome)}
        podeVerCusto
        inicial={{
          codigo: produto.codigo,
          nome: produto.nome,
          categoria: produto.categoria.nome,
          marca: produto.marca?.nome ?? "",
          descricao: produto.descricao ?? "",
          ativo: produto.ativo,
          fotoUrl: urlFoto(produto.id, produto.foto?.updatedAt),
          variacoes: produto.variacoes.map((v) => ({
            id: v.id,
            chave: v.id,
            descricao: v.descricao,
            cor: v.cor ?? "",
            tamanho: v.tamanho ?? "",
            sku: v.sku,
            codigoBarras: v.codigoBarras ?? "",
            precoCusto: valorParaCampo(v.precoCusto),
            precoVenda: valorParaCampo(v.precoVenda),
            ativo: v.ativo,
            estoqueInicial: "0",
          })),
        }}
      />
    </div>
  );
}
