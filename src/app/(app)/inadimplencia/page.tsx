import Link from "next/link";
import { Download } from "lucide-react";
import { CabecalhoPagina, Cartao, Distintivo, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { listarInadimplentes, type FiltrosInadimplencia } from "@/server/services/cobranca";
import { mascararCpf } from "@/lib/cpf";
import { formatarData, formatarDataSemHora, formatarMoeda, formatarTelefone } from "@/lib/formato";
import { codigoVenda, hojeSP } from "@/lib/venda";
import { FAIXAS, faixaAtraso, hojeComoData, NOME_STATUS_COBRANCA } from "@/lib/cobranca";

export default async function Inadimplencia({ searchParams }: { searchParams: Promise<FiltrosInadimplencia> }) {
  await exigirSessao("cobranca.gerenciar");
  const filtros = await searchParams;
  const [linhas, vendedores, lojas] = await Promise.all([
    listarInadimplentes(filtros),
    db.vendedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  const hoje = hojeComoData(hojeSP());

  const totalAtraso = linhas.reduce((s, l) => s + l.emAtrasoCentavos, 0);
  const totalAberto = linhas.reduce((s, l) => s + l.emAbertoCentavos, 0);
  const clientes = new Set(linhas.map((l) => l.cliente.id)).size;
  const porFaixa = FAIXAS.map((f) => ({
    faixa: f,
    valor: linhas.flatMap((l) => l.parcelasAtrasadas).filter((p) => faixaAtraso(p.dias) === f).reduce((s, p) => s + p.saldoCentavos, 0),
  }));
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]);
  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Inadimplência"
        subtitulo="Somente parcelas de crediário e carnê vencidas e não pagas"
        acoes={
          <a href={`/inadimplencia/exportar?${params}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">
            <Download className="size-4" aria-hidden /> Exportar CSV
          </a>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo rotulo="Valor vencido" valor={formatarMoeda(totalAtraso / 100)} alerta={totalAtraso > 0} />
        <Resumo rotulo="Saldo total dessas vendas" valor={formatarMoeda(totalAberto / 100)} />
        <Resumo rotulo="Clientes inadimplentes" valor={String(clientes)} />
        <Resumo rotulo="Maior atraso" valor={linhas.length ? `${linhas[0].diasAtraso} dias` : "—"} />
      </div>
      {totalAtraso > 0 && (
        <Cartao className="mb-4 p-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-texto-suave uppercase">Valor vencido por tempo de atraso</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-4">
            {porFaixa.map((f) => (
              <div key={f.faixa}>
                <dt className="text-texto-suave">{f.faixa}</dt>
                <dd className="font-medium">{formatarMoeda(f.valor / 100)}</dd>
              </div>
            ))}
          </dl>
        </Cartao>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-texto-suave">
          Cliente ou CPF
          <input name="q" defaultValue={filtros.q} className={`${estiloFiltro} mt-1 block w-52`} />
        </label>
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
          Status da cobrança
          <select name="status" defaultValue={filtros.status ?? ""} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todos</option>
            {Object.entries(NOME_STATUS_COBRANCA)
              .filter(([v]) => v !== "REGULARIZADO")
              .map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs text-texto-suave">
          Vencimento de
          <input type="date" name="de" defaultValue={filtros.de} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <label className="text-xs text-texto-suave">
          até
          <input type="date" name="ate" defaultValue={filtros.ate} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Filtrar</button>
      </form>

      {linhas.length === 0 ? (
        <Vazio>Nenhuma parcela vencida em aberto.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Atraso</th>
              <th>Cliente</th>
              <th>Venda</th>
              <th>Parcelas vencidas</th>
              <th className="text-right">Vencido</th>
              <th className="text-right">Em aberto</th>
              <th>Cobrança</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const promessaVencida = l.cobranca?.promessa?.data && l.cobranca.status === "PROMESSA_PAGAMENTO" && l.cobranca.promessa.data.getTime() < hoje.getTime();
              return (
                <tr key={l.vendaId}>
                  <td>
                    <Distintivo tom={l.diasAtraso > 60 ? "erro" : l.diasAtraso > 30 ? "alerta" : "ouro"}>{l.diasAtraso} dias</Distintivo>
                  </td>
                  <td>
                    <p className="font-medium">{l.cliente.nome}</p>
                    <p className="text-xs text-texto-suave">
                      <span className="font-mono">{mascararCpf(l.cliente.cpf)}</span> · {formatarTelefone(l.cliente.celular)}
                    </p>
                  </td>
                  <td className="text-xs">
                    <span className="font-mono">{codigoVenda(l.numero)}</span> · {formatarData(l.dataVenda)}
                    <p className="text-texto-suave">
                      {formatarMoeda(l.valorVenda)} · {l.vendedor} · {l.loja}
                    </p>
                  </td>
                  <td className="text-xs">
                    {l.parcelasAtrasadas.map((p) => (
                      <p key={p.numero} className="whitespace-nowrap">
                        {p.numero}ª · {formatarDataSemHora(p.vencimento)} · {formatarMoeda(p.saldoCentavos / 100)}
                      </p>
                    ))}
                  </td>
                  <td className="text-right font-semibold whitespace-nowrap text-erro">{formatarMoeda(l.emAtrasoCentavos / 100)}</td>
                  <td className="text-right whitespace-nowrap">{formatarMoeda(l.emAbertoCentavos / 100)}</td>
                  <td className="text-xs">
                    {l.cobranca ? NOME_STATUS_COBRANCA[l.cobranca.status as keyof typeof NOME_STATUS_COBRANCA] : <span className="text-erro">Sem cobrança</span>}
                    {promessaVencida && (
                      <p>
                        <Distintivo tom="erro">promessa vencida</Distintivo>
                      </p>
                    )}
                    <p className="text-texto-suave">
                      {l.cobranca?.ultimoContato ? `Último contato ${formatarData(l.cobranca.ultimoContato)}` : "Nenhum contato"}
                      {l.cobranca?.responsavel && ` · ${l.cobranca.responsavel}`}
                    </p>
                  </td>
                  <td className="text-right">
                    <Link href={`/recebimentos/${l.vendaId}`} className="text-sm font-medium text-marca hover:underline">
                      Cobrar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium tracking-wide text-texto-suave uppercase">{rotulo}</p>
      <p className={`mt-1 font-serif text-2xl font-semibold ${alerta ? "text-erro" : ""}`}>{valor}</p>
    </Cartao>
  );
}
