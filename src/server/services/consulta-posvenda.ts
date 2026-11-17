import "server-only";
import type { Prisma } from "@prisma/client";

/** Filtros de situação no banco. "Referência" = próximo contato agendado, ou o prazo quando não há agendamento. */
export function filtroSituacao(situacao: string, agora: Date, alertaDias: number): Prisma.PosVendaWhereInput {
  const limite = new Date(agora.getTime() + (alertaDias + 1) * 86_400_000);
  const referenciaEntre = (de: Date | undefined, ate: Date): Prisma.PosVendaWhereInput => ({
    OR: [
      { proximoContato: null, prazo: { ...(de && { gte: de }), lt: ate } },
      { proximoContato: { ...(de && { gte: de }), lt: ate } },
    ],
  });
  switch (situacao) {
    case "atrasados":
      return { status: { finaliza: false }, ...referenciaEntre(undefined, agora) };
    case "vencendo":
      return { status: { finaliza: false }, ...referenciaEntre(agora, limite) };
    case "concluidos":
      return { status: { finaliza: true } };
    case "todos":
      return {};
    default:
      return { status: { finaliza: false } };
  }
}

export const incluirFilaPosVenda = {
  status: true,
  vendedor: { select: { nome: true } },
  cliente: { select: { id: true, nome: true, nomeSocial: true, celular: true, consentimentoContato: true } },
  venda: {
    select: {
      id: true,
      numero: true,
      dataHora: true,
      presente: true,
      presenteRegistro: { select: { data: true, observacao: true } },
      loja: { select: { nome: true } },
      itens: { select: { quantidade: true, variacao: { select: { produto: { select: { nome: true } } } } } },
    },
  },
  interacoes: { orderBy: { data: "desc" }, take: 1, select: { data: true, canal: true } },
} satisfies Prisma.PosVendaInclude;
