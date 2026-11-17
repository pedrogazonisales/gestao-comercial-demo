import { obterSessao } from "@/server/auth";
import { db } from "@/server/db";
import { registrarAuditoria } from "@/server/auditoria";
import { filtroVendas, incluirListaVendas, type FiltrosVenda } from "@/server/services/consulta-vendas";
import { mascararCpf } from "@/lib/cpf";
import { formatarDataHora } from "@/lib/formato";
import { codigoVenda, FORMAS } from "@/lib/venda";

// CSV com ";" e vírgula decimal: abre direto no Excel em português.
const celula = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const numero = (v: unknown) => Number(v ?? 0).toFixed(2).replace(".", ",");

export async function GET(req: Request) {
  const sessao = await obterSessao();
  if (!sessao || sessao.usuario.trocarSenha) return new Response("Não autorizado", { status: 401 });

  const filtros = Object.fromEntries(new URL(req.url).searchParams) as FiltrosVenda;
  const vendas = await db.venda.findMany({
    where: filtroVendas(filtros, sessao),
    orderBy: { dataHora: "desc" },
    take: 10_000,
    include: incluirListaVendas,
  });

  const linhas = [
    ["Venda", "Data", "Status", "Presente", "Loja", "Vendedor", "Cliente", "CPF", "Produtos", "Pagamento", "Bruto", "Desconto", "Total"],
    ...vendas.map((v) => [
      codigoVenda(v.numero),
      formatarDataHora(v.dataHora),
      v.status === "CANCELADA" ? "Cancelada" : "Confirmada",
      v.presente ? "Sim" : "Não",
      v.loja.nome,
      v.vendedor.nome,
      v.cliente.nomeSocial || v.cliente.nome,
      mascararCpf(v.cliente.cpf), // LGPD: CPF parcial no arquivo exportado
      v.itens.map((i) => `${i.quantidade}x ${i.variacao.produto.nome} (${i.variacao.sku})`).join(" | "),
      v.pagamentos.map((p) => `${FORMAS[p.forma].rotulo}${p.numeroParcelas > 1 ? ` ${p.numeroParcelas}x` : ""}: ${numero(p.valor)}`).join(" | "),
      numero(v.valorBruto),
      numero(v.descontoValor),
      numero(v.valorLiquido),
    ]),
  ];
  await registrarAuditoria(db, { usuarioId: sessao.usuario.id, acao: "VENDAS_EXPORTADAS", entidade: "Venda", detalhes: { quantidade: vendas.length, filtros } });

  const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  const data = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendas-${data}.csv"`,
    },
  });
}
