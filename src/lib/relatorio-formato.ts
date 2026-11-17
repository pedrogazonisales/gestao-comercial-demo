import type { TipoColuna } from "@/server/services/relatorios";
import { formatarTelefone } from "./formato";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata uma célula de relatório. No CSV, números saem sem "R$" e com vírgula decimal (abre direto no Excel). */
export function formatarCelula(valor: unknown, tipo: TipoColuna = "texto", csv = false): string {
  if (valor === null || valor === undefined || valor === "") return csv ? "" : "—";
  switch (tipo) {
    case "moeda":
      return csv ? Number(valor).toFixed(2).replace(".", ",") : moeda.format(Number(valor));
    case "numero":
      return csv ? String(valor) : Number(valor).toLocaleString("pt-BR");
    case "pct":
      return typeof valor === "number" ? `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : String(valor);
    case "telefone":
      return formatarTelefone(String(valor));
    case "data":
      return new Date(valor as string | Date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    default:
      return String(valor);
  }
}
