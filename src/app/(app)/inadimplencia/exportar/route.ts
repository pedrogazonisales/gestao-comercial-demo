import { obterSessao } from "@/server/auth";
import { db } from "@/server/db";
import { pode } from "@/server/permissoes";
import { registrarAuditoria } from "@/server/auditoria";
import { listarInadimplentes, type FiltrosInadimplencia } from "@/server/services/cobranca";
import { mascararCpf } from "@/lib/cpf";
import { formatarDataHora, formatarDataSemHora } from "@/lib/formato";
import { codigoVenda } from "@/lib/venda";
import { NOME_STATUS_COBRANCA } from "@/lib/cobranca";

const celula = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const numero = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

export async function GET(req: Request) {
  const sessao = await obterSessao();
  if (!sessao || sessao.usuario.trocarSenha || !pode(sessao.usuario.perfil, "cobranca.gerenciar")) return new Response("Não autorizado", { status: 401 });

  const filtros = Object.fromEntries(new URL(req.url).searchParams) as FiltrosInadimplencia;
  const linhas = await listarInadimplentes(filtros);
  const csv = [
    ["Cliente", "CPF", "Venda", "Data da venda", "Valor da venda", "Vendedor", "Loja", "Parcelas vencidas", "Vencimento mais antigo", "Dias em atraso", "Valor vencido", "Valor em aberto", "Status da cobrança", "Responsável", "Último contato"],
    ...linhas.map((l) => [
      l.cliente.nome,
      mascararCpf(l.cliente.cpf),
      codigoVenda(l.numero),
      formatarDataHora(l.dataVenda),
      l.valorVenda.toFixed(2).replace(".", ","),
      l.vendedor,
      l.loja,
      l.parcelasAtrasadas.map((p) => `${p.numero}ª ${formatarDataSemHora(p.vencimento)} ${numero(p.saldoCentavos)}`).join(" | "),
      formatarDataSemHora(l.parcelasAtrasadas[0]?.vencimento),
      l.diasAtraso,
      numero(l.emAtrasoCentavos),
      numero(l.emAbertoCentavos),
      l.cobranca ? NOME_STATUS_COBRANCA[l.cobranca.status as keyof typeof NOME_STATUS_COBRANCA] : "Sem cobrança",
      l.cobranca?.responsavel ?? "",
      l.cobranca?.ultimoContato ? formatarDataHora(l.cobranca.ultimoContato) : "",
    ]),
  ];
  await registrarAuditoria(db, { usuarioId: sessao.usuario.id, acao: "INADIMPLENCIA_EXPORTADA", entidade: "Cobranca", detalhes: { quantidade: linhas.length, filtros } });
  return new Response("﻿" + csv.map((l) => l.map(celula).join(";")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inadimplencia-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
