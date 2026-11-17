import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina, Cartao, Distintivo, Tabela, Vazio } from "@/components/ui";
import { GraficoDiario } from "@/components/graficos";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { indicadoresDashboard } from "@/server/services/dashboard";
import { indicadoresPosVenda } from "@/server/services/indicadores-posvenda";
import { periodoPadrao } from "@/server/services/relatorios";
import { formatarDataHora, formatarMoeda } from "@/lib/formato";
import { codigoVenda } from "@/lib/venda";

const dataValida = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function DesempenhoVendedor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const gestor = pode(sessao.usuario.perfil, "relatorio.ver");
  // Vendedor só vê a própria página.
  if (!gestor && sessao.usuario.vendedor?.id !== id) redirect("/?sem-permissao=1");

  const vendedor = await db.vendedor.findUnique({ where: { id } });
  if (!vendedor) notFound();

  const sp = await searchParams;
  const padrao = periodoPadrao();
  const de = dataValida(sp.de) ?? padrao.de;
  const ate = dataValida(sp.ate) ?? padrao.ate;
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(`${ate}T23:59:59.999-03:00`);

  const [ind, pv, ranking, clientesAtendidos, ultimas] = await Promise.all([
    indicadoresDashboard({ de, ate, vendedorId: id }, sessao),
    indicadoresPosVenda({ de: inicio, ate: fim, vendedorId: id }),
    db.venda.groupBy({ by: ["vendedorId"], where: { status: "CONFIRMADA", dataHora: { gte: inicio, lte: fim } }, _sum: { valorLiquido: true } }),
    db.venda.findMany({ where: { vendedorId: id, status: "CONFIRMADA", dataHora: { gte: inicio, lte: fim } }, distinct: ["clienteId"], select: { clienteId: true } }),
    db.venda.findMany({
      where: { vendedorId: id, dataHora: { gte: inicio, lte: fim } },
      orderBy: { dataHora: "desc" },
      take: 10,
      include: { cliente: { select: { nome: true, nomeSocial: true } }, loja: { select: { nome: true } } },
    }),
  ]);
  const ordenado = ranking.sort((a, b) => Number(b._sum.valorLiquido ?? 0) - Number(a._sum.valorLiquido ?? 0));
  const posicao = ordenado.findIndex((r) => r.vendedorId === id) + 1;
  const meu = pv.porVendedor[0];
  const pctDesconto = ind.periodo.bruto ? (ind.periodo.descontos / ind.periodo.bruto) * 100 : 0;
  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CabecalhoPagina
        titulo={vendedor.nome}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            Desempenho individual
            {!vendedor.ativo && <Distintivo>Inativo</Distintivo>}
            {posicao > 0 && <Distintivo tom="ouro">{posicao}º em faturamento entre {ordenado.length}</Distintivo>}
          </span>
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-texto-suave">
          De
          <input type="date" name="de" defaultValue={de} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <label className="text-xs text-texto-suave">
          Até
          <input type="date" name="ate" defaultValue={ate} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Aplicar</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Bloco rotulo="Faturamento" valor={formatarMoeda(ind.periodo.faturamento)} />
        <Bloco rotulo="Vendas" valor={String(ind.periodo.vendas)} />
        <Bloco rotulo="Ticket médio" valor={formatarMoeda(ind.periodo.ticketMedio)} />
        <Bloco rotulo="Descontos concedidos" valor={formatarMoeda(ind.periodo.descontos)} rodape={`${pctDesconto.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do valor bruto`} />
        <Bloco rotulo="Clientes atendidos" valor={String(clientesAtendidos.length)} />
        <Bloco rotulo="Pós-vendas concluídos" valor={String(meu?.concluidos ?? 0)} rodape={`de ${meu?.gerados ?? 0} gerados no período`} />
        <Bloco rotulo="Pós-vendas pendentes" valor={String(meu?.pendentes ?? 0)} rodape={`${meu?.atrasados ?? 0} atrasado(s)`} alerta={(meu?.atrasados ?? 0) > 0} />
        <Bloco rotulo="Contato no prazo" valor={meu?.taxaNoPrazo === null || meu?.taxaNoPrazo === undefined ? "—" : `${meu.taxaNoPrazo}%`} rodape="pós-venda feito até o prazo" />
      </div>

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Vendas por dia</h2>
        {ind.periodo.vendas === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : <GraficoDiario dados={ind.serieDiaria} />}
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-serif text-xl font-semibold">Produtos mais vendidos</h2>
          {ind.maisVendidos.length === 0 ? (
            <Vazio>Nenhuma venda no período.</Vazio>
          ) : (
            <ol className="divide-y divide-borda text-sm">
              {ind.maisVendidos.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="w-5 text-right text-xs text-texto-suave tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  <span className="text-texto-suave tabular-nums">{p.quantidade} un.</span>
                  <span className="w-28 text-right font-medium tabular-nums">{formatarMoeda(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </Cartao>
        <section>
          <h2 className="mb-3 font-serif text-xl font-semibold">Últimas vendas</h2>
          {ultimas.length === 0 ? (
            <Vazio>Nenhuma venda no período.</Vazio>
          ) : (
            <Tabela>
              <tbody>
                {ultimas.map((v) => (
                  <tr key={v.id} className={v.status === "CANCELADA" ? "text-texto-suave line-through" : ""}>
                    <td className="font-mono text-xs">
                      <Link href={`/vendas/${v.id}`} className="text-marca hover:underline">
                        {codigoVenda(v.numero)}
                      </Link>
                    </td>
                    <td className="text-xs whitespace-nowrap">{formatarDataHora(v.dataHora)}</td>
                    <td className="text-xs">{v.cliente.nomeSocial || v.cliente.nome}</td>
                    <td className="text-right text-xs whitespace-nowrap">{formatarMoeda(v.valorLiquido)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </section>
      </div>
    </div>
  );
}

function Bloco({ rotulo, valor, rodape, alerta }: { rotulo: string; valor: string; rodape?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border bg-superficie p-4 shadow-sm ${alerta ? "border-erro/30" : "border-borda"}`}>
      <p className="text-xs font-medium text-texto-suave">{rotulo}</p>
      <p className={`mt-1 text-lg font-semibold break-words sm:text-xl ${alerta ? "text-erro" : ""}`}>{valor}</p>
      {rodape && <p className="mt-0.5 text-xs text-texto-suave">{rodape}</p>}
    </div>
  );
}
