// Regras de prazo do pós-venda (puras; usadas em telas e testes).
import type { CanalContato } from "@prisma/client";
import { assinaturaEmpresa } from "./empresa";

export type Situacao = "concluido" | "atrasado" | "vence-hoje" | "vencendo" | "no-prazo";

const diaSP = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** Dias de calendário (fuso de Brasília) entre agora e a data. Negativo = já passou. */
export function diasAte(data: Date, agora = new Date()) {
  const alvo = Date.parse(`${diaSP(data)}T00:00:00Z`);
  const hoje = Date.parse(`${diaSP(agora)}T00:00:00Z`);
  return Math.round((alvo - hoje) / 86_400_000);
}

/** Data de referência: o próximo contato agendado, se houver; senão o prazo. */
export function dataReferencia(pv: { prazo: Date; proximoContato: Date | null }) {
  return pv.proximoContato ?? pv.prazo;
}

export function situacao(pv: { prazo: Date; proximoContato: Date | null; finalizado: boolean }, alertaDias: number, agora = new Date()): Situacao {
  if (pv.finalizado) return "concluido";
  const ref = dataReferencia(pv);
  if (ref.getTime() < agora.getTime()) return "atrasado";
  const dias = diasAte(ref, agora);
  if (dias <= 0) return "vence-hoje";
  if (dias <= alertaDias) return "vencendo";
  return "no-prazo";
}

export function textoContagem(pv: { prazo: Date; proximoContato: Date | null; finalizado: boolean }, agora = new Date()) {
  if (pv.finalizado) return "Concluído";
  const ref = dataReferencia(pv);
  const dias = diasAte(ref, agora);
  if (ref.getTime() < agora.getTime()) return dias === 0 ? "Atrasado desde hoje" : `Atrasado há ${-dias} dia${dias === -1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Falta 1 dia";
  return `Faltam ${dias} dias`;
}

export const TOM_SITUACAO: Record<Situacao, "erro" | "alerta" | "ouro" | "sucesso" | "neutro"> = {
  atrasado: "erro",
  "vence-hoje": "alerta",
  vencendo: "ouro",
  "no-prazo": "neutro",
  concluido: "sucesso",
};

export const NOME_CANAL: Record<CanalContato, string> = {
  WHATSAPP: "WhatsApp",
  TELEFONE: "Telefone",
  EMAIL: "E-mail",
  PRESENCIAL: "Presencial",
  SMS: "SMS",
  OUTRO: "Outro",
};

/** `empresa` é o nome configurado (EMPRESA.nome); sem ele, a mensagem sai sem a assinatura da empresa. */
export function mensagemPosVenda(empresa: string | null, cliente: string, vendedor: string, produto: string, presente = false) {
  const primeiroNome = cliente.replace(/^\[TESTE\]\s*/, "").split(" ")[0];
  const vendedorNome = vendedor.replace(/^\[TESTE\]\s*/, "").split(" ")[0] + assinaturaEmpresa(empresa);
  if (presente) {
    return `Olá, ${primeiroNome}! Aqui é ${vendedorNome}. Passando para saber se o presente (${produto}) agradou. Ficou tudo certo? Se precisar de troca ou de algum ajuste, estamos à disposição!`;
  }
  return `Olá, ${primeiroNome}! Aqui é ${vendedorNome}. Passando para saber como está sendo sua experiência com ${produto}. Ficou tudo certo? Se precisar de qualquer ajuste ou tiver alguma dúvida, estamos à disposição!`;
}
