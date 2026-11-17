import { EMPRESA } from "@/lib/empresa";

/** Marca da empresa: o logotipo configurado ou, sem ele, o nome em texto. Componente de servidor. */
export function MarcaEmpresa({ tamanho = "menu" }: { tamanho?: "login" | "menu" }) {
  if (EMPRESA.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- o logotipo tem proporção desconhecida; a altura é fixa e a largura acompanha
      <img src={EMPRESA.logo} alt={EMPRESA.nomeExibicao} className={tamanho === "login" ? "h-24 w-auto max-w-full" : "h-14 w-auto max-w-full"} />
    );
  }
  return (
    <span className={`block font-serif font-semibold leading-tight text-marca ${tamanho === "login" ? "text-4xl" : "text-2xl"}`}>{EMPRESA.nomeExibicao}</span>
  );
}
