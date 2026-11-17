import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { dataReferencia } from "@/lib/posvenda";

export type IndicadorVendedor = {
  vendedorId: string;
  vendedor: string;
  gerados: number;
  concluidos: number;
  pendentes: number;
  atrasados: number;
  semContato: number;
  noPrazo: number;
  elegiveis: number; // prazo já venceu ou já houve contato
  taxaNoPrazo: number | null; // 0–100
  horasAtePrimeiroContato: number | null;
};

/**
 * Execução do pós-venda por vendedor, para vendas confirmadas no período.
 * "No prazo" = primeiro contato registrado até o prazo (original ou ajustado).
 */
export async function indicadoresPosVenda(filtro: { de: Date; ate: Date; lojaId?: string; vendedorId?: string }, agora = new Date()) {
  const where: Prisma.PosVendaWhereInput = {
    venda: { status: "CONFIRMADA", dataHora: { gte: filtro.de, lte: filtro.ate }, ...(filtro.lojaId && { lojaId: filtro.lojaId }) },
    ...(filtro.vendedorId && { vendedorId: filtro.vendedorId }),
  };
  const registros = await db.posVenda.findMany({
    where,
    select: {
      vendedorId: true,
      prazo: true,
      proximoContato: true,
      createdAt: true,
      vendedor: { select: { nome: true } },
      status: { select: { finaliza: true } },
      interacoes: { orderBy: { data: "asc" }, take: 1, select: { data: true } },
    },
  });

  const mapa = new Map<string, IndicadorVendedor & { somaHoras: number; comContato: number }>();
  for (const r of registros) {
    const i =
      mapa.get(r.vendedorId) ??
      { vendedorId: r.vendedorId, vendedor: r.vendedor.nome, gerados: 0, concluidos: 0, pendentes: 0, atrasados: 0, semContato: 0, noPrazo: 0, elegiveis: 0, taxaNoPrazo: null, horasAtePrimeiroContato: null, somaHoras: 0, comContato: 0 };
    mapa.set(r.vendedorId, i);

    i.gerados++;
    const primeiro = r.interacoes[0]?.data;
    if (r.status.finaliza) i.concluidos++;
    else {
      i.pendentes++;
      if (dataReferencia(r).getTime() < agora.getTime()) i.atrasados++;
    }
    if (!primeiro) i.semContato++;
    else {
      i.comContato++;
      i.somaHoras += (primeiro.getTime() - r.createdAt.getTime()) / 3_600_000;
    }
    if (primeiro || r.prazo.getTime() < agora.getTime()) {
      i.elegiveis++;
      if (primeiro && primeiro.getTime() <= r.prazo.getTime()) i.noPrazo++;
    }
  }

  const lista = [...mapa.values()].map(({ somaHoras, comContato, ...i }) => ({
    ...i,
    taxaNoPrazo: i.elegiveis ? Math.round((i.noPrazo / i.elegiveis) * 100) : null,
    horasAtePrimeiroContato: comContato ? somaHoras / comContato : null,
  }));
  // Quem mais deixa de fazer aparece primeiro.
  lista.sort((a, b) => (a.taxaNoPrazo ?? 101) - (b.taxaNoPrazo ?? 101) || b.atrasados - a.atrasados);

  const total = lista.reduce(
    (t, i) => ({ gerados: t.gerados + i.gerados, concluidos: t.concluidos + i.concluidos, pendentes: t.pendentes + i.pendentes, atrasados: t.atrasados + i.atrasados, noPrazo: t.noPrazo + i.noPrazo, elegiveis: t.elegiveis + i.elegiveis }),
    { gerados: 0, concluidos: 0, pendentes: 0, atrasados: 0, noPrazo: 0, elegiveis: 0 },
  );
  return { porVendedor: lista, total: { ...total, taxaNoPrazo: total.elegiveis ? Math.round((total.noPrazo / total.elegiveis) * 100) : null } };
}
