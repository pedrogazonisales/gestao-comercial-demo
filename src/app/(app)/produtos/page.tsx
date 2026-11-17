import Link from "next/link";
import { ImageOff, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { CabecalhoPagina, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { formatarMoeda } from "@/lib/formato";
import { urlFoto } from "@/lib/produto";

const LIMITE = 60;

export default async function PaginaProdutos({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; inativos?: string }> }) {
  const sessao = await exigirSessao();
  const { q = "", categoria = "", inativos } = await searchParams;
  const termo = q.trim();

  const where: Prisma.ProdutoWhereInput = {
    ...(inativos ? {} : { ativo: true }),
    ...(categoria && { categoriaId: categoria }),
    ...(termo && {
      OR: [
        { nome: { contains: termo, mode: "insensitive" } },
        { codigo: { contains: termo, mode: "insensitive" } },
        { marca: { nome: { contains: termo, mode: "insensitive" } } },
        { variacoes: { some: { OR: [{ sku: { contains: termo, mode: "insensitive" } }, { codigoBarras: termo }] } } },
      ],
    }),
  };

  const [produtos, total, categorias] = await Promise.all([
    db.produto.findMany({
      where,
      orderBy: { nome: "asc" },
      take: LIMITE,
      include: {
        categoria: { select: { nome: true } },
        marca: { select: { nome: true } },
        foto: { select: { updatedAt: true } },
        variacoes: { where: { ativo: true }, include: { estoques: true } },
      },
    }),
    db.produto.count({ where }),
    db.categoria.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina
        titulo="Produtos"
        subtitulo={`${total} produto${total === 1 ? "" : "s"}`}
        acoes={
          pode(sessao.usuario.perfil, "produto.editar") && (
            <LinkBotao href="/produtos/novo">
              <Plus className="size-4" aria-hidden /> Novo produto
            </LinkBotao>
          )
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar produto
          </label>
          <input
            id="q"
            name="q"
            defaultValue={termo}
            placeholder="Nome, código, marca, SKU ou código de barras"
            className="h-10 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 text-sm focus:border-marca focus:outline-none"
          />
        </div>
        <label htmlFor="categoria" className="sr-only">
          Categoria
        </label>
        <select id="categoria" name="categoria" defaultValue={categoria} className="h-10 rounded-lg border border-borda bg-superficie px-3 text-sm">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-1 text-sm text-texto-suave">
          <input type="checkbox" name="inativos" defaultChecked={Boolean(inativos)} className="accent-marca" /> Incluir inativos
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Filtrar</button>
      </form>

      {produtos.length === 0 ? (
        <Vazio>{termo || categoria ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th className="w-14"></th>
              <th>Produto</th>
              <th>Categoria</th>
              <th className="text-right">Preço</th>
              <th className="text-right">{sessao.loja ? `Estoque ${sessao.loja.nome}` : "Estoque loja"}</th>
              <th className="text-right">Todas as lojas</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => {
              const precos = p.variacoes.map((v) => Number(v.precoVenda));
              const saldos = p.variacoes.flatMap((v) => v.estoques);
              const naLoja = saldos.filter((s) => s.lojaId === sessao.loja?.id);
              const qtdLoja = naLoja.reduce((s, e) => s + e.quantidade, 0);
              const baixo = naLoja.some((e) => e.quantidade <= e.estoqueMinimo);
              const foto = urlFoto(p.id, p.foto?.updatedAt);
              return (
                <tr key={p.id} className="hover:bg-fundo/60">
                  <td>
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-fundo text-texto-suave">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {foto ? <img src={foto} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4" aria-hidden />}
                    </div>
                  </td>
                  <td>
                    <Link href={`/produtos/${p.id}`} className="font-medium text-marca hover:underline">
                      {p.nome}
                    </Link>
                    <p className="text-xs text-texto-suave">
                      {p.codigo}
                      {p.marca && ` · ${p.marca.nome}`}
                      {p.variacoes.length > 1 && ` · ${p.variacoes.length} variações`}
                      {!p.ativo && " · inativo"}
                    </p>
                  </td>
                  <td>{p.categoria.nome}</td>
                  <td className="text-right whitespace-nowrap">
                    {precos.length === 0
                      ? "—"
                      : Math.min(...precos) === Math.max(...precos)
                        ? formatarMoeda(precos[0])
                        : `${formatarMoeda(Math.min(...precos))} – ${formatarMoeda(Math.max(...precos))}`}
                  </td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-2">
                      {baixo && <Distintivo tom="alerta">baixo</Distintivo>}
                      {qtdLoja}
                    </span>
                  </td>
                  <td className="text-right">{saldos.reduce((s, e) => s + e.quantidade, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
      {total > LIMITE && <p className="mt-3 text-sm text-texto-suave">Mostrando os {LIMITE} primeiros de {total}. Refine a busca.</p>}
    </div>
  );
}
