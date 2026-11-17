// Regras de venda usadas tanto na tela quanto no servidor. Valores sempre em centavos (inteiros).
import type { FormaPagamento } from "@prisma/client";

export function codigoVenda(numero: number) {
  return `V-${String(numero).padStart(6, "0")}`;
}

/** Aceita "V-000123", "v123" ou "123". */
export function numeroDoCodigo(texto: string) {
  const m = texto.trim().match(/^v?-?0*(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}

export const FORMAS: Record<FormaPagamento, { rotulo: string; parcelado: boolean; recebivelProprio: boolean }> = {
  DINHEIRO: { rotulo: "Dinheiro", parcelado: false, recebivelProprio: false },
  PIX: { rotulo: "PIX", parcelado: false, recebivelProprio: false },
  DEBITO: { rotulo: "Cartão de débito", parcelado: false, recebivelProprio: false },
  CREDITO: { rotulo: "Cartão de crédito", parcelado: true, recebivelProprio: false },
  CREDIARIO: { rotulo: "Crediário próprio", parcelado: true, recebivelProprio: true },
  CARNE: { rotulo: "Carnê próprio", parcelado: true, recebivelProprio: true },
};

export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const paraReais = (centavos: number) => centavos / 100;

/** Divide um total em n parcelas; a diferença de centavos fica na primeira. */
export function dividirParcelas(totalCentavos: number, n: number) {
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? resto : 0));
}

/** Desconto em centavos a partir de percentual ou valor fixo. */
export function calcularDesconto(brutoCentavos: number, tipo: "PERCENTUAL" | "VALOR" | null, valor: number) {
  if (!tipo || !valor) return 0;
  return tipo === "PERCENTUAL" ? Math.round((brutoCentavos * valor) / 100) : paraCentavos(valor);
}

/** Data "AAAA-MM-DD" de hoje no fuso de Brasília. */
export function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Soma meses a uma data só-dia em UTC, ajustando o fim do mês (31/01 + 1 mês = 28/02). */
export function somarMesesUTC(data: Date, meses: number) {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + meses;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(data.getUTCDate(), ultimoDia)));
}
