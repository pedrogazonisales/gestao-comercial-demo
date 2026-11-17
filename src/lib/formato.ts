import { somenteDigitos } from "./cpf";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number | string | { toString(): string } | null | undefined) {
  return moeda.format(Number(valor ?? 0));
}

export function formatarData(data: Date | string | null | undefined) {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Para campos só de data (@db.Date, gravados à meia-noite UTC): não converte fuso, senão volta um dia. */
export function formatarDataSemHora(data: Date | string | null | undefined) {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatarDataHora(data: Date | string | null | undefined) {
  if (!data) return "—";
  return new Date(data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function formatarTelefone(valor: string | null | undefined) {
  const d = somenteDigitos(valor ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor ?? "";
}

export function formatarCep(valor: string | null | undefined) {
  const d = somenteDigitos(valor ?? "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (valor ?? "");
}

/** Converte "1.234,56" ou "1234.56" em número. Retorna NaN se inválido. */
export function lerValorMonetario(valor: string) {
  const limpo = valor.trim().replace(/[R$\s]/g, "");
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return normalizado === "" ? NaN : Number(normalizado);
}

/** Link para conversa no WhatsApp (sem integração paga). */
export function linkWhatsapp(celular: string | null | undefined, mensagem?: string) {
  const d = somenteDigitos(celular ?? "");
  if (d.length < 10) return null;
  const numero = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}
