import "server-only";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cpfValido, somenteDigitos } from "@/lib/cpf";
import { vazioParaUndefined } from "@/lib/acao";
import { esquemaNovaSenha } from "@/lib/senha";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";

export class ErroEquipe extends Error {}

const base = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo").max(150),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado"),
  email: z.preprocess(vazioParaUndefined, z.string().trim().toLowerCase().email("E-mail inválido").optional()),
  perfil: z.enum(["ADMIN", "GERENTE", "VENDEDOR"], { message: "Selecione o perfil" }),
  lojaPadraoId: z.preprocess(vazioParaUndefined, z.string().optional()),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  realizaVendas: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  cpf: z.preprocess(vazioParaUndefined, z.string().transform(somenteDigitos).optional()),
  telefone: z.preprocess(vazioParaUndefined, z.string().transform(somenteDigitos).optional()),
  dataAdmissao: z.preprocess(vazioParaUndefined, z.coerce.date({ invalid_type_error: "Data inválida" }).optional()),
});

// Quem realiza vendas precisa de CPF e data de admissão (cadastro de vendedor).
const comRegrasDeVendedor = <T extends z.ZodTypeAny>(s: T) =>
  s.superRefine((d: z.infer<typeof base>, ctx) => {
    if (!d.realizaVendas) return;
    if (!d.cpf || !cpfValido(d.cpf)) ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF válido é obrigatório para vendedores" });
    if (!d.dataAdmissao) ctx.addIssue({ code: "custom", path: ["dataAdmissao"], message: "Informe a data de admissão" });
  });

export const esquemaNovoUsuario = comRegrasDeVendedor(base.extend({ senha: esquemaNovaSenha }));
export const esquemaEdicaoUsuario = comRegrasDeVendedor(base);

type DadosUsuario = z.infer<typeof base>;

async function sincronizarVendedor(tx: Prisma.TransactionClient, usuarioId: string, d: DadosUsuario) {
  const existente = await tx.vendedor.findUnique({ where: { usuarioId } });
  if (d.realizaVendas) {
    const dados = {
      nome: d.nome,
      cpf: d.cpf!,
      telefone: d.telefone ?? null,
      email: d.email ?? null,
      dataAdmissao: d.dataAdmissao!,
      ativo: d.ativo,
    };
    if (existente) await tx.vendedor.update({ where: { id: existente.id }, data: dados });
    else await tx.vendedor.create({ data: { ...dados, usuarioId } });
  } else if (existente?.ativo) {
    // Mantém o cadastro (histórico de vendas), apenas desativa.
    await tx.vendedor.update({ where: { id: existente.id }, data: { ativo: false } });
  }
}

function traduzirUnico(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const alvo = String((e.meta?.target as string[] | undefined)?.join(",") ?? "");
    if (alvo.includes("login")) throw new ErroEquipe("Este login já está em uso.");
    if (alvo.includes("email")) throw new ErroEquipe("Este e-mail já está em uso por outro usuário.");
    if (alvo.includes("cpf")) throw new ErroEquipe("Já existe um vendedor com este CPF.");
  }
  throw e;
}

export async function criarUsuario(d: z.infer<typeof esquemaNovoUsuario>, adminId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: d.nome,
          login: d.login,
          email: d.email ?? null,
          perfil: d.perfil,
          lojaPadraoId: d.lojaPadraoId ?? null,
          ativo: d.ativo,
          senhaHash: await bcrypt.hash(d.senha, 12),
          trocarSenha: true,
        },
      });
      await sincronizarVendedor(tx, usuario.id, d);
      await registrarAuditoria(tx, {
        usuarioId: adminId,
        acao: "USUARIO_CRIADO",
        entidade: "Usuario",
        entidadeId: usuario.id,
        detalhes: { perfil: d.perfil, realizaVendas: d.realizaVendas },
      });
      return usuario;
    });
  } catch (e) {
    traduzirUnico(e);
  }
}

export async function atualizarUsuario(id: string, d: DadosUsuario, adminId: string) {
  const atual = await db.usuario.findUnique({ where: { id } });
  if (!atual) throw new ErroEquipe("Usuário não encontrado.");

  const deixaDeSerAdminAtivo = atual.perfil === "ADMIN" && atual.ativo && (d.perfil !== "ADMIN" || !d.ativo);
  if (deixaDeSerAdminAtivo) {
    if (id === adminId) throw new ErroEquipe("Você não pode remover seu próprio acesso de administrador.");
    const outrosAdmins = await db.usuario.count({ where: { perfil: "ADMIN", ativo: true, id: { not: id } } });
    if (outrosAdmins === 0) throw new ErroEquipe("O sistema precisa de pelo menos um administrador ativo.");
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: { nome: d.nome, login: d.login, email: d.email ?? null, perfil: d.perfil, lojaPadraoId: d.lojaPadraoId ?? null, ativo: d.ativo },
      });
      await sincronizarVendedor(tx, id, d);
      // Perfil ou status mudou: derruba as sessões para valer imediatamente.
      if (atual.perfil !== d.perfil || atual.ativo !== d.ativo) await tx.sessao.deleteMany({ where: { usuarioId: id } });
      await registrarAuditoria(tx, {
        usuarioId: adminId,
        acao: "USUARIO_EDITADO",
        entidade: "Usuario",
        entidadeId: id,
        detalhes: { perfilAnterior: atual.perfil, perfil: d.perfil, ativoAnterior: atual.ativo, ativo: d.ativo },
      });
    });
  } catch (e) {
    traduzirUnico(e);
  }
}

export async function redefinirSenha(id: string, senha: string, adminId: string) {
  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { senhaHash: await bcrypt.hash(senha, 12), trocarSenha: true } });
    await tx.sessao.deleteMany({ where: { usuarioId: id } });
    await tx.auditLog.deleteMany({ where: { acao: "LOGIN_FALHOU", entidadeId: (await tx.usuario.findUniqueOrThrow({ where: { id } })).login } });
    await registrarAuditoria(tx, { usuarioId: adminId, acao: "SENHA_REDEFINIDA", entidade: "Usuario", entidadeId: id });
  });
}
