"use client";

import { useActionState } from "react";
import { Aviso, Botao, Campo, Selecao } from "@/components/ui";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin({ lojas }: { lojas: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4">
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo id="login" rotulo="Usuário" autoComplete="username" autoCapitalize="none" required defaultValue={estado.login} />
      <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" required autoFocus={Boolean(estado.erro)} />
      {/* key força o select a reaplicar a loja escolhida depois de um erro */}
      <Selecao key={estado.lojaId} id="lojaId" rotulo="Loja em que você está" required defaultValue={estado.lojaId ?? ""}>
        <option value="" disabled>
          Selecione…
        </option>
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </Selecao>
      <Botao type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
