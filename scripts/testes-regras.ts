// Testes das regras puras (cálculos de venda, CPF, formatos). Uso: npx tsx scripts/testes-regras.ts
import assert from "node:assert/strict";
import { calcularDesconto, codigoVenda, dividirParcelas, numeroDoCodigo, somarMesesUTC } from "../src/lib/venda";
import { cpfValido, formatarCpf, mascararCpf } from "../src/lib/cpf";
import { lerValorMonetario } from "../src/lib/formato";
import { diasAte, situacao, textoContagem } from "../src/lib/posvenda";
import { diasAtraso, estaVencida, faixaAtraso, saldoCentavos, statusAposPagamento } from "../src/lib/cobranca";
import { conhecimentoDoPerfil, promptSuporte } from "../src/server/suporte/prompt";
import { diasAteData, ocorrenciaAtendida, ocorrenciaNoAno, proximaOcorrenciaLembrete } from "../src/lib/presente";

const casos: [string, () => void][] = [
  ["parcelas somam o total e o resto fica na 1ª", () => {
    assert.deepEqual(dividirParcelas(100000, 3), [33334, 33333, 33333]);
    assert.equal(dividirParcelas(99999, 7).reduce((a, b) => a + b, 0), 99999);
  }],
  ["vencimentos mensais respeitam fim de mês", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    assert.equal(somarMesesUTC(d("2026-01-31"), 1).toISOString().slice(0, 10), "2026-02-28");
    assert.equal(somarMesesUTC(d("2026-12-10"), 2).toISOString().slice(0, 10), "2027-02-10");
    assert.equal(somarMesesUTC(d("2028-01-31"), 1).toISOString().slice(0, 10), "2028-02-29");
  }],
  ["desconto percentual e em valor", () => {
    assert.equal(calcularDesconto(163980, "PERCENTUAL", 10), 16398);
    assert.equal(calcularDesconto(100000, "VALOR", 50.5), 5050);
    assert.equal(calcularDesconto(100000, null, 10), 0);
  }],
  ["código da venda", () => {
    assert.equal(codigoVenda(12), "V-000012");
    assert.equal(numeroDoCodigo("V-000012"), 12);
    assert.equal(numeroDoCodigo("v12"), 12);
    assert.equal(numeroDoCodigo("Maria"), null);
  }],
  ["CPF", () => {
    assert.equal(cpfValido("123.456.789-09"), true);
    assert.equal(cpfValido("111.111.111-11"), false);
    assert.equal(cpfValido("123.456.789-00"), false);
    assert.equal(formatarCpf("12345678909"), "123.456.789-09");
    assert.equal(mascararCpf("12345678909"), "***.456.789-**");
  }],
  ["pós-venda: situação e contagem regressiva (fuso de Brasília)", () => {
    const agora = new Date("2026-11-10T15:00:00-03:00");
    const pv = (prazo: string, proximo: string | null = null, finalizado = false) => ({ prazo: new Date(prazo), proximoContato: proximo ? new Date(proximo) : null, finalizado });
    assert.equal(diasAte(new Date("2026-11-17T10:00:00-03:00"), agora), 7);
    // 23h em Brasília ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC
    assert.equal(diasAte(new Date("2026-11-10T23:30:00-03:00"), agora), 0);
    assert.equal(situacao(pv("2026-11-17T10:00:00-03:00"), 2, agora), "no-prazo");
    assert.equal(situacao(pv("2026-11-12T10:00:00-03:00"), 2, agora), "vencendo");
    assert.equal(situacao(pv("2026-11-10T18:00:00-03:00"), 2, agora), "vence-hoje");
    assert.equal(situacao(pv("2026-11-10T09:00:00-03:00"), 2, agora), "atrasado");
    assert.equal(situacao(pv("2026-11-08T09:00:00-03:00", null, true), 2, agora), "concluido");
    // próximo contato agendado substitui o prazo como referência
    assert.equal(situacao(pv("2026-11-08T09:00:00-03:00", "2026-11-20T18:00:00-03:00"), 2, agora), "no-prazo");
    assert.equal(textoContagem(pv("2026-11-08T09:00:00-03:00"), agora), "Atrasado há 2 dias");
    assert.equal(textoContagem(pv("2026-11-11T09:00:00-03:00"), agora), "Falta 1 dia");
    assert.equal(textoContagem(pv("2026-11-10T09:00:00-03:00"), agora), "Atrasado desde hoje");
  }],
  ["inadimplência: só parcela vencida, em aberto e com saldo", () => {
    const hoje = new Date("2026-11-10T00:00:00Z");
    const p = (venc: string, status: "ABERTA" | "PARCIAL" | "PAGA" | "CANCELADA", valor = 100, pago = 0) => ({ vencimento: new Date(`${venc}T00:00:00Z`), status, valor, valorPago: pago });
    assert.equal(estaVencida(p("2026-11-09", "ABERTA"), hoje), true);
    assert.equal(estaVencida(p("2026-11-10", "ABERTA"), hoje), false, "vence hoje ainda não é atraso");
    assert.equal(estaVencida(p("2026-11-01", "PAGA", 100, 100), hoje), false);
    assert.equal(estaVencida(p("2026-11-01", "CANCELADA"), hoje), false);
    assert.equal(estaVencida(p("2026-11-01", "PARCIAL", 100, 40), hoje), true);
    assert.equal(saldoCentavos({ valor: "333.34", valorPago: "100.10" }), 23324);
    assert.equal(diasAtraso(new Date("2026-10-11T00:00:00Z"), hoje), 30);
    assert.equal(faixaAtraso(30), "1 a 30 dias");
    assert.equal(faixaAtraso(91), "Mais de 90 dias");
    assert.equal(statusAposPagamento(33334, 0), "ABERTA");
    assert.equal(statusAposPagamento(33334, 10000), "PARCIAL");
    assert.equal(statusAposPagamento(33334, 33334), "PAGA");
  }],
  ["chat de suporte: cada perfil só recebe o manual do seu nível", () => {
    const vendedor = conhecimentoDoPerfil("VENDEDOR");
    const gerente = conhecimentoDoPerfil("GERENTE");
    const admin = conhecimentoDoPerfil("ADMIN");
    // Vendedor: sabe vender, receber e fazer pós-venda; não recebe instruções de gerente/admin.
    for (const t of ["Registrar uma venda", "Receber uma parcela", "Pós-venda", "Consultar produtos e estoque"]) assert.ok(vendedor.includes(t), `vendedor deveria ter: ${t}`);
    for (const t of ["Cancelar uma venda", "Novo usuário", "Estornar", "Ajuste por contagem", "Painel da equipe", "Exportar CSV", "Assistente de IA", "Redefinir senha", "O que cada perfil pode fazer"])
      assert.ok(!vendedor.includes(t), `vendedor NÃO deveria ter: ${t}`);
    // Gerente: tem gestão, mas não cadastro de usuários.
    for (const t of ["Cancelar uma venda", "Ajuste por contagem", "Painel da equipe", "Inadimplência"]) assert.ok(gerente.includes(t), `gerente deveria ter: ${t}`);
    for (const t of ["Novo usuário", "Redefinir senha", "Pós-venda → Status"]) assert.ok(!gerente.includes(t), `gerente NÃO deveria ter: ${t}`);
    assert.ok(!gerente.includes("só os próprios clientes") && !gerente.includes("dos próprios clientes**"), "trecho exclusivo do vendedor não vai para o gerente");
    // Admin: tudo, inclusive equipe.
    for (const t of ["Novo usuário", "Redefinir senha", "Cancelar uma venda", "Pós-venda → Status"]) assert.ok(admin.includes(t), `admin deveria ter: ${t}`);
    // Regras de escopo presentes no prompt.
    const p = promptSuporte("VENDEDOR");
    assert.ok(p.includes("NÃO tem acesso a dados") && p.includes("Vendedor") && p.includes("cancelar vendas"), "prompt do vendedor lista o que não pode");
  }],
  ["presente: a data volta nos anos seguintes, não no ano da compra", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    // Compra em 01/11/2026 para 15/11/2026: o lembrete é só em 2027.
    assert.equal(iso(proximaOcorrenciaLembrete(d("2026-11-15"), "2026-11-01", "2026-11-01")), "2027-11-15");
    // Data já passada em poucos dias, informada com o ano da venda: atendeu este ano.
    assert.equal(iso(proximaOcorrenciaLembrete(d("2026-10-20"), "2026-11-01", "2026-11-01")), "2027-10-20");
    // Data do ano seguinte: a compra atendeu 2027, lembrete em 2028.
    assert.equal(iso(proximaOcorrenciaLembrete(d("2027-03-20"), "2026-11-01", "2026-11-01")), "2028-03-20");
    // Data de nascimento antiga: vale a ocorrência mais próxima da venda.
    assert.equal(iso(ocorrenciaAtendida(d("1985-11-15"), "2026-11-01")), "2026-11-15");
    assert.equal(iso(ocorrenciaAtendida(d("1985-03-20"), "2026-11-01")), "2027-03-20");
    // Um ano depois, a data aparece; depois de passar a tolerância, pula para o ano seguinte.
    assert.equal(iso(proximaOcorrenciaLembrete(d("2026-11-15"), "2026-11-01", "2027-11-01")), "2027-11-15");
    assert.equal(iso(proximaOcorrenciaLembrete(d("2026-11-15"), "2026-11-01", "2027-11-20")), "2027-11-15");
    assert.equal(iso(proximaOcorrenciaLembrete(d("2026-11-15"), "2026-11-01", "2027-11-23")), "2028-11-15");
    // 29/02 em ano não bissexto.
    assert.equal(iso(ocorrenciaNoAno(d("2024-02-29"), 2027)), "2027-02-28");
    assert.equal(diasAteData(d("2027-11-15"), "2027-11-01"), 14);
  }],
  ["valores digitados", () => {
    assert.equal(lerValorMonetario("1.299,90"), 1299.9);
    assert.equal(lerValorMonetario("1299.90"), 1299.9);
    assert.equal(lerValorMonetario("R$ 10,5"), 10.5);
    assert.ok(Number.isNaN(lerValorMonetario("")));
  }],
];

let falhas = 0;
for (const [nome, fn] of casos) {
  try {
    fn();
    console.log(`✔ ${nome}`);
  } catch (e) {
    falhas++;
    console.error(`✘ ${nome}\n  ${(e as Error).message}`);
  }
}
console.log(falhas ? `${falhas} falha(s)` : "Todos os testes passaram.");
process.exit(falhas ? 1 : 0);
