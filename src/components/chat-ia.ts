"use client";

import { useRef, useState } from "react";

export type TurnoChat = { papel: "usuario" | "assistente"; texto: string; erro?: boolean };

/**
 * Conversa com uma rota de IA que responde em NDJSON ({t:"status"|"texto"|"erro"|"fim"}).
 * Usado pelo assistente de gestão (/api/assistente) e pelo chat de suporte (/api/suporte).
 */
export function useChatIA(url: string, opcoes: { maxHistorico: number; minimo: number }) {
  const [turnos, setTurnos] = useState<TurnoChat[]>([]);
  const [status, setStatus] = useState("");
  const [carregando, setCarregando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  async function perguntar(texto: string, extra: Record<string, unknown> = {}) {
    const q = texto.trim();
    if (q.length < opcoes.minimo || carregando) return false;
    // Só turnos bem-sucedidos vão como contexto.
    const historico = turnos.filter((t) => !t.erro).slice(-opcoes.maxHistorico).map(({ papel, texto }) => ({ papel, texto }));
    setTurnos((t) => [...t, { papel: "usuario", texto: q }, { papel: "assistente", texto: "" }]);
    setCarregando(true);
    setStatus("Pensando…");

    const atualizarResposta = (fn: (r: TurnoChat) => TurnoChat) =>
      setTurnos((t) => {
        const copia = [...t];
        copia[copia.length - 1] = fn(copia[copia.length - 1]);
        return copia;
      });

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q, historico, ...extra }),
      });
      if (!resp.ok || !resp.body) {
        const corpo = await resp.json().catch(() => ({}));
        atualizarResposta(() => ({ papel: "assistente", texto: corpo.erro ?? "Não foi possível responder agora.", erro: true }));
        return true;
      }
      const leitor = resp.body.getReader();
      const decodificador = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buffer += decodificador.decode(value, { stream: true });
        const linhas = buffer.split("\n");
        buffer = linhas.pop() ?? "";
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          const e = JSON.parse(linha);
          if (e.t === "status") setStatus(e.texto);
          else if (e.t === "texto") {
            setStatus("");
            atualizarResposta((r) => ({ ...r, texto: r.texto + e.delta }));
          } else if (e.t === "erro") atualizarResposta(() => ({ papel: "assistente", texto: e.mensagem, erro: true }));
        }
        fim.current?.scrollIntoView({ block: "nearest" });
      }
    } catch {
      atualizarResposta(() => ({ papel: "assistente", texto: "Falha de conexão. Tente novamente.", erro: true }));
    } finally {
      setCarregando(false);
      setStatus("");
    }
    return true;
  }

  return { turnos, status, carregando, perguntar, limpar: () => setTurnos([]), fim };
}
