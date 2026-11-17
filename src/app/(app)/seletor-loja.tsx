"use client";

import { useRef } from "react";
import { trocarLoja } from "./actions";

export function SeletorLoja({ id, lojas, atual }: { id: string; lojas: { id: string; nome: string }[]; atual?: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={trocarLoja}>
      <label htmlFor={id} className="sr-only">
        Loja atual
      </label>
      <select
        id={id}
        key={atual}
        name="lojaId"
        defaultValue={atual}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 rounded-lg border border-borda bg-superficie px-2 text-sm font-medium text-marca focus:border-marca focus:outline-none"
      >
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
    </form>
  );
}
