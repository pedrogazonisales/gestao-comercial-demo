// Regras das datas de presente (puras; usadas em telas, serviços e testes).
// `data` é só-dia (meia-noite UTC). Datas "AAAA-MM-DD" são dias de Brasília.
import { assinaturaEmpresa } from "./empresa";

const DIA = 86_400_000;
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** A data da comemoração em um ano. 29/02 vira 28/02 em ano não bissexto. */
export function ocorrenciaNoAno(data: Date, ano: number) {
  const mes = data.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(data.getUTCDate(), ultimoDia)));
}

/**
 * Qual ocorrência a compra atendeu. Se o vendedor informou a data do ano da venda (ou vizinho), é ela;
 * se informou uma data antiga (ex.: nascimento), é a ocorrência mais próxima da venda.
 */
export function ocorrenciaAtendida(data: Date, diaVenda: string) {
  const venda = paraData(diaVenda);
  const anoVenda = venda.getUTCFullYear();
  if (Math.abs(data.getUTCFullYear() - anoVenda) <= 1) return ocorrenciaNoAno(data, data.getUTCFullYear());
  return [anoVenda - 1, anoVenda, anoVenda + 1]
    .map((ano) => ocorrenciaNoAno(data, ano))
    .sort((a, b) => Math.abs(a.getTime() - venda.getTime()) - Math.abs(b.getTime() - venda.getTime()))[0];
}

/**
 * Próxima data que deve gerar lembrete: sempre depois da ocorrência que a compra atendeu,
 * considerando também as que passaram há até `toleranciaDias` (para não perder quem não foi contatado a tempo).
 */
export function proximaOcorrenciaLembrete(data: Date, diaVenda: string, hoje: string, toleranciaDias = 7) {
  const atendida = ocorrenciaAtendida(data, diaVenda);
  const limite = paraData(hoje).getTime() - toleranciaDias * DIA;
  for (let ano = paraData(hoje).getUTCFullYear() - 1; ; ano++) {
    const ocorrencia = ocorrenciaNoAno(data, ano);
    if (ocorrencia.getTime() > atendida.getTime() && ocorrencia.getTime() >= limite) return ocorrencia;
  }
}

export function diasAteData(ocorrencia: Date, hoje: string) {
  return Math.round((ocorrencia.getTime() - paraData(hoje).getTime()) / DIA);
}

export function textoDiasPresente(dias: number) {
  if (dias === 0) return "É hoje";
  if (dias === 1) return "É amanhã";
  if (dias > 1) return `Faltam ${dias} dias`;
  return dias === -1 ? "Foi ontem" : `Foi há ${-dias} dias`;
}

/** Dia e mês (a data se repete todo ano). */
export function diaMes(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}

/** `empresa` é o nome configurado (EMPRESA.nome); sem ele, a mensagem sai sem a assinatura da empresa. */
export function mensagemDataPresente(empresa: string | null, cliente: string, vendedor: string, dataTexto: string, observacao?: string | null) {
  const nome = cliente.replace(/^\[TESTE\]\s*/, "").split(" ")[0];
  const quem = vendedor.replace(/^\[TESTE\]\s*/, "").split(" ")[0] + assinaturaEmpresa(empresa);
  const motivo = observacao ? ` (${observacao})` : "";
  return `Olá, ${nome}! Aqui é ${quem}. Vi que a data de ${dataTexto}${motivo} está chegando. Em uma compra anterior ajudamos você a escolher um presente especial. Quer ver algumas opções para este ano?`;
}
