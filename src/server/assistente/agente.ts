import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { EMPRESA } from "@/lib/empresa";
import type { SessaoAtual } from "../auth";
import { TIPOS_RELATORIO, type TipoRelatorio } from "../services/relatorios";
import { consultarEstoque, consultarIndicadores, consultarRelatorio, listarCadastrosBase } from "./consultas";
import { MANUAL_USUARIO } from "./manual";

export const MODELO = "claude-opus-5-5";

export type EventoAssistente =
  | { t: "status"; texto: string }
  | { t: "texto"; delta: string }
  | { t: "fim"; tokensEntrada: number; tokensSaida: number }
  | { t: "erro"; mensagem: string };

export type TurnoHistorico = { papel: "usuario" | "assistente"; texto: string };

// Prompt de sistema fixo (sem data nem dados variáveis) para aproveitar o cache de prompt entre perguntas.
// A empresa e o ramo vêm da configuração da instalação (fixos enquanto o servidor roda, então o cache continua valendo).
const SISTEMA = `Você é o assistente de gestão do sistema de gestão comercial ${EMPRESA.nome ? `da empresa ${EMPRESA.nome}` : "desta empresa"}, que atua no ramo de ${EMPRESA.ramo} e pode ter uma ou mais lojas (consulte os cadastros para saber quais).
Quem conversa com você é o dono ou um gerente. Responda em português do Brasil, de forma direta e cordial, como um consultor de varejo.

Como trabalhar:
- Para qualquer número da operação (vendas, faturamento, vendedores, produtos, estoque, clientes, pós-venda, inadimplência), consulte as ferramentas. Nunca invente nem estime números que as ferramentas não trouxeram.
- Se a pergunta não disser o período, use o mês atual e diga isso na resposta. Converta períodos como "semana passada" ou "outubro" em datas AAAA-MM-DD a partir da data de hoje informada na mensagem.
- Use mais de uma ferramenta quando precisar comparar (por exemplo, dois períodos ou duas lojas).
- Diga sempre o período e os filtros dos números que apresentar. Valores em reais, no formato brasileiro (R$ 1.234,56).
- Depois dos números, quando fizer sentido, traga uma leitura breve e prática para a gestão (o que chama atenção e uma sugestão de ação). Não exagere em conclusões com poucos dados.
- Para dúvidas sobre como usar o sistema, responda com base no manual abaixo. Se o manual não cobrir, diga que não sabe em vez de supor.
- Você só consulta dados; não altera nada no sistema. Se pedirem para registrar, cancelar ou mudar algo, explique onde fazer isso no sistema.
- Privacidade (LGPD): você não tem acesso a CPF, telefone, e-mail ou endereço de clientes e não deve pedir esses dados.
- Registros com "[TESTE]" no nome são registros de teste; avise quando aparecerem.
- Formato: respostas curtas, com listas ou tabelas simples em markdown quando ajudarem. Sem títulos grandes.

Manual de uso do sistema (referência para dúvidas de uso):
<manual>
${MANUAL_USUARIO}
</manual>`;

const periodo = {
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial AAAA-MM-DD. Padrão: primeiro dia do mês atual."),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final AAAA-MM-DD. Padrão: hoje."),
  loja: z.string().optional().describe("Nome da loja, como aparece nos cadastros. Omitir para todas."),
  vendedor: z.string().optional().describe("Nome do vendedor. Omitir para todos."),
};

