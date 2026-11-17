import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, PackageX } from "lucide-react";
import type { ReactNode } from "react";
import { Aviso, Cartao, LinkBotao } from "@/components/ui";
import { GraficoDiario, GraficoRanking } from "@/components/graficos";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { indicadoresDashboard } from "@/server/services/dashboard";
import { formatarMoeda } from "@/lib/formato";
import { hojeSP } from "@/lib/venda";

const somarDias = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

function periodoPreset(chave: string, hoje: string): { de: string; ate: string } | null {
  switch (chave) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7d":
      return { de: somarDias(hoje, -6), ate: hoje };
    case "30d":
      return { de: somarDias(hoje, -29), ate: hoje };
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case "mes-anterior": {
      const primeiro = new Date(`${hoje.slice(0, 7)}-01T00:00:00Z`);
      const fim = new Date(primeiro.getTime() - 86_400_000);
      return { de: `${fim.toISOString().slice(0, 7)}-01`, ate: fim.toISOString().slice(0, 10) };
    }
    default:
      return null;
  }
}

const PRESETS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "mes", rotulo: "Este mês" },
  { chave: "mes-anterior", rotulo: "Mês passado" },
];

const dataValida = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; loja?: string; vendedor?: string; "sem-permissao"?: string }>;
}) {
  const sessao = await exigirSessao();
  const sp = await searchParams;
  const hoje = hojeSP();
  const gestor = pode(sessao.usuario.perfil, "relatorio.ver");

  const personalizado = dataValida(sp.de) && dataValida(sp.ate) && sp.de! <= sp.ate! ? { de: sp.de!, ate: sp.ate! } : null;
  const presetAtivo = personalizado ? null : (sp.periodo ?? "mes");
  const periodo = personalizado ?? periodoPreset(presetAtivo!, hoje) ?? periodoPreset("mes", hoje)!;
  // Vendedor vê sempre os próprios números; gestor escolhe loja e vendedor.
  const vendedorId = gestor ? sp.vendedor || undefined : (sessao.usuario.vendedor?.id ?? "__nenhum__");
  const lojaId = gestor ? sp.loja || undefined : undefined;

  const [ind, lojas, vendedores] = await Promise.all([
    indicadoresDashboard({ ...periodo, lojaId, vendedorId }, sessao),
    gestor ? db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }) : [],
    gestor ? db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [],
  ]);

  const primeiroNome = sessao.usuario.nome.replace(/^\[TESTE\]\s*/, "").split(" ")[0];
  const variacao = ind.anterior.faturamento > 0 ? ((ind.periodo.faturamento - ind.anterior.faturamento) / ind.anterior.faturamento) * 100 : null;
  const link = (mudanca: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const atual = { periodo: presetAtivo ?? undefined, de: personalizado?.de, ate: personalizado?.ate, loja: sp.loja, vendedor: sp.vendedor, ...mudanca };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    return `/?${p}`;
  };
  const rotuloPeriodo = periodo.de === periodo.ate ? new Date(`${periodo.de}T12:00:00Z`).toLocaleDateString("pt-BR") : `${new Date(`${periodo.de}T12:00:00Z`).toLocaleDateString("pt-BR")} a ${new Date(`${periodo.ate}T12:00:00Z`).toLocaleDateString("pt-BR")}`;
  const estiloFiltro = "h-9 rounded-lg border border-borda bg-superficie px-2 text-sm";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {sp["sem-permissao"] && <Aviso tipo="alerta">Seu perfil não tem acesso à página solicitada.</Aviso>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-texto-suave">{sessao.loja?.nome ?? "Nenhuma loja selecionada"}</p>
          <h1 className="font-serif text-3xl font-semibold">Olá, {primeiroNome}</h1>
          <div className="mt-3 h-px w-16 bg-ouro" />
        </div>
        <LinkBotao href="/vendas/nova">Nova venda</LinkBotao>
      </div>

      {/* Filtros: uma linha acima de tudo */}
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Período" className="flex flex-wrap gap-1 rounded-lg border border-borda bg-superficie p-1">
          {PRESETS.map((p) => (
            <Link
              key={p.chave}
              href={link({ periodo: p.chave, de: undefined, ate: undefined })}
              aria-current={presetAtivo === p.chave ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${presetAtivo === p.chave ? "bg-marca text-white" : "text-texto-suave hover:bg-marca-claro hover:text-marca"}`}
            >
              {p.rotulo}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="de">
            De
          </label>
          <input id="de" type="date" name="de" defaultValue={periodo.de} max={hoje} className={estiloFiltro} />
          <span className="text-xs text-texto-suave">a</span>
          <label className="sr-only" htmlFor="ate">
            Até
          </label>
          <input id="ate" type="date" name="ate" defaultValue={periodo.ate} max={hoje} className={estiloFiltro} />
          {gestor && (
            <>
              <label className="sr-only" htmlFor="loja">
                Loja
              </label>
              <select id="loja" name="loja" defaultValue={sp.loja ?? ""} className={estiloFiltro}>
                <option value="">Todas as lojas</option>
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="vendedor">
                Vendedor
              </label>
              <select id="vendedor" name="vendedor" defaultValue={sp.vendedor ?? ""} className={estiloFiltro}>
                <option value="">Todos os vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="h-9 rounded-lg border border-borda bg-superficie px-3 text-sm font-medium hover:border-marca hover:text-marca">Aplicar</button>
        </form>
      </div>

      {/* Número principal + indicadores do período */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_2fr]">
        <Cartao className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-texto-suave">{gestor ? "Faturamento" : "Suas vendas"} · {rotuloPeriodo}</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight break-words sm:text-5xl">{formatarMoeda(ind.periodo.faturamento)}</p>
          </div>
          <p className="mt-4 flex items-center gap-1 text-sm">
            {variacao === null ? (
              <span className="text-texto-suave">Sem vendas no período anterior para comparar</span>
            ) : (
              <>
                {variacao >= 0 ? <ArrowUpRight className="size-4 text-sucesso" aria-hidden /> : <ArrowDownRight className="size-4 text-erro" aria-hidden />}
                <span className={variacao >= 0 ? "text-sucesso" : "text-erro"}>
                  {variacao >= 0 ? "+" : ""}
                  {variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
                <span className="text-texto-suave">vs. período anterior de mesma duração ({formatarMoeda(ind.anterior.faturamento)})</span>
              </>
            )}
          </p>
        </Cartao>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Bloco rotulo="Hoje" valor={formatarMoeda(ind.doDia.faturamento)} rodape={`${ind.doDia.vendas} venda${ind.doDia.vendas === 1 ? "" : "s"}`} />
          <Bloco rotulo="Mês atual" valor={formatarMoeda(ind.doMes.faturamento)} rodape={`${ind.doMes.vendas} venda${ind.doMes.vendas === 1 ? "" : "s"}`} />
          <Bloco rotulo="Vendas no período" valor={String(ind.periodo.vendas)} />
          <Bloco rotulo="Ticket médio" valor={formatarMoeda(ind.periodo.ticketMedio)} />
          <Bloco
            rotulo="Descontos concedidos"
            valor={formatarMoeda(ind.periodo.descontos)}
            rodape={ind.periodo.bruto ? `${((ind.periodo.descontos / ind.periodo.bruto) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do bruto` : undefined}
          />
          <Bloco rotulo="Clientes cadastrados" valor={String(ind.clientes.total)} rodape={`${ind.clientes.novos} novo${ind.clientes.novos === 1 ? "" : "s"} no período`} href="/clientes" />
        </div>
      </div>

      {/* Alertas operacionais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bloco rotulo="Pós-vendas pendentes" valor={String(ind.posVenda.pendentes)} href="/pos-venda?situacao=pendentes" />
        <Bloco rotulo="Pós-vendas atrasados" valor={String(ind.posVenda.atrasados)} href="/pos-venda?situacao=atrasados" alerta={ind.posVenda.atrasados > 0} />
        {gestor ? (
          <>
            <Bloco
              rotulo="Clientes inadimplentes"
              valor={String(ind.recebiveis.inadimplentes)}
              rodape={`${formatarMoeda(ind.recebiveis.vencido)} vencido`}
              href="/inadimplencia"
              alerta={ind.recebiveis.inadimplentes > 0}
            />
            <Bloco rotulo="Total em aberto (crediário/carnê)" valor={formatarMoeda(ind.recebiveis.emAberto)} href="/recebimentos" />
          </>
        ) : (
          <Bloco rotulo="Produtos com estoque baixo" valor={String(ind.estoqueBaixo.total)} href="/estoque?baixo=on" alerta={ind.estoqueBaixo.total > 0} />
        )}
      </div>

      <Cartao>
        <h2 className="font-serif text-xl font-semibold">{gestor ? "Faturamento por dia" : "Suas vendas por dia"}</h2>
        <p className="mb-4 text-xs text-texto-suave">{rotuloPeriodo} · passe o mouse sobre as colunas para ver o valor</p>
        {ind.periodo.vendas === 0 ? <SemDados /> : <GraficoDiario dados={ind.serieDiaria} />}
        <TabelaDados
          cabecalho={["Dia", "Vendas", "Faturamento"]}
          linhas={ind.serieDiaria.filter((d) => d.vendas > 0).map((d) => [new Date(`${d.dia}T12:00:00Z`).toLocaleDateString("pt-BR"), String(d.vendas), formatarMoeda(d.total)])}
        />
      </Cartao>

      {gestor && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Cartao>
            <h2 className="mb-4 font-serif text-xl font-semibold">Vendas por vendedor</h2>
            {ind.porVendedor.length === 0 ? (
              <SemDados />
            ) : (
              <GraficoRanking dados={ind.porVendedor.map((v) => ({ nome: v.nome, total: v.total, detalhe: `${v.vendas} vendas · ticket ${formatarMoeda(v.ticket)}` }))} />
            )}
            <TabelaDados
              cabecalho={["Vendedor", "Vendas", "Faturamento", "Ticket médio", "Descontos"]}
              linhas={ind.porVendedor.map((v) => [v.nome, String(v.vendas), formatarMoeda(v.total), formatarMoeda(v.ticket), formatarMoeda(v.descontos)])}
            />
          </Cartao>
          <Cartao>
            <h2 className="mb-4 font-serif text-xl font-semibold">Faturamento por loja</h2>
            {ind.periodo.vendas === 0 ? <SemDados /> : <GraficoRanking dados={ind.porLoja.map((l) => ({ nome: l.nome, total: l.total, detalhe: `${l.vendas} vendas` }))} />}
            <TabelaDados cabecalho={["Loja", "Vendas", "Faturamento"]} linhas={ind.porLoja.map((l) => [l.nome, String(l.vendas), formatarMoeda(l.total)])} />
          </Cartao>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-serif text-xl font-semibold">Produtos mais vendidos</h2>
          {ind.maisVendidos.length === 0 ? (
            <SemDados />
          ) : (
            <ol className="divide-y divide-borda text-sm">
              {ind.maisVendidos.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="w-5 text-right text-xs text-texto-suave tabular-nums">{i + 1}</span>
                  <Link href={`/produtos/${p.id}`} className="min-w-0 flex-1 truncate hover:text-marca">
                    {p.nome}
                  </Link>
                  <span className="text-texto-suave tabular-nums">{p.quantidade} un.</span>
                  <span className="w-28 text-right font-medium tabular-nums">{formatarMoeda(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </Cartao>
        <Cartao>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold">Estoque baixo</h2>
            {ind.estoqueBaixo.total > 0 && (
              <Link href="/estoque?baixo=on" className="text-xs font-medium text-marca hover:underline">
                Ver todos ({ind.estoqueBaixo.total})
              </Link>
            )}
          </div>
          {ind.estoqueBaixo.total === 0 ? (
            <SemDados texto="Nenhum produto abaixo do estoque mínimo." />
          ) : (
            <ul className="divide-y divide-borda text-sm">
              {ind.estoqueBaixo.itens.map((e) => (
                <li key={`${e.variacaoId}-${e.loja}`} className="flex items-center gap-3 py-2">
                  <PackageX className={`size-4 shrink-0 ${e.quantidade === 0 ? "text-erro" : "text-alerta"}`} aria-hidden />
                  <Link href={`/produtos/${e.produtoId}`} className="min-w-0 flex-1 truncate hover:text-marca">
                    {e.produto}
                    {e.descricao !== "Padrão" && <span className="text-texto-suave"> · {e.descricao}</span>}
                  </Link>
                  <span className="text-xs text-texto-suave">{e.loja}</span>
                  <span className="w-24 text-right text-xs tabular-nums">
                    <strong className={e.quantidade === 0 ? "text-erro" : "text-alerta"}>{e.quantidade === 0 ? "esgotado" : `${e.quantidade} un.`}</strong> / mín. {e.minimo}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}

function Bloco({ rotulo, valor, rodape, href, alerta }: { rotulo: string; valor: string; rodape?: string; href?: string; alerta?: boolean }) {
  const conteudo: ReactNode = (
    <>
      <p className="text-xs font-medium text-texto-suave">{rotulo}</p>
      {/* Menor no celular: valores como R$ 120.000,00 precisam caber em meia largura de tela. */}
      <p className={`mt-1 text-lg font-semibold break-words sm:text-2xl ${alerta ? "text-erro" : "text-texto"}`}>{valor}</p>
      {rodape && <p className="mt-0.5 text-xs text-texto-suave">{rodape}</p>}
    </>
  );
  const estilo = `block rounded-xl border bg-superficie p-4 shadow-sm ${alerta ? "border-erro/30" : "border-borda"}`;
  return href ? (
    <Link href={href} className={`${estilo} transition-colors hover:border-marca`}>
      {conteudo}
    </Link>
  ) : (
    <div className={estilo}>{conteudo}</div>
  );
}

function SemDados({ texto = "Nenhuma venda no período." }: { texto?: string }) {
  return <p className="rounded-lg border border-dashed border-borda px-4 py-10 text-center text-sm text-texto-suave">{texto}</p>;
}

/** Visão em tabela de cada gráfico (acessibilidade e conferência). */
function TabelaDados({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  if (!linhas.length) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-marca">Ver dados em tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums [&_td]:py-1 [&_td]:pr-4 [&_th]:py-1 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-texto-suave">
          <thead>
            <tr>
              {cabecalho.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-borda/60">
                {l.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
