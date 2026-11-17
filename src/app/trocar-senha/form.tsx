"use client";

import { useActionState } from "react";
import { Aviso, Botao, Campo } from "@/components/ui";
import { trocarSenha, type EstadoTrocaSenha } from "./actions";

export function FormTrocaSenha() {
  const [estado, acao, enviando] = useActionState<EstadoTrocaSenha, FormData>(trocarSenha, {});

  return (
    <form action={acao} className="space-y-4">
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo id="atual" rotulo="Senha atual" type="password" autoComplete="current-password" required />
      <Campo
        id="nova"
        rotulo="Nova senha"
        type="password"
        autoComplete="new-password"
        ajuda="Mínimo de 10 caracteres, com letras e números."
        required
      />
      <Campo id="confirmacao" rotulo="Confirme a nova senha" type="password" autoComplete="new-password" required />
      <Botao type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar senha"}
      </Botao>
    </form>
  );
}
