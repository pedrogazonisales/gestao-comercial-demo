"use client";

import { useEffect, useRef } from "react";
import { Aviso, AreaTexto, Botao, Selecao } from "@/components/ui";
import { useFormAcao } from "@/components/form-acao";
import { NOME_CANAL } from "@/lib/posvenda";
import { acaoContatoPresente } from "../../actions";

export function FormContatoPresente({ id }: { id: string }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoContatoPresente.bind(null, id));
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.sucesso) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} onSubmit={aoEnviar} className="space-y-4" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <Selecao id="canal" rotulo="Canal utilizado *" defaultValue="WHATSAPP" erro={estado.campos?.canal}>
        {Object.entries(NOME_CANAL).map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </Selecao>
      <AreaTexto id="resultado" rotulo="Resultado do contato *" placeholder="Ex.: Cliente vai passar na loja na sexta para ver opções." erro={estado.campos?.resultado} />
      <div className="flex justify-end">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Registrando…" : "Registrar contato"}
        </Botao>
      </div>
    </form>
  );
}
