// Regras de parcelas e cobrança (puras). Datas de vencimento são só-dia (meia-noite UTC).
import type { StatusCobranca, StatusParcela } from "@prisma/client";

/** Hoje (Brasília) como data só-dia em UTC, comparável com `Parcela.vencimento`. */
export function hojeComoData(hojeIso: string) {
  return new Date(`${hojeIso}T00:00:00Z`);
}

export function diasAtraso(vencimento: Date, hoje: Date) {
  return Math.max(0, Math.round((hoje.getTime() - vencimento.getTime()) / 86_400_000));
}

export function saldoCentavos(p: { valor: unknown; valorPago: unknown }) {
  return Math.round(Number(p.valor) * 100) - Math.round(Number(p.valorPago) * 100);
}

/** Uma parcela só é inadimplente se está em aberto, com saldo, e o vencimento já passou. */
export function estaVencida(p: { status: StatusParcela; vencimento: Date; valor: unknown; valorPago: unknown }, hoje: Date) {
  return (p.status === "ABERTA" || p.status === "PARCIAL") && p.vencimento.getTime() < hoje.getTime() && saldoCentavos(p) > 0;
}

/** Status da parcela depois de um recebimento ou estorno. */
export function statusAposPagamento(valorCentavos: number, pagoCentavos: number): StatusParcela {
  if (pagoCentavos <= 0) return "ABERTA";
  return pagoCentavos >= valorCentavos ? "PAGA" : "PARCIAL";
}

export function faixaAtraso(dias: number) {
  if (dias <= 30) return "1 a 30 dias";
  if (dias <= 60) return "31 a 60 dias";
  if (dias <= 90) return "61 a 90 dias";
  return "Mais de 90 dias";
}
export const FAIXAS = ["1 a 30 dias", "31 a 60 dias", "61 a 90 dias", "Mais de 90 dias"] as const;

export const NOME_STATUS_COBRANCA: Record<StatusCobranca, string> = {
  PENDENTE: "Pendente de cobrança",
  PRIMEIRA_TENTATIVA: "Primeira tentativa realizada",
  CLIENTE_CONTATADO: "Cliente contatado",
  PROMESSA_PAGAMENTO: "Promessa de pagamento",
  PAGAMENTO_PARCIAL: "Pagamento parcial",
  NEGOCIACAO: "Negociação em andamento",
  REGULARIZADO: "Regularizado",
  ANALISE_GERENCIAL: "Encaminhado para análise gerencial",
};

export const NOME_STATUS_PARCELA: Record<StatusParcela, string> = {
  ABERTA: "Em aberto",
  PARCIAL: "Paga parcialmente",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};
