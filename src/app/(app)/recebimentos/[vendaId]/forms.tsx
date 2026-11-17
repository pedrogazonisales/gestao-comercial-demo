"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso, AreaTexto, Botao, Campo, Selecao } from "@/components/ui";
import { useFormAcao } from "@/components/form-acao";
import { NOME_CANAL } from "@/lib/posvenda";
import { NOME_STATUS_COBRANCA } from "@/lib/cobranca";
import { acaoEstornarRecebimento, acaoReceberParcela, acaoRegistrarCobranca } from "../actions";

const FORMAS_RECEBIMENTO = { DINHEIRO: "Dinheiro", PIX: "PIX", DEBITO: "Cartão de débito", CREDITO: "Cartão de crédito" };

export function FormReceber({ parcelaId, saldo }: { parcelaId: string; saldo: string }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoReceberParcela.bind(null, parcelaId));
  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-end gap-2" noValidate>
      <div>
        <label htmlFor={`valor-${parcelaId}`} className="block text-xs text-texto-suave">
          Valor (R$)
        </label>
        <input
          id={`valor-${parcelaId}`}
          name="valor"
          inputMode="decimal"
          defaultValue={saldo}
          className="h-9 w-28 rounded-md border border-borda bg-superficie px-2 text-sm focus:border-marca focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor={`forma-${parcelaId}`} className="block text-xs text-texto-suave">
          Forma
        </label>
        <select id={`forma-${parcelaId}`} name="forma" defaultValue="PIX" className="h-9 rounded-md border border-borda bg-superficie px-2 text-sm">
          {Object.entries(FORMAS_RECEBIMENTO).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <Botao type="submit" className="h-9" disabled={pendente}>
        {pendente ? "…" : "Registrar pagamento"}
      </Botao>
      {(estado.erro || estado.campos?.valorCentavos) && <p className="basis-full text-xs text-erro">{estado.campos?.valorCentavos ?? estado.erro}</p>}
    </form>
  );
}

export function FormEstorno({ recebimentoId }: { recebimentoId: string }) {
  const [aberto, setAberto] = useState(false);
  const { estado, aoEnviar, pendente } = useFormAcao(acaoEstornarRecebimento.bind(null, recebimentoId));
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs text-texto-suave hover:text-erro">
        Estornar
      </button>
    );
  }
  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-center gap-2">
      <label htmlFor={`motivo-${recebimentoId}`} className="sr-only">
        Motivo do estorno
      </label>
      <input
        id={`motivo-${recebimentoId}`}
        name="motivo"
        placeholder="Motivo do estorno"
        className="h-8 w-56 rounded-md border border-borda bg-superficie px-2 text-xs focus:border-marca focus:outline-none"
      />
      <button type="submit" disabled={pendente} className="text-xs font-medium text-erro hover:underline">
        {pendente ? "…" : "Confirmar estorno"}
      </button>
      {estado.erro && <span className="text-xs text-erro">{estado.erro}</span>}
    </form>
  );
}

export function FormCobranca({ vendaId, statusAtual, responsaveis, responsavelAtual }: { vendaId: string; statusAtual: string; responsaveis: { id: string; nome: string }[]; responsavelAtual?: string }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoRegistrarCobranca.bind(null, vendaId));
  const [status, setStatus] = useState(statusAtual === "PENDENTE" ? "PRIMEIRA_TENTATIVA" : statusAtual);
  const erro = (c: string) => estado.campos?.[c];
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.sucesso) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} onSubmit={aoEnviar} className="space-y-4" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Selecao id="canal" rotulo="Canal *" defaultValue="WHATSAPP">
          {Object.entries(NOME_CANAL)
            .filter(([v]) => v !== "OUTRO")
            .map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
        </Selecao>
        <Selecao id="statusNovo" rotulo="Status da cobrança *" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(NOME_STATUS_COBRANCA).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Selecao>
        <Selecao id="responsavelId" rotulo="Responsável" defaultValue={responsavelAtual ?? ""}>
          <option value="">Eu mesmo</option>
          {responsaveis.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </Selecao>
        <AreaTexto id="descricao" rotulo="O que aconteceu *" className="sm:col-span-3" placeholder="Ex.: Liguei, cliente disse que paga na sexta-feira." erro={erro("descricao")} />
        {status === "PROMESSA_PAGAMENTO" && (
          <>
            <Campo id="valorPrometido" rotulo="Valor prometido (R$) *" inputMode="decimal" erro={erro("valorPrometido")} />
            <Campo id="dataPromessa" rotulo="Data prometida *" type="date" erro={erro("dataPromessa")} />
          </>
        )}
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Registrando…" : "Registrar cobrança"}
        </Botao>
      </div>
    </form>
  );
}
