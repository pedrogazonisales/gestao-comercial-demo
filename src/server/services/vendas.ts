import "server-only";
import { Prisma, type Perfil } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { configNumero } from "../config";
import { registrarAuditoria } from "../auditoria";
import { pode } from "../permissoes";
import { ErroEstoque, movimentarEstoque } from "./estoque";
import { calcularDesconto, dividirParcelas, FORMAS, hojeSP, paraReais, somarMesesUTC } from "@/lib/venda";

export class ErroVenda extends Error {}

export const esquemaVenda = z.object({
  chaveIdempotencia: z.string().uuid(),
  clienteId: z.string().min(1, "Identifique o cliente"),
  vendedorId: z.string().min(1, "Selecione o vendedor"),
  itens: z
    .array(z.object({ variacaoId: z.string().min(1), quantidade: z.number().int().min(1, "Quantidade inválida").max(999) }))
    .min(1, "Adicione pelo menos um produto"),
  desconto: z.object({
    tipo: z.enum(["PERCENTUAL", "VALOR"]).nullable(),
    valor: z.number().min(0, "Desconto inválido"),
  }),
  pagamentos: z
    .array(
      z.object({
        forma: z.enum(["DINHEIRO", "PIX", "DEBITO", "CREDITO", "CREDIARIO", "CARNE"]),
        valorCentavos: z.number().int().min(1, "Valor do pagamento inválido"),
        numeroParcelas: z.number().int().min(1).max(48),
        primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      }),
    )
    .min(1, "Informe a forma de pagamento"),
  observacoes: z.string().trim().max(1000).optional(),
  // Resposta obrigatória (sim ou não); data e observação do presente são opcionais.
  presente: z.object(
    {
      eh: z.boolean({ required_error: "Informe se a venda é um presente", invalid_type_error: "Informe se a venda é um presente" }),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data do presente inválida").nullable().optional(),
      observacao: z.string().trim().max(300, "Observação do presente muito longa").optional(),
    },
    { required_error: "Informe se a venda é um presente" },
  ),
  autorizarEstoqueNegativo: z.boolean().default(false),
});

export type DadosVenda = z.infer<typeof esquemaVenda>;

