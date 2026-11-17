// Configuração da empresa que usa esta instalação (uma instalação por cliente).
// Vem de variáveis de ambiente (.env / Vercel) e é lida só no servidor: componentes cliente
// recebem os valores por propriedade. Sem configuração, o sistema usa textos e cores neutros.
//
//   EMPRESA_NOME  nome que aparece no título, login, menu, impressão, WhatsApp e assistentes de IA
//   EMPRESA_RAMO  ramo de atividade, usado só nos textos dos assistentes de IA (ex.: "moda feminina")
//   EMPRESA_LOGO  caminho de uma imagem dentro de public/ (ex.: "/logo.png"); sem ela, o nome aparece em texto
//   EMPRESA_COR   cor principal em hexadecimal (ex.: "#1f4e79"); as variações clara e escura são derivadas

const texto = (valor: string | undefined) => valor?.trim() || null;

const nome = texto(process.env.EMPRESA_NOME);
const cor = texto(process.env.EMPRESA_COR);
const logo = texto(process.env.EMPRESA_LOGO);

export const NOME_SISTEMA = "Gestão Comercial";

export const EMPRESA = {
  /** Nome da empresa; `null` enquanto não for configurado. */
  nome,
  /** Nome para exibir: o da empresa ou, sem configuração, o nome genérico do sistema. */
  nomeExibicao: nome ?? NOME_SISTEMA,
  ramo: texto(process.env.EMPRESA_RAMO) ?? "varejo",
  /** Só aceita caminho local simples (arquivo em public/). */
  logo: logo && /^\/[\w\-./]+\.(png|svg|webp|jpe?g)$/i.test(logo) ? logo : null,
  /** Só aceita #RRGGBB (o valor entra em uma folha de estilo). */
  cor: cor && /^#[0-9a-f]{6}$/i.test(cor) ? cor.toLowerCase() : null,
};

/** Variáveis de cor derivadas da cor principal; vazio quando não há cor configurada. */
export function cssCorEmpresa() {
  if (!EMPRESA.cor) return "";
  const c = EMPRESA.cor;
  return `:root{--color-marca:${c};--color-marca-escuro:color-mix(in srgb,${c} 72%,black);--color-marca-claro:color-mix(in srgb,${c} 9%,white);--color-grafico:color-mix(in srgb,${c} 82%,white)}`;
}

/** Trecho ", da Empresa" das mensagens ao cliente; vazio sem nome configurado. */
export function assinaturaEmpresa(empresa: string | null) {
  return empresa ? `, da ${empresa}` : "";
}
