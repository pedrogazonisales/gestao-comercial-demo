import { CabecalhoPagina } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { acaoCriarProduto } from "../actions";
import { FormProduto } from "../form-produto";

export default async function NovoProduto() {
  const sessao = await exigirSessao("produto.editar");
  const [categorias, marcas] = await Promise.all([
    db.categoria.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
    db.marca.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina titulo="Novo produto" subtitulo="Categoria e marca novas são criadas automaticamente." />
      <FormProduto
        acao={acaoCriarProduto}
        categorias={categorias.map((c) => c.nome)}
        marcas={marcas.map((m) => m.nome)}
        lojaAtual={sessao.loja?.nome}
        podeVerCusto
      />
    </div>
  );
}
