import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cpfValido, somenteDigitos } from "@/lib/cpf";
import { vazioParaUndefined } from "@/lib/acao";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";

const textoOpcional = (max = 120) => z.preprocess(vazioParaUndefined, z.string().trim().max(max).optional());
const digitosOpcional = (tamanhos: number[], msg: string) =>
  z.preprocess(
    (v) => vazioParaUndefined(typeof v === "string" ? somenteDigitos(v) : v),
    z
      .string()
      .refine((d) => tamanhos.includes(d.length), msg)
      .optional(),
  );

// Celular é obrigatório: sem ele não há pós-venda (diagnóstico da consultoria).
export const esquemaCliente = z.object({
  cpf: z
    .string()
    .transform(somenteDigitos)
    .refine(cpfValido, "CPF inválido"),
  nome: z.string().trim().min(3, "Informe o nome completo").max(150),
  nomeSocial: textoOpcional(150),
  dataNascimento: z.preprocess(
    vazioParaUndefined,
    z.coerce
      .date({ invalid_type_error: "Data inválida" })
      .refine((d) => d <= new Date() && d.getFullYear() >= 1900, "Data de nascimento inválida")
      .optional(),
  ),
  celular: z
    .string()
    .transform(somenteDigitos)
    .refine((d) => d.length === 11 || d.length === 10, "Informe o celular com DDD"),
  telefoneFixo: digitosOpcional([10], "Telefone fixo com DDD (10 dígitos)"),
  email: z.preprocess(vazioParaUndefined, z.string().trim().toLowerCase().email("E-mail inválido").optional()),
  cep: digitosOpcional([8], "CEP deve ter 8 dígitos"),
  uf: z.preprocess(vazioParaUndefined, z.string().trim().toUpperCase().length(2, "UF com 2 letras").optional()),
  cidade: textoOpcional(),
  bairro: textoOpcional(),
  tipoLogradouro: textoOpcional(30),
  logradouro: textoOpcional(150),
  numero: textoOpcional(20),
  complemento: textoOpcional(),
  observacoes: textoOpcional(2000),
  consentimentoContato: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  vendedorResponsavelId: z.preprocess(vazioParaUndefined, z.string().optional()),
});

export type DadosCliente = z.infer<typeof esquemaCliente>;

export class ErroCliente extends Error {}

function paraBanco(d: DadosCliente) {
  return {
    cpf: d.cpf,
    nome: d.nome,
    nomeSocial: d.nomeSocial ?? null,
    dataNascimento: d.dataNascimento ?? null,
    celular: d.celular,
    telefoneFixo: d.telefoneFixo ?? null,
    email: d.email ?? null,
    cep: d.cep ?? null,
    uf: d.uf ?? null,
    cidade: d.cidade ?? null,
    bairro: d.bairro ?? null,
    tipoLogradouro: d.tipoLogradouro ?? null,
    logradouro: d.logradouro ?? null,
    numero: d.numero ?? null,
    complemento: d.complemento ?? null,
    observacoes: d.observacoes ?? null,
    vendedorResponsavelId: d.vendedorResponsavelId ?? null,
  };
}

export async function criarCliente(d: DadosCliente, usuarioId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          ...paraBanco(d),
          consentimentoContato: d.consentimentoContato,
          consentimentoEm: d.consentimentoContato ? new Date() : null,
          criadoPorId: usuarioId,
        },
      });
      await registrarAuditoria(tx, { usuarioId, acao: "CLIENTE_CRIADO", entidade: "Cliente", entidadeId: cliente.id });
      return cliente;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ErroCliente("Já existe um cliente com este CPF.");
    }
    throw e;
  }
}

export async function atualizarCliente(id: string, d: DadosCliente, usuarioId: string) {
  const atual = await db.cliente.findUnique({ where: { id } });
  if (!atual) throw new ErroCliente("Cliente não encontrado.");
  if (atual.cpf !== d.cpf) throw new ErroCliente("O CPF não pode ser alterado. Em caso de erro, procure o administrador.");

  const novos = paraBanco(d);
  // Auditoria guarda só os nomes dos campos alterados, não os valores (LGPD).
  const alterados = (Object.keys(novos) as (keyof typeof novos)[]).filter(
    (k) => String(atual[k] ?? "") !== String(novos[k] ?? ""),
  );
  const consentimentoMudou = atual.consentimentoContato !== d.consentimentoContato;

  return db.$transaction(async (tx) => {
    const cliente = await tx.cliente.update({
      where: { id },
      data: {
        ...novos,
        ...(consentimentoMudou && {
          consentimentoContato: d.consentimentoContato,
          consentimentoEm: d.consentimentoContato ? new Date() : null,
        }),
      },
    });
    if (alterados.length || consentimentoMudou) {
      await registrarAuditoria(tx, {
        usuarioId,
        acao: "CLIENTE_EDITADO",
        entidade: "Cliente",
        entidadeId: id,
        detalhes: { campos: [...alterados, ...(consentimentoMudou ? ["consentimentoContato"] : [])] },
      });
    }
    return cliente;
  });
}

const CAMPOS_COMPLETUDE = ["celular", "email", "dataNascimento", "cep", "logradouro", "numero"] as const;

/** Percentual de preenchimento do cadastro (além de CPF e nome, sempre obrigatórios). */
export function completudeCadastro(c: Partial<Record<(typeof CAMPOS_COMPLETUDE)[number], unknown>>) {
  const preenchidos = CAMPOS_COMPLETUDE.filter((k) => c[k] !== null && c[k] !== undefined && c[k] !== "").length;
  return Math.round((preenchidos / CAMPOS_COMPLETUDE.length) * 100);
}
