"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/server/auth";
import { ErroRecebimento, esquemaRecebimento, estornarRecebimento, receberParcela } from "@/server/services/recebimentos";
import { ErroCobranca, esquemaInteracaoCobranca, registrarInteracaoCobranca } from "@/server/services/cobranca";
import { errosDoZod, type EstadoForm } from "@/lib/acao";
import { lerValorMonetario } from "@/lib/formato";

export async function acaoReceberParcela(parcelaId: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("parcela.receber");
  const valor = lerValorMonetario(String(form.get("valor") ?? ""));
  const dados = esquemaRecebimento.safeParse({
    valorCentavos: Number.isFinite(valor) ? Math.round(valor * 100) : 0,
    forma: form.get("forma"),
    observacao: String(form.get("observacao") ?? "") || undefined,
  });
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await receberParcela(parcelaId, dados.data, { usuarioId: sessao.usuario.id, lojaId: sessao.loja?.id ?? null });
  } catch (e) {
    if (e instanceof ErroRecebimento) return { erro: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { sucesso: "Pagamento registrado." };
}

export async function acaoEstornarRecebimento(recebimentoId: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("parcela.estornar");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { erro: "Informe o motivo do estorno." };
  try {
    await estornarRecebimento(recebimentoId, motivo, sessao.usuario.id);
  } catch (e) {
    if (e instanceof ErroRecebimento) return { erro: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { sucesso: "Recebimento estornado." };
}

export async function acaoRegistrarCobranca(vendaId: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await exigirSessao("cobranca.gerenciar");
  const dados = esquemaInteracaoCobranca.safeParse(Object.fromEntries(form));
  if (!dados.success) return errosDoZod(dados.error);
  try {
    await registrarInteracaoCobranca(vendaId, dados.data, sessao.usuario.id);
  } catch (e) {
    if (e instanceof ErroCobranca) return { erro: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { sucesso: "Cobrança registrada." };
}
