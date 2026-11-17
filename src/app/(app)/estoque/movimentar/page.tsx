import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina, Cartao, Tabela } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { FormMinimo, FormMovimentar } from "./forms";

export default async function Movimentar({ searchParams }: { searchParams: Promise<{ variacao?: string }> }) {
  const sessao = await exigirSessao("estoque.ajustar");
  const { variacao: variacaoId } = await searchParams;
  if (!variacaoId) notFound();

  const [variacao, lojas] = await Promise.all([
    db.produtoVariacao.findUnique({ where: { id: variacaoId }, include: { produto: true, estoques: true } }),
    db.loja.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!variacao) notFound();

  const saldos = lojas.map((l) => {
    const s = variacao.estoques.find((e) => e.lojaId === l.id);
    return { id: l.id, nome: l.nome, quantidade: s?.quantidade ?? 0, estoqueMinimo: s?.estoqueMinimo ?? 0 };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CabecalhoPagina
        titulo="Movimentar estoque"
        subtitulo={
          <>
            <Link href={`/produtos/${variacao.produto.id}`} className="text-marca hover:underline">
              {variacao.produto.nome}
            </Link>
            {variacao.descricao !== "Padrão" && ` · ${variacao.descricao}`} · <span className="font-mono">{variacao.sku}</span>
          </>
        }
      />
      <Cartao>
        <FormMovimentar variacaoId={variacao.id} lojas={saldos} lojaAtualId={sessao.loja?.id} />
      </Cartao>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Saldo e estoque mínimo por loja</h2>
        <Tabela>
          <thead>
            <tr>
              <th>Loja</th>
              <th className="text-right">Saldo</th>
              <th className="text-right">Estoque mínimo</th>
            </tr>
          </thead>
          <tbody>
            {saldos.map((s) => (
              <tr key={s.id}>
                <td>{s.nome}</td>
                <td className={`text-right font-semibold ${s.estoqueMinimo > 0 && s.quantidade <= s.estoqueMinimo ? "text-alerta" : ""}`}>{s.quantidade}</td>
                <td>
                  <FormMinimo variacaoId={variacao.id} lojaId={s.id} valor={s.estoqueMinimo} />
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </section>
    </div>
  );
}
