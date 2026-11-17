"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/server/auth";
import { atualizarCliente, criarCliente, ErroCliente, esquemaCliente } from "@/server/services/clientes";
import { errosDoZod, type EstadoForm } from "@/lib/acao";

/** Aceita apenas caminhos internos para o parâmetro "voltar" (evita redirecionamento para sites externos). */
function destinoSeguro(voltar: FormDataEntryValue | null) {
  const v = typeof voltar === "string" ? voltar : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export async function acaoCriarCliente(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("cliente.editar");
  const dados = esquemaCliente.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);

  let id: string;
  try {
    id = (await criarCliente(dados.data, sessao.usuario.id)).id;
  } catch (e) {
    if (e instanceof ErroCliente) return { erro: e.message, campos: { cpf: e.message } };
    throw e;
  }
  revalidatePath("/clientes");
  const voltar = destinoSeguro(form.get("voltar"));
  redirect(voltar ? `${voltar}${voltar.includes("?") ? "&" : "?"}clienteId=${id}` : `/clientes/${id}`);
}

export async function acaoAtualizarCliente(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("cliente.editar");
  const dados = esquemaCliente.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);

  try {
    await atualizarCliente(id, dados.data, sessao.usuario.id);
  } catch (e) {
    if (e instanceof ErroCliente) return { erro: e.message };
    throw e;
  }
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}
