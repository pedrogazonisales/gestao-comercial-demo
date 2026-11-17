import Link from "next/link";
import { Download, Gift, Plus } from "lucide-react";
import { CabecalhoPagina, Cartao, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { filtroVendas, incluirListaVendas, type FiltrosVenda } from "@/server/services/consulta-vendas";
import { mascararCpf } from "@/lib/cpf";
import { formatarDataHora, formatarMoeda } from "@/lib/formato";
import { codigoVenda, FORMAS } from "@/lib/venda";

const LIMITE = 100;

export default async function HistoricoVendas({ searchParams }: { searchParams: Promise<FiltrosVenda> }) {
  const sessao = await exigirSessao();
  const filtros = await searchParams;
  const verTodas = pode(sessao.usuario.perfil, "venda.verTodas");
  const where = filtroVendas(filtros, sessao);
  const confirmadas = { AND: [where, { status: "CONFIRMADA" as const }] };

  const [vendas, total, soma, vendedores, lojas] = await Promise.all([
    db.venda.findMany({ where, orderBy: { dataHora: "desc" }, take: LIMITE, include: incluirListaVendas }),
    db.venda.count({ where }),
    db.venda.aggregate({ where: confirmadas, _sum: { valorLiquido: true, descontoValor: true }, _count: true }),
    verTodas ? db.vendedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [],
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  const faturamento = Number(soma._sum.valorLiquido ?? 0);
  const ticket = soma._count ? faturamento / soma._count : 0;
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]);
  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Vendas"
        subtitulo={verTodas ? "Histórico de todas as lojas" : "Suas vendas"}
        acoes={
          <>
            <a href={`/vendas/exportar?${params}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">
              <Download className="size-4" aria-hidden /> Exportar CSV
            </a>
            <LinkBotao href="/vendas/nova">
              <Plus className="size-4" aria-hidden /> Nova venda
            </LinkBotao>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-texto-suave">
          Código, CPF ou cliente
          <input name="q" defaultValue={filtros.q} className={`${estiloFiltro} mt-1 block w-56`} />
        </label>
        {verTodas && (
          <label className="text-xs text-texto-suave">
            Vendedor
            <select name="vendedor" defaultValue={filtros.vendedor ?? ""} className={`${estiloFiltro} mt-1 block`}>
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs text-texto-suave">
          Loja
          <select name="loja" defaultValue={filtros.loja ?? ""} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-texto-suave">
          Pagamento
          <select name="forma" defaultValue={filtros.forma ?? ""} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todos</option>
            {Object.entries(FORMAS).map(([v, f]) => (
              <option key={v} value={v}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-texto-suave">
          Status
          <select name="status" defaultValue={filtros.status ?? ""} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todos</option>
            <option value="CONFIRMADA">Confirmadas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </label>
        <label className="text-xs text-texto-suave">
          De
          <input type="date" name="de" defaultValue={filtros.de} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <label className="text-xs text-texto-suave">
          Até
          <input type="date" name="ate" defaultValue={filtros.ate} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Filtrar</button>
      </form>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Resumo rotulo="Vendas confirmadas" valor={String(soma._count)} />
        <Resumo rotulo="Faturamento" valor={formatarMoeda(faturamento)} />
        <Resumo rotulo="Ticket médio" valor={formatarMoeda(ticket)} />
        <Resumo rotulo="Descontos concedidos" valor={formatarMoeda(soma._sum.descontoValor)} />
      </div>

      {vendas.length === 0 ? (
        <Vazio>Nenhuma venda encontrada.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Venda</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Produtos</th>
              <th>Vendedor / loja</th>
              <th>Pagamento</th>
              <th className="text-right">Desconto</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => (
              <tr key={v.id} className={v.status === "CANCELADA" ? "text-texto-suave" : "hover:bg-fundo/60"}>
                <td className="whitespace-nowrap">
                  <Link href={`/vendas/${v.id}`} className="font-mono text-xs font-medium text-marca hover:underline">
                    {codigoVenda(v.numero)}
                  </Link>
                  {v.presente && <Gift className="ml-1.5 inline size-3.5 text-ouro-texto" aria-label="Presente" />}
                  {v.status === "CANCELADA" && (
                    <span className="ml-2">
                      <Distintivo tom="erro">cancelada</Distintivo>
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap">{formatarDataHora(v.dataHora)}</td>
                <td>
                  {v.cliente.nomeSocial || v.cliente.nome}
                  <p className="font-mono text-xs text-texto-suave">{mascararCpf(v.cliente.cpf)}</p>
                </td>
                <td className="max-w-56 text-xs">{v.itens.map((i) => `${i.quantidade}× ${i.variacao.produto.nome}`).join(", ")}</td>
                <td className="text-xs">
                  {v.vendedor.nome}
                  <p className="text-texto-suave">{v.loja.nome}</p>
                </td>
                <td className="text-xs">{v.pagamentos.map((p) => `${FORMAS[p.forma].rotulo}${p.numeroParcelas > 1 ? ` ${p.numeroParcelas}×` : ""}`).join(" + ")}</td>
                <td className="text-right whitespace-nowrap">{Number(v.descontoValor) > 0 ? formatarMoeda(v.descontoValor) : "—"}</td>
                <td className={`text-right font-medium whitespace-nowrap ${v.status === "CANCELADA" ? "line-through" : ""}`}>{formatarMoeda(v.valorLiquido)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      {total > LIMITE && <p className="mt-3 text-sm text-texto-suave">Mostrando as {LIMITE} mais recentes de {total}. Use os filtros ou exporte o CSV para ver todas.</p>}
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium tracking-wide text-texto-suave uppercase">{rotulo}</p>
      <p className="mt-1 font-serif text-2xl font-semibold">{valor}</p>
    </Cartao>
  );
}
