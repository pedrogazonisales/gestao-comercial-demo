import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, ImageOff, Pencil } from "lucide-react";
import { CabecalhoPagina, Cartao, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { NOME_MOVIMENTACAO } from "@/server/services/estoque";
import { formatarDataHora, formatarMoeda } from "@/lib/formato";
import { urlFoto } from "@/lib/produto";

export default async function DetalheProduto({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const perfil = sessao.usuario.perfil;
  const verCusto = pode(perfil, "produto.verCusto");
  const movimentar = pode(perfil, "estoque.ajustar");

  const [produto, lojas] = await Promise.all([
    db.produto.findUnique({
      where: { id },
      include: {
        categoria: true,
        marca: true,
        foto: { select: { updatedAt: true } },
        variacoes: { orderBy: [{ ativo: "desc" }, { sku: "asc" }], include: { estoques: true } },
      },
    }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!produto) notFound();

  const movimentacoes = await db.movimentacaoEstoque.findMany({
    where: { variacao: { produtoId: id } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { loja: { select: { nome: true } }, usuario: { select: { nome: true } }, variacao: { select: { sku: true } } },
  });
  const foto = urlFoto(produto.id, produto.foto?.updatedAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CabecalhoPagina
        titulo={produto.nome}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            {produto.codigo} · {produto.categoria.nome}
            {produto.marca && ` · ${produto.marca.nome}`}
            {!produto.ativo && <Distintivo>Inativo</Distintivo>}
          </span>
        }
        acoes={
          pode(perfil, "produto.editar") && (
            <LinkBotao href={`/produtos/${produto.id}/editar`} variante="secundario">
              <Pencil className="size-4" aria-hidden /> Editar
            </LinkBotao>
          )
        }
      />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-borda bg-superficie text-texto-suave">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {foto ? <img src={foto} alt={produto.nome} className="size-full object-cover" /> : <ImageOff className="size-8" aria-hidden />}
        </div>
        <Cartao>
          <h2 className="mb-2 font-serif text-xl font-semibold">Descrição</h2>
          <p className="text-sm whitespace-pre-line text-texto-suave">{produto.descricao || "Sem descrição."}</p>
        </Cartao>
      </div>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Variações e estoque por loja</h2>
        <Tabela>
          <thead>
            <tr>
              <th>Variação</th>
              {verCusto && <th className="text-right">Custo</th>}
              <th className="text-right">Venda</th>
              {lojas.map((l) => (
                <th key={l.id} className="text-right">
                  {l.nome}
                </th>
              ))}
              <th className="text-right">Total</th>
              {movimentar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {produto.variacoes.map((v) => (
              <tr key={v.id} className={v.ativo ? "" : "text-texto-suave"}>
                <td>
                  <p className="font-medium">{v.descricao}</p>
                  <p className="font-mono text-xs text-texto-suave">
                    {v.sku}
                    {v.codigoBarras && ` · ${v.codigoBarras}`}
                    {!v.ativo && " · inativa"}
                  </p>
                </td>
                {verCusto && <td className="text-right whitespace-nowrap">{formatarMoeda(v.precoCusto)}</td>}
                <td className="text-right whitespace-nowrap">{formatarMoeda(v.precoVenda)}</td>
                {lojas.map((l) => {
                  const s = v.estoques.find((e) => e.lojaId === l.id);
                  const baixo = s && s.quantidade <= s.estoqueMinimo;
                  return (
                    <td key={l.id} className={`text-right ${l.id === sessao.loja?.id ? "bg-marca-claro/40 font-semibold" : ""}`}>
                      <span className={baixo ? "text-alerta" : ""} title={s ? `Mínimo: ${s.estoqueMinimo}` : undefined}>
                        {s?.quantidade ?? 0}
                      </span>
                    </td>
                  );
                })}
                <td className="text-right font-semibold">{v.estoques.reduce((s, e) => s + e.quantidade, 0)}</td>
                {movimentar && (
                  <td className="text-right">
                    <Link href={`/estoque/movimentar?variacao=${v.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-marca hover:underline">
                      <ArrowLeftRight className="size-3.5" aria-hidden /> Movimentar
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabela>
        <p className="mt-2 text-xs text-texto-suave">Números em laranja estão no estoque mínimo ou abaixo. A coluna destacada é a sua loja atual.</p>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Últimas movimentações</h2>
        {movimentacoes.length === 0 ? (
          <Vazio>Nenhuma movimentação registrada.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>SKU</th>
                <th>Loja</th>
                <th className="text-right">Qtd.</th>
                <th className="text-right">Saldo</th>
                <th>Responsável</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{formatarDataHora(m.createdAt)}</td>
                  <td>{NOME_MOVIMENTACAO[m.tipo]}</td>
                  <td className="font-mono text-xs">{m.variacao.sku}</td>
                  <td>{m.loja.nome}</td>
                  <td className={`text-right font-medium ${m.quantidade < 0 ? "text-erro" : "text-sucesso"}`}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
                  <td className="text-right">
                    {m.saldoAnterior} → {m.saldoPosterior}
                  </td>
                  <td>{m.usuario.nome}</td>
                  <td className="text-texto-suave">{m.justificativa ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>
    </div>
  );
}
