"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Headset, Loader2, RotateCcw, X } from "lucide-react";
import { useChatIA } from "@/components/chat-ia";
import { Markdown } from "@/components/markdown";

/** Bolinha de suporte (canto inferior direito) + chat flutuante com o atendente de IA. Presente em todas as telas logadas. */
export function SuporteChat({ empresa, nome, perfilRotulo, sugestoes }: { empresa: string | null; nome: string; perfilRotulo: string; sugestoes: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const { turnos, carregando, perguntar, limpar, fim } = useChatIA("/api/suporte", { maxHistorico: 12, minimo: 2 });
  const caminho = usePathname();
  const campo = useRef<HTMLTextAreaElement>(null);
  const primeiroNome = nome.replace(/^\[TESTE\]\s*/, "").split(" ")[0];

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  // Esc fecha o chat.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  function enviar(texto: string) {
    if (texto.trim().length < 2 || carregando) return;
    setMensagem("");
    perguntar(texto, { pagina: caminho });
  }

  return (
    <div className="print:hidden">
      {aberto && (
        <section
          role="dialog"
          aria-label="Chat de suporte"
          className="fixed inset-x-2 bottom-20 z-50 flex max-h-[min(36rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-borda bg-superficie shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[24rem]"
        >
          <header className="flex items-center justify-between gap-2 bg-marca px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
                <Headset className="size-4" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{empresa ? `Suporte ${empresa}` : "Suporte"}</p>
                <p className="text-[11px] text-white/75">Atendente virtual · dúvidas sobre o sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {turnos.length > 0 && (
                <button type="button" onClick={limpar} disabled={carregando} className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-50" title="Nova conversa">
                  <RotateCcw className="size-4" aria-hidden />
                  <span className="sr-only">Nova conversa</span>
                </button>
              )}
              <button type="button" onClick={() => setAberto(false)} className="rounded-md p-1.5 hover:bg-white/15" title="Fechar">
                <X className="size-4" aria-hidden />
                <span className="sr-only">Fechar</span>
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-fundo/60 px-4 py-4 text-sm" aria-live="polite">
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-superficie px-3 py-2 shadow-sm">
              Olá, {primeiroNome}! Sou o atendente virtual do sistema. Posso explicar como usar as telas disponíveis para o seu perfil (<strong>{perfilRotulo}</strong>). Como posso ajudar?
            </div>
            {turnos.length === 0 && (
              <div className="flex flex-col items-start gap-1.5">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="rounded-full border border-marca/30 bg-superficie px-3 py-1 text-left text-xs text-marca hover:bg-marca-claro"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turnos.map((t, i) =>
              t.papel === "usuario" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-marca px-3 py-2 text-white">{t.texto}</p>
                </div>
              ) : (
                <div key={i} className={`max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm ${t.erro ? "bg-erro-claro text-erro" : "bg-superficie"}`}>
                  {t.texto ? (
                    <Markdown texto={t.texto} />
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-texto-suave">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden /> Digitando…
                    </span>
                  )}
                </div>
              ),
            )}
            <div ref={fim} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-borda bg-superficie p-3"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(mensagem);
            }}
          >
            <label htmlFor="mensagem-suporte" className="sr-only">
              Sua dúvida
            </label>
            <textarea
              id="mensagem-suporte"
              ref={campo}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(mensagem);
                }
              }}
              rows={1}
              maxLength={800}
              placeholder="Escreva sua dúvida…"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-borda bg-fundo/50 px-3 py-2 text-sm focus:border-marca focus:outline-none"
            />
            <button
              type="submit"
              disabled={carregando || mensagem.trim().length < 2}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-marca text-white hover:bg-marca-escuro disabled:opacity-40"
              aria-label="Enviar"
            >
              {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
            </button>
          </form>
          <p className="bg-superficie px-3 pb-2 text-[10px] text-texto-suave">Respostas geradas por IA. Não envie senhas nem dados de clientes.</p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar o chat de suporte" : "Abrir o chat de suporte"}
        title="Suporte"
        className="fixed right-5 bottom-5 z-50 flex size-14 items-center justify-center rounded-full bg-marca text-white shadow-lg ring-4 ring-ouro/30 transition-transform hover:scale-105 hover:bg-marca-escuro"
      >
        {aberto ? <X className="size-6" aria-hidden /> : <Headset className="size-6" aria-hidden />}
      </button>
    </div>
  );
}
