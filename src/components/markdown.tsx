import { Fragment, type ReactNode } from "react";

/** Markdown simples e seguro (sem HTML) para respostas de IA: negrito, listas, tabelas, títulos e parágrafos. */
export function Markdown({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  const blocos: ReactNode[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (/^\s*\|.*\|\s*$/.test(linha)) {
      const tabela: string[] = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) tabela.push(linhas[i++]);
      i--;
      const celulas = tabela.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l)).map((l) => l.trim().slice(1, -1).split("|").map((c) => c.trim()));
      blocos.push(
        <div key={i} className="my-2 overflow-x-auto">
          <table className="w-full text-xs [&_td]:border-b [&_td]:border-borda/60 [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold">
            <thead>
              <tr>{celulas[0]?.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {celulas.slice(1).map((l, k) => (
                <tr key={k}>{l.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^\s*([-*•]|\d+\.)\s+/.test(linha)) {
      const itens: string[] = [];
      const numerada = /^\s*\d+\./.test(linha);
      while (i < linhas.length && /^\s*([-*•]|\d+\.)\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*•]|\d+\.)\s+/, ""));
      i--;
      const Lista = numerada ? "ol" : "ul";
      blocos.push(
        <Lista key={i} className={`my-1 space-y-0.5 pl-5 ${numerada ? "list-decimal" : "list-disc"}`}>
          {itens.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </Lista>,
      );
    } else if (/^#{1,6}\s/.test(linha)) {
      blocos.push(
        <p key={i} className="mt-2 font-semibold">
          {inline(linha.replace(/^#{1,6}\s/, ""))}
        </p>,
      );
    } else if (linha.trim()) {
      blocos.push(
        <p key={i} className="my-1">
          {inline(linha)}
        </p>,
      );
    }
  }
  return <>{blocos}</>;
}

function inline(texto: string): ReactNode {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? <strong key={i}>{parte.slice(2, -2)}</strong> : <Fragment key={i}>{parte}</Fragment>,
  );
}
