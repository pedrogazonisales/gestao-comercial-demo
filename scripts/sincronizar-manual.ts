// Gera src/server/assistente/manual.ts a partir de ../docs/manual-usuario.md.
// - MANUAL_USUARIO: manual completo (assistente de gestão, só gerente/admin).
// - SECOES_MANUAL: trechos com os perfis indicados pelas marcações "<!-- perfis: ... -->" (chat de suporte por perfil).
// Rodar sempre que o manual mudar: npm run manual:sync
import { readFileSync, writeFileSync } from "node:fs";

const PERFIS = ["ADMIN", "GERENTE", "VENDEDOR"] as const;
const bruto = readFileSync("../docs/manual-usuario.md", "utf8");

type Secao = { perfis: string[]; texto: string };
const secoes: Secao[] = [];
let atual: Secao = { perfis: [...PERFIS], texto: "" }; // introdução antes da 1ª marcação vale para todos

let emComentario = false;
for (const linha of bruto.split(/\r?\n/)) {
  const marcacao = linha.match(/^<!--\s*perfis:\s*([A-Z, ]+?)\s*-->$/);
  // Comentários comuns (inclusive de várias linhas) não entram em nenhum trecho.
  if (!marcacao && (emComentario || linha.trimStart().startsWith("<!--"))) {
    emComentario = !linha.includes("-->");
    continue;
  }
  if (marcacao) {
    if (atual.texto.trim()) secoes.push(atual);
    const lista = marcacao[1].split(",").map((p) => p.trim());
    const invalidos = lista.filter((p) => !["TODOS", "NENHUM", ...PERFIS].includes(p));
    if (invalidos.length) throw new Error(`Perfil desconhecido na marcação: ${invalidos.join(", ")}`);
    atual = { perfis: lista.includes("TODOS") ? [...PERFIS] : lista.filter((p) => p !== "NENHUM"), texto: "" };
    continue;
  }
  if (linha.trim() === "---") continue;
  atual.texto += linha + "\n";
}
if (atual.texto.trim()) secoes.push(atual);

const manualCompleto = bruto.replace(/<!--[\s\S]*?-->\n?/g, "");
const conteudo =
  `// GERADO por scripts/sincronizar-manual.ts a partir de docs/manual-usuario.md — não editar à mão.\n` +
  `export const MANUAL_USUARIO = ${JSON.stringify(manualCompleto)};\n\n` +
  `export const SECOES_MANUAL: { perfis: ("ADMIN" | "GERENTE" | "VENDEDOR")[]; texto: string }[] = ${JSON.stringify(
    secoes.map((s) => ({ perfis: s.perfis, texto: s.texto.trim() })),
    null,
    1,
  )};\n`;
writeFileSync("src/server/assistente/manual.ts", conteudo);
console.log(`Manual sincronizado: ${manualCompleto.length} caracteres, ${secoes.length} trechos.`);
for (const p of PERFIS) console.log(`  ${p}: ${secoes.filter((s) => s.perfis.includes(p)).length} trechos`);
