import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { obterSessao } from "@/server/auth";
import { db } from "@/server/db";
import { registrarAuditoria } from "@/server/auditoria";
import { MODELO_SUPORTE, responderSuporte, type EventoChat } from "@/server/suporte/agente";

export const maxDuration = 60;

const LIMITE_POR_HORA = 40;

const esquema = z.object({
  pergunta: z.string().trim().min(2, "Escreva a dúvida").max(800, "Mensagem muito longa"),
  historico: z
    .array(z.object({ papel: z.enum(["usuario", "assistente"]), texto: z.string().max(6000) }))
    .max(12)
    .default([]),
  pagina: z.string().max(120).regex(/^\/[\w\-/]*$/).catch("/"),
});

const json = (status: number, mensagem: string) => Response.json({ erro: mensagem }, { status });

// Qualquer usuário logado pode usar. O PERFIL vem da sessão no servidor (nunca do navegador),
// e define o que o atendente sabe e pode ensinar.
export async function POST(req: Request) {
  const sessao = await obterSessao();
  if (!sessao || sessao.usuario.trocarSenha) return json(401, "Sessão expirada. Entre novamente.");
  if (!process.env.ANTHROPIC_API_KEY) return json(503, "O chat de suporte ainda não está ativo. Enquanto isso, procure o gerente da sua loja ou o administrador.");

  let dados: z.infer<typeof esquema>;
  try {
    dados = esquema.parse(await req.json());
  } catch {
    return json(400, "Mensagem inválida.");
  }

  const usadas = await db.auditLog.count({
    where: { acao: "SUPORTE_PERGUNTA", usuarioId: sessao.usuario.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (usadas >= LIMITE_POR_HORA) return json(429, `Limite de ${LIMITE_POR_HORA} mensagens por hora atingido. Tente mais tarde.`);

  const codificador = new TextEncoder();
  const corpo = new ReadableStream({
    async start(controle) {
      const emitir = (e: EventoChat) => controle.enqueue(codificador.encode(JSON.stringify(e) + "\n"));
      try {
        const uso = await responderSuporte({
          pergunta: dados.pergunta,
          historico: dados.historico,
          perfil: sessao.usuario.perfil,
          nome: sessao.usuario.nome,
          pagina: dados.pagina,
          emitir,
        });
        await registrarAuditoria(db, {
          usuarioId: sessao.usuario.id,
          acao: "SUPORTE_PERGUNTA",
          entidade: "Suporte",
          detalhes: { perfil: sessao.usuario.perfil, pagina: dados.pagina, modelo: MODELO_SUPORTE, ...uso },
        });
      } catch (e) {
        console.error("Suporte:", e);
        emitir({
          t: "erro",
          mensagem:
            e instanceof Anthropic.RateLimitError
              ? "O atendimento está ocupado. Tente novamente em instantes."
              : e instanceof Anthropic.AuthenticationError
                ? "O chat de suporte está com problema de configuração. Avise o administrador."
                : "Não foi possível responder agora. Tente novamente.",
        });
      } finally {
        controle.close();
      }
    },
  });

  return new Response(corpo, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
