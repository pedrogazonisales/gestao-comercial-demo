"use client";

import { Printer } from "lucide-react";
import { Aviso, Botao, Campo } from "@/components/ui";
import { useFormAcao } from "@/components/form-acao";
import { acaoCancelarVenda } from "../actions";

export function BotaoImprimir() {
  return (
    <Botao type="button" variante="secundario" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Imprimir
    </Botao>
  );
}

export function FormCancelarVenda({ vendaId }: { vendaId: string }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acaoCancelarVenda.bind(null, vendaId));
  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm("Confirmar o cancelamento desta venda?")) return e.preventDefault();
        aoEnviar(e);
      }}
      className="space-y-3"
      noValidate
    >
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="flex flex-wrap items-end gap-2">
        <Campo id="motivo" rotulo="Motivo do cancelamento *" className="min-w-64 flex-1" erro={estado.campos?.motivo} />
        <Botao type="submit" variante="perigo" disabled={pendente}>
          {pendente ? "Cancelando…" : "Cancelar venda"}
        </Botao>
      </div>
    </form>
  );
}
