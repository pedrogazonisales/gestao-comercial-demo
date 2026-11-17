import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { obterSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { registrarAuditoria } from "@/server/auditoria";
import { MODELO, responderPergunta, type EventoAssistente } from "@/server/assistente/agente";
import { hojeSP } from "@/lib/venda";

// Perguntas que consultam vários relatórios podem levar dezenas de segundos.
export const maxDuration = 60;

const LIMITE_POR_HORA = 30;

const esquema = z.object({
  pergunta: z.string().trim().min(3, "Escreva a pergunta").max(1000, "Pergunta muito longa"),
  historico: z
    .array(z.object({ papel: z.enum(["usuario", "assistente"]), texto: z.string().max(8000) }))
    .max(10)
    .default([]),
});

const json = (status: number, mensagem: string) => Response.json({ erro: mensagem }, { status });

export async function POST(req: Request) {
  const sessao = await obterSessao();
  if (!sessao || sessao.usuario.trocarSenha) return json(401, "Sessão expirada. Entre novamente.");
  if (!pode(sessao.usuario.perfil, "relatorio.ver")) return json(403, "Seu perfil não tem acesso ao assistente.");
  if (!process.env.ANTHROPIC_API_KEY) return json(503, "O assistente de IA ainda não foi configurado (falta a chave da API da Anthropic).");

  let dados: z.infer<typeof esquema>;
  try {
    dados = esquema.parse(await req.json());
  } catch {
    return json(400, "Pergunta inválida.");
  }

  // Limite de uso por pessoa (controle de custo e de abuso).
  const usadas = await db.auditLog.count({
    where: { acao: "ASSISTENTE_PERGUNTA", usuarioId: sessao.usuario.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (usadas >= LIMITE_POR_HORA) return json(429, `Limite de ${LIMITE_POR_HORA} perguntas por hora atingido. Tente mais tarde.`);

  const codificador = new TextEncoder();
  const corpo = new ReadableStream({
    async start(controle) {
      const emitir = (e: EventoAssistente) => controle.enqueue(codificador.encode(JSON.stringify(e) + "\n"));
      try {
        const uso = await responderPergunta({ pergunta: dados.pergunta, historico: dados.historico, hoje: hojeSP(), sessao, emitir });
        await registrarAuditoria(db, {
          usuarioId: sessao.usuario.id,
          acao: "ASSISTENTE_PERGUNTA",
          entidade: "Assistente",
          detalhes: { pergunta: dados.pergunta, modelo: MODELO, ...uso },
        });
      } catch (e) {
        const mensagem =
          e instanceof Anthropic.AuthenticationError
            ? "A chave da API da Anthropic é inválida. Verifique a configuração."
            : e instanceof Anthropic.RateLimitError
              ? "O serviço de IA está ocupado. Tente novamente em instantes."
              : e instanceof Anthropic.APIError
                ? `O serviço de IA respondeu com erro (${e.status ?? "sem código"}). Tente novamente.`
                : "Não foi possível responder agora. Tente novamente.";
        console.error("Assistente:", e);
        emitir({ t: "erro", mensagem });
      } finally {
        controle.close();
      }
    },
  });

  return new Response(corpo, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