export async function registrarVenda(d: DadosVenda, ctx: { usuarioId: string; perfil: Perfil; lojaId: string }) {
  // Reenvio da mesma venda (duplo clique, rede instável): devolve a venda já gravada.
  const existente = await db.venda.findUnique({ where: { chaveIdempotencia: d.chaveIdempotencia } });
  if (existente) return existente;

  if (d.autorizarEstoqueNegativo && !pode(ctx.perfil, "estoque.negativo")) {
    throw new ErroVenda("Seu perfil não pode autorizar venda sem estoque.");
  }

  const [cliente, vendedor] = await Promise.all([
    db.cliente.findUnique({ where: { id: d.clienteId } }),
    db.vendedor.findUnique({ where: { id: d.vendedorId } }),
  ]);
  if (!cliente) throw new ErroVenda("Cliente não encontrado.");
  if (!vendedor?.ativo) throw new ErroVenda("Vendedor inválido ou inativo.");

  // Agrupa itens repetidos e busca preços no banco (o preço enviado pela tela é ignorado).
  const quantidades = new Map<string, number>();
  for (const i of d.itens) quantidades.set(i.variacaoId, (quantidades.get(i.variacaoId) ?? 0) + i.quantidade);
  const variacoes = await db.produtoVariacao.findMany({
    where: { id: { in: [...quantidades.keys()] } },
    include: { produto: { select: { nome: true, ativo: true } } },
  });
  if (variacoes.length !== quantidades.size) throw new ErroVenda("Produto não encontrado.");
  const inativo = variacoes.find((v) => !v.ativo || !v.produto.ativo);
  if (inativo) throw new ErroVenda(`O produto ${inativo.produto.nome} está inativo.`);

  const itens = variacoes.map((v) => {
    const quantidade = quantidades.get(v.id)!;
    const precoCentavos = Math.round(Number(v.precoVenda) * 100);
    return { variacao: v, quantidade, precoCentavos, custoCentavos: Math.round(Number(v.precoCusto) * 100), totalCentavos: precoCentavos * quantidade };
  });
  const brutoCentavos = itens.reduce((s, i) => s + i.totalCentavos, 0);

  if (d.desconto.tipo === "PERCENTUAL" && d.desconto.valor > 100) throw new ErroVenda("O desconto não pode passar de 100%.");
  const descontoCentavos = calcularDesconto(brutoCentavos, d.desconto.tipo, d.desconto.valor);
  if (descontoCentavos > brutoCentavos) throw new ErroVenda("O desconto é maior que o valor da venda.");
  const liquidoCentavos = brutoCentavos - descontoCentavos;
  if (liquidoCentavos <= 0) throw new ErroVenda("O valor final da venda deve ser maior que zero.");

  const pagoCentavos = d.pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
  if (pagoCentavos !== liquidoCentavos) {
    throw new ErroVenda(`A soma dos pagamentos (${(pagoCentavos / 100).toFixed(2)}) difere do total da venda (${(liquidoCentavos / 100).toFixed(2)}).`);
  }

  const [maxCredito, maxCrediario, prazoMaxVenc, prazoPosVenda] = await Promise.all([
    configNumero("venda.maxParcelasCredito", 12),
    configNumero("venda.maxParcelasCrediario", 10),
    configNumero("venda.prazoMaxPrimeiroVencimentoDias", 60),
    configNumero("posvenda.prazoDias", 7),
  ]);
  const hoje = new Date(`${hojeSP()}T00:00:00Z`);
  for (const p of d.pagamentos) {
    const forma = FORMAS[p.forma];
    if (!forma.parcelado && p.numeroParcelas !== 1) throw new ErroVenda(`${forma.rotulo} não permite parcelamento.`);
    if (p.forma === "CREDITO" && p.numeroParcelas > maxCredito) throw new ErroVenda(`Cartão de crédito: no máximo ${maxCredito} parcelas.`);
    if (forma.recebivelProprio) {
      if (p.numeroParcelas > maxCrediario) throw new ErroVenda(`${forma.rotulo}: no máximo ${maxCrediario} parcelas.`);
      if (!p.primeiroVencimento) throw new ErroVenda(`${forma.rotulo}: informe o primeiro vencimento.`);
      const venc = new Date(`${p.primeiroVencimento}T00:00:00Z`);
      const dias = (venc.getTime() - hoje.getTime()) / 86_400_000;
      if (dias < 0) throw new ErroVenda("O primeiro vencimento não pode estar no passado.");
      if (dias > prazoMaxVenc) throw new ErroVenda(`O primeiro vencimento deve ser em até ${prazoMaxVenc} dias.`);
    }
  }

  // Data do presente: aceita data de nascimento antiga, mas não datas impossíveis.
  const dataPresente = d.presente.eh && d.presente.data ? new Date(`${d.presente.data}T00:00:00Z`) : null;
  if (dataPresente && (Number.isNaN(dataPresente.getTime()) || dataPresente.getUTCFullYear() < 1900 || dataPresente.getUTCFullYear() > hoje.getUTCFullYear() + 2)) {
    throw new ErroVenda("A data do presente é inválida.");
  }

  const statusInicial = await db.statusPosVenda.findFirst({ where: { inicial: true, ativo: true } });
  if (!statusInicial) throw new ErroVenda("Fluxo de pós-venda não configurado.");

  try {
    return await db.$transaction(
      async (tx) => {
        const agora = new Date();
        const venda = await tx.venda.create({
          data: {
            lojaId: ctx.lojaId,
            vendedorId: vendedor.id,
            clienteId: cliente.id,
            operadorId: ctx.usuarioId,
            dataHora: agora,
            valorBruto: paraReais(brutoCentavos),
            descontoTipo: descontoCentavos > 0 ? d.desconto.tipo : null,
            descontoPercentual: descontoCentavos > 0 && d.desconto.tipo === "PERCENTUAL" ? d.desconto.valor : null,
            descontoValor: paraReais(descontoCentavos),
            valorLiquido: paraReais(liquidoCentavos),
            observacoes: d.observacoes || null,
            presente: d.presente.eh,
            chaveIdempotencia: d.chaveIdempotencia,
          },
        });

        // Cada venda de presente gera um registro novo no cliente: as datas anteriores continuam lá.
        if (d.presente.eh) {
          await tx.presenteCliente.create({
            data: { clienteId: cliente.id, vendaId: venda.id, data: dataPresente, observacao: d.presente.observacao || null },
          });
        }

        for (const i of itens) {
          await tx.vendaItem.create({
            data: {
              vendaId: venda.id,
              variacaoId: i.variacao.id,
              quantidade: i.quantidade,
              precoUnitario: paraReais(i.precoCentavos),
              custoUnitario: paraReais(i.custoCentavos),
              valorTotal: paraReais(i.totalCentavos),
            },
          });
          await movimentarEstoque(tx, {
            variacaoId: i.variacao.id,
            lojaId: ctx.lojaId,
            quantidade: -i.quantidade,
            tipo: "SAIDA_VENDA",
            usuarioId: ctx.usuarioId,
            vendaId: venda.id,
            permitirNegativo: d.autorizarEstoqueNegativo,
          });
        }

        for (const p of d.pagamentos) {
          const pagamento = await tx.pagamento.create({
            data: { vendaId: venda.id, forma: p.forma, valor: paraReais(p.valorCentavos), numeroParcelas: p.numeroParcelas },
          });
          if (FORMAS[p.forma].recebivelProprio) {
            const primeiro = new Date(`${p.primeiroVencimento}T00:00:00Z`);
            await tx.parcela.createMany({
              data: dividirParcelas(p.valorCentavos, p.numeroParcelas).map((centavos, n) => ({
                pagamentoId: pagamento.id,
                vendaId: venda.id,
                clienteId: cliente.id,
                numero: n + 1,
                vencimento: somarMesesUTC(primeiro, n),
                valor: paraReais(centavos),
              })),
            });
          }
        }

        const prazo = new Date(agora.getTime() + prazoPosVenda * 86_400_000);
        await tx.posVenda.create({
          data: { vendaId: venda.id, clienteId: cliente.id, vendedorId: vendedor.id, statusId: statusInicial.id, prazoOriginal: prazo, prazo },
        });

        await registrarAuditoria(tx, {
          usuarioId: ctx.usuarioId,
          acao: "VENDA_REGISTRADA",
          entidade: "Venda",
          entidadeId: venda.id,
          detalhes: { numero: venda.numero, total: paraReais(liquidoCentavos), ...(d.autorizarEstoqueNegativo && { estoqueNegativoAutorizado: true }) },
        });
        return venda;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (e instanceof ErroEstoque) {
      throw new ErroVenda(e.message);
    }
    // Corrida rara: a mesma chave gravada por outra requisição ao mesmo tempo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const gravada = await db.venda.findUnique({ where: { chaveIdempotencia: d.chaveIdempotencia } });
      if (gravada) return gravada;
    }
    throw e;
  }
}

export async function cancelarVenda(vendaId: string, motivo: string, usuarioId: string) {
  const venda = await db.venda.findUnique({ where: { id: vendaId }, include: { itens: true, parcelas: true } });
  if (!venda) throw new ErroVenda("Venda não encontrada.");
  if (venda.status === "CANCELADA") throw new ErroVenda("Esta venda já está cancelada.");
  if (venda.parcelas.some((p) => Number(p.valorPago) > 0)) {
    throw new ErroVenda("Há parcelas com pagamento registrado. Trate a devolução do valor antes de cancelar.");
  }

  await db.$transaction(
    async (tx) => {
      // Trava a venda para impedir dois cancelamentos simultâneos.
      const [atual] = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "Venda" WHERE id = ${vendaId} FOR UPDATE`;
      if (atual.status === "CANCELADA") throw new ErroVenda("Esta venda já está cancelada.");

      for (const i of venda.itens) {
        await movimentarEstoque(tx, {
          variacaoId: i.variacaoId,
          lojaId: venda.lojaId,
          quantidade: i.quantidade,
          tipo: "ESTORNO_VENDA",
          usuarioId,
          vendaId,
          justificativa: `Cancelamento: ${motivo}`,
        });
      }
      await tx.parcela.updateMany({ where: { vendaId, status: { in: ["ABERTA", "PARCIAL"] } }, data: { status: "CANCELADA" } });
      await tx.venda.update({
        where: { id: vendaId },
        data: { status: "CANCELADA", canceladaEm: new Date(), canceladaPorId: usuarioId, motivoCancelamento: motivo },
      });
      await registrarAuditoria(tx, { usuarioId, acao: "VENDA_CANCELADA", entidade: "Venda", entidadeId: vendaId, detalhes: { numero: venda.numero, motivo } });
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
