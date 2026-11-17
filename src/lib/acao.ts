import type { ZodError } from "zod";

/** Resultado padrão das ações de formulário. */
export type EstadoForm = {
  erro?: string;
  campos?: Record<string, string>;
  sucesso?: string;
};

export function errosDoZod(e: ZodError): EstadoForm {
  const campos: Record<string, string> = {};
  for (const issue of e.issues) {
    const chave = issue.path.join(".");
    if (chave && !campos[chave]) campos[chave] = issue.message;
  }
  return { erro: "Revise os campos destacados.", campos };
}

/** Converte "" em undefined (campos opcionais vindos de FormData). */
export function vazioParaUndefined(v: unknown) {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}
