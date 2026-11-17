// Dados FICTÍCIOS para demonstração: equipe, catálogo, clientes e 18 meses de vendas.
// Todo registro criado aqui tem id começando com "demo_", o que permite removê-los depois.
// Uso: npm run demo            → carrega no banco de .env
//      npm run demo:remover    → remove tudo o que é fictício, inclusive vendas feitas com esses cadastros
//      npm run demo:conferir   → confere se os dados carregados estão coerentes
//      npm run demo:resetar    → remove e carrega de novo (restaura a demonstração do portfólio)
// Celulares usam o prefixo 90000 e e-mails @example.com para nunca alcançar uma pessoa real.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Prisma, PrismaClient, type CanalContato, type FormaPagamento, type StatusCobranca, type StatusParcela } from "@prisma/client";
import bcrypt from "bcryptjs";
import { dividirParcelas, FORMAS, hojeSP, paraReais, somarMesesUTC } from "../src/lib/venda";

try {
  process.loadEnvFile(".env");
} catch {
  /* variáveis já vêm do ambiente */
}
const db = new PrismaClient();

const PREFIXO = "demo_";
const TOTAL_VENDAS = 200;
const TOTAL_CLIENTES = 80;
const MESES = 18;
const DIA_MS = 86_400_000;
const LOTE_SENHA = ".env.demo";

// Sorteio com semente fixa: a mesma carga sempre gera os mesmos dados.
let semente = 20261102;
function r() {
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const inteiro = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const um = <T>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)];
function ponderado<T>(lista: readonly (readonly [T, number])[]) {
  let alvo = r() * lista.reduce((s, [, p]) => s + p, 0);
  for (const [v, p] of lista) {
    alvo -= p;
    if (alvo <= 0) return v;
  }
  return lista[lista.length - 1][0];
}
let sequencia = 0;
const novoId = (tipo: string) => `${PREFIXO}${tipo}_${String(++sequencia).padStart(6, "0")}`;

// ─────────────────────── Catálogo (preços médios de mercado estimados) ───────────────────────

type ItemCatalogo = { codigo: string; nome: string; marca?: string; custo: number; preco: number; variacoes: string[]; peso: number };

const SEM_VARIACAO = ["Padrão"];
const CATALOGO: Record<string, ItemCatalogo[]> = {
  "Óculos de sol masculino": [
    { codigo: "OSM-RB3025", nome: "Óculos de sol Ray-Ban Aviator RB3025", marca: "Ray-Ban", custo: 440, preco: 799, variacoes: ["Dourado / lente verde", "Preto / lente cinza"], peso: 5 },
    { codigo: "OSM-RB2140", nome: "Óculos de sol Ray-Ban Wayfarer RB2140", marca: "Ray-Ban", custo: 420, preco: 749, variacoes: ["Preto", "Tartaruga"], peso: 4 },
    { codigo: "OSM-OO9102", nome: "Óculos de sol Oakley Holbrook OO9102", marca: "Oakley", custo: 390, preco: 699, variacoes: ["Preto fosco"], peso: 3 },
    { codigo: "OSM-CA1007", nome: "Óculos de sol Carrera 1007/S", marca: "Carrera", custo: 300, preco: 549, variacoes: ["Preto", "Azul"], peso: 2 },
  ],
  "Óculos de sol feminino": [
    { codigo: "OSF-RB4171", nome: "Óculos de sol Ray-Ban Erika RB4171", marca: "Ray-Ban", custo: 360, preco: 649, variacoes: ["Tartaruga", "Preto"], peso: 5 },
    { codigo: "OSF-VO5239", nome: "Óculos de sol Vogue VO5239", marca: "Vogue", custo: 240, preco: 449, variacoes: ["Rosé", "Preto"], peso: 4 },
    { codigo: "OSF-MK2140", nome: "Óculos de sol Michael Kors MK2140", marca: "Michael Kors", custo: 510, preco: 899, variacoes: ["Dourado"], peso: 3 },
    { codigo: "OSF-PR17WS", nome: "Óculos de sol Prada PR 17WS", marca: "Prada", custo: 1090, preco: 1890, variacoes: ["Preto"], peso: 1 },
  ],
  "Óculos de grau masculino": [
    { codigo: "OGM-RX5228", nome: "Óculos de grau Ray-Ban RX5228 com lentes", marca: "Ray-Ban", custo: 640, preco: 1290, variacoes: ["Preto / aro 53", "Havana / aro 55"], peso: 5 },
    { codigo: "OGM-OX8141", nome: "Óculos de grau Oakley Crosslink OX8141 com lentes", marca: "Oakley", custo: 760, preco: 1490, variacoes: ["Grafite / aro 54"], peso: 3 },
    { codigo: "OGM-LA2268", nome: "Óculos de grau Lacoste L2268 com lentes", marca: "Lacoste", custo: 490, preco: 990, variacoes: ["Azul / aro 54"], peso: 3 },
  ],
  "Óculos de grau feminino": [
    { codigo: "OGF-RX7047", nome: "Óculos de grau Ray-Ban RX7047 com lentes", marca: "Ray-Ban", custo: 590, preco: 1190, variacoes: ["Preto / aro 54", "Bordô / aro 52"], peso: 5 },
    { codigo: "OGF-AH6247", nome: "Óculos de grau Ana Hickmann AH6247 com lentes", marca: "Ana Hickmann", custo: 530, preco: 1090, variacoes: ["Rosé / aro 53"], peso: 4 },
    { codigo: "OGF-VO5286", nome: "Óculos de grau Vogue VO5286 com lentes", marca: "Vogue", custo: 420, preco: 890, variacoes: ["Vinho / aro 51", "Nude / aro 51"], peso: 3 },
  ],
  Relógios: [
    { codigo: "REL-INV8926", nome: "Relógio Invicta Pro Diver 8926OB automático", marca: "Invicta", custo: 760, preco: 1290, variacoes: SEM_VARIACAO, peso: 2 },
    { codigo: "REL-96A205", nome: "Relógio Bulova Classic 96A205", marca: "Bulova", custo: 1290, preco: 2190, variacoes: SEM_VARIACAO, peso: 2 },
    { codigo: "REL-AW1231", nome: "Relógio Citizen Eco-Drive AW1231", marca: "Citizen", custo: 980, preco: 1690, variacoes: SEM_VARIACAO, peso: 2 },
    { codigo: "REL-F49700", nome: "Relógio Orient Automático F49SS", marca: "Orient", custo: 670, preco: 1150, variacoes: SEM_VARIACAO, peso: 3 },
    { codigo: "REL-2115MM", nome: "Relógio Technos Classic masculino 2115", marca: "Technos", custo: 440, preco: 799, variacoes: SEM_VARIACAO, peso: 4 },
    { codigo: "REL-2035MK", nome: "Relógio Technos Elegance feminino 2035", marca: "Technos", custo: 380, preco: 699, variacoes: ["Dourado", "Prateado"], peso: 4 },
    { codigo: "REL-A168WG", nome: "Relógio Casio Vintage A168", marca: "Casio", custo: 190, preco: 349, variacoes: ["Prateado", "Dourado"], peso: 3 },
  ],
  Pulseiras: [
    { codigo: "PUL-PR925V", nome: "Pulseira de prata 925 veneziana", custo: 105, preco: 229, variacoes: ["19 cm", "21 cm"], peso: 5 },
    { codigo: "PUL-PR925Z", nome: "Pulseira de prata 925 riviera com zircônias", custo: 175, preco: 389, variacoes: ["18 cm"], peso: 4 },
    { codigo: "PUL-OU18EP", nome: "Pulseira de ouro 18k elos portugueses", custo: 1590, preco: 2490, variacoes: ["19 cm"], peso: 2 },
    { codigo: "PUL-COURAC", nome: "Pulseira masculina de couro e aço", custo: 80, preco: 189, variacoes: ["Preta", "Marrom"], peso: 3 },
  ],
  Correntes: [
    { codigo: "COR-PR925G", nome: "Corrente de prata 925 grumet 60 cm", custo: 155, preco: 349, variacoes: SEM_VARIACAO, peso: 5 },
    { codigo: "COR-PR925C", nome: "Corrente de prata 925 cartier 45 cm", custo: 125, preco: 289, variacoes: SEM_VARIACAO, peso: 5 },
    { codigo: "COR-FOLGRU", nome: "Corrente folheada a ouro grumet 60 cm", custo: 105, preco: 249, variacoes: SEM_VARIACAO, peso: 3 },
    { codigo: "COR-OU18VE", nome: "Corrente de ouro 18k veneziana 45 cm", custo: 1150, preco: 1790, variacoes: SEM_VARIACAO, peso: 2 },
    { codigo: "COR-OU18CA", nome: "Corrente de ouro 18k cartier 60 cm", custo: 2790, preco: 4290, variacoes: SEM_VARIACAO, peso: 1 },
  ],
  Serviços: [
    { codigo: "SRV-BATERI", nome: "Troca de bateria de relógio", custo: 12, preco: 45, variacoes: SEM_VARIACAO, peso: 10 },
    { codigo: "SRV-REVREL", nome: "Manutenção de relógio (limpeza e revisão)", custo: 70, preco: 220, variacoes: SEM_VARIACAO, peso: 4 },
    { codigo: "SRV-REVAUT", nome: "Revisão completa de relógio automático", custo: 130, preco: 380, variacoes: SEM_VARIACAO, peso: 2 },
    { codigo: "SRV-LENTVS", nome: "Troca de lentes de óculos (visão simples)", custo: 170, preco: 380, variacoes: SEM_VARIACAO, peso: 5 },
    { codigo: "SRV-LENTMF", nome: "Troca de lentes de óculos (multifocal)", custo: 420, preco: 890, variacoes: SEM_VARIACAO, peso: 3 },
    { codigo: "SRV-ARMACA", nome: "Manutenção de armação de óculos (solda e ajuste)", custo: 20, preco: 90, variacoes: SEM_VARIACAO, peso: 5 },
    { codigo: "SRV-PLAQUE", nome: "Troca de plaquetas e parafusos de óculos", custo: 6, preco: 35, variacoes: SEM_VARIACAO, peso: 4 },
    { codigo: "SRV-APEREL", nome: "Aperto de pulseira de relógio", custo: 3, preco: 25, variacoes: SEM_VARIACAO, peso: 6 },
    { codigo: "SRV-APEJOI", nome: "Aperto e conserto de pulseira de joia", custo: 8, preco: 40, variacoes: SEM_VARIACAO, peso: 3 },
  ],
};
const PESO_CATEGORIA = [
  ["Óculos de grau masculino", 15],
  ["Óculos de grau feminino", 18],
  ["Óculos de sol masculino", 14],
  ["Óculos de sol feminino", 16],
  ["Relógios", 17],
  ["Pulseiras", 10],
  ["Correntes", 10],
] as const;

