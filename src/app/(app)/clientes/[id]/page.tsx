import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, MessageCircle, Pencil } from "lucide-react";
import { CabecalhoPagina, Cartao, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { configNumero } from "@/server/config";
import { completudeCadastro } from "@/server/services/clientes";
import { formatarCpf } from "@/lib/cpf";
import { formatarCep, formatarData, formatarDataHora, formatarDataSemHora, formatarMoeda, formatarTelefone, linkWhatsapp } from "@/lib/formato";
import { codigoVenda, hojeSP } from "@/lib/venda";
import { estaVencida, hojeComoData, saldoCentavos } from "@/lib/cobranca";
import { proximaOcorrenciaLembrete } from "@/lib/presente";

const diaDaVenda = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

export default async function DetalheCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({
    where: { id },
    include: {
      vendedorResponsavel: { select: { nome: true } },
      vendas: {
        orderBy: { dataHora: "desc" },
        include: {
          vendedor: { select: { nome: true } },
          loja: { select: { nome: true } },
          itens: { include: { variacao: { include: { produto: { select: { nome: true } } } } } },
        },
      },
      posVendas: { include: { interacoes: { include: { usuario: { select: { nome: true } } }, orderBy: { data: "desc" } } } },
    },
  });
  if (!cliente) notFound();

  const [inativoDias, presentes, parcelasAbertas] = await Promise.all([
    configNumero("cliente.inativoDias", 180),
    // Todas as datas de presente ficam no cadastro; só somem se a venda de origem for cancelada.
    db.presenteCliente.findMany({
      where: { clienteId: id, venda: { status: "CONFIRMADA" } },
      orderBy: { createdAt: "desc" },
      include: {
        venda: {
          select: {
            id: true,
            numero: true,
            dataHora: true,
            vendedor: { select: { nome: true } },
            itens: { select: { quantidade: true, variacao: { select: { produto: { select: { nome: true } } } } } },
          },
        },
      },
    }),
    db.parcela.findMany({ where: { clienteId: id, status: { in: ["ABERTA", "PARCIAL"] }, venda: { status: "CONFIRMADA" } } }),
  ]);
  const hojeData = hojeComoData(hojeSP());
  const emAberto = parcelasAbertas.reduce((s, p) => s + saldoCentavos(p), 0);
  const vencidas = parcelasAbertas.filter((p) => estaVencida(p, hojeData));
  const vendasComParcela = [...new Set(parcelasAbertas.map((p) => p.vendaId))];
  const confirmadas = cliente.vendas.filter((v) => v.status === "CONFIRMADA");
  const totalComprado = confirmadas.reduce((s, v) => s + Number(v.valorLiquido), 0);
  const ultima = confirmadas[0]?.dataHora;
  const diasSemComprar = ultima ? Math.floor((Date.now() - ultima.getTime()) / 86_400_000) : null;
  const inativo = diasSemComprar !== null && diasSemComprar > inativoDias;
  const completude = completudeCadastro(cliente);
  const whatsapp = cliente.consentimentoContato ? linkWhatsapp(cliente.celular) : null;
  const interacoes = cliente.posVendas.flatMap((p) => p.interacoes).sort((a, b) => b.data.getTime() - a.data.getTime());
  const endereco = [
    [cliente.tipoLogradouro, cliente.logradouro].filter(Boolean).join(" "),
    cliente.numero,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade && `${cliente.cidade}/${cliente.uf}`,
    cliente.cep && `CEP ${formatarCep(cliente.cep)}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CabecalhoPagina
        titulo={cliente.nomeSocial || cliente.nome}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            CPF {formatarCpf(cliente.cpf)}
            {cliente.nomeSocial && <span>· Nome civil: {cliente.nome}</span>}
            {inativo && <Distintivo tom="alerta">Inativo há {diasSemComprar} dias</Distintivo>}
            {!cliente.consentimentoContato && <Distintivo tom="erro">Sem autorização de contato</Distintivo>}
          </span>
        }
        acoes={
          <>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-sucesso hover:text-sucesso"
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp
              </a>
            )}
            <LinkBotao href={`/clientes/${cliente.id}/editar`} variante="secundario">
              <Pencil className="size-4" aria-hidden /> Editar
            </LinkBotao>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Total comprado" valor={formatarMoeda(totalComprado)} />
        <Indicador rotulo="Compras" valor={String(confirmadas.length)} />
        <Indicador rotulo="Última compra" valor={formatarData(ultima)} />
        <Indicador rotulo="Cadastro completo" valor={`${completude}%`} />
      </div>

      {emAberto > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm ${
            vencidas.length ? "border-erro/30 bg-erro-claro text-erro" : "border-borda bg-superficie"
          }`}
        >
          <span>
            Crediário/carnê em aberto: <strong>{formatarMoeda(emAberto / 100)}</strong>
            {vencidas.length > 0 && ` · ${vencidas.length} parcela${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`}
          </span>
          <span className="flex gap-3">
            {vendasComParcela.map((vid) => {
              const v = cliente.vendas.find((x) => x.id === vid);
              return (
                <Link key={vid} href={`/recebimentos/${vid}`} className="font-medium text-marca hover:underline">
                  Ver parcelas {v ? codigoVenda(v.numero) : ""}
                </Link>
              );
            })}
          </span>
        </div>
      )}

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Dados cadastrais</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dado rotulo="Celular" valor={formatarTelefone(cliente.celular)} />
          <Dado rotulo="Telefone fixo" valor={formatarTelefone(cliente.telefoneFixo)} />
          <Dado rotulo="E-mail" valor={cliente.email} />
          <Dado rotulo="Nascimento" valor={cliente.dataNascimento ? formatarDataSemHora(cliente.dataNascimento) : null} />
          <Dado rotulo="Vendedor responsável" valor={cliente.vendedorResponsavel?.nome} />
          <Dado rotulo="Cliente desde" valor={formatarData(cliente.createdAt)} />
          <Dado rotulo="Endereço" valor={endereco} className="sm:col-span-2 lg:col-span-3" />
          {cliente.observacoes && <Dado rotulo="Observações" valor={cliente.observacoes} className="sm:col-span-2 lg:col-span-3" />}
        </dl>
      </Cartao>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
          <Gift className="size-5 text-ouro" aria-hidden /> Datas de presente
        </h2>
        {presentes.length === 0 ? (
          <Vazio>Nenhuma compra de presente registrada.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Data</th>
                <th>Para quem / ocasião</th>
                <th>Próximo lembrete</th>
                <th>Compra</th>
                <th>Produtos</th>
                <th>Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {presentes.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{p.data ? formatarDataSemHora(p.data) : "Não informada"}</td>
                  <td>{p.observacao ?? "—"}</td>
                  <td className="whitespace-nowrap">{p.data ? formatarDataSemHora(proximaOcorrenciaLembrete(p.data, diaDaVenda(p.venda.dataHora), hojeSP())) : "—"}</td>
                  <td className="font-mono text-xs">
                    <Link href={`/vendas/${p.venda.id}`} className="text-marca hover:underline">
                      {codigoVenda(p.venda.numero)}
                    </Link>
                    <p className="font-sans text-texto-suave">{formatarData(p.venda.dataHora)}</p>
                  </td>
                  <td className="text-xs">{p.venda.itens.map((i) => `${i.quantidade}× ${i.variacao.produto.nome}`).join(", ")}</td>
                  <td className="text-xs">{p.venda.vendedor.nome}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Histórico de compras</h2>
        {cliente.vendas.length === 0 ? (
          <Vazio>Nenhuma compra registrada.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Data</th>
                <th>Venda</th>
                <th>Loja</th>
                <th>Vendedor</th>
                <th>Produtos</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {cliente.vendas.map((v) => (
                <tr key={v.id} className={v.status === "CANCELADA" ? "text-texto-suave line-through" : ""}>
                  <td className="whitespace-nowrap">{formatarDataHora(v.dataHora)}</td>
                  <td className="font-mono text-xs">
                    <Link href={`/vendas/${v.id}`} className="text-marca hover:underline">
                      {codigoVenda(v.numero)}
                    </Link>
                  </td>
                  <td>{v.loja.nome}</td>
                  <td>{v.vendedor.nome}</td>
                  <td>{v.itens.map((i) => `${i.quantidade}× ${i.variacao.produto.nome}`).join(", ")}</td>
                  <td className="text-right whitespace-nowrap">{formatarMoeda(v.valorLiquido)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Histórico de relacionamento</h2>
        {interacoes.length === 0 ? (
          <Vazio>Nenhum contato de pós-venda registrado.</Vazio>
        ) : (
          <ul className="space-y-2">
            {interacoes.map((i) => (
              <li key={i.id} className="rounded-lg border border-borda bg-superficie px-4 py-3 text-sm">
                <span className="text-texto-suave">
                  {formatarDataHora(i.data)} · {i.usuario.nome} · {i.canal.toLowerCase()}
                </span>
                <p className="mt-1">{i.resultado}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium tracking-wide text-texto-suave uppercase">{rotulo}</p>
      <p className="mt-1 font-serif text-2xl font-semibold">{valor}</p>
    </Cartao>
  );
}

function Dado({ rotulo, valor, className }: { rotulo: string; valor?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="mt-0.5">{valor || <span className="text-texto-suave">—</span>}</dd>
    </div>
  );
}
