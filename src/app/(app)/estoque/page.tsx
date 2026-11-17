import Link from "next/link";
import { History, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { CabecalhoPagina, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";

const LIMITE = 100;

export default async function PaginaEstoque({ searchParams }: { searchParams: Promise<{ q?: string; baixo?: string }> }) {
  const sessao = await exigirSessao();
  const { q = "", baixo } = await searchParams;
  const termo = q.trim();
  const movimentar = pode(sessao.usuario.perfil, "estoque.ajustar");

  // Prisma não compara duas colunas: busca no SQL quais variações estão no mínimo ou abaixo em alguma loja.
  const idsBaixos = baixo
    ? (
        await db.$queryRaw<{ variacaoId: string }[]>`
          SELECT DISTINCT "variacaoId" FROM "EstoqueSaldo"
          WHERE "estoqueMinimo" > 0 AND quantidade <= "estoqueMinimo"`
      ).map((r) => r.variacaoId)
    : null;

  const where: Prisma.ProdutoVariacaoWhereInput = {
    ativo: true,
    produto: { ativo: true },
    ...(idsBaixos && { id: { in: idsBaixos } }),
    ...(termo && {
      OR: [
        { sku: { contains: termo, mode: "insensitive" } },
        { codigoBarras: termo },
        { descricao: { contains: termo, mode: "insensitive" } },
        { produto: { nome: { contains: termo, mode: "insensitive" } } },
        { produto: { codigo: { contains: termo, mode: "insensitive" } } },
        { produto: { marca: { nome: { contains: termo, mode: "insensitive" } } } },
      ],
    }),
  };

  const [variacoes, total, lojas] = await Promise.all([
    db.produtoVariacao.findMany({
      where,
      orderBy: [{ produto: { nome: "asc" } }, { sku: "asc" }],
      take: LIMITE,
      include: { produto: { select: { id: true, nome: true, marca: { select: { nome: true } } } }, estoques: true },
    }),
    db.produtoVariacao.count({ where }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Estoque"
        subtitulo="Saldo de cada produto em todas as lojas"
        acoes={
          movimentar && (
            <LinkBotao href="/estoque/movimentacoes" variante="secundario">
              <History className="size-4" aria-hidden /> Movimentações
            </LinkBotao>
          )
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={termo}
            placeholder="Produto, marca, SKU ou código de barras"
            className="h-10 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 text-sm focus:border-marca focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 px-1 text-sm text-texto-suave">
          <input type="checkbox" name="baixo" defaultChecked={Boolean(baixo)} className="accent-marca" /> Só estoque baixo
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Filtrar</button>
      </form>

      {variacoes.length === 0 ? (
        <Vazio>{baixo ? "Nenhum produto com estoque baixo." : "Nenhum produto encontrado."}</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Produto</th>
              {lojas.map((l) => (
                <th key={l.id} className={`text-right ${l.id === sessao.loja?.id ? "text-marca" : ""}`}>
                  {l.nome}
                </th>
              ))}
              <th className="text-right">Total</th>
              {movimentar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {variacoes.map((v) => (
              <tr key={v.id} className="hover:bg-fundo/60">
                <td>
                  <Link href={`/produtos/${v.produto.id}`} className="font-medium text-marca hover:underline">
                    {v.produto.nome}
                  </Link>
                  <p className="text-xs text-texto-suave">
                    {v.descricao !== "Padrão" && `${v.descricao} · `}
                    <span className="font-mono">{v.sku}</span>
                    {v.produto.marca && ` · ${v.produto.marca.nome}`}
                  </p>
                </td>
                {lojas.map((l) => {
                  const s = v.estoques.find((e) => e.lojaId === l.id);
                  const qtd = s?.quantidade ?? 0;
                  const abaixo = s && s.estoqueMinimo > 0 && qtd <= s.estoqueMinimo;
                  return (
                    <td key={l.id} className={`text-right ${l.id === sessao.loja?.id ? "bg-marca-claro/40" : ""}`}>
                      {abaixo ? <Distintivo tom={qtd === 0 ? "erro" : "alerta"}>{qtd}</Distintivo> : <span className={qtd === 0 ? "text-texto-suave" : ""}>{qtd}</span>}
                    </td>
                  );
                })}
                <td className="text-right font-semibold">{v.estoques.reduce((s, e) => s + e.quantidade, 0)}</td>
                {movimentar && (
                  <td className="text-right">
                    <Link href={`/estoque/movimentar?variacao=${v.id}`} className="text-xs font-medium text-marca hover:underline">
                      Movimentar
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      {total > LIMITE && <p className="mt-3 text-sm text-texto-suave">Mostrando {LIMITE} de {total}. Refine a busca.</p>}
    </div>
  );
}