// ─────────────────────── Pessoas ───────────────────────

const EQUIPE: Record<string, { gerente: string; vendedores: [string, string] }> = {
  L01: { gerente: "Marcos Vinícius Teles", vendedores: ["Juliana Prado Rocha", "Felipe Nogueira Dias"] },
  L02: { gerente: "Patrícia Almeida Fontes", vendedores: ["Bruno Cardoso Lima", "Camila Rezende Souza"] },
  L03: { gerente: "Renata Moraes Queiroz", vendedores: ["Thiago Barbosa Martins", "Larissa Pacheco Reis"] },
  L04: { gerente: "Eduardo Figueira Campos", vendedores: ["Aline Cavalcante Pires", "Rafael Tavares Moura"] },
};
const PESO_LOJA = [["L03", 30], ["L04", 30], ["L02", 22], ["L01", 18]] as const;

const NOMES = ["Ana", "Maria", "Beatriz", "Fernanda", "Carla", "Sandra", "Luciana", "Vanessa", "Gabriela", "Mariana", "Tatiane", "Simone", "Débora", "Cláudia", "Letícia", "Paula", "Roberta", "Helena", "Isabela", "Adriana", "João", "José", "Carlos", "Paulo", "Ricardo", "André", "Rodrigo", "Marcelo", "Gustavo", "Leandro", "Fábio", "Daniel", "Lucas", "Mateus", "Sérgio", "Antônio", "Vinícius", "Diego", "Henrique", "Otávio"];
const SOBRENOMES = ["Silva", "Santos", "Oliveira", "Souza", "Ferreira", "Pereira", "Costa", "Ribeiro", "Gomes", "Martins", "Araújo", "Carvalho", "Mendes", "Barros", "Freitas", "Vieira", "Teixeira", "Correia", "Machado", "Nunes", "Ramos", "Lopes", "Monteiro", "Duarte", "Azevedo", "Batista"];
const BAIRROS = ["Centro", "Jardim América", "Vila Nova", "Jardim Paulista", "Parque das Flores", "Jardim Europa", "Vila Industrial", "Jardim Primavera", "Vila Esperança", "Cidade Jardim"];
const RUAS = ["das Acácias", "dos Ipês", "das Palmeiras", "São Paulo", "Sete de Setembro", "Quinze de Novembro", "dos Girassóis", "das Orquídeas", "Rui Barbosa", "Tiradentes"];
const CIDADES = [["Campinas", 80], ["Valinhos", 12], ["Vinhedo", 8]] as const;

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function gerarCpf(usados: Set<string>): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => inteiro(0, 9));
    const digito = (nums: number[]) => {
      const soma = nums.reduce((s, n, i) => s + n * (nums.length + 1 - i), 0);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    const d1 = digito(base);
    const cpf = [...base, d1, digito([...base, d1])].join("");
    if (!usados.has(cpf) && !/^(\d)\1{10}$/.test(cpf)) {
      usados.add(cpf);
      return cpf;
    }
  }
}
let contadorCelular = 0;
const celularFicticio = () => `1990000${String(++contadorCelular).padStart(4, "0")}`;

