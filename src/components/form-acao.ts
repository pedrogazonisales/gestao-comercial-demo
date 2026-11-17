"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { EstadoForm } from "@/lib/acao";

/**
 * Envia o formulário para uma server action SEM limpar os campos quando há erro
 * (o envio nativo do React 19 reinicia o formulário, apagando o que foi digitado).
 */
export function useFormAcao(
  acao: (estado: EstadoForm, form: FormData) => Promise<EstadoForm>,
  antesDeEnviar?: (dados: FormData) => void,
) {
  const [estado, executar, pendente] = useActionState(acao, {});
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    antesDeEnviar?.(dados);
    startTransition(() => executar(dados));
  }
  return { estado, aoEnviar, pendente };
}

/** Aplica uma máscara ao digitar em um input não controlado. */
export function mascara(formatar: (v: string) => string) {
  return (e: FormEvent<HTMLInputElement>) => {
    e.currentTarget.value = formatar(e.currentTarget.value);
  };
}
