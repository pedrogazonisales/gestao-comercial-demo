import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { hojeSP } from "@/lib/venda";
import { diasAteData, proximaOcorrenciaLembrete } from "@/lib/presente";
import { db } from "../db";
import { configNumero } from "../config";
import { pode } from "../permissoes";
import type { SessaoAtual } from "../auth";

export class ErroPresente extends Error {}

const diaBrasilia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** Presentes com data, de vendas válidas. Vendedor só enxerga os das próprias vendas; gerente e admin, todos. */
function escopoPresentes(sessao: SessaoAtual): Prisma.PresenteClienteWhereInput {
  const gestor = pode(sessao.usuario.perfil, "venda.verTodas");
  return {
    data: { not: null },
    venda: { status: "CONFIRMADA", ...(!gestor && { vendedorId: sessao.usuario.vendedor?.id ?? "__nenhum__" }) },
  };
}

const incluirPresente = {
  cliente: { select: { id: true, nome: true, nomeSocial: true, celular: true, consentimentoContato: true } },
  venda: {
    select: {
      id: true,
      numero: true,
      dataHora: true,
      vendedorId: true,
      vendedor: { select: { nome: true } },
      loja: { select: { nome: true } },
      itens: { select: { quantidade: true, variacao: { select: { produto: { select: { nome: true } } } } } },
    },
  },
  contatos: { orderBy: { data: "desc" }, include: { usuario: { select: { nome: true } } } },
} satisfies Prisma.PresenteClienteInclude;

type PresenteCompleto = Prisma.PresenteClienteGetPayload<{ include: typeof incluirPresente }>;

function comOcorrencia(p: PresenteCompleto, hoje: string) {
  const ocorrencia = proximaOcorrenciaLembrete(p.data!, diaBrasilia(p.venda.dataHora), hoje);
  const ano = ocorrencia.getUTCFullYear();
  return { ...p, ocorrencia, dias: diasAteData(ocorrencia, hoje), contatadoNoAno: p.contatos.some((c) => c.ano === ano) };
}

/** Datas de presente de anos anteriores que estão chegando (calculado na hora; não depende de rotina agendada). */
export async function listarLembretesPresente(sessao: SessaoAtual, filtro: { vendedorId?: string; lojaId?: string; busca?: string } = {}) {
  const hoje = hojeSP();
  const antecedencia = await configNumero("presente.antecedenciaDias", 30);
  const termo = filtro.busca?.trim();
  const presentes = await db.presenteCliente.findMany({
    where: {
      AND: [
        escopoPresentes(sessao),
        ...(filtro.vendedorId ? [{ venda: { vendedorId: filtro.vendedorId } }] : []),
        ...(filtro.lojaId ? [{ venda: { lojaId: filtro.lojaId } }] : []),
        ...(termo ? [{ cliente: { nome: { contains: termo, mode: "insensitive" as const } } }] : []),
      ],
    },
    include: incluirPresente,
  });
  return presentes
    .map((p) => comOcorrencia(p, hoje))
    .filter((p) => p.dias <= antecedencia)
    .sort((a, b) => Number(a.contatadoNoAno) - Number(b.contatadoNoAno) || a.dias - b.dias);
}

export async function buscarPresente(id: string, sessao: SessaoAtual) {
  const p = await db.presenteCliente.findFirst({ where: { AND: [{ id }, escopoPresentes(sessao)] }, include: incluirPresente });
  return p && comOcorrencia(p, hojeSP());
}

export const esquemaContatoPresente = z.object({
  canal: z.enum(["WHATSAPP", "TELEFONE", "EMAIL", "PRESENCIAL", "SMS", "OUTRO"], { message: "Selecione o canal" }),
  resultado: z.string().trim().min(5, "Descreva o resultado do contato").max(2000),
});

export async function registrarContatoPresente(id: string, d: z.infer<typeof esquemaContatoPresente>, sessao: SessaoAtual) {
  const p = await buscarPresente(id, sessao);
  if (!p) throw new ErroPresente("Presente não encontrado ou sem permissão.");
  await db.presenteContato.create({
    data: { presenteId: id, ano: p.ocorrencia.getUTCFullYear(), usuarioId: sessao.usuario.id, canal: d.canal, resultado: d.resultado },
  });
}
