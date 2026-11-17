"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/server/auth";
import { atualizarProduto, criarProduto, ErroProduto, esquemaProduto, validarFoto } from "@/server/services/produtos";
import { ErroEstoque } from "@/server/services/estoque";
import { errosDoZod, type EstadoForm } from "@/lib/acao";

function lerForm(form: FormData) {
  const { foto: _foto, removerFoto: _remover, ...resto } = Object.fromEntries(form);
  return resto;
}

export async function acaoCriarProduto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("produto.editar");
  if (!sessao.loja) return { erro: "Selecione a loja atual antes de cadastrar estoque inicial." };
  const dados = esquemaProduto.safeParse(lerForm(form));
  if (!dados.success) return errosDoZod(dados.error);

  let id: string;
  try {
    const foto = validarFoto(form.get("foto"));
    id = (await criarProduto(dados.data, { usuarioId: sessao.usuario.id, lojaId: sessao.loja.id, foto })).id;
  } catch (e) {
    if (e instanceof ErroProduto || e instanceof ErroEstoque) return { erro: e.message };
    throw e;
  }
  revalidatePath("/produtos");
  redirect(`/produtos/${id}`);
}

export async function acaoAtualizarProduto(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("produto.editar");
  const dados = esquemaProduto.safeParse(lerForm(form));
  if (!dados.success) return errosDoZod(dados.error);

  try {
    const foto = validarFoto(form.get("foto"));
    await atualizarProduto(id, dados.data, { usuarioId: sessao.usuario.id, foto, removerFoto: form.get("removerFoto") === "on" });
  } catch (e) {
    if (e instanceof ErroProduto) return { erro: e.message };
    throw e;
  }
  revalidatePath("/produtos");
  redirect(`/produtos/${id}`);
}