// ─────────────────────── Textos ───────────────────────

const OBS_PRESENTE = [
  "Para a esposa, aniversário",
  "Para o marido, aniversário",
  "Para a mãe, aniversário",
  "Para o pai, aniversário",
  "Para a filha, formatura",
  "Para o filho, aniversário de 18 anos",
  "Para a namorada, aniversário de namoro",
  "Para o namorado, aniversário",
  "Bodas de casamento",
  "Para a irmã, aniversário",
  "Para a sogra, aniversário",
  "Para amiga, aniversário",
];
const RESULTADO_CONTATO = [
  "Cliente satisfeito com a compra, sem nenhuma reclamação.",
  "Agradeceu o contato e elogiou o atendimento na loja.",
  "Produto atendeu às expectativas. Pediu aviso sobre novidades.",
  "Cliente adaptado e satisfeito. Comentou que deve voltar em breve.",
  "Tudo certo com o produto. Disse que indicará a loja para a família.",
  "Ajuste feito na loja resolveu; cliente satisfeito.",
];
const RESULTADO_SEM_RESPOSTA = ["Mensagem enviada, aguardando retorno.", "Telefone chamou e não atendeu. Enviada mensagem.", "Cliente pediu para retornar na próxima semana."];
const RESULTADO_PRESENTE = ["Lembrado da data; cliente agradeceu e vai passar na loja.", "Cliente gostou do lembrete e pediu sugestões de presente.", "Enviadas sugestões por mensagem; retornará perto da data."];
const MOTIVOS_CANCELAMENTO = ["Cliente desistiu da compra no mesmo dia", "Lançamento com produto errado", "Divergência no valor combinado", "Cliente preferiu outro modelo"];

// ─────────────────────── Geração ───────────────────────

type Linha = Record<string, unknown>;

