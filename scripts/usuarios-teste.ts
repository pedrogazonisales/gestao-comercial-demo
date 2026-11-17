// Cria (ou redefine) usuários de TESTE para validar o sistema no ambiente de desenvolvimento.
// Senhas em .env.teste (gerado localmente, fora do Git). Login sempre começa com "teste.".
// Uso: npx tsx scripts/usuarios-teste.ts           → cria/redefine
//      npx tsx scripts/usuarios-teste.ts --desativar → desativa todos (fazer antes da produção)
import { PrismaClient, type Perfil } from "@prisma/client";
import bcrypt from "bcryptjs";

process.loadEnvFile(".env");
process.loadEnvFile(".env.teste");

const db = new PrismaClient();

const USUARIOS: { login: string; nome: string; perfil: Perfil; trocarSenha: boolean }[] = [
  { login: "teste.admin", nome: "[TESTE] Administrador", perfil: "ADMIN", trocarSenha: false },
  { login: "teste.gerente", nome: "[TESTE] Gerente", perfil: "GERENTE", trocarSenha: false },
  // A troca obrigatória de senha já foi validada (2026-10-31); manter false agiliza os testes.
  { login: "teste.vendedor", nome: "[TESTE] Vendedor", perfil: "VENDEDOR", trocarSenha: false },
];

async function main() {
  if (process.argv.includes("--desativar")) {
    const r = await db.usuario.updateMany({ where: { login: { startsWith: "teste." } }, data: { ativo: false } });
    console.log(`${r.count} usuário(s) de teste desativado(s).`);
    return;
  }
  const senha = process.env.TESTE_SENHA;
  if (!senha) throw new Error("TESTE_SENHA ausente em .env.teste");
  const senhaHash = await bcrypt.hash(senha, 10);
  for (const u of USUARIOS) {
    await db.usuario.upsert({
      where: { login: u.login },
      update: { senhaHash, trocarSenha: u.trocarSenha, ativo: true },
      create: { ...u, senhaHash },
    });
    await db.sessao.deleteMany({ where: { usuario: { login: u.login } } });
  }
  // Limpa bloqueios de login de testes anteriores.
  await db.auditLog.deleteMany({ where: { acao: "LOGIN_FALHOU", entidadeId: { startsWith: "teste." } } });
  console.log(`Usuários de teste prontos: ${USUARIOS.map((u) => u.login).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
