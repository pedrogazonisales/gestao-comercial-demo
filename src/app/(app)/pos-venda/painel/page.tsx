import Link from "next/link";
import { CabecalhoPagina, Cartao, Distintivo, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { indicadoresPosVenda } from "@/server/services/indicadores-posvenda";
import { hojeSP } from "@/lib/venda";

function formatarTempo(horas: number | null) {
  if (horas === null) return "—";
  if (horas < 24) return `${Math.max(1, Math.round(horas))} h`;
  return `${(horas / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

export default async function PainelPosVenda({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; loja?: string }> }) {
  await exigirSessao("relatorio.ver");
  const hoje = hojeSP();
  const padraoDe = new Date(Date.parse(`${hoje}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  const { de = padraoDe, ate = hoje, loja = "" } = await searchParams;

  const [{ porVendedor, total }, lojas] = await Promise.all([
    indicadoresPosVenda({ de: new Date(`${de}T00:00:00-03:00`), ate: new Date(`${ate}T23:59:59.999-03:00`), lojaId: loja || undefined }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";
  const tomTaxa = (t: number | null) => (t === null ? "neutro" : t >= 90 ? "sucesso" : t >= 70 ? "ouro" : "erro");

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Painel do pós-venda" subtitulo="Execução dos acompanhamentos por vendedor, para vendas do período" />

      <form className="mb-6 flex flex-wrap items-end gap-2">
        <label className="text-xs text-texto-suave">
          Vendas de
          <input type="date" name="de" defaultValue={de} className={`${estiloFiltro} mt-1 block`} />
        </label>
        <label className="text-xs text-texto-suave">
          Até
          <input type="date" name="ate" defaultValue={ate} className={`${estiloFiltro} mt-1 block`} />
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
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Aplicar</button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador rotulo="Gerados" valor={String(total.gerados)} />
        <Indicador rotulo="Concluídos" valor={String(total.concluidos)} />
        <Indicador rotulo="Pendentes" valor={String(total.pendentes)} />
        <Indicador rotulo="Atrasados" valor={String(total.atrasados)} alerta={total.atrasados > 0} />
        <Indicador rotulo="Contato no prazo" valor={total.taxaNoPrazo === null ? "—" : `${total.taxaNoPrazo}%`} />
      </div>

      {porVendedor.length === 0 ? (
        <Vazio>Nenhuma venda no período.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th className="text-right">Gerados</th>
              <th className="text-right">Concluídos</th>
              <th className="text-right">Pendentes</th>
              <th className="text-right">Atrasados</th>
              <th className="text-right">Sem nenhum contato</th>
              <th className="text-right">Contato no prazo</th>
              <th className="text-right">Tempo até 1º contato</th>
            </tr>
          </thead>
          <tbody>
            {porVendedor.map((v) => (
              <tr key={v.vendedorId}>
                <td>
                  <Link href={`/pos-venda?situacao=pendentes&vendedor=${v.vendedorId}`} className="font-medium text-marca hover:underline">
                    {v.vendedor}
                  </Link>
                </td>
                <td className="text-right">{v.gerados}</td>
                <td className="text-right">{v.concluidos}</td>
                <td className="text-right">{v.pendentes}</td>
                <td className={`text-right ${v.atrasados ? "font-semibold text-erro" : ""}`}>{v.atrasados}</td>
                <td className="text-right">{v.semContato}</td>
                <td className="text-right">
                  <Distintivo tom={tomTaxa(v.taxaNoPrazo)}>{v.taxaNoPrazo === null ? "aguardando" : `${v.taxaNoPrazo}%`}</Distintivo>
                  <p className="text-xs text-texto-suave">
                    {v.noPrazo} de {v.elegiveis}
                  </p>
                </td>
                <td className="text-right whitespace-nowrap">{formatarTempo(v.horasAtePrimeiroContato)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      <p className="mt-3 text-xs text-texto-suave">
        “Contato no prazo” considera os atendimentos cujo prazo já venceu ou que já tiveram contato, e conta como cumprido quando o primeiro contato foi registrado até o prazo. A lista
        começa por quem está com a menor taxa.
      </p>
    </div>
  );
}

function Indicador({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium tracking-wide text-texto-suave uppercase">{rotulo}</p>
      <p className={`mt-1 font-serif text-2xl font-semibold ${alerta ? "text-erro" : ""}`}>{valor}</p>
    </Cartao>
  );
}