async function carregar() {
  const jaCarregado = await db.venda.count({ where: { id: { startsWith: PREFIXO } } });
  if (jaCarregado > 0) throw new Error(`Já existem ${jaCarregado} vendas fictícias neste banco. Remova-as antes de carregar de novo.`);

  const lojas = await db.loja.findMany();
  const lojaPorCodigo = new Map(lojas.map((l) => [l.codigo, l]));
  for (const codigo of Object.keys(EQUIPE)) if (!lojaPorCodigo.has(codigo)) throw new Error(`Loja ${codigo} não encontrada. Rode o seed.`);
  const statusLista = await db.statusPosVenda.findMany();
  const status = (nome: string) => {
    const s = statusLista.find((x) => x.nome === nome);
    if (!s) throw new Error(`Status de pós-venda "${nome}" não encontrado. Rode o seed.`);
    return s.id;
  };

  const agora = new Date();
  const hoje = new Date(`${hojeSP()}T00:00:00Z`);
  const inicio = somarMesesUTC(hoje, -MESES);
  const limite = (d: Date) => (d > agora ? agora : d);
  const cpfs = new Set((await db.cliente.findMany({ select: { cpf: true } })).map((c) => c.cpf));
  for (const v of await db.vendedor.findMany({ select: { cpf: true } })) cpfs.add(v.cpf);

  // Senha única dos usuários fictícios: fica só neste computador, fora do Git.
  if (!existsSync(LOTE_SENHA)) writeFileSync(LOTE_SENHA, `DEMO_SENHA="${randomBytes(12).toString("base64url")}"\n`);
  const senha = readFileSync(LOTE_SENHA, "utf8").match(/DEMO_SENHA="(.+)"/)?.[1];
  if (!senha) throw new Error(`DEMO_SENHA ausente em ${LOTE_SENHA}`);
  const senhaHash = await bcrypt.hash(senha, 10);

  // Equipe
  const usuarios: Linha[] = [];
  const vendedoresLinhas: Linha[] = [];
  const gerentes = new Map<string, string>();
  const vendedoresDaLoja = new Map<string, { id: string; usuarioId: string }[]>();
  const loginDe = (nome: string) => {
    const p = semAcento(nome).split(" ");
    return `${p[0]}.${p[p.length - 1]}`;
  };
  const admissao = (anos: number) => new Date(Date.UTC(hoje.getUTCFullYear() - anos, inteiro(0, 11), inteiro(1, 28)));
  for (const [codigo, equipe] of Object.entries(EQUIPE)) {
    const lojaId = lojaPorCodigo.get(codigo)!.id;
    const criadoEm = new Date(inicio.getTime() - 30 * DIA_MS);
    const gerenteId = novoId("usu");
    gerentes.set(lojaId, gerenteId);
    usuarios.push({ id: gerenteId, nome: equipe.gerente, login: loginDe(equipe.gerente), email: `${loginDe(equipe.gerente)}@example.com`, senhaHash, perfil: "GERENTE", trocarSenha: false, lojaPadraoId: lojaId, createdAt: criadoEm, updatedAt: criadoEm });
    const lista: { id: string; usuarioId: string }[] = [];
    for (const nome of equipe.vendedores) {
      const usuarioId = novoId("usu");
      const id = novoId("vnd");
      usuarios.push({ id: usuarioId, nome, login: loginDe(nome), email: `${loginDe(nome)}@example.com`, senhaHash, perfil: "VENDEDOR", trocarSenha: false, lojaPadraoId: lojaId, createdAt: criadoEm, updatedAt: criadoEm });
      vendedoresLinhas.push({ id, usuarioId, nome, cpf: gerarCpf(cpfs), telefone: celularFicticio(), email: `${loginDe(nome)}@example.com`, dataAdmissao: admissao(inteiro(2, 6)), createdAt: criadoEm, updatedAt: criadoEm });
      lista.push({ id, usuarioId });
    }
    vendedoresDaLoja.set(lojaId, lista);
  }
  const todosVendedores = [...vendedoresDaLoja.values()].flat();

  // Catálogo: reaproveita categorias e marcas de mesmo nome que já existam.
  const categoriasExistentes = new Map((await db.categoria.findMany()).map((c) => [c.nome, c.id]));
  const marcasExistentes = new Map((await db.marca.findMany()).map((m) => [m.nome, m.id]));
  const categorias: Linha[] = [];
  const marcas: Linha[] = [];
  const produtos: Linha[] = [];
  const variacoes: Linha[] = [];
  type Var = { id: string; custo: number; preco: number; servico: boolean };
  const opcoes = new Map<string, { item: ItemCatalogo; vars: Var[] }[]>();
  const criadoCatalogo = new Date(inicio.getTime() - 15 * DIA_MS);
  for (const [categoria, itens] of Object.entries(CATALOGO)) {
    let categoriaId = categoriasExistentes.get(categoria);
    if (!categoriaId) {
      categoriaId = novoId("cat");
      categorias.push({ id: categoriaId, nome: categoria });
      categoriasExistentes.set(categoria, categoriaId);
    }
    const grupo: { item: ItemCatalogo; vars: Var[] }[] = [];
    for (const item of itens) {
      let marcaId: string | null = null;
      if (item.marca) {
        marcaId = marcasExistentes.get(item.marca) ?? null;
        if (!marcaId) {
          marcaId = novoId("mar");
          marcas.push({ id: marcaId, nome: item.marca });
          marcasExistentes.set(item.marca, marcaId);
        }
      }
      const produtoId = novoId("prd");
      produtos.push({ id: produtoId, codigo: item.codigo, nome: item.nome, categoriaId, marcaId, createdAt: criadoCatalogo, updatedAt: criadoCatalogo });
      const vars = item.variacoes.map((descricao, i) => {
        const id = novoId("var");
        variacoes.push({ id, produtoId, sku: `${item.codigo}-${i + 1}`, descricao, precoCusto: item.custo, precoVenda: item.preco });
        return { id, custo: item.custo, preco: item.preco, servico: categoria === "Serviços" };
      });
      grupo.push({ item, vars });
    }
    opcoes.set(categoria, grupo);
  }
  const sortearItem = (categoria: string) => {
    const grupo = opcoes.get(categoria)!;
    return um(ponderado(grupo.map((g) => [g, g.item.peso] as const)).vars);
  };

  // Datas: 18 faixas de ~30 dias, com sazonalidade e leve crescimento; a faixa mais recente concentra vendas na última semana.
  const pesoMes = [1, 1, 1, 1, 1.5, 1.5, 1, 1.3, 1, 1, 1.25, 2.2];
  const faixas = Array.from({ length: MESES }, (_, i) => {
    const meio = new Date(hoje.getTime() - (i + 0.5) * 30.4 * DIA_MS);
    return { offset: i * 30.4, peso: pesoMes[meio.getUTCMonth()] * (1 + (MESES - i) * 0.015) };
  });
  const somaPesos = faixas.reduce((s, f) => s + f.peso, 0);
  const datas: Date[] = [];
  for (const [i, f] of faixas.entries()) {
    const qtd = i === MESES - 1 ? TOTAL_VENDAS - datas.length : Math.round((f.peso / somaPesos) * TOTAL_VENDAS);
    for (let n = 0; n < qtd; n++) {
      const deslocamento = i === 0 && n < 3 ? n + 1 : i === 0 && n % 2 === 0 ? inteiro(1, 7) : Math.ceil(f.offset + r() * 30.4) || 1;
      const d = new Date(hoje.getTime() - deslocamento * DIA_MS);
      d.setUTCHours(inteiro(12, 22), inteiro(0, 59), inteiro(0, 59));
      datas.push(d);
    }
  }
  datas.sort((a, b) => a.getTime() - b.getTime());

  // Vendas
  const vendas: Linha[] = [];
  const itensVenda: Linha[] = [];
  const pagamentos: Linha[] = [];
  const parcelas: Linha[] = [];
  const recebimentos: Linha[] = [];
  const posVendas: Linha[] = [];
  const interacoesPos: Linha[] = [];
  const presentes: Linha[] = [];
  const contatosPresente: Linha[] = [];
  const cobrancas: Linha[] = [];
  const interacoesCob: Linha[] = [];
  const auditoria: Linha[] = [];
  const clientes: Linha[] = [];
  const clienteIds: { id: string; consentimento: boolean }[] = [];
  const nomesUsados = new Set<string>();
  type Evento = { quando: Date; lojaId: string; usuarioId: string; vendaId: string; tipo: "SAIDA_VENDA" | "ESTORNO_VENDA"; itens: { variacaoId: string; quantidade: number }[]; justificativa: string | null };
  const eventos: Evento[] = [];
  let totalCanceladas = 0;
  const canceladasAlvo = new Set<number>();
  while (canceladasAlvo.size < 5) canceladasAlvo.add(inteiro(5, TOTAL_VENDAS - 8));

  datas.forEach((dataHora, indice) => {
    const lojaCodigo = ponderado(PESO_LOJA);
    const lojaId = lojaPorCodigo.get(lojaCodigo)!.id;
    const vendedor = r() < 0.88 ? um(vendedoresDaLoja.get(lojaId)!) : um(todosVendedores);
    const gerenteId = gerentes.get(lojaId)!;

    // Cliente novo ou recorrente; todos os 80 acabam tendo ao menos uma compra.
    const restantes = TOTAL_VENDAS - indice;
    const faltam = TOTAL_CLIENTES - clienteIds.length;
    let cliente: { id: string; consentimento: boolean };
    if (faltam > 0 && (restantes <= faltam || clienteIds.length === 0 || r() < 0.42)) {
      let nome = "";
      do nome = `${um(NOMES)} ${um(SOBRENOMES)} ${um(SOBRENOMES)}`;
      while (nomesUsados.has(nome));
      nomesUsados.add(nome);
      const id = novoId("cli");
      const consentimento = r() < 0.9;
      const criado = new Date(dataHora.getTime() - inteiro(5, 40) * 60_000);
      const p = semAcento(nome).split(" ");
      const completo = r() < 0.85;
      clientes.push({
        id,
        cpf: gerarCpf(cpfs),
        nome,
        dataNascimento: r() < 0.88 ? new Date(Date.UTC(inteiro(1958, 2004), inteiro(0, 11), inteiro(1, 28))) : null,
        celular: celularFicticio(),
        email: r() < 0.75 ? `${p[0]}.${p[2]}${inteiro(1, 99)}@example.com` : null,
        cep: completo ? `130${inteiro(10, 99)}${inteiro(100, 999)}` : null,
        uf: "SP",
        cidade: ponderado(CIDADES),
        bairro: completo ? um(BAIRROS) : null,
        tipoLogradouro: completo ? "Rua" : null,
        logradouro: completo ? um(RUAS) : null,
        numero: completo ? String(inteiro(10, 2400)) : null,
        consentimentoContato: consentimento,
        consentimentoEm: consentimento ? criado : null,
        vendedorResponsavelId: vendedor.id,
        criadoPorId: vendedor.usuarioId,
        createdAt: criado,
        updatedAt: criado,
      });
      cliente = { id, consentimento };
      clienteIds.push(cliente);
    } else {
      cliente = um(clienteIds);
    }

    // Itens
    const ehServico = r() < 0.3;
    const escolhidos = new Map<string, { v: Var; quantidade: number }>();
    const adicionar = (v: Var) => {
      const atual = escolhidos.get(v.id);
      if (atual) atual.quantidade++;
      else escolhidos.set(v.id, { v, quantidade: 1 });
    };
    if (ehServico) {
      adicionar(sortearItem("Serviços"));
      if (r() < 0.12) adicionar(sortearItem("Serviços"));
    } else {
      adicionar(sortearItem(ponderado(PESO_CATEGORIA)));
      if (r() < 0.12) adicionar(sortearItem(um(["Pulseiras", "Correntes", "Serviços"])));
    }
    const lista = [...escolhidos.values()];
    const brutoCentavos = lista.reduce((s, i) => s + i.v.preco * 100 * i.quantidade, 0);

    // Desconto
    let descontoCentavos = 0;
    let descontoTipo: "PERCENTUAL" | "VALOR" | null = null;
    let descontoPercentual: number | null = null;
    if (!ehServico && r() < 0.28) {
      if (brutoCentavos > 80000 && r() < 0.3) {
        descontoTipo = "VALOR";
        descontoCentavos = um([5000, 10000]);
      } else {
        descontoTipo = "PERCENTUAL";
        descontoPercentual = um([5, 5, 8, 10]);
        descontoCentavos = Math.round((brutoCentavos * descontoPercentual) / 100);
      }
    }
    const liquidoCentavos = brutoCentavos - descontoCentavos;
    const vendaId = novoId("ven");
    const usuarioId = vendedor.usuarioId;
    const cancelada = canceladasAlvo.has(indice);
    const canceladaEm = cancelada ? limite(new Date(dataHora.getTime() + inteiro(1, 3) * DIA_MS)) : null;
    const motivo = cancelada ? um(MOTIVOS_CANCELAMENTO) : null;
    if (cancelada) totalCanceladas++;

    // É presente?
    const presente = !ehServico && r() < 0.2;
    vendas.push({
      id: vendaId,
      lojaId,
      vendedorId: vendedor.id,
      clienteId: cliente.id,
      operadorId: usuarioId,
      dataHora,
      valorBruto: paraReais(brutoCentavos),
      descontoTipo,
      descontoPercentual,
      descontoValor: paraReais(descontoCentavos),
      valorLiquido: paraReais(liquidoCentavos),
      descontoAutorizadoPorId: descontoCentavos > 0 && (descontoPercentual ?? 0) >= 10 ? gerenteId : null,
      status: cancelada ? "CANCELADA" : "CONFIRMADA",
      presente,
      chaveIdempotencia: vendaId,
      canceladaEm,
      canceladaPorId: cancelada ? gerenteId : null,
      motivoCancelamento: motivo,
    });
    for (const i of lista) {
      itensVenda.push({
        id: novoId("itm"),
        vendaId,
        variacaoId: i.v.id,
        quantidade: i.quantidade,
        precoUnitario: i.v.preco,
        custoUnitario: i.v.custo,
        valorTotal: i.v.preco * i.quantidade,
      });
    }
    const movimento = lista.map((i) => ({ variacaoId: i.v.id, quantidade: i.quantidade }));
    eventos.push({ quando: dataHora, lojaId, usuarioId, vendaId, tipo: "SAIDA_VENDA", itens: movimento, justificativa: null });
    if (cancelada) eventos.push({ quando: canceladaEm!, lojaId, usuarioId: gerenteId, vendaId, tipo: "ESTORNO_VENDA", itens: movimento, justificativa: `Cancelamento: ${motivo}` });

    if (presente) {
      const presenteId = novoId("pre");
      let dataPresente: Date | null = null;
      if (r() < 0.85) {
        dataPresente = new Date(`${dataHora.toISOString().slice(0, 10)}T00:00:00Z`);
        dataPresente = new Date(dataPresente.getTime() + inteiro(1, 12) * DIA_MS);
        // Parte dos presentes do ano passado tem a data nas próximas semanas, para a aba "Datas de presente" ter o que mostrar.
        if (dataHora.getUTCFullYear() < hoje.getUTCFullYear() && r() < 0.45) {
          const alvo = new Date(hoje.getTime() + inteiro(3, 25) * DIA_MS);
          const candidata = new Date(Date.UTC(dataHora.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate()));
          if (candidata.getTime() > dataHora.getTime() + 7 * DIA_MS) dataPresente = candidata;
        }
      }
      presentes.push({ id: presenteId, clienteId: cliente.id, vendaId, data: dataPresente, observacao: r() < 0.9 ? um(OBS_PRESENTE) : null, createdAt: dataHora });
      // Data de compra do ano passado que já passou neste ano: parte delas já foi lembrada.
      if (!cancelada && dataPresente && cliente.consentimento) {
        const noAno = new Date(Date.UTC(hoje.getUTCFullYear(), dataPresente.getUTCMonth(), dataPresente.getUTCDate()));
        if (dataPresente.getUTCFullYear() < hoje.getUTCFullYear() && noAno < hoje && r() < 0.65) {
          contatosPresente.push({
            id: novoId("cpr"),
            presenteId,
            ano: noAno.getUTCFullYear(),
            usuarioId,
            data: new Date(noAno.getTime() - inteiro(3, 15) * DIA_MS + 14 * 3_600_000),
            canal: "WHATSAPP",
            resultado: um(RESULTADO_PRESENTE),
          });
        }
      }
    }

    // Pagamento
    type Pg = { forma: FormaPagamento; centavos: number; parcelas: number };
    const pgs: Pg[] = [];
    const reais = liquidoCentavos / 100;
    const forma: FormaPagamento =
      reais < 150
        ? ponderado([["PIX", 50], ["DINHEIRO", 30], ["DEBITO", 20]] as const)
        : reais < 400
          ? ponderado([["PIX", 35], ["CREDITO", 35], ["DEBITO", 20], ["DINHEIRO", 10]] as const)
          : cancelada
            ? "CREDITO"
            : ponderado([["CREDITO", 45], ["PIX", 17], ["CREDIARIO", 20], ["CARNE", 12], ["DEBITO", 6]] as const);
    if (FORMAS[forma].recebivelProprio) {
      const entrada = r() < 0.35 ? Math.round(liquidoCentavos * um([0.2, 0.3])) : 0;
      if (entrada > 0) pgs.push({ forma: "PIX", centavos: entrada, parcelas: 1 });
      pgs.push({ forma, centavos: liquidoCentavos - entrada, parcelas: inteiro(2, Math.min(8, Math.max(2, Math.floor(reais / 150)))) });
    } else {
      pgs.push({ forma, centavos: liquidoCentavos, parcelas: forma === "CREDITO" ? ponderado([[1, 25], [2, 15], [3, 20], [6, 20], [10, 20]] as const) : 1 });
    }

    const inadimplente = !cancelada && r() < 0.24;
    let primeiraVencidaAberta: Date | null = null;
    for (const pg of pgs) {
      const pagamentoId = novoId("pag");
      pagamentos.push({ id: pagamentoId, vendaId, forma: pg.forma, valor: paraReais(pg.centavos), numeroParcelas: pg.parcelas });
      if (!FORMAS[pg.forma].recebivelProprio) continue;
      const primeiro = new Date(`${dataHora.toISOString().slice(0, 10)}T00:00:00Z`);
      primeiro.setTime(primeiro.getTime() + 30 * DIA_MS);
      const corte = inteiro(0, pg.parcelas - 1);
      dividirParcelas(pg.centavos, pg.parcelas).forEach((centavos, n) => {
        const parcelaId = novoId("par");
        const vencimento = somarMesesUTC(primeiro, n);
        let statusParcela: StatusParcela = "ABERTA";
        let pagoCentavos = 0;
        let quitadaEm: Date | null = null;
        if (vencimento <= hoje) {
          if (inadimplente && n >= corte) {
            if (!primeiraVencidaAberta) {
              primeiraVencidaAberta = vencimento;
              if (r() < 0.3) {
                statusParcela = "PARCIAL";
                pagoCentavos = Math.round(centavos * 0.4);
              }
            }
          } else {
            statusParcela = "PAGA";
            pagoCentavos = centavos;
          }
        }
        if (pagoCentavos > 0) {
          const pagoEm = limite(new Date(vencimento.getTime() + inteiro(-4, 3) * DIA_MS + 15 * 3_600_000));
          recebimentos.push({ id: novoId("rec"), parcelaId, valor: paraReais(pagoCentavos), forma: um(["PIX", "PIX", "DINHEIRO", "DEBITO"] as const), dataPagamento: pagoEm, usuarioId, lojaId });
          if (statusParcela === "PAGA") quitadaEm = pagoEm;
        }
        if (cancelada) statusParcela = "CANCELADA";
        parcelas.push({ id: parcelaId, pagamentoId, vendaId, clienteId: cliente.id, numero: n + 1, vencimento, valor: paraReais(centavos), valorPago: paraReais(pagoCentavos), status: statusParcela, quitadaEm });
      });
    }

    // Cobrança: dois em cada três casos de atraso já estão sendo tratados.
    if (primeiraVencidaAberta && r() < 0.67) {
      const vencida: Date = primeiraVencidaAberta;
      const cobrancaId = novoId("cob");
      const statusFinal = ponderado<StatusCobranca>([["PRIMEIRA_TENTATIVA", 30], ["CLIENTE_CONTATADO", 25], ["PROMESSA_PAGAMENTO", 25], ["NEGOCIACAO", 12], ["ANALISE_GERENCIAL", 8]] as const);
      const primeiroContato = limite(new Date(vencida.getTime() + inteiro(3, 10) * DIA_MS + 15 * 3_600_000));
      const canal: CanalContato = cliente.consentimento ? "WHATSAPP" : "TELEFONE";
      cobrancas.push({ id: cobrancaId, vendaId, clienteId: cliente.id, status: statusFinal, responsavelId: gerenteId, createdAt: primeiroContato, updatedAt: primeiroContato });
      interacoesCob.push({ id: novoId("icb"), cobrancaId, usuarioId: gerenteId, data: primeiroContato, canal, descricao: "Primeiro contato sobre a parcela em atraso.", statusAnterior: "PENDENTE", statusNovo: "PRIMEIRA_TENTATIVA" });
      if (statusFinal !== "PRIMEIRA_TENTATIVA") {
        const segundo = limite(new Date(primeiroContato.getTime() + inteiro(2, 6) * DIA_MS));
        interacoesCob.push({
          id: novoId("icb"),
          cobrancaId,
          usuarioId: gerenteId,
          data: segundo,
          canal,
          descricao: statusFinal === "PROMESSA_PAGAMENTO" ? "Cliente prometeu regularizar a parcela." : statusFinal === "NEGOCIACAO" ? "Cliente pediu para renegociar as parcelas restantes." : statusFinal === "ANALISE_GERENCIAL" ? "Sem retorno após várias tentativas. Encaminhado para análise." : "Cliente atendeu e reconheceu o atraso.",
          statusAnterior: "PRIMEIRA_TENTATIVA",
          statusNovo: statusFinal,
          valorPrometido: statusFinal === "PROMESSA_PAGAMENTO" ? paraReais(Math.round(liquidoCentavos / 4)) : null,
          dataPromessa: statusFinal === "PROMESSA_PAGAMENTO" ? new Date(hoje.getTime() + inteiro(3, 20) * DIA_MS) : null,
        });
      }
    }

    // Pós-venda: quase todos os antigos foram concluídos; uma parte fica em aberto, como na vida real.
    const posVendaId = novoId("pos");
    const prazo = new Date(dataHora.getTime() + 7 * DIA_MS);
    const canal: CanalContato = cliente.consentimento ? "WHATSAPP" : "TELEFONE";
    const idadeDias = (agora.getTime() - dataHora.getTime()) / DIA_MS;
    let statusPos = status("Aguardando contato");
    let concluidoEm: Date | null = null;
    let proximoContato: Date | null = null;
    if (!cancelada) {
      const sorteio = r();
      if ((idadeDias > 10 && sorteio < 0.92) || (idadeDias > 3 && sorteio < 0.4)) {
        const atrasado = r() < 0.1;
        concluidoEm = limite(new Date(prazo.getTime() + (atrasado ? inteiro(1, 5) : -inteiro(1, 5)) * DIA_MS));
        statusPos = status("Atendimento concluído");
        interacoesPos.push({ id: novoId("ipv"), posVendaId, usuarioId, data: concluidoEm, canal, resultado: um(RESULTADO_CONTATO), statusAnteriorId: status("Aguardando contato"), statusNovoId: statusPos });
      } else if (idadeDias > 3 && sorteio < 0.97) {
        const novo = um(["Aguardando resposta do cliente", "Necessita de novo contato"]);
        statusPos = status(novo);
        const contato = limite(new Date(prazo.getTime() - inteiro(1, 4) * DIA_MS));
        if (novo === "Necessita de novo contato") proximoContato = new Date(agora.getTime() + inteiro(1, 6) * DIA_MS);
        interacoesPos.push({ id: novoId("ipv"), posVendaId, usuarioId, data: contato, canal, resultado: um(RESULTADO_SEM_RESPOSTA), statusAnteriorId: status("Aguardando contato"), statusNovoId: statusPos });
      }
    }
    posVendas.push({ id: posVendaId, vendaId, clienteId: cliente.id, vendedorId: vendedor.id, statusId: statusPos, prazoOriginal: prazo, prazo, concluidoEm, proximoContato, createdAt: dataHora, updatedAt: concluidoEm ?? dataHora });

    auditoria.push({ id: novoId("aud"), usuarioId, acao: "VENDA_REGISTRADA", entidade: "Venda", entidadeId: vendaId, dados: { demonstracao: true, total: paraReais(liquidoCentavos) }, createdAt: dataHora });
    if (cancelada) auditoria.push({ id: novoId("aud"), usuarioId: gerenteId, acao: "VENDA_CANCELADA", entidade: "Venda", entidadeId: vendaId, dados: { demonstracao: true, motivo }, createdAt: canceladaEm });
  });

  // Estoque: entrada inicial, reposições quando faltaria, e saldo final coerente com as movimentações.
  eventos.sort((a, b) => a.quando.getTime() - b.quando.getTime());
  const movimentacoes: Linha[] = [];
  const saldo = new Map<string, number>();
  const servicos = new Set(variacoes.filter((v) => String(v.sku).startsWith("SRV-")).map((v) => String(v.id)));
  const inicioEstoque = new Date(inicio.getTime() - 10 * DIA_MS);
  const registrar = (variacaoId: string, lojaId: string, quantidade: number, tipo: string, usuarioId: string, quando: Date, vendaId: string | null, justificativa: string | null) => {
    const chave = `${variacaoId}|${lojaId}`;
    const anterior = saldo.get(chave) ?? 0;
    saldo.set(chave, anterior + quantidade);
    movimentacoes.push({ id: novoId("mov"), variacaoId, lojaId, tipo, quantidade, saldoAnterior: anterior, saldoPosterior: anterior + quantidade, justificativa, usuarioId, vendaId, createdAt: quando });
  };
  for (const v of variacoes) {
    for (const loja of lojas) {
      if (!Object.keys(EQUIPE).includes(loja.codigo)) continue;
      const id = String(v.id);
      registrar(id, loja.id, servicos.has(id) ? 300 : inteiro(1, 4), "ENTRADA", gerentes.get(loja.id)!, inicioEstoque, null, servicos.has(id) ? "Capacidade inicial do serviço" : "Estoque inicial");
    }
  }
  for (const e of eventos) {
    for (const i of e.itens) {
      if (e.tipo === "SAIDA_VENDA" && (saldo.get(`${i.variacaoId}|${e.lojaId}`) ?? 0) < i.quantidade) {
        registrar(i.variacaoId, e.lojaId, inteiro(2, 4), "ENTRADA", gerentes.get(e.lojaId)!, new Date(e.quando.getTime() - 2 * DIA_MS), null, "Reposição de estoque");
      }
      registrar(i.variacaoId, e.lojaId, e.tipo === "SAIDA_VENDA" ? -i.quantidade : i.quantidade, e.tipo, e.usuarioId, e.quando, e.vendaId, e.justificativa);
    }
  }
  // Reposição recente: a maior parte do que ficou baixo chega de novo, e sobram alguns alertas de estoque.
  for (const [chave, quantidade] of [...saldo.entries()]) {
    const [variacaoId, lojaId] = chave.split("|");
    if (!servicos.has(variacaoId) && quantidade <= 2 && r() < 0.85) {
      registrar(variacaoId, lojaId, inteiro(2, 5), "ENTRADA", gerentes.get(lojaId)!, limite(new Date(hoje.getTime() + 12 * 3_600_000)), null, "Reposição de estoque");
    }
  }
  const saldos: Linha[] = [...saldo.entries()].map(([chave, quantidade]) => {
    const [variacaoId, lojaId] = chave.split("|");
    return { variacaoId, lojaId, quantidade, estoqueMinimo: servicos.has(variacaoId) ? 0 : inteiro(1, 2) };
  });

  console.log(`Gravando: ${vendas.length} vendas, ${clientes.length} clientes, ${usuarios.length} usuários, ${produtos.length} produtos...`);
  await db.$transaction(
    async (tx) => {
      const criar = async (nome: string, dados: Linha[]) => {
        if (dados.length) await (tx as unknown as Record<string, { createMany: (a: { data: Linha[] }) => Promise<unknown> }>)[nome].createMany({ data: dados });
      };
      await criar("usuario", usuarios);
      await criar("vendedor", vendedoresLinhas);
      await criar("cliente", clientes);
      await criar("categoria", categorias);
      await criar("marca", marcas);
      await criar("produto", produtos);
      await criar("produtoVariacao", variacoes);
      await criar("estoqueSaldo", saldos);
      await criar("venda", vendas);
      await criar("vendaItem", itensVenda);
      await criar("pagamento", pagamentos);
      await criar("parcela", parcelas);
      await criar("recebimento", recebimentos);
      await criar("movimentacaoEstoque", movimentacoes);
      await criar("posVenda", posVendas);
      await criar("interacaoPosVenda", interacoesPos);
      await criar("cobranca", cobrancas);
      await criar("interacaoCobranca", interacoesCob);
      await criar("presenteCliente", presentes);
      await criar("presenteContato", contatosPresente);
      await criar("auditLog", auditoria);
    },
    { timeout: 180_000, maxWait: 20_000 },
  );
  await usuarioPublico();
  console.log(`Carga concluída (${totalCanceladas} vendas canceladas). A senha dos usuários fictícios está em ${LOTE_SENHA}.`);
  console.log(`Logins: ${usuarios.map((u) => `${u.login} (${u.perfil})`).join(", ")}`);
  await conferir();
}

