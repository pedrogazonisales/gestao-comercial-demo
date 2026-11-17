import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, MessageCircle, Phone } from "lucide-react";
import { Aviso, CabecalhoPagina, Cartao, Distintivo, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { configNumero } from "@/server/config";
import { pode } from "@/server/permissoes";
import { escopoPosVenda } from "@/server/services/posvenda";
import { formatarCpf, somenteDigitos } from "@/lib/cpf";
import { formatarData, formatarDataHora, formatarDataSemHora, formatarMoeda, formatarTelefone, linkWhatsapp } from "@/lib/formato";
import { codigoVenda, hojeSP } from "@/lib/venda";
import { EMPRESA } from "@/lib/empresa";
import { mensagemPosVenda, NOME_CANAL, situacao, textoContagem, TOM_SITUACAO } from "@/lib/posvenda";
import { FormAjustePrazo, FormInteracao } from "./forms";

export default async function AtendimentoPosVenda({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const [pv, status, alertaDias] = await Promise.all([
    db.posVenda.findFirst({
      where: { AND: [{ id }, escopoPosVenda(sessao)] },
      include: {
        status: true,
        vendedor: { select: { nome: true } },
        prazoAjustadoPor: { select: { nome: true } },
        cliente: true,
        venda: {
          include: {
            loja: { select: { nome: true } },
            presenteRegistro: true,
            itens: { include: { variacao: { include: { produto: { select: { nome: true } } } } } },
          },
        },
        interacoes: {
          orderBy: { data: "desc" },
          include: { usuario: { select: { nome: true } }, statusNovo: { select: { nome: true } } },
        },
      },
    }),
    db.statusPosVenda.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true, finaliza: true } }),
    configNumero("posvenda.alertaDias", 2),
  ]);
  if (!pv) notFound();

  const est = { prazo: pv.prazo, proximoContato: pv.proximoContato, finalizado: pv.status.finaliza };
  const sit = situacao(est, alertaDias);
  const nomeCliente = pv.cliente.nomeSocial || pv.cliente.nome;
  const produtos = pv.venda.itens.map((i) => i.variacao.produto.nome);
  const whatsapp = pv.cliente.consentimentoContato ? linkWhatsapp(pv.cliente.celular, mensagemPosVenda(EMPRESA.nome, nomeCliente, pv.vendedor.nome, produtos[0] ?? "sua compra", pv.venda.presente)) : null;
  const hoje = hojeSP();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo={nomeCliente}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <Distintivo tom={TOM_SITUACAO[sit]}>{textoContagem(est)}</Distintivo>
            {pv.status.nome} · Vendedor: {pv.vendedor.nome}
          </span>
        }
      />

      {pv.venda.presente && (
        <div className="flex items-start gap-3 rounded-xl border border-ouro/40 bg-ouro-claro px-4 py-3 text-sm">
          <Gift className="mt-0.5 size-5 shrink-0 text-ouro-texto" aria-hidden />
          <div>
            <p className="font-medium text-ouro-texto">Esta venda foi um presente</p>
            <p className="text-texto">
              {pv.venda.presenteRegistro?.observacao ?? "Sem observação."}
              {pv.venda.presenteRegistro?.data && ` · Data: ${formatarDataSemHora(pv.venda.presenteRegistro.data)}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-serif text-xl font-semibold">Contato</h2>
          <p className="text-sm">
            CPF {formatarCpf(pv.cliente.cpf)} ·{" "}
            <Link href={`/clientes/${pv.cliente.id}`} className="text-marca hover:underline">
              ficha do cliente
            </Link>
          </p>
          <p className="mt-1 text-lg font-medium">{formatarTelefone(pv.cliente.celular)}</p>
          {pv.cliente.telefoneFixo && <p className="text-sm text-texto-suave">Fixo: {formatarTelefone(pv.cliente.telefoneFixo)}</p>}
          {pv.cliente.email && <p className="text-sm text-texto-suave">{pv.cliente.email}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sucesso px-4 text-sm font-medium text-white hover:opacity-90"
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp com mensagem pronta
              </a>
            )}
            {pv.cliente.celular && (
              <a
                href={`tel:+55${somenteDigitos(pv.cliente.celular)}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca"
              >
                <Phone className="size-4" aria-hidden /> Ligar
              </a>
            )}
          </div>
          {!pv.cliente.consentimentoContato && (
            <div className="mt-3">
              <Aviso tipo="alerta">O cliente não autorizou contato por mensagem. Confirme a autorização ao falar com ele e atualize a ficha.</Aviso>
            </div>
          )}
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-serif text-xl font-semibold">Compra</h2>
          <p className="text-sm">
            <Link href={`/vendas/${pv.venda.id}`} className="font-mono text-marca hover:underline">
              {codigoVenda(pv.venda.numero)}
            </Link>{" "}
            · {formatarDataHora(pv.venda.dataHora)} · {pv.venda.loja.nome}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {pv.venda.itens.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.quantidade}× {i.variacao.produto.nome}
                  {i.variacao.descricao !== "Padrão" && <span className="text-texto-suave"> ({i.variacao.descricao})</span>}
                </span>
                <span className="text-texto-suave">{formatarMoeda(i.valorTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-borda pt-3 text-sm">
            <div>
              <dt className="text-xs text-texto-suave">Prazo do pós-venda</dt>
              <dd>{formatarDataHora(pv.prazo)}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave">Próximo contato</dt>
              <dd>{pv.proximoContato && !pv.status.finaliza ? formatarData(pv.proximoContato) : "—"}</dd>
            </div>
            {pv.prazoAjustadoPor && (
              <div className="col-span-2 text-xs text-texto-suave">
                Prazo ajustado por {pv.prazoAjustadoPor.nome} (original {formatarData(pv.prazoOriginal)}): {pv.motivoAjustePrazo}
              </div>
            )}
          </dl>
        </Cartao>
      </div>

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">{pv.status.finaliza ? "Registrar novo contato" : "Registrar contato"}</h2>
        <FormInteracao posVendaId={pv.id} status={status} statusAtualId={pv.statusId} hoje={hoje} />
      </Cartao>

      {pode(sessao.usuario.perfil, "posvenda.ajustarPrazo") && !pv.status.finaliza && (
        <Cartao>
          <h2 className="mb-1 font-serif text-xl font-semibold">Ajustar prazo</h2>
          <p className="mb-3 text-sm text-texto-suave">Uso gerencial. O ajuste fica registrado com o motivo.</p>
          <FormAjustePrazo posVendaId={pv.id} hoje={hoje} />
        </Cartao>
      )}

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Histórico de contatos</h2>
        {pv.interacoes.length === 0 ? (
          <Vazio>Nenhum contato registrado ainda.</Vazio>
        ) : (
          <ol className="space-y-3 border-l-2 border-ouro/40 pl-5">
            {pv.interacoes.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-superficie bg-ouro" aria-hidden />
                <p className="text-xs text-texto-suave">
                  {formatarDataHora(i.data)} · {i.usuario.nome} · {NOME_CANAL[i.canal]}
                  {i.statusNovo && ` · ${i.statusNovo.nome}`}
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-line">{i.resultado}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
