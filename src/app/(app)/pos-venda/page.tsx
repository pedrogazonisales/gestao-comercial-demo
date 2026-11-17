import Link from "next/link";
import { BarChart3, Gift, MessageCircle, Settings2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { CabecalhoPagina, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { configNumero } from "@/server/config";
import { pode } from "@/server/permissoes";
import { escopoPosVenda } from "@/server/services/posvenda";
import { filtroSituacao, incluirFilaPosVenda } from "@/server/services/consulta-posvenda";
import { listarLembretesPresente } from "@/server/services/presentes";
import { diaMes, textoDiasPresente } from "@/lib/presente";
import { EMPRESA } from "@/lib/empresa";
import { formatarData, formatarDataHora, formatarDataSemHora, formatarTelefone, linkWhatsapp } from "@/lib/formato";
import { codigoVenda } from "@/lib/venda";
import { dataReferencia, mensagemPosVenda, NOME_CANAL, situacao, textoContagem, TOM_SITUACAO } from "@/lib/posvenda";

const ABAS = [
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "atrasados", rotulo: "Atrasados" },
  { valor: "vencendo", rotulo: "Vencendo" },
  { valor: "concluidos", rotulo: "Concluídos" },
  { valor: "todos", rotulo: "Todos" },
  { valor: "presentes", rotulo: "Datas de presente" },
];
const LIMITE = 200;

export default async function FilaPosVenda({ searchParams }: { searchParams: Promise<{ situacao?: string; vendedor?: string; loja?: string; q?: string }> }) {
  const sessao = await exigirSessao();
  const { situacao: aba = "pendentes", vendedor = "", loja = "", q = "" } = await searchParams;
  const gestor = pode(sessao.usuario.perfil, "venda.verTodas");
  const alertaDias = await configNumero("posvenda.alertaDias", 2);
  const agora = new Date();

  const base: Prisma.PosVendaWhereInput = {
    AND: [
      escopoPosVenda(sessao),
      ...(gestor && vendedor ? [{ vendedorId: vendedor }] : []),
      ...(loja ? [{ venda: { lojaId: loja } }] : []),
      ...(q.trim() ? [{ cliente: { OR: [{ nome: { contains: q.trim(), mode: "insensitive" as const } }, { cpf: { startsWith: q.replace(/\D/g, "") || "-" } }] } }] : []),
    ],
  };
  const comAba = (s: string): Prisma.PosVendaWhereInput => ({ AND: [base, filtroSituacao(s, agora, alertaDias)] });

  const [registros, lembretes, contPendentes, contAtrasados, contVencendo, vendedores, lojas] = await Promise.all([
    aba === "presentes" ? [] : db.posVenda.findMany({ where: comAba(aba), include: incluirFilaPosVenda, orderBy: { prazo: aba === "concluidos" ? "desc" : "asc" }, take: LIMITE }),
    listarLembretesPresente(sessao, { vendedorId: gestor && vendedor ? vendedor : undefined, lojaId: loja || undefined, busca: q }),
    db.posVenda.count({ where: comAba("pendentes") }),
    db.posVenda.count({ where: comAba("atrasados") }),
    db.posVenda.count({ where: comAba("vencendo") }),
    gestor ? db.vendedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [],
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  if (aba !== "concluidos") registros.sort((a, b) => dataReferencia(a).getTime() - dataReferencia(b).getTime());

  const contagem: Record<string, number> = { pendentes: contPendentes, atrasados: contAtrasados, vencendo: contVencendo, presentes: lembretes.filter((l) => !l.contatadoNoAno).length };
  const params = (mudanca: Record<string, string>) => {
    const p = new URLSearchParams({ ...(vendedor && { vendedor }), ...(loja && { loja }), ...(q && { q }), situacao: aba, ...mudanca });
    return `/pos-venda?${p}`;
  };
  const estiloFiltro = "h-10 rounded-lg border border-borda bg-superficie px-3 text-sm";

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Pós-venda"
        subtitulo={gestor ? "Acompanhamento de todos os vendedores" : "Seus clientes para contato"}
        acoes={
          <>
            {pode(sessao.usuario.perfil, "relatorio.ver") && (
              <LinkBotao href="/pos-venda/painel" variante="secundario">
                <BarChart3 className="size-4" aria-hidden /> Painel da equipe
              </LinkBotao>
            )}
            {pode(sessao.usuario.perfil, "config.editar") && (
              <LinkBotao href="/pos-venda/status" variante="fantasma">
                <Settings2 className="size-4" aria-hidden /> Status
              </LinkBotao>
            )}
          </>
        }
      />

      <nav aria-label="Situação" className="mb-4 flex gap-1 overflow-x-auto border-b border-borda">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={params({ situacao: a.valor })}
            aria-current={aba === a.valor ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
              aba === a.valor ? "border-marca text-marca" : "border-transparent text-texto-suave hover:text-marca"
            }`}
          >
            {a.rotulo}
            {contagem[a.valor] !== undefined && (
              <span
                className={`rounded-full px-2 text-xs ${
                  a.valor === "atrasados" && contagem[a.valor] > 0 ? "bg-erro text-white" : a.valor === "vencendo" && contagem[a.valor] > 0 ? "bg-alerta text-white" : a.valor === "presentes" && contagem[a.valor] > 0 ? "bg-ouro-claro text-ouro-texto" : "bg-fundo text-texto-suave"
                }`}
              >
                {contagem[a.valor]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="situacao" value={aba} />
        <label className="text-xs text-texto-suave">
          Cliente ou CPF
          <input name="q" defaultValue={q} className={`${estiloFiltro} mt-1 block w-56`} />
        </label>
        {gestor && (
          <label className="text-xs text-texto-suave">
            Vendedor
            <select name="vendedor" defaultValue={vendedor} className={`${estiloFiltro} mt-1 block`}>
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
          <select name="loja" defaultValue={loja} className={`${estiloFiltro} mt-1 block`}>
            <option value="">Todas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Filtrar</button>
      </form>

      {aba === "presentes" ? (
        lembretes.length === 0 ? (
          <Vazio>Nenhuma data de presente chegando. As datas aparecem aqui com antecedência, a partir do ano seguinte ao da compra.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Cliente</th>
                <th>Presente</th>
                <th>Compra de origem</th>
                {gestor && <th>Vendedor</th>}
                <th>Contato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lembretes.map((l) => (
                <tr key={l.id} className={l.contatadoNoAno ? "text-texto-suave" : l.dias <= 7 ? "bg-ouro-claro/40" : ""}>
                  <td className="whitespace-nowrap">
                    <Distintivo tom={l.dias < 0 ? "alerta" : "ouro"}>
                      <Gift className="mr-1 size-3" aria-hidden /> {textoDiasPresente(l.dias)}
                    </Distintivo>
                    <p className="mt-1 text-xs text-texto-suave">{diaMes(l.ocorrencia)}</p>
                  </td>
                  <td>
                    <Link href={`/pos-venda/presentes/${l.id}`} className="font-medium text-marca hover:underline">
                      {l.cliente.nomeSocial || l.cliente.nome}
                    </Link>
                    <p className="text-xs whitespace-nowrap text-texto-suave">{formatarTelefone(l.cliente.celular)}</p>
                  </td>
                  <td className="max-w-60 text-xs">{l.observacao ?? "—"}</td>
                  <td className="text-xs">
                    <span className="font-mono">{codigoVenda(l.venda.numero)}</span> · {formatarData(l.venda.dataHora)}
                    <p className="max-w-60 truncate text-texto-suave">{l.venda.itens.map((i) => i.variacao.produto.nome).join(", ")}</p>
                  </td>
                  {gestor && <td className="text-xs">{l.venda.vendedor.nome}</td>}
                  <td className="text-xs">{l.contatadoNoAno ? <Distintivo tom="sucesso">Contatado</Distintivo> : "Pendente"}</td>
                  <td className="text-right">
                    <Link href={`/pos-venda/presentes/${l.id}`} className="text-xs font-medium text-marca hover:underline">
                      Atender
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )
      ) : registros.length === 0 ? (
        <Vazio>{aba === "atrasados" ? "Nenhum pós-venda atrasado. Ótimo trabalho!" : "Nenhum pós-venda nesta situação."}</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Prazo</th>
              <th>Cliente</th>
              <th>Compra</th>
              {gestor && <th>Vendedor</th>}
              <th>Status</th>
              <th>Último contato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registros.map((pv) => {
              const est = { prazo: pv.prazo, proximoContato: pv.proximoContato, finalizado: pv.status.finaliza };
              const sit = situacao(est, alertaDias, agora);
              const produtos = pv.venda.itens.map((i) => i.variacao.produto.nome);
              const nomeCliente = pv.cliente.nomeSocial || pv.cliente.nome;
              const whatsapp = pv.cliente.consentimentoContato ? linkWhatsapp(pv.cliente.celular, mensagemPosVenda(EMPRESA.nome, nomeCliente, pv.vendedor.nome, produtos[0] ?? "sua compra", pv.venda.presente)) : null;
              const ultimo = pv.interacoes[0];
              return (
                <tr key={pv.id} className={sit === "atrasado" ? "bg-erro-claro/40" : sit === "vence-hoje" ? "bg-alerta-claro/50" : ""}>
                  <td className="whitespace-nowrap">
                    <Distintivo tom={TOM_SITUACAO[sit]}>{textoContagem(est, agora)}</Distintivo>
                    <p className="mt-1 text-xs text-texto-suave">
                      {pv.proximoContato && !pv.status.finaliza ? "Retorno " : "Até "}
                      {formatarData(dataReferencia(pv))}
                    </p>
                  </td>
                  <td>
                    <Link href={`/pos-venda/${pv.id}`} className="font-medium text-marca hover:underline">
                      {nomeCliente}
                    </Link>
                    {pv.venda.presente && (
                      <p className="my-0.5">
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-ouro/40 bg-ouro-claro px-1.5 py-0.5 text-[11px] font-medium text-ouro-texto"
                          title={[pv.venda.presenteRegistro?.observacao, pv.venda.presenteRegistro?.data && `Data: ${formatarDataSemHora(pv.venda.presenteRegistro.data)}`].filter(Boolean).join(" · ") || "Venda de presente"}
                        >
                          <Gift className="size-3" aria-hidden /> Presente
                        </span>
                      </p>
                    )}
                    <p className="text-xs whitespace-nowrap text-texto-suave">{formatarTelefone(pv.cliente.celular)}</p>
                  </td>
                  <td className="text-xs">
                    <span className="font-mono">{codigoVenda(pv.venda.numero)}</span> · {formatarData(pv.venda.dataHora)} · {pv.venda.loja.nome}
                    <p className="max-w-60 truncate text-texto-suave">{produtos.join(", ")}</p>
                  </td>
                  {gestor && <td className="text-xs">{pv.vendedor.nome}</td>}
                  <td className="text-xs">{pv.status.nome}</td>
                  <td className="text-xs whitespace-nowrap text-texto-suave">{ultimo ? `${formatarDataHora(ultimo.data)} · ${NOME_CANAL[ultimo.canal]}` : "Nenhum"}</td>
                  <td className="text-right whitespace-nowrap">
                    {whatsapp && !pv.status.finaliza && (
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp com mensagem pronta" className="mr-3 inline-flex text-sucesso hover:opacity-80">
                        <MessageCircle className="size-5" aria-hidden />
                        <span className="sr-only">WhatsApp</span>
                      </a>
                    )}
                    <Link href={`/pos-venda/${pv.id}`} className="text-xs font-medium text-marca hover:underline">
                      {pv.status.finaliza ? "Ver" : "Atender"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
      {registros.length === LIMITE && <p className="mt-3 text-sm text-texto-suave">Mostrando {LIMITE}. Use os filtros para refinar.</p>}
    </div>
  );
}
