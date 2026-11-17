"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso, AreaTexto, Botao, Campo, Selecao } from "@/components/ui";
import { useFormAcao } from "@/components/form-acao";
import { NOME_CANAL } from "@/lib/posvenda";
import { acaoAjustarPrazo, acaoRegistrarInteracao } from "../actions";

type Status = { id: string; nome: string; finaliza: boolean };

export function FormInteracao({ posVendaId, status, statusAtualId, hoje }: { posVendaId: string; status: Status[]; statusAtualId: string; hoje: string }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoRegistrarInteracao.bind(null, posVendaId));
  const erro = (c: string) => estado.campos?.[c];
  // Sugere o próximo passo do fluxo em vez de repetir o status atual.
  const atual = status.findIndex((s) => s.id === statusAtualId);
  const [statusId, setStatusId] = useState(status[Math.min(atual + 1, status.length - 1)]?.id ?? "");
  const finaliza = status.find((s) => s.id === statusId)?.finaliza;
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.sucesso) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} onSubmit={aoEnviar} className="space-y-4" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao id="canal" rotulo="Canal utilizado *" defaultValue="WHATSAPP" erro={erro("canal")}>
          {Object.entries(NOME_CANAL).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Selecao>
        <Selecao id="statusId" rotulo="Novo status *" value={statusId} onChange={(e) => setStatusId(e.target.value)} erro={erro("statusId")}>
          {status.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </Selecao>
        <AreaTexto
          id="resultado"
          rotulo="Resultado do contato *"
          className="sm:col-span-2"
          placeholder="Ex.: Cliente satisfeito com a compra, pediu para avisar quando chegar a nova coleção."
          erro={erro("resultado")}
        />
        {!finaliza && (
          <Campo
            id="proximoContato"
            rotulo="Agendar novo contato"
            type="date"
            min={hoje}
            erro={erro("proximoContato")}
            ajuda="Opcional. O atendimento volta para a fila nessa data."
          />
        )}
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Registrando…" : "Registrar contato"}
        </Botao>
      </div>
    </form>
  );
}

export function FormAjustePrazo({ posVendaId, hoje }: { posVendaId: string; hoje: string }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoAjustarPrazo.bind(null, posVendaId));
  return (
    <form onSubmit={aoEnviar} className="space-y-3" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <Campo id="prazo" rotulo="Novo prazo" type="date" min={hoje} erro={estado.campos?.prazo} />
        <Campo id="motivo" rotulo="Motivo" placeholder="Ex.: cliente viajando até dia 20" erro={estado.campos?.motivo} />
        <Botao type="submit" variante="secundario" disabled={pendente}>
          {pendente ? "Salvando…" : "Ajustar prazo"}
        </Botao>
      </div>
    </form>
  );
}