// ─────────────────────── Conferência ───────────────────────

async function conferir() {
  const demo = { startsWith: PREFIXO };
  const erros: string[] = [];
  const vendas = await db.venda.findMany({ where: { id: demo }, include: { itens: true, pagamentos: true, parcelas: true, posVenda: true }, orderBy: { numero: "asc" } });
  const reais = (v: Prisma.Decimal | number) => Math.round(Number(v) * 100);
  let anterior = 0;
  for (const v of vendas) {
    const nome = v.chaveIdempotencia;
    if (v.itens.reduce((s, i) => s + reais(i.valorTotal), 0) !== reais(v.valorBruto)) erros.push(`${nome}: itens diferem do bruto`);
    if (reais(v.valorBruto) - reais(v.descontoValor) !== reais(v.valorLiquido)) erros.push(`${nome}: desconto incoerente`);
    if (v.pagamentos.reduce((s, p) => s + reais(p.valor), 0) !== reais(v.valorLiquido)) erros.push(`${nome}: pagamentos diferem do total`);
    for (const pg of v.pagamentos) {
      const dela = v.parcelas.filter((p) => p.pagamentoId === pg.id);
      if (FORMAS[pg.forma].recebivelProprio && (dela.length !== pg.numeroParcelas || dela.reduce((s, p) => s + reais(p.valor), 0) !== reais(pg.valor))) erros.push(`${nome}: parcelas incoerentes`);
    }
    if (!v.posVenda) erros.push(`${nome}: sem pós-venda`);
    if (v.dataHora.getTime() < anterior) erros.push(`${nome}: número fora da ordem da data`);
    anterior = v.dataHora.getTime();
    if (v.dataHora > new Date()) erros.push(`${nome}: data no futuro`);
  }
  const saldos = await db.estoqueSaldo.findMany({ where: { variacaoId: demo } });
  for (const s of saldos) {
    const movs = await db.movimentacaoEstoque.aggregate({ where: { variacaoId: s.variacaoId, lojaId: s.lojaId }, _sum: { quantidade: true } });
    if ((movs._sum.quantidade ?? 0) !== s.quantidade) erros.push(`estoque ${s.variacaoId}/${s.lojaId}: saldo ${s.quantidade} ≠ movimentações ${movs._sum.quantidade}`);
    if (s.quantidade < 0) erros.push(`estoque ${s.variacaoId}/${s.lojaId}: negativo`);
  }
  for (const p of await db.parcela.findMany({ where: { id: demo }, include: { recebimentos: true } })) {
    if (p.recebimentos.reduce((s, x) => s + reais(x.valor), 0) !== reais(p.valorPago)) erros.push(`${p.id}: recebimentos diferem do valor pago`);
  }

  const hoje = new Date(`${hojeSP()}T00:00:00Z`);
  const total = vendas.filter((v) => v.status === "CONFIRMADA").reduce((s, v) => s + reais(v.valorLiquido), 0);
  const resumo = {
    vendas: vendas.length,
    canceladas: vendas.filter((v) => v.status === "CANCELADA").length,
    faturamento: (total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    primeiraVenda: vendas[0]?.dataHora.toISOString().slice(0, 10),
    ultimaVenda: vendas[vendas.length - 1]?.dataHora.toISOString().slice(0, 10),
    clientes: await db.cliente.count({ where: { id: demo } }),
    clientesComCompra: (await db.venda.groupBy({ by: ["clienteId"], where: { id: demo } })).length,
    gerentes: await db.usuario.count({ where: { id: demo, perfil: "GERENTE" } }),
    vendedores: await db.usuario.count({ where: { id: demo, perfil: "VENDEDOR" } }),
    produtos: await db.produto.count({ where: { id: demo } }),
    presentes: await db.presenteCliente.count({ where: { id: demo } }),
    parcelasVencidas: await db.parcela.count({ where: { id: demo, vencimento: { lt: hoje }, status: { in: ["ABERTA", "PARCIAL"] } } }),
    cobrancas: await db.cobranca.count({ where: { id: demo } }),
    posVendaEmAberto: await db.posVenda.count({ where: { id: demo, concluidoEm: null, venda: { status: "CONFIRMADA" } } }),
  };
  console.table(resumo);
  if (erros.length) {
    console.error(`INCOERÊNCIAS (${erros.length}):\n${erros.slice(0, 30).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("Conferência sem incoerências.");
  }
}

// ─────────────────────── Remoção ───────────────────────

async function remover() {
  const demo = { startsWith: PREFIXO };
  // Vendas feitas durante a apresentação com cadastros fictícios também saem.
  const alvo = await db.venda.findMany({
    where: { OR: [{ id: demo }, { clienteId: demo }, { vendedorId: demo }, { operadorId: demo }, { itens: { some: { variacaoId: demo } } }] },
    select: { id: true },
  });
  const vendaId = { in: alvo.map((v) => v.id) };
  await db.$transaction(
    async (tx) => {
      // Produto real vendido numa venda removida: devolve a quantidade ao estoque.
      const reais = await tx.movimentacaoEstoque.findMany({ where: { vendaId, NOT: { variacaoId: demo } } });
      for (const m of reais) {
        await tx.estoqueSaldo.update({ where: { variacaoId_lojaId: { variacaoId: m.variacaoId, lojaId: m.lojaId } }, data: { quantidade: { decrement: m.quantidade } } });
      }

      await tx.presenteContato.deleteMany({ where: { OR: [{ id: demo }, { usuarioId: demo }, { presente: { vendaId } }] } });
      await tx.presenteCliente.deleteMany({ where: { OR: [{ id: demo }, { vendaId }, { clienteId: demo }] } });
      await tx.interacaoCobranca.deleteMany({ where: { OR: [{ id: demo }, { usuarioId: demo }, { cobranca: { vendaId } }] } });
      await tx.cobranca.deleteMany({ where: { OR: [{ id: demo }, { vendaId }] } });
      await tx.cobranca.updateMany({ where: { responsavelId: demo }, data: { responsavelId: null } });
      await tx.interacaoPosVenda.deleteMany({ where: { OR: [{ id: demo }, { usuarioId: demo }, { posVenda: { vendaId } }] } });
      await tx.posVenda.deleteMany({ where: { OR: [{ id: demo }, { vendaId }] } });
      await tx.posVenda.updateMany({ where: { prazoAjustadoPorId: demo }, data: { prazoAjustadoPorId: null } });
      await tx.recebimento.updateMany({ where: { estornadoPorId: demo }, data: { estornadoPorId: null } });
      await tx.recebimento.deleteMany({ where: { OR: [{ id: demo }, { usuarioId: demo }, { parcela: { vendaId } }] } });
      await tx.parcela.deleteMany({ where: { OR: [{ id: demo }, { vendaId }] } });
      await tx.pagamento.deleteMany({ where: { OR: [{ id: demo }, { vendaId }] } });
      await tx.movimentacaoEstoque.deleteMany({ where: { OR: [{ id: demo }, { vendaId }, { variacaoId: demo }, { usuarioId: demo }] } });
      await tx.vendaItem.deleteMany({ where: { OR: [{ id: demo }, { vendaId }] } });
      await tx.venda.updateMany({ where: { canceladaPorId: demo }, data: { canceladaPorId: null } });
      await tx.venda.updateMany({ where: { descontoAutorizadoPorId: demo }, data: { descontoAutorizadoPorId: null } });
      await tx.venda.deleteMany({ where: { id: { in: alvo.map((v) => v.id) } } });

      await tx.estoqueSaldo.deleteMany({ where: { variacaoId: demo } });
      await tx.produtoVariacao.deleteMany({ where: { id: demo } });
      await tx.produto.deleteMany({ where: { id: demo } });
      await tx.categoria.deleteMany({ where: { id: demo } });
      await tx.marca.deleteMany({ where: { id: demo } });
      await tx.cliente.updateMany({ where: { vendedorResponsavelId: demo }, data: { vendedorResponsavelId: null } });
      await tx.cliente.updateMany({ where: { criadoPorId: demo }, data: { criadoPorId: null } });
      await tx.cliente.deleteMany({ where: { id: demo } });
      await tx.vendedor.deleteMany({ where: { id: demo } });
      await tx.auditLog.deleteMany({ where: { OR: [{ id: demo }, { usuarioId: demo }, { entidadeId: demo }, { entidadeId: { in: alvo.map((v) => v.id) } }] } });
      await tx.usuario.deleteMany({ where: { id: demo } });

      // Sem nenhuma venda restante, a numeração volta a começar em V-000001.
      if ((await tx.venda.count()) === 0) await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('"Venda"', 'numero'), 1, false)`;
    },
    { timeout: 180_000, maxWait: 20_000 },
  );
  console.log(`Dados fictícios removidos (${alvo.length} vendas). Vendas restantes no banco: ${await db.venda.count()}.`);
}

// Acesso público do portfólio: admin/admin, sem troca obrigatória de senha. Só faz sentido com MODO_DEMO=1,
// que impede o visitante de mudar essa senha. A política de senha forte do sistema não vale aqui de propósito.
async function usuarioPublico() {
  const dados = { nome: "Administrador (demonstração)", senhaHash: await bcrypt.hash("admin", 10), perfil: "ADMIN" as const, ativo: true, trocarSenha: false };
  await db.usuario.upsert({ where: { login: "admin" }, update: dados, create: { login: "admin", ...dados } });
  await db.sessao.deleteMany({ where: { usuario: { login: "admin" } } });
  console.log('Acesso público pronto: usuário "admin", senha "admin".');
}

async function resetar() {
  await remover();
  await carregar();
}

const comando = process.argv.includes("--remover")
  ? remover
  : process.argv.includes("--conferir")
    ? conferir
    : process.argv.includes("--resetar")
      ? resetar
      : carregar;
comando()
  .catch((e) => {
    console.error("FALHA:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
