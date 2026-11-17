// Carga inicial obrigatória do sistema (dados reais de funcionamento, não fictícios):
// lojas, fluxo de status do pós-venda, configurações padrão e o primeiro administrador.
// Pode ser executado mais de uma vez sem duplicar registros.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Lojas da empresa: SEED_LOJAS no .env, com os nomes separados por ponto e vírgula
// (ex.: SEED_LOJAS="Matriz;Filial Centro"). Sem a variável, cria uma única "Loja principal".
// Os códigos seguem a ordem (L01, L02…): para acrescentar uma loja depois, ponha o nome no fim da lista.
const LOJAS = (process.env.SEED_LOJAS ?? "")
  .split(";")
  .map((nome) => nome.trim())
  .filter(Boolean)
  .concat(process.env.SEED_LOJAS?.trim() ? [] : ["Loja principal"])
  .map((nome, i) => ({ codigo: `L${String(i + 1).padStart(2, "0")}`, nome }));

const STATUS_POS_VENDA = [
  { nome: "Aguardando contato", ordem: 1, inicial: true, finaliza: false },
  { nome: "Contato realizado", ordem: 2, inicial: false, finaliza: false },
  { nome: "Aguardando resposta do cliente", ordem: 3, inicial: false, finaliza: false },
  { nome: "Resposta recebida", ordem: 4, inicial: false, finaliza: false },
  { nome: "Atendimento concluído", ordem: 5, inicial: false, finaliza: true },
  { nome: "Necessita de novo contato", ordem: 6, inicial: false, finaliza: false },
];

const CONFIGURACOES: Record<string, unknown> = {
  "posvenda.prazoDias": 7,
  "posvenda.alertaDias": 2, // destaca quando faltam 2 dias ou menos
  "presente.antecedenciaDias": 30, // datas de presente aparecem no pós-venda com esta antecedência
  "cliente.inativoDias": 180,
  // Limites padrão — ajustar conforme a política de cada empresa.
  "venda.maxParcelasCredito": 12,
  "venda.maxParcelasCrediario": 10,
  "venda.prazoMaxPrimeiroVencimentoDias": 60,
};

async function main() {
  for (const loja of LOJAS) {
    await db.loja.upsert({ where: { codigo: loja.codigo }, update: {}, create: loja });
  }
  for (const status of STATUS_POS_VENDA) {
    await db.statusPosVenda.upsert({ where: { nome: status.nome }, update: {}, create: status });
  }
  for (const [chave, valor] of Object.entries(CONFIGURACOES)) {
    await db.configuracao.upsert({ where: { chave }, update: {}, create: { chave, valor: valor as never } });
  }

  const totalAdmins = await db.usuario.count({ where: { perfil: "ADMIN" } });
  if (totalAdmins === 0) {
    const login = (process.env.SEED_ADMIN_LOGIN ?? "admin").toLowerCase();
    const senha = process.env.SEED_ADMIN_SENHA;
    if (!senha || senha.length < 10) {
      throw new Error("Defina SEED_ADMIN_SENHA no .env (mínimo 10 caracteres) para criar o primeiro administrador.");
    }
    await db.usuario.create({
      data: {
        nome: process.env.SEED_ADMIN_NOME ?? "Administrador",
        login,
        senhaHash: await bcrypt.hash(senha, 12),
        perfil: "ADMIN",
        trocarSenha: true,
      },
    });
    console.log(`Administrador "${login}" criado. A senha deverá ser trocada no primeiro acesso.`);
  }

  console.log("Carga inicial concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
