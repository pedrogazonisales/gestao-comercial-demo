import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Perfil } from "@prisma/client";
import { promptSuporte } from "./prompt";

export const MODELO_SUPORTE = "claude-opus-5-5";

export type EventoChat = { t: "texto"; delta: string } | { t: "fim"; tokensEntrada: number; tokensSaida: number } | { t: "erro"; mensagem: string };
export type TurnoChat = { papel: "usuario" | "assistente"; texto: string };

/**
 * Atendente de suporte: SEM ferramentas (não acessa nenhum dado do sistema) e com o conhecimento
 * limitado ao perfil do usuário (ver prompt.ts). Respostas em streaming.
 */
export async function responderSuporte(p: {
  pergunta: string;
  historico: TurnoChat[];
  perfil: Perfil;
  nome: string;
  pagina: string;
  emitir: (e: EventoChat) => void;
}) {
  const client = new Anthropic();
  const primeiroNome = p.nome.replace(/^\[TESTE\]\s*/, "").split(" ")[0];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...p.historico.map((h) => ({ role: h.papel === "usuario" ? ("user" as const) : ("assistant" as const), content: h.texto })),
    // Contexto variável vai na mensagem (não no sistema) para manter o cache do prompt por perfil.
    { role: "user", content: `(Usuário: ${primeiroNome}. Tela atual: ${p.pagina}.)\n\n${p.pergunta}` },
  ];

  const stream = client.beta.messages.stream({
    model: MODELO_SUPORTE,
    max_tokens: 4000,
    output_config: { effort: "low" },
    // Se um classificador de segurança recusar por engano, a API refaz a pergunta em outro modelo adequado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: promptSuporte(p.perfil),
    messages,
  });

  for await (const evento of stream) {
    if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
      p.emitir({ t: "texto", delta: evento.delta.text });
    }
  }
  const mensagem = await stream.finalMessage();
  if (mensagem.stop_reason === "refusal") {
    p.emitir({ t: "texto", delta: "\n\nNão consigo ajudar com isso. Posso tirar dúvidas sobre como usar o sistema." });
  } else if (mensagem.stop_reason === "max_tokens") {
    p.emitir({ t: "texto", delta: "\n\n(Resposta interrompida por ser longa. Pergunte por partes.)" });
  }
  const uso = {
    tokensEntrada: (mensagem.usage.input_tokens ?? 0) + (mensagem.usage.cache_read_input_tokens ?? 0) + (mensagem.usage.cache_creation_input_tokens ?? 0),
    tokensSaida: mensagem.usage.output_tokens ?? 0,
  };
  p.emitir({ t: "fim", ...uso });
  return uso;
}
