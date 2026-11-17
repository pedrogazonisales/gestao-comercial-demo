import Link from "next/link";
import { Download } from "lucide-react";
import { CabecalhoPagina, Cartao, Tabela, Vazio } from "@/components/ui";
import { GraficoColunas, GraficoRanking } from "@/components/graficos";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { gerarRelatorio, lerFiltrosRelatorio, TIPOS_RELATORIO } from "@/server/services/relatorios";
import { formatarCelula } from "@/lib/relatorio-formato";
import { AssistenteIA } from "./assistente";

type Busca = { tipo?: string; de?: string; ate?: string; loja?: string; vendedor?: string; agrupar?: string };

export default async function Relatorios({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirSessao("relatorio.ver");
  const sp = await searchParams;
  const { tipo, filtro } = lerFiltrosRelatorio(sp);
  const [rel, lojas, vendedores] = await Promise.all([
    gerarRelatorio(tipo, filtro),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
    db.vendedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const params = (mudanca: Record<string, string>) => {
    const p = new URLSearchParams({ tipo, de: filtro.de, ate: filtro.ate, ...(sp.loja && { loja: sp.loja }), ...(sp.vendedor && { vendedor: sp.vendedor }), ...(sp.agrupar && { agrupar: sp.agrupar }), ...mudanca });
    return p.toString();
  };
  const semPeriodo = tipo === "clientes-inativos" || tipo === "estoque-baixo";
  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Relatórios"
        subtitulo="Indicadores para a gestão, com filtros e exportação"
        acoes={
          <a href={`/relatorios/exportar?${params({})}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">
            <Download className="size-4" aria-hidden /> Exportar CSV
          </a>
        }
      />

      <AssistenteIA />

      <nav aria-label="Relatórios" className="mb-4 flex gap-1 overflow-x-auto border-b border-borda">
        {TIPOS_RELATORIO.map((t) => (
          <Link
            key={t.chave}
            href={`/relatorios?${params({ tipo: t.chave })}`}
            aria-current={tipo === t.chave ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tipo === t.chave ? "border-marca text-marca" : "border-transparent text-texto-suave hover:text-marca"}`}
          >
            {t.rotulo}
          </Link>
        ))}
      </nav>

      <form className="mb-5 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tipo" value={tipo} />
        {!semPeriodo && (
          <>
            <label className="text-xs text-texto-suave">
              De
              <input type="date" name="de" defaultValue={filtro.de} className={`${estiloFiltro} mt-1 block`} />
            </label>
            <label className="text-xs text-texto-suave">
              Até
              <input type="date" name="ate" defaultValue={filtro.ate} className={`${estiloFiltro} mt-1 block`} />
            </label>
          </>
        )}
        <label className="text-xs text-texto-suave">
          Loja
          <select name="loja" defaultValue={sp.loja ?? ""} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        {!semPeriodo && tipo !== "aniversariantes" && (
          <label className="text-xs text-texto-suave">
            Vendedor
            <select name="vendedor" defaultValue={sp.vendedor ?? ""} className={`${estiloFiltro} mt-1 block`}>
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {tipo === "vendas" && (
          <label className="text-xs text-texto-suave">
            Agrupar por
            <select name="agrupar" defaultValue={filtro.agrupar} className={`${estiloFiltro} mt-1 block`}>
              <option value="dia">Dia</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
          </label>
        )}
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Aplicar</button>
      </form>

      <h2 className="font-serif text-2xl font-semibold">{rel.titulo}</h2>
      <p className="mb-4 text-sm text-texto-suave">{rel.descricao}</p>

      {rel.resumo && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {rel.resumo.map((r) => (
            <Cartao key={r.rotulo} className="p-4">
              <p className="text-xs font-medium text-texto-suave">{r.rotulo}</p>
              <p className="mt-1 text-xl font-semibold">{formatarCelula(r.valor, r.tipo)}</p>
            </Cartao>
          ))}
        </div>
      )}

      {rel.grafico && rel.grafico.dados.some((d) => d.total > 0) && (
        <Cartao className="mb-4">{rel.grafico.tipo === "colunas" ? <GraficoColunas dados={rel.grafico.dados} /> : <GraficoRanking dados={rel.grafico.dados} />}</Cartao>
      )}

      {rel.linhas.length === 0 ? (
        <Vazio>Nenhum registro para os filtros escolhidos.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              {rel.colunas.map((c) => (
                <th key={c.chave} className={c.tipo && c.tipo !== "texto" && c.tipo !== "data" ? "text-right" : ""}>
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rel.linhas.map((l, i) => (
              <tr key={i} className="hover:bg-fundo/60">
                {rel.colunas.map((c) => {
                  const texto = formatarCelula(l[c.chave], c.tipo);
                  const numerico = c.tipo && c.tipo !== "texto" && c.tipo !== "data";
                  return (
                    <td key={c.chave} className={numerico ? "text-right whitespace-nowrap tabular-nums" : ""}>
                      {l._href && c.chave === rel.colunaLink ? (
                        <Link href={l._href} className="font-medium text-marca hover:underline">
                          {texto}
                        </Link>
                      ) : (
                        texto
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </div>
  );
}
