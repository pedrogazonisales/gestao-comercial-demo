import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { CabecalhoPagina, Distintivo, LinkBotao, Tabela, Vazio } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { completudeCadastro } from "@/server/services/clientes";
import { cpfValido, formatarCpf, mascararCpf, somenteDigitos } from "@/lib/cpf";
import { formatarData, formatarTelefone } from "@/lib/formato";

const LIMITE = 50;

export default async function PaginaClientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirSessao();
  const q = ((await searchParams).q ?? "").trim();
  const digitos = somenteDigitos(q);

  const where: Prisma.ClienteWhereInput = !q
    ? {}
    : digitos.length >= 3 && digitos.length === q.replace(/[.\-\s]/g, "").length
      ? { OR: [{ cpf: { startsWith: digitos } }, { celular: { contains: digitos } }] }
      : { OR: [{ nome: { contains: q, mode: "insensitive" } }, { nomeSocial: { contains: q, mode: "insensitive" } }] };

  const [clientes, total] = await Promise.all([
    db.cliente.findMany({
      where,
      orderBy: { nome: "asc" },
      take: LIMITE,
      include: { vendas: { where: { status: "CONFIRMADA" }, orderBy: { dataHora: "desc" }, take: 1, select: { dataHora: true } } },
    }),
    db.cliente.count({ where }),
  ]);
  const cpfNovo = digitos.length === 11 && cpfValido(digitos) && total === 0 ? digitos : null;

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina
        titulo="Clientes"
        subtitulo={`${total} cliente${total === 1 ? "" : "s"}${q ? " encontrados" : " cadastrados"}`}
        acoes={
          <LinkBotao href="/clientes/novo">
            <Plus className="size-4" aria-hidden /> Novo cliente
          </LinkBotao>
        }
      />

      <form className="mb-4 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar cliente
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CPF ou celular"
            className="h-10 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 text-sm focus:border-marca focus:outline-none"
          />
        </div>
        <button className="h-10 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:border-marca hover:text-marca">
          Buscar
        </button>
      </form>

      {clientes.length === 0 ? (
        <Vazio>
          {q ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
          {cpfNovo && (
            <div className="mt-4">
              <LinkBotao href={`/clientes/novo?cpf=${cpfNovo}`}>Cadastrar CPF {formatarCpf(cpfNovo)}</LinkBotao>
            </div>
          )}
        </Vazio>
      ) : (
        <>
          <Tabela>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Celular</th>
                <th>Cidade</th>
                <th>Cadastro</th>
                <th>Última compra</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const completude = completudeCadastro(c);
                return (
                  <tr key={c.id} className="hover:bg-fundo/60">
                    <td>
                      <Link href={`/clientes/${c.id}`} className="font-medium text-marca hover:underline">
                        {c.nomeSocial || c.nome}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{mascararCpf(c.cpf)}</td>
                    <td className="whitespace-nowrap">{formatarTelefone(c.celular)}</td>
                    <td>{c.cidade ? `${c.cidade}/${c.uf}` : "—"}</td>
                    <td>
                      <Distintivo tom={completude === 100 ? "sucesso" : completude >= 50 ? "ouro" : "alerta"}>{completude}%</Distintivo>
                    </td>
                    <td className="whitespace-nowrap">{formatarData(c.vendas[0]?.dataHora)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
          {total > LIMITE && (
            <p className="mt-3 text-sm text-texto-suave">
              Mostrando os {LIMITE} primeiros de {total}. Refine a busca para encontrar outros.
            </p>
          )}
        </>
      )}
    </div>
  );
}
