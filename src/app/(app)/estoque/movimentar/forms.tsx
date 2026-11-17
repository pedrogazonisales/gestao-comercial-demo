"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso, Botao, Campo, Selecao } from "@/components/ui";
import { useFormAcao } from "@/components/form-acao";
import { acaoDefinirMinimo, acaoMovimentar } from "../actions";

type Loja = { id: string; nome: string; quantidade: number };

const OPERACOES = [
  { valor: "ENTRADA", rotulo: "Entrada", ajuda: "Mercadoria recebida (compra, reposição)." },
  { valor: "AJUSTE", rotulo: "Ajuste por contagem", ajuda: "Informe a quantidade contada na prateleira. O sistema lança a diferença." },
  { valor: "TRANSFERENCIA", rotulo: "Transferência", ajuda: "Envio de peças de uma loja para outra." },
] as const;

export function FormMovimentar({ variacaoId, lojas, lojaAtualId }: { variacaoId: string; lojas: Loja[]; lojaAtualId?: string }) {
  const [operacao, setOperacao] = useState<(typeof OPERACOES)[number]["valor"]>("ENTRADA");
  const { estado, aoEnviar, pendente } = useFormAcao(acaoMovimentar);
  const erro = (c: string) => estado.campos?.[c];
  const info = OPERACOES.find((o) => o.valor === operacao)!;
  const formRef = useRef<HTMLFormElement>(null);

  // Após registrar, limpa quantidade e observação para evitar lançamento repetido.
  useEffect(() => {
    if (!estado.sucesso || !formRef.current) return;
    for (const nome of ["quantidade", "justificativa"]) {
      const campo = formRef.current.elements.namedItem(nome) as HTMLInputElement | null;
      if (campo) campo.value = "";
    }
  }, [estado]);

  return (
    <form ref={formRef} onSubmit={aoEnviar} className="space-y-4" noValidate>
      <input type="hidden" name="variacaoId" value={variacaoId} />
      <input type="hidden" name="operacao" value={operacao} />
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}

      <div role="radiogroup" aria-label="Tipo de movimentação" className="grid gap-2 sm:grid-cols-3">
        {OPERACOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={operacao === o.valor}
            onClick={() => setOperacao(o.valor)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              operacao === o.valor ? "border-marca bg-marca-claro text-marca" : "border-borda bg-superficie hover:border-marca"
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      <p className="text-xs text-texto-suave">{info.ajuda}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao id="lojaId" rotulo={operacao === "TRANSFERENCIA" ? "Loja de origem" : "Loja"} defaultValue={lojaAtualId ?? ""} erro={erro("lojaId")}>
          <option value="">Selecione…</option>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome} (saldo {l.quantidade})
            </option>
          ))}
        </Selecao>
        {operacao === "TRANSFERENCIA" && (
          <Selecao id="destinoId" rotulo="Loja de destino" defaultValue="" erro={erro("destinoId")}>
            <option value="">Selecione…</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </Selecao>
        )}
        <Campo
          id="quantidade"
          rotulo={operacao === "AJUSTE" ? "Quantidade contada" : "Quantidade"}
          type="number"
          min={0}
          step={1}
          erro={erro("quantidade")}
        />
        <Campo
          id="justificativa"
          rotulo={operacao === "AJUSTE" ? "Motivo do ajuste *" : "Observação"}
          placeholder={operacao === "ENTRADA" ? "Ex.: NF 1234 — fornecedor" : operacao === "AJUSTE" ? "Ex.: inventário mensal, peça danificada" : ""}
          erro={erro("justificativa")}
          className={operacao === "TRANSFERENCIA" ? "" : "sm:col-span-2"}
        />
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Registrando…" : `Registrar ${info.rotulo.toLowerCase()}`}
        </Botao>
      </div>
    </form>
  );
}

export function FormMinimo({ variacaoId, lojaId, valor }: { variacaoId: string; lojaId: string; valor: number }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoDefinirMinimo);
  return (
    <form onSubmit={aoEnviar} className="flex items-center justify-end gap-2">
      <input type="hidden" name="variacaoId" value={variacaoId} />
      <input type="hidden" name="lojaId" value={lojaId} />
      <label className="sr-only" htmlFor={`min-${lojaId}`}>
        Estoque mínimo
      </label>
      <input
        id={`min-${lojaId}`}
        name="estoqueMinimo"
        type="number"
        min={0}
        defaultValue={valor}
        className="h-8 w-20 rounded-md border border-borda bg-superficie px-2 text-right text-sm focus:border-marca focus:outline-none"
      />
      <button type="submit" disabled={pendente} className="text-xs font-medium text-marca hover:underline disabled:opacity-50">
        {pendente ? "…" : estado.sucesso ? "Salvo ✓" : "Salvar"}
      </button>
      {estado.erro && <span className="text-xs text-erro">{estado.erro}</span>}
    </form>
  );
}
