import Link from "next/link";
import type { Prisma, TipoMovimentacao } from "@prisma/client";
import { CabecalhoPagina, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { NOME_MOVIMENTACAO } from "@/server/services/estoque";
import { formatarDataHora } from "@/lib/formato";
import { codigoVenda } from "@/lib/venda";

const LIMITE = 200;

export default async function Movimentacoes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; loja?: string; tipo?: string; de?: string; ate?: string }>;
}) {
  await exigirSessao("estoque.ajustar");
  const { q = "", loja = "", tipo = "", de = "", ate = "" } = await searchParams;
  const termo = q.trim();

  // Datas do filtro no fuso de Brasília.
  const inicio = de ? new Date(`${de}T00:00:00-03:00`) : undefined;
  const fim = ate ? new Date(`${ate}T23:59:59.999-03:00`) : undefined;

  const where: Prisma.MovimentacaoEstoqueWhereInput = {
    ...(loja && { lojaId: loja }),
    ...(tipo && tipo in NOME_MOVIMENTACAO && { tipo: tipo as TipoMovimentacao }),
    ...((inicio || fim) && { createdAt: { gte: inicio, lte: fim } }),
    ...(termo && {
      variacao: {
        OR: [
          { sku: { contains: termo, mode: "insensitive" } },
          { produto: { nome: { contains: termo, mode: "insensitive" } } },
        ],
      },
    }),
  };

  const [movimentacoes, lojas] = await Promise.all([
    db.movimentacaoEstoque.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: LIMITE,
      include: {
        loja: { select: { nome: true } },
        usuario: { select: { nome: true } },
        variacao: { select: { sku: true, descricao: true, produto: { select: { id: true, nome: true } } } },
        venda: { select: { numero: true } },
      },
    }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);

  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina titulo="Movimentações de estoque" subtitulo="Histórico completo de entradas, saídas, ajustes e transferências" />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-texto-suave">
          Produto ou SKU
          <input name="q" defaultValue={termo} className={`${estiloFiltro} mt-1 block w-56`} />
        </label>
        <label className="text-xs text-texto-suave">
          Loja
          <select name="loja" defaultValue={loja} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-texto-suave">
          Tipo
          <select name="tipo" defaultValue={tipo} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todos</option>
            {Object.entries(NOME_MOVIMENTACAO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-texto-suave">
          De
          <input type="date" name="de" defaultValue={de} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <label className="text-xs text-texto-suave">
          Até
          <input type="date" name="ate" defaultValue={ate} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Filtrar</button>
      </form>

      {movimentacoes.length === 0 ? (
        <Vazio>Nenhuma movimentação encontrada.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Data</th>
              <th>Produto</th>
              <th>Loja</th>
              <th>Tipo</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">Saldo</th>
              <th>Responsável</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{formatarDataHora(m.createdAt)}</td>
                <td>
                  <Link href={`/produtos/${m.variacao.produto.id}`} className="text-marca hover:underline">
                    {m.variacao.produto.nome}
                  </Link>
                  <p className="font-mono text-xs text-texto-suave">{m.variacao.sku}</p>
                </td>
                <td>{m.loja.nome}</td>
                <td>
                  {NOME_MOVIMENTACAO[m.tipo]}
                  {m.venda && <span className="text-xs text-texto-suave"> · {codigoVenda(m.venda.numero)}</span>}
                </td>
                <td className={`text-right font-medium ${m.quantidade < 0 ? "text-erro" : "text-sucesso"}`}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
                <td className="text-right whitespace-nowrap">
                  {m.saldoAnterior} → {m.saldoPosterior}
                </td>
                <td>{m.usuario.nome}</td>
                <td className="text-texto-suave">{m.justificativa ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      {movimentacoes.length === LIMITE && <p className="mt-3 text-sm text-texto-suave">Mostrando as {LIMITE} mais recentes. Use os filtros para refinar.</p>}
    </div>
  );
}
