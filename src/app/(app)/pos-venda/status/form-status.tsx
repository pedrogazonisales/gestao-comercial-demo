"use client";

import { useFormAcao } from "@/components/form-acao";
import { acaoSalvarStatus } from "../actions";

type Status = { id?: string; nome: string; ordem: number; finaliza: boolean; ativo: boolean; inicial?: boolean; emUso?: number };

export function LinhaStatus({ status }: { status: Status }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoSalvarStatus);
  const novo = !status.id;
  const prefixo = status.id ?? "novo";
  const campo = "h-9 rounded-md border border-borda bg-superficie px-2 text-sm focus:border-marca focus:outline-none";

  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-center gap-3 border-b border-borda/70 px-4 py-3 last:border-0">
      {status.id && <input type="hidden" name="id" value={status.id} />}
      <label className="sr-only" htmlFor={`ordem-${prefixo}`}>
        Ordem
      </label>
      <input id={`ordem-${prefixo}`} name="ordem" type="number" min={1} max={99} defaultValue={status.ordem} className={`${campo} w-16 text-center`} />
      <label className="sr-only" htmlFor={`nome-${prefixo}`}>
        Nome
      </label>
      <input id={`nome-${prefixo}`} name="nome" defaultValue={status.nome} placeholder={novo ? "Novo status" : undefined} className={`${campo} min-w-48 flex-1`} />
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="finaliza" defaultChecked={status.finaliza} disabled={status.inicial} className="accent-marca" /> Encerra
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="ativo" defaultChecked={status.ativo} disabled={status.inicial} className="accent-marca" /> Ativo
      </label>
      {/* checkbox desabilitado não é enviado: o status inicial segue sempre ativo e sem encerrar */}
      {status.inicial && <input type="hidden" name="ativo" value="on" />}
      <span className="w-24 text-xs text-texto-suave">{status.inicial ? "inicial" : status.emUso ? `${status.emUso} em uso` : ""}</span>
      <button type="submit" disabled={pendente} className="text-xs font-medium text-marca hover:underline disabled:opacity-50">
        {pendente ? "…" : novo ? "Adicionar" : "Salvar"}
      </button>
      {(estado.erro || estado.sucesso) && (
        <p className={`basis-full text-xs ${estado.erro ? "text-erro" : "text-sucesso"}`}>{estado.erro ?? estado.sucesso}</p>
      )}
    </form>
  );
}
