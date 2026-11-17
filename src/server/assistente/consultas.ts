import "server-only";
// Consultas que o assistente de IA pode fazer. Todas são SOMENTE LEITURA e reaproveitam os serviços dos relatórios.
// LGPD: nada aqui devolve CPF, telefone, e-mail ou endereço — só o necessário para responder perguntas de gestão.
import { db } from "../db";
import type { SessaoAtual } from "../auth";
import { gerarRelatorio, periodoPadrao, TIPOS_RELATORIO, type TipoRelatorio } from "../services/relatorios";
import { indicadoresDashboard } from "../services/dashboard";

const COLUNAS_SENSIVEIS = new Set(["celular", "telefone", "cpf", "email", "endereco"]);
const MAX_LINHAS = 40;

type FiltroNomes = { de?: string; ate?: string; loja?: string; vendedor?: string };

/** O modelo conhece nomes, não ids: converte "Matriz" / "Maria" no id correspondente. */
async function resolverFiltros(f: FiltroNomes) {
  const padrao = periodoPadrao();
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  let lojaId: string | undefined;
  let vendedorId: string | undefined;
  const avisos: string[] = [];
  if (f.loja) {
    const lojas = await db.loja.findMany({ where: { ativa: true } });
    lojaId = lojas.find((l) => normalizar(l.nome).includes(normalizar(f.loja!)))?.id;
    if (!lojaId) avisos.push(`Loja "${f.loja}" não encontrada; considerei todas as lojas. Lojas: ${lojas.map((l) => l.nome).join(", ")}.`);
  }
  if (f.vendedor) {
    const vendedores = await db.vendedor.findMany();
    const achados = vendedores.filter((v) => normalizar(v.nome).includes(normalizar(f.vendedor!)));
    if (achados.length === 1) vendedorId = achados[0].id;
    else avisos.push(achados.length ? `Mais de um vendedor corresponde a "${f.vendedor}": ${achados.map((v) => v.nome).join(", ")}.` : `Vendedor "${f.vendedor}" não encontrado.`);
  }
  const de = f.de && /^\d{4}-\d{2}-\d{2}$/.test(f.de) ? f.de : padrao.de;
  const ate = f.ate && /^\d{4}-\d{2}-\d{2}$/.test(f.ate) ? f.ate : padrao.ate;
  return { de: de <= ate ? de : ate, ate, lojaId, vendedorId, avisos };
}

export async function consultarRelatorio(p: FiltroNomes & { tipo: TipoRelatorio; agrupar?: "dia" | "semana" | "mes" }) {
  const filtro = await resolverFiltros(p);
  const rel = await gerarRelatorio(p.tipo, { ...filtro, agrupar: p.agrupar ?? "dia" });
  const colunas = rel.colunas.filter((c) => !COLUNAS_SENSIVEIS.has(c.chave) && c.tipo !== "telefone");
  const linhas = rel.linhas.slice(0, MAX_LINHAS).map((l) =>
    Object.fromEntries(colunas.map((c) => [c.rotulo, l[c.chave] instanceof Date ? (l[c.chave] as Date).toISOString().slice(0, 10) : l[c.chave]])),
  );
  return {
    relatorio: rel.titulo,
    descricao: rel.descricao,
    periodo: { de: filtro.de, ate: filtro.ate },
    filtros: { loja: p.loja ?? "todas", vendedor: p.vendedor ?? "todos" },
    avisos: filtro.avisos,
    resumo: rel.resumo?.map((r) => ({ [r.rotulo]: r.valor })),
    totalDeLinhas: rel.linhas.length,
    linhas,
    observacao: rel.linhas.length > MAX_LINHAS ? `Mostrando ${MAX_LINHAS} de ${rel.linhas.length} linhas (as primeiras na ordem do relatório).` : undefined,
    valoresMonetariosEm: "reais (R$)",
  };
}

export async function consultarIndicadores(p: FiltroNomes, sessao: SessaoAtual) {
  const filtro = await resolverFiltros(p);
  const ind = await indicadoresDashboard({ de: filtro.de, ate: filtro.ate, lojaId: filtro.lojaId, vendedorId: filtro.vendedorId }, sessao);
  return {
    periodo: { de: filtro.de, ate: filtro.ate },
    avisos: filtro.avisos,
    periodoSelecionado: ind.periodo,
    periodoAnteriorMesmaDuracao: ind.anterior,
    hoje: ind.doDia,
    mesAtual: ind.doMes,
    vendasPorDia: ind.serieDiaria.filter((d) => d.vendas > 0),
    porVendedor: ind.porVendedor.map(({ id: _id, ...v }) => v),
    porLoja: ind.porLoja.map(({ id: _id, ...l }) => l),
    maisVendidos: ind.maisVendidos.map(({ id: _id, ...p }) => p),
    estoqueBaixo: { total: ind.estoqueBaixo.total, exemplos: ind.estoqueBaixo.itens.map((e) => ({ produto: e.produto, variacao: e.descricao, loja: e.loja, saldo: e.quantidade, minimo: e.minimo })) },
    clientes: ind.clientes,
    posVenda: ind.posVenda,
    recebiveis: ind.recebiveis,
    valoresMonetariosEm: "reais (R$)",
  };
}

export async function consultarEstoque(busca: string) {
  const termo = busca.trim();
  const variacoes = await db.produtoVariacao.findMany({
    where: {
      OR: [
        { sku: { contains: termo, mode: "insensitive" } },
        { descricao: { contains: termo, mode: "insensitive" } },
        { produto: { nome: { contains: termo, mode: "insensitive" } } },
        { produto: { codigo: { contains: termo, mode: "insensitive" } } },
        { produto: { marca: { nome: { contains: termo, mode: "insensitive" } } } },
        { produto: { categoria: { nome: { contains: termo, mode: "insensitive" } } } },
      ],
    },
    take: 15,
    include: {
      produto: { select: { nome: true, codigo: true, ativo: true, marca: { select: { nome: true } }, categoria: { select: { nome: true } } } },
      estoques: { include: { loja: { select: { nome: true } } } },
    },
  });
  return {
    encontrados: variacoes.length,
    produtos: variacoes.map((v) => ({
      produto: v.produto.nome,
      codigo: v.produto.codigo,
      marca: v.produto.marca?.nome,
      categoria: v.produto.categoria.nome,
      variacao: v.descricao,
      sku: v.sku,
      ativo: v.ativo && v.produto.ativo,
      precoVenda: Number(v.precoVenda),
      precoCusto: Number(v.precoCusto),
      estoquePorLoja: v.estoques.map((e) => ({ loja: e.loja.nome, saldo: e.quantidade, minimo: e.estoqueMinimo })),
      estoqueTotal: v.estoques.reduce((s, e) => s + e.quantidade, 0),
    })),
  };
}

export async function listarCadastrosBase() {
  const [lojas, vendedores, categorias, configuracoes] = await Promise.all([
    db.loja.findMany({ orderBy: { nome: "asc" }, select: { nome: true, ativa: true } }),
    db.vendedor.findMany({ orderBy: { nome: "asc" }, select: { nome: true, ativo: true } }),
    db.categoria.findMany({ orderBy: { nome: "asc" }, select: { nome: true } }),
    db.configuracao.findMany(),
  ]);
  return {
    lojas,
    vendedores,
    categorias: categorias.map((c) => c.nome),
    configuracoes: Object.fromEntries(configuracoes.map((c) => [c.chave, c.valor])),
    relatoriosDisponiveis: TIPOS_RELATORIO.map((t) => `${t.chave} (${t.rotulo})`),
  };
}