function criarFerramentas(sessao: SessaoAtual, emitir: (e: EventoAssistente) => void) {
  const tiposRelatorio = TIPOS_RELATORIO.map((t) => t.chave) as [TipoRelatorio, ...TipoRelatorio[]];
  const rotulo = Object.fromEntries(TIPOS_RELATORIO.map((t) => [t.chave, t.rotulo]));
  return [
    betaZodTool({
      name: "consultar_relatorio",
      description:
        "Gera um dos relatórios gerenciais do sistema e devolve resumo e linhas. Tipos: vendas (faturamento por dia/semana/mês), vendedores (ranking, ticket, descontos, margem, pós-venda), produtos (mais vendidos, com margem), menos-vendidos (incluindo sem venda e estoque parado), clientes-recorrentes, clientes-inativos (sem compras há muito tempo), aniversariantes (mês da data final), pos-venda (execução por vendedor), inadimplencia (por mês de vencimento; período = vencimento), estoque-baixo.",
      inputSchema: z.object({
        tipo: z.enum(tiposRelatorio),
        ...periodo,
        agrupar: z.enum(["dia", "semana", "mes"]).optional().describe("Só para tipo=vendas."),
      }),
      eager_input_streaming: true,
      run: async (input) => {
        emitir({ t: "status", texto: `Consultando o relatório “${rotulo[input.tipo]}”…` });
        return JSON.stringify(await consultarRelatorio(input));
      },
    }),
    betaZodTool({
      name: "consultar_indicadores",
      description:
        "Painel geral de um período: faturamento, número de vendas, ticket médio, descontos, comparação com o período anterior de mesma duração, hoje e mês atual, vendas por dia, por vendedor e por loja, mais vendidos, estoque baixo, clientes, pós-vendas pendentes/atrasados, inadimplência e total a receber.",
      inputSchema: z.object(periodo),
      eager_input_streaming: true,
      run: async (input) => {
        emitir({ t: "status", texto: "Consultando os indicadores…" });
        return JSON.stringify(await consultarIndicadores(input, sessao));
      },
    }),
    betaZodTool({
      name: "consultar_estoque",
      description: "Procura produtos por nome, código, SKU, marca ou categoria e devolve preço, custo e saldo em cada loja (até 15 variações).",
      inputSchema: z.object({ busca: z.string().min(2).describe("Termo de busca: nome, marca, categoria ou código do produto") }),
      eager_input_streaming: true,
      run: async ({ busca }) => {
        emitir({ t: "status", texto: `Procurando “${busca}” no estoque…` });
        return JSON.stringify(await consultarEstoque(busca));
      },
    }),
    betaZodTool({
      name: "listar_cadastros",
      description: "Lista lojas, vendedores, categorias e configurações do sistema (prazos de pós-venda, parcelas máximas etc.).",
      inputSchema: z.object({}),
      eager_input_streaming: true,
      run: async () => {
        emitir({ t: "status", texto: "Consultando cadastros…" });
        return JSON.stringify(await listarCadastrosBase());
      },
    }),
  ];
}

export async function responderPergunta(p: {
  pergunta: string;
  historico: TurnoHistorico[];
  hoje: string; // AAAA-MM-DD
  sessao: SessaoAtual;
  emitir: (e: EventoAssistente) => void;
}) {
  const client = new Anthropic();
  const dataBR = new Date(`${p.hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...p.historico.map((h) => ({ role: h.papel === "usuario" ? ("user" as const) : ("assistant" as const), content: h.texto })),
    { role: "user", content: `(Hoje é ${dataBR}, ${p.hoje}.)\n\n${p.pergunta}` },
  ];

  const runner = client.beta.messages.toolRunner({
    model: MODELO,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // Se um classificador de segurança recusar por engano, a API refaz a pergunta em outro modelo adequado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: SISTEMA,
    tools: criarFerramentas(p.sessao, p.emitir),
    messages,
    max_iterations: 8,
    stream: true,
  });

  let tokensEntrada = 0;
  let tokensSaida = 0;
  for await (const stream of runner) {
    for await (const evento of stream) {
      if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
        p.emitir({ t: "texto", delta: evento.delta.text });
      }
    }
    const mensagem = await stream.finalMessage();
    tokensEntrada += (mensagem.usage.input_tokens ?? 0) + (mensagem.usage.cache_read_input_tokens ?? 0) + (mensagem.usage.cache_creation_input_tokens ?? 0);
    tokensSaida += mensagem.usage.output_tokens ?? 0;
    if (mensagem.stop_reason === "refusal") {
      p.emitir({ t: "texto", delta: "\n\nNão consegui responder a esta pergunta. Tente reformulá-la." });
    } else if (mensagem.stop_reason === "max_tokens") {
      p.emitir({ t: "texto", delta: "\n\n(A resposta ficou longa demais e foi interrompida. Tente uma pergunta mais específica.)" });
    } else if (mensagem.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: mensagem.content });
    }
  }
  p.emitir({ t: "fim", tokensEntrada, tokensSaida });
  return { tokensEntrada, tokensSaida };
}
