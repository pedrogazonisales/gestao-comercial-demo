import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina, Cartao, Distintivo, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { formatarCpf } from "@/lib/cpf";
import { formatarDataHora, formatarDataSemHora, formatarMoeda, formatarTelefone } from "@/lib/formato";
import { codigoVenda, FORMAS, hojeSP } from "@/lib/venda";
import { NOME_CANAL } from "@/lib/posvenda";
import { diasAtraso, estaVencida, hojeComoData, NOME_STATUS_COBRANCA, NOME_STATUS_PARCELA, saldoCentavos } from "@/lib/cobranca";
import { BotaoImprimir } from "../../vendas/[id]/acoes";
import { FormCobranca, FormEstorno, FormReceber } from "./forms";

export default async function CarneDaVenda({ params }: { params: Promise<{ vendaId: string }> }) {
  const sessao = await exigirSessao("parcela.receber");
  const { vendaId } = await params;
  const perfil = sessao.usuario.perfil;
  const gestor = pode(perfil, "cobranca.gerenciar");

  const venda = await db.venda.findUnique({
    where: { id: vendaId },
    include: {
      cliente: true,
      vendedor: { select: { nome: true } },
      loja: { select: { nome: true } },
      pagamentos: { where: { parcelas: { some: {} } }, select: { forma: true } },
      parcelas: {
        orderBy: { numero: "asc" },
        include: {
          recebimentos: {
            orderBy: { dataPagamento: "asc" },
            include: { usuario: { select: { nome: true } }, estornadoPor: { select: { nome: true } } },
          },
        },
      },
      cobranca: {
        include: {
          responsavel: { select: { id: true, nome: true } },
          interacoes: { orderBy: { data: "desc" }, include: { usuario: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!venda || !venda.parcelas.length) notFound();

  const hoje = hojeComoData(hojeSP());
  const ativas = venda.parcelas.filter((p) => p.status !== "CANCELADA");
  const aberto = ativas.reduce((s, p) => s + Math.max(0, saldoCentavos(p)), 0);
  const vencidas = ativas.filter((p) => estaVencida(p, hoje));
  const recebimentos = venda.parcelas.flatMap((p) => p.recebimentos.map((r) => ({ ...r, parcela: p.numero })));
  const responsaveis = gestor ? await db.usuario.findMany({ where: { ativo: true, perfil: { in: ["ADMIN", "GERENTE"] } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo={venda.cliente.nomeSocial || venda.cliente.nome}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            CPF {formatarCpf(venda.cliente.cpf)} · {formatarTelefone(venda.cliente.celular)} ·{" "}
            <Link href={`/vendas/${venda.id}`} className="font-mono text-marca hover:underline">
              {codigoVenda(venda.numero)}
            </Link>{" "}
            de {formatarDataHora(venda.dataHora)} · {venda.pagamentos.map((p) => FORMAS[p.forma].rotulo).join(", ")}
            {venda.status === "CANCELADA" && <Distintivo tom="erro">venda cancelada</Distintivo>}
          </span>
        }
        acoes={<div className="print:hidden"><BotaoImprimir /></div>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo rotulo="Em aberto" valor={formatarMoeda(aberto / 100)} />
        <Resumo rotulo="Vencido" valor={formatarMoeda(vencidas.reduce((s, p) => s + saldoCentavos(p), 0) / 100)} alerta={vencidas.length > 0} />
        <Resumo rotulo="Maior atraso" valor={vencidas.length ? `${Math.max(...vencidas.map((p) => diasAtraso(p.vencimento, hoje)))} dias` : "—"} alerta={vencidas.length > 0} />
      </div>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Parcelas</h2>
        <Tabela>
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Vencimento</th>
              <th className="text-right">Valor</th>
              <th className="text-right">Pago</th>
              <th className="text-right">Saldo</th>
              <th>Situação</th>
              <th className="print:hidden">Receber</th>
            </tr>
          </thead>
          <tbody>
            {venda.parcelas.map((p) => {
              const saldo = saldoCentavos(p);
              const vencida = estaVencida(p, hoje);
              const aberta = (p.status === "ABERTA" || p.status === "PARCIAL") && venda.status === "CONFIRMADA";
              return (
                <tr key={p.id} className={vencida ? "bg-erro-claro/40" : ""}>
                  <td>{p.numero}ª</td>
                  <td className="whitespace-nowrap">{formatarDataSemHora(p.vencimento)}</td>
                  <td className="text-right whitespace-nowrap">{formatarMoeda(p.valor)}</td>
                  <td className="text-right whitespace-nowrap">{formatarMoeda(p.valorPago)}</td>
                  <td className="text-right font-medium whitespace-nowrap">{p.status === "CANCELADA" ? "—" : formatarMoeda(saldo / 100)}</td>
                  <td>
                    {vencida ? (
                      <Distintivo tom="erro">vencida há {diasAtraso(p.vencimento, hoje)} dias</Distintivo>
                    ) : (
                      <Distintivo tom={p.status === "PAGA" ? "sucesso" : p.status === "PARCIAL" ? "ouro" : p.status === "CANCELADA" ? "neutro" : "marca"}>{NOME_STATUS_PARCELA[p.status]}</Distintivo>
                    )}
                  </td>
                  <td className="print:hidden">
                    {aberto > 0 && aberta && <FormReceber key={`${p.id}-${saldo}`} parcelaId={p.id} saldo={(saldo / 100).toFixed(2).replace(".", ",")} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Pagamentos recebidos</h2>
        {recebimentos.length === 0 ? (
          <Vazio>Nenhum pagamento registrado.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Data</th>
                <th>Parcela</th>
                <th>Forma</th>
                <th className="text-right">Valor</th>
                <th>Recebido por</th>
                <th className="print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {recebimentos.map((r) => (
                <tr key={r.id} className={r.estornadoEm ? "text-texto-suave" : ""}>
                  <td className="whitespace-nowrap">{formatarDataHora(r.dataPagamento)}</td>
                  <td>{r.parcela}ª</td>
                  <td>{FORMAS[r.forma].rotulo}</td>
                  <td className={`text-right whitespace-nowrap ${r.estornadoEm ? "line-through" : ""}`}>{formatarMoeda(r.valor)}</td>
                  <td>
                    {r.usuario.nome}
                    {r.estornadoEm && (
                      <p className="text-xs text-erro">
                        Estornado por {r.estornadoPor?.nome} em {formatarDataHora(r.estornadoEm)}: {r.motivoEstorno}
                      </p>
                    )}
                  </td>
                  <td className="text-right print:hidden">{!r.estornadoEm && pode(perfil, "parcela.estornar") && <FormEstorno recebimentoId={r.id} />}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>

      {gestor && venda.status === "CONFIRMADA" && (vencidas.length > 0 || venda.cobranca) && (
        <section className="space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold">Cobrança</h2>
            {venda.cobranca && (
              <span className="flex items-center gap-2 text-sm text-texto-suave">
                <Distintivo tom={venda.cobranca.status === "REGULARIZADO" ? "sucesso" : "alerta"}>{NOME_STATUS_COBRANCA[venda.cobranca.status]}</Distintivo>
                Responsável: {venda.cobranca.responsavel?.nome ?? "—"}
              </span>
            )}
          </div>
          <Cartao>
            <FormCobranca vendaId={venda.id} statusAtual={venda.cobranca?.status ?? "PENDENTE"} responsaveis={responsaveis} responsavelAtual={venda.cobranca?.responsavel?.id} />
          </Cartao>
          {venda.cobranca && venda.cobranca.interacoes.length > 0 && (
            <ol className="space-y-3 border-l-2 border-ouro/40 pl-5">
              {venda.cobranca.interacoes.map((i) => (
                <li key={i.id} className="relative">
                  <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-superficie bg-ouro" aria-hidden />
                  <p className="text-xs text-texto-suave">
                    {formatarDataHora(i.data)} · {i.usuario.nome} · {i.canal === "OUTRO" ? "Sistema" : NOME_CANAL[i.canal]} · {NOME_STATUS_COBRANCA[i.statusNovo]}
                  </p>
                  <p className="mt-0.5 text-sm">{i.descricao}</p>
                  {i.dataPromessa && (
                    <p className="text-xs text-ouro-texto">
                      Promessa: {i.valorPrometido ? formatarMoeda(i.valorPrometido) : ""} até {formatarDataSemHora(i.dataPromessa)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
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
