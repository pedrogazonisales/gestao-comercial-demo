"use client";

import { useState } from "react";
import { ArrowUp, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useChatIA } from "@/components/chat-ia";
import { Markdown } from "@/components/markdown";

const EXEMPLOS = [
  "Como foram as vendas deste mês em comparação com o mês passado?",
  "Qual vendedor está deixando de fazer o pós-venda?",
  "Quais produtos estão com estoque baixo e em qual loja?",
  "Quanto temos vencido no crediário e quem são os clientes?",
  "Como cadastro um novo vendedor?",
];

export function AssistenteIA() {
  const { turnos, status, carregando, perguntar, limpar, fim } = useChatIA("/api/assistente", { maxHistorico: 10, minimo: 3 });
  const [pergunta, setPergunta] = useState("");

  function enviar(texto: string) {
    if (texto.trim().length < 3 || carregando) return;
    setPergunta("");
    perguntar(texto);
  }

  return (
    <section className="mb-6 rounded-xl border border-marca/20 bg-superficie shadow-sm" aria-label="Assistente de IA">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-5 py-3">
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Sparkles className="size-5 text-ouro" aria-hidden /> Pergunte ao assistente
        </h2>
        {turnos.length > 0 && (
          <button
            type="button"
            onClick={limpar}
            disabled={carregando}
            className="flex items-center gap-1 text-xs font-medium text-texto-suave hover:text-marca disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Nova conversa
          </button>
        )}
      </div>

      {turnos.length > 0 && (
        <div className="max-h-[32rem] space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
          {turnos.map((t, i) =>
            t.papel === "usuario" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-marca px-4 py-2 text-sm text-white">{t.texto}</p>
              </div>
            ) : (
              <div key={i} className={`max-w-[95%] text-sm leading-relaxed ${t.erro ? "text-erro" : "text-texto"}`}>
                {t.texto ? <Markdown texto={t.texto} /> : null}
                {i === turnos.length - 1 && carregando && status && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-texto-suave">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> {status}
                  </p>
                )}
              </div>
            ),
          )}
          <div ref={fim} />
        </div>
      )}

      <form
        className="flex items-end gap-2 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pergunta);
        }}
      >
        <label htmlFor="pergunta-ia" className="sr-only">
          Sua pergunta
        </label>
        <textarea
          id="pergunta-ia"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(pergunta);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Pergunte sobre as vendas, a equipe, o estoque, os clientes ou sobre como usar o sistema…"
          className="max-h-32 min-h-11 flex-1 resize-y rounded-lg border border-borda bg-fundo/50 px-3 py-2.5 text-sm focus:border-marca focus:outline-none"
        />
        <button
          type="submit"
          disabled={carregando || pergunta.trim().length < 3}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-marca text-white hover:bg-marca-escuro disabled:opacity-40"
          aria-label="Enviar pergunta"
        >
          {carregando ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowUp className="size-5" aria-hidden />}
        </button>
      </form>

      {turnos.length === 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => enviar(ex)}
              className="rounded-full border border-borda px-3 py-1 text-xs text-texto-suave hover:border-marca hover:text-marca"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
      <p className="border-t border-borda px-5 py-2 text-[11px] text-texto-suave">
        Respostas geradas por IA (Claude, da Anthropic) a partir dos dados do sistema, sem CPF, telefone ou endereço de clientes. Confira números importantes nos relatórios.
      </p>
    </section>
  );
}
