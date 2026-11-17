import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { CabecalhoPagina, Distintivo, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { mascararCpf, somenteDigitos } from "@/lib/cpf";
import { formatarDataSemHora, formatarMoeda } from "@/lib/formato";
import { codigoVenda, hojeSP, numeroDoCodigo } from "@/lib/venda";
import { estaVencida, hojeComoData, saldoCentavos } from "@/lib/cobranca";

const LIMITE = 100;

export default async function ContasAReceber({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sessao = await exigirSessao("parcela.receber");
  const { q = "" } = await searchParams;
  const termo = q.trim();
  const gestor = pode(sessao.usuario.perfil, "cobranca.gerenciar");
  // Vendedor (caixa) só vê carnês ao buscar o cliente; a lista completa é gerencial (LGPD: mínimo necessário).
  const exibir = gestor || termo.length >= 3;
  const hoje = hojeComoData(hojeSP());

  const digitos = somenteDigitos(termo);
  const numero = numeroDoCodigo(termo);
  const where: Prisma.VendaWhereInput = {
    status: "CONFIRMADA",
    parcelas: { some: { status: { in: ["ABERTA", "PARCIAL"] } } },
    ...(termo && {
      OR: [
        { cliente: { nome: { contains: termo, mode: "insensitive" } } },
        ...(digitos.length >= 3 ? [{ cliente: { cpf: { startsWith: digitos } } }] : []),
        ...(numero !== null ? [{ numero }] : []),
      ],
    }),
  };

  const vendas = exibir
    ? await db.venda.findMany({
        where,
        take: LIMITE,
        include: {
          cliente: { select: { nome: true, nomeSocial: true, cpf: true } },
          loja: { select: { nome: true } },
          parcelas: { where: { status: { in: ["ABERTA", "PARCIAL"] } }, orderBy: { vencimento: "asc" } },
        },
      })
    : [];
  const linhas = vendas
    .map((v) => {
      const proxima = v.parcelas[0];
      const vencidas = v.parcelas.filter((p) => estaVencida(p, hoje));
      return { v, proxima, vencidas, aberto: v.parcelas.reduce((s, p) => s + saldoCentavos(p), 0) };
    })
    .sort((a, b) => a.proxima.vencimento.getTime() - b.proxima.vencimento.getTime());

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Recebimentos" subtitulo="Parcelas de crediário e carnê em aberto. Busque o cliente para registrar um pagamento." />

      <form className="mb-4 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={termo}
            autoFocus
            placeholder="CPF, nome do cliente ou código da venda"
            className="h-10 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 text-sm focus:border-marca focus:outline-none"
          />
        </div>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">Buscar</button>
      </form>

      {!exibir ? (
        <Vazio>Digite o CPF, o nome do cliente ou o código da venda.</Vazio>
      ) : linhas.length === 0 ? (
        <Vazio>{termo ? "Nenhuma parcela em aberto para esta busca." : "Nenhuma parcela em aberto."}</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Venda</th>
              <th>Próxima parcela</th>
              <th className="text-right">Em aberto</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ v, proxima, vencidas, aberto }) => (
              <tr key={v.id} className={vencidas.length ? "bg-erro-claro/30" : ""}>
                <td>
                  <p className="font-medium">{v.cliente.nomeSocial || v.cliente.nome}</p>
                  <p className="font-mono text-xs text-texto-suave">{mascararCpf(v.cliente.cpf)}</p>
                </td>
                <td className="text-xs">
                  <span className="font-mono">{codigoVenda(v.numero)}</span> · {v.loja.nome}
                </td>
                <td className="text-xs whitespace-nowrap">
                  {proxima.numero}ª · vence {formatarDataSemHora(proxima.vencimento)} · {formatarMoeda(saldoCentavos(proxima) / 100)}
                </td>
                <td className="text-right font-medium whitespace-nowrap">{formatarMoeda(aberto / 100)}</td>
                <td>
                  {vencidas.length ? (
                    <Distintivo tom="erro">
                      {vencidas.length} vencida{vencidas.length > 1 ? "s" : ""}
                    </Distintivo>
                  ) : (
                    <Distintivo tom="sucesso">em dia</Distintivo>
                  )}
                </td>
                <td className="text-right">
                  <Link href={`/recebimentos/${v.id}`} className="text-sm font-medium text-marca hover:underline">
                    Receber
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      {vendas.length === LIMITE && <p className="mt-3 text-sm text-texto-suave">Mostrando {LIMITE}. Refine a busca.</p>}
    </div>
  );
}
