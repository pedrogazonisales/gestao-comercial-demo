"use client";

// Gráficos de série única (sem legenda: o título do cartão diz o que está plotado).
// Especificações: barras ≤ 24px com ponta arredondada de 4px, grade em linha fina sólida,
// texto sempre em cor de texto (nunca na cor da série), tooltip ao passar o mouse.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";

const COR = "var(--color-grafico)";
const GRADE = "var(--color-grafico-grade)";
const EIXO = "var(--color-grafico-eixo)";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const umaCasa = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
// Formato compacto próprio (o "compact" do Intl variou entre navegador e servidor).
export function valorCompacto(v: number) {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1_000_000) return `R$ ${umaCasa(v / 1_000_000)} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${umaCasa(v / 1_000)} mil`;
  return `R$ ${Math.round(v)}`;
}
const eixoMoeda = valorCompacto;

// Rótulo de eixo em uma linha só (o padrão do Recharts quebra "R$ 1 mil" em várias linhas e corta).
function TickValor({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={EIXO} fontSize={11}>
      {eixoMoeda(payload?.value ?? 0)}
    </text>
  );
}

function CaixaTooltip({ active, payload, titulo, detalhe }: TooltipProps<number, string> & { titulo: (p: Record<string, unknown>) => string; detalhe?: (p: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null;
  const dados = payload[0].payload as Record<string, unknown>;
  return (
    <div className="rounded-lg border border-borda bg-superficie px-3 py-2 text-xs shadow-md">
      <p className="text-texto-suave">{titulo(dados)}</p>
      <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-texto">
        <span className="size-2 rounded-full" style={{ background: COR }} aria-hidden />
        {moeda.format(Number(payload[0].value ?? 0))}
      </p>
      {detalhe && <p className="text-texto-suave">{detalhe(dados)}</p>}
    </div>
  );
}

export function GraficoDiario({ dados }: { dados: { dia: string; total: number; vendas: number }[] }) {
  const rotuloDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const intervalo = dados.length > 16 ? Math.ceil(dados.length / 8) - 1 : 0;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={GRADE} strokeWidth={1} />
          <XAxis dataKey="dia" tickFormatter={rotuloDia} interval={intervalo} tick={{ fill: EIXO, fontSize: 11 }} axisLine={{ stroke: GRADE }} tickLine={false} />
          <YAxis tick={<TickValor />} axisLine={false} tickLine={false} width={72} />
          <Tooltip
            cursor={{ fill: "var(--color-marca-claro)", opacity: 0.6 }}
            content={
              <CaixaTooltip
                titulo={(p) => new Date(`${p.dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                detalhe={(p) => `${p.vendas} venda${p.vendas === 1 ? "" : "s"}`}
              />
            }
          />
          <Bar dataKey="total" fill={COR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Colunas por categoria (meses, semanas…), série única. */
export function GraficoColunas({ dados }: { dados: { nome: string; total: number; detalhe?: string }[] }) {
  const intervalo = dados.length > 14 ? Math.ceil(dados.length / 8) - 1 : 0;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={GRADE} strokeWidth={1} />
          <XAxis dataKey="nome" interval={intervalo} tick={{ fill: EIXO, fontSize: 11 }} axisLine={{ stroke: GRADE }} tickLine={false} />
          <YAxis tick={<TickValor />} axisLine={false} tickLine={false} width={72} />
          <Tooltip cursor={{ fill: "var(--color-marca-claro)", opacity: 0.6 }} content={<CaixaTooltip titulo={(p) => String(p.nome)} detalhe={(p) => (p.detalhe ? String(p.detalhe) : "")} />} />
          <Bar dataKey="total" fill={COR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais ordenadas (ranking). Valor no fim da barra. */
export function GraficoRanking({ dados }: { dados: { nome: string; total: number; detalhe?: string }[] }) {
  const altura = Math.max(120, dados.length * 40 + 16);
  return (
    <div className="w-full" style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 88, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={GRADE} strokeWidth={1} />
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="nome"
            width={140}
            tick={{ fill: "var(--color-texto)", fontSize: 12 }}
            tickFormatter={(n: string) => (n.length > 20 ? `${n.slice(0, 19)}…` : n)}
            axisLine={{ stroke: GRADE }}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "var(--color-marca-claro)", opacity: 0.6 }} content={<CaixaTooltip titulo={(p) => String(p.nome)} detalhe={(p) => (p.detalhe ? String(p.detalhe) : "")} />} />
          <Bar
            dataKey="total"
            fill={COR}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            isAnimationActive={false}
            label={{ position: "right", fill: "var(--color-texto-suave)", fontSize: 12, formatter: (v: number) => eixoMoeda(v) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
