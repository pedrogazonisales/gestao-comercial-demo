import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo";

const ESTILO_BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-marca text-white hover:bg-marca-escuro",
  secundario: "border border-borda bg-superficie text-texto hover:border-marca hover:text-marca",
  fantasma: "text-texto-suave hover:bg-marca-claro hover:text-marca",
  perigo: "bg-erro text-white hover:opacity-90",
};

export function Botao({
  variante = "primario",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return (
    <button
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        ESTILO_BOTAO[variante],
        className,
      )}
      {...props}
    />
  );
}

export function LinkBotao({
  href,
  variante = "primario",
  className,
  children,
}: {
  href: string;
  variante?: VarianteBotao;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
        ESTILO_BOTAO[variante],
        className,
      )}
    >
      {children}
    </Link>
  );
}

const ESTILO_CAMPO =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave/70 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/15 aria-invalid:border-erro";

export function Campo({
  rotulo,
  erro,
  ajuda,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; erro?: string; ajuda?: string; id: string }) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-texto">
        {rotulo}
      </label>
      <input id={id} name={props.name ?? id} aria-invalid={erro ? true : undefined} className={ESTILO_CAMPO} {...props} />
      {erro ? <p className="text-xs text-erro">{erro}</p> : ajuda ? <p className="text-xs text-texto-suave">{ajuda}</p> : null}
    </div>
  );
}

export function Selecao({
  rotulo,
  erro,
  id,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; erro?: string; id: string; children: ReactNode }) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-texto">
        {rotulo}
      </label>
      <select id={id} name={props.name ?? id} aria-invalid={erro ? true : undefined} className={ESTILO_CAMPO} {...props}>
        {children}
      </select>
      {erro && <p className="text-xs text-erro">{erro}</p>}
    </div>
  );
}

export function AreaTexto({
  rotulo,
  erro,
  id,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string; erro?: string; id: string }) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-texto">
        {rotulo}
      </label>
      <textarea
        id={id}
        name={props.name ?? id}
        rows={3}
        aria-invalid={erro ? true : undefined}
        className={cx(ESTILO_CAMPO, "h-auto py-2")}
        {...props}
      />
      {erro && <p className="text-xs text-erro">{erro}</p>}
    </div>
  );
}

export function CaixaMarcacao({
  rotulo,
  descricao,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; descricao?: string; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} name={props.name ?? id} type="checkbox" className="mt-0.5 size-4 accent-marca" {...props} />
      <span>
        <span className="block text-sm font-medium">{rotulo}</span>
        {descricao && <span className="block text-xs text-texto-suave">{descricao}</span>}
      </span>
    </label>
  );
}

export function CabecalhoPagina({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold leading-tight">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-texto-suave">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

type TomDistintivo = "neutro" | "marca" | "ouro" | "sucesso" | "alerta" | "erro";

export function Distintivo({ tom = "neutro", children }: { tom?: TomDistintivo; children: ReactNode }) {
  const estilo = {
    neutro: "bg-fundo text-texto-suave border-borda",
    marca: "bg-marca-claro text-marca border-marca/20",
    ouro: "bg-ouro-claro text-ouro-texto border-ouro/30",
    sucesso: "bg-sucesso-claro text-sucesso border-sucesso/20",
    alerta: "bg-alerta-claro text-alerta border-alerta/25",
    erro: "bg-erro-claro text-erro border-erro/20",
  }[tom];
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", estilo)}>
      {children}
    </span>
  );
}

/** Tabela com rolagem horizontal própria (a página nunca rola na horizontal). */
export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
      <table className="w-full text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-texto-suave [&_th]:uppercase [&_thead]:border-b [&_thead]:border-borda [&_thead]:bg-fundo/60 [&_tbody_tr]:border-b [&_tbody_tr]:border-borda/70 [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-borda bg-superficie px-6 py-12 text-center text-sm text-texto-suave">{children}</div>;
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-borda bg-superficie p-5 shadow-sm", className)}>{children}</div>;
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "alerta" | "sucesso"; children: ReactNode }) {
  const estilo = {
    erro: "border-erro/30 bg-erro-claro text-erro",
    alerta: "border-alerta/30 bg-alerta-claro text-alerta",
    sucesso: "border-sucesso/30 bg-sucesso-claro text-sucesso",
  }[tipo];
  return (
    <div role="alert" className={cx("rounded-lg border px-3 py-2 text-sm", estilo)}>
      {children}
    </div>
  );
}
