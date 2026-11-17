import { obterSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { registrarAuditoria } from "@/server/auditoria";
import { gerarRelatorio, lerFiltrosRelatorio } from "@/server/services/relatorios";
import { formatarCelula } from "@/lib/relatorio-formato";

const celula = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export async function GET(req: Request) {
  const sessao = await obterSessao();
  if (!sessao || sessao.usuario.trocarSenha || !pode(sessao.usuario.perfil, "relatorio.ver")) return new Response("Não autorizado", { status: 401 });

  const { tipo, filtro } = lerFiltrosRelatorio(Object.fromEntries(new URL(req.url).searchParams));
  const rel = await gerarRelatorio(tipo, filtro);
  const linhas = [rel.colunas.map((c) => c.rotulo), ...rel.linhas.map((l) => rel.colunas.map((c) => formatarCelula(l[c.chave], c.tipo, true)))];
  await registrarAuditoria(db, { usuarioId: sessao.usuario.id, acao: "RELATORIO_EXPORTADO", entidade: "Relatorio", entidadeId: tipo, detalhes: { ...filtro, linhas: rel.linhas.length } });

  return new Response("﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${tipo}-${filtro.de}-a-${filtro.ate}.csv"`,
    },
  });
}
