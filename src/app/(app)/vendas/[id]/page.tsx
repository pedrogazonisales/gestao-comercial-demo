import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Gift, Plus } from "lucide-react";
import { MarcaEmpresa } from "@/components/marca";
import { Aviso, CabecalhoPagina, Cartao, Distintivo, LinkBotao, Tabela } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { formatarCpf } from "@/lib/cpf";
import { formatarDataHora, formatarDataSemHora, formatarMoeda, formatarTelefone } from "@/lib/formato";
import { codigoVenda, FORMAS } from "@/lib/venda";
import { BotaoImprimir, FormCancelarVenda } from "./acoes";

export default async function DetalheVenda({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const { nova } = await searchParams;

  const venda = await db.venda.findUnique({
    where: { id },
    include: {
      loja: true,
      vendedor: { select: { nome: true } },
      operador: { select: { nome: true } },
      canceladaPor: { select: { nome: true } },
      cliente: true,
      itens: { include: { variacao: { include: { produto: { select: { id: true, nome: true } } } } } },
      pagamentos: { include: { parcelas: { orderBy: { numero: "asc" } } } },
      posVenda: { include: { status: true } },
      presenteRegistro: true,
    },
  });
  if (!venda) notFound();

  const cancelada = venda.status === "CANCELADA";
  const podeCancelar = !cancelada && pode(sessao.usuario.perfil, "venda.cancelar");

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
      <div className="hidden items-center justify-between border-b border-borda pb-3 print:flex">
        <MarcaEmpresa />
        <p className="text-right text-xs">
          {venda.loja.nome}
          {venda.loja.endereco && <br />}
          {venda.loja.endereco}
        </p>
      </div>

      {nova && !cancelada && (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso/30 bg-sucesso-claro px-4 py-3 text-sm text-sucesso print:hidden">
          <CheckCircle2 className="size-5" aria-hidden /> Venda registrada. Estoque atualizado e pós-venda agendado.
        </div>
      )}
      {cancelada && (
        <Aviso>
          Venda cancelada em {formatarDataHora(venda.canceladaEm)} por {venda.canceladaPor?.nome}. Motivo: {venda.motivoCancelamento}
        </Aviso>
      )}

      <CabecalhoPagina
        titulo={`Venda ${codigoVenda(venda.numero)}`}
        subtitulo={`${formatarDataHora(venda.dataHora)} · ${venda.loja.nome} · Vendedor: ${venda.vendedor.nome}`}
        acoes={
          <div className="flex gap-2 print:hidden">
            <BotaoImprimir />
            <LinkBotao href="/vendas/nova">
              <Plus className="size-4" aria-hidden /> Nova venda
            </LinkBotao>
          </div>
        }
      />

      <Cartao>
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs text-texto-suave">Cliente</p>
            <Link href={`/clientes/${venda.cliente.id}`} className="font-medium text-marca hover:underline print:text-texto">
              {venda.cliente.nomeSocial || venda.cliente.nome}
            </Link>
            <p className="text-sm text-texto-suave">
              CPF {formatarCpf(venda.cliente.cpf)} · {formatarTelefone(venda.cliente.celular)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-texto-suave">Status</p>
            {cancelada ? <Distintivo tom="erro">Cancelada</Distintivo> : <Distintivo tom="sucesso">Confirmada</Distintivo>}
          </div>
        </div>
      </Cartao>

      <Tabela>
        <thead>
          <tr>
            <th>Produto</th>
            <th className="text-right">Qtd.</th>
            <th className="text-right">Unitário</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {venda.itens.map((i) => (
            <tr key={i.id}>
              <td>
                <p className="font-medium">{i.variacao.produto.nome}</p>
                <p className="text-xs text-texto-suave">
                  {i.variacao.descricao !== "Padrão" && `${i.variacao.descricao} · `}
                  {i.variacao.sku}
                </p>
              </td>
              <td className="text-right">{i.quantidade}</td>
              <td className="text-right whitespace-nowrap">{formatarMoeda(i.precoUnitario)}</td>
              <td className="text-right whitespace-nowrap">{formatarMoeda(i.valorTotal)}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <div className="grid gap-6 md:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-serif text-xl font-semibold">Pagamento</h2>
          <ul className="space-y-3 text-sm">
            {venda.pagamentos.map((p) => (
              <li key={p.id}>
                <div className="flex justify-between">
                  <span>
                    {FORMAS[p.forma].rotulo}
                    {p.numeroParcelas > 1 && ` · ${p.numeroParcelas}×`}
                  </span>
                  <span className="font-medium">{formatarMoeda(p.valor)}</span>
                </div>
                {p.parcelas.length > 0 && (
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      {p.parcelas.map((pa) => (
                        <tr key={pa.id} className="border-t border-borda/60">
                          <td className="py-1">{pa.numero}ª parcela</td>
                          <td className="py-1">vence {formatarDataSemHora(pa.vencimento)}</td>
                          <td className="py-1 text-right">{formatarMoeda(pa.valor)}</td>
                          <td className="py-1 text-right text-texto-suave">{pa.status.toLowerCase()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-serif text-xl font-semibold">Valores</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-texto-suave">Subtotal</dt>
              <dd>{formatarMoeda(venda.valorBruto)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-texto-suave">
                Desconto
                {venda.descontoTipo === "PERCENTUAL" && venda.descontoPercentual && ` (${Number(venda.descontoPercentual).toLocaleString("pt-BR")}%)`}
              </dt>
              <dd>− {formatarMoeda(venda.descontoValor)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-borda pt-2">
              <dt className="font-medium">Total</dt>
              <dd className="font-serif text-2xl font-semibold text-marca print:text-texto">{formatarMoeda(venda.valorLiquido)}</dd>
            </div>
          </dl>
          {venda.observacoes && <p className="mt-3 text-sm text-texto-suave">Obs.: {venda.observacoes}</p>}
          {venda.presente && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-ouro-claro px-3 py-2 text-sm text-ouro-texto">
              <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Presente
                {venda.presenteRegistro?.observacao && `: ${venda.presenteRegistro.observacao}`}
                {venda.presenteRegistro?.data && ` · Data: ${formatarDataSemHora(venda.presenteRegistro.data)}`}
              </span>
            </p>
          )}
          <p className="mt-3 text-xs text-texto-suave">Registrada por {venda.operador.nome}</p>
        </Cartao>
      </div>

      {venda.posVenda && !cancelada && (
        <Cartao className="print:hidden">
          <h2 className="mb-1 font-serif text-xl font-semibold">Pós-venda</h2>
          <p className="text-sm text-texto-suave">
            {venda.posVenda.status.nome} · contato até {formatarDataHora(venda.posVenda.prazo)}
          </p>
        </Cartao>
      )}

      {podeCancelar && (
        <Cartao className="print:hidden">
          <h2 className="mb-1 font-serif text-xl font-semibold">Cancelar venda</h2>
          <p className="mb-3 text-sm text-texto-suave">Devolve os produtos ao estoque desta loja e cancela as parcelas em aberto. A venda continua no histórico.</p>
          <FormCancelarVenda vendaId={venda.id} />
        </Cartao>
      )}
    </div>
  );
}
