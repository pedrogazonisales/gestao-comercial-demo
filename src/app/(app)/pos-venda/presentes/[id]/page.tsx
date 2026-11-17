import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, MessageCircle } from "lucide-react";
import { Aviso, CabecalhoPagina, Cartao, Distintivo, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { buscarPresente } from "@/server/services/presentes";
import { formatarData, formatarDataHora, formatarDataSemHora, formatarTelefone, linkWhatsapp } from "@/lib/formato";
import { codigoVenda } from "@/lib/venda";
import { EMPRESA } from "@/lib/empresa";
import { NOME_CANAL } from "@/lib/posvenda";
import { diaMes, mensagemDataPresente, textoDiasPresente } from "@/lib/presente";
import { FormContatoPresente } from "./form";

export default async function AtendimentoPresente({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const p = await buscarPresente(id, sessao);
  if (!p) notFound();

  const nome = p.cliente.nomeSocial || p.cliente.nome;
  const dataTexto = formatarDataSemHora(p.ocorrencia);
  const whatsapp = p.cliente.consentimentoContato ? linkWhatsapp(p.cliente.celular, mensagemDataPresente(EMPRESA.nome, nome, sessao.usuario.nome, diaMes(p.ocorrencia), p.observacao)) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina
        titulo={nome}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <Distintivo tom="ouro">
              <Gift className="mr-1 size-3" aria-hidden /> {textoDiasPresente(p.dias)}
            </Distintivo>
            Data de presente: {dataTexto}
            {p.contatadoNoAno && <Distintivo tom="sucesso">Contatado em {p.ocorrencia.getUTCFullYear()}</Distintivo>}
          </span>
        }
      />

      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-texto-suave">Observação do presente</dt>
            <dd>{p.observacao ?? "Sem observação."}</dd>
          </div>
          <div>
            <dt className="text-xs text-texto-suave">Compra de origem</dt>
            <dd>
              <Link href={`/vendas/${p.venda.id}`} className="font-mono text-marca hover:underline">
                {codigoVenda(p.venda.numero)}
              </Link>{" "}
              em {formatarData(p.venda.dataHora)} · {p.venda.loja.nome}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-texto-suave">Produtos</dt>
            <dd>{p.venda.itens.map((i) => `${i.quantidade}× ${i.variacao.produto.nome}`).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-texto-suave">Vendedor da compra</dt>
            <dd>{p.venda.vendedor.nome}</dd>
          </div>
          <div>
            <dt className="text-xs text-texto-suave">Celular</dt>
            <dd>
              {formatarTelefone(p.cliente.celular)} ·{" "}
              <Link href={`/clientes/${p.cliente.id}`} className="text-marca hover:underline">
                ficha do cliente
              </Link>
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-sucesso px-4 text-sm font-medium text-white hover:opacity-90">
              <MessageCircle className="size-4" aria-hidden /> WhatsApp com mensagem pronta
            </a>
          ) : (
            <Aviso tipo="alerta">O cliente não autorizou contato por mensagem. Confirme a autorização pessoalmente e atualize a ficha.</Aviso>
          )}
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Registrar contato</h2>
        <FormContatoPresente id={p.id} />
      </Cartao>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Contatos desta data</h2>
        {p.contatos.length === 0 ? (
          <Vazio>Nenhum contato registrado ainda.</Vazio>
        ) : (
          <ol className="space-y-3 border-l-2 border-ouro/40 pl-5">
            {p.contatos.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="text-xs text-texto-suave">
                  {formatarDataHora(c.data)} · {c.usuario.nome} · {NOME_CANAL[c.canal]} · referente a {c.ano}
                </p>
                <p className="mt-0.5 whitespace-pre-line">{c.resultado}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
