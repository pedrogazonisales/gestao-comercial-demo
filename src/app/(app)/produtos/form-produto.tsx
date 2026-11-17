"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Aviso, AreaTexto, Botao, CaixaMarcacao, Campo, Cartao, LinkBotao } from "@/components/ui";
import { useFormAcao } from "@/components/form-acao";
import { formatarMoeda, lerValorMonetario } from "@/lib/formato";
import type { EstadoForm } from "@/lib/acao";

export type VariacaoForm = {
  id?: string;
  chave: string;
  descricao: string;
  cor: string;
  tamanho: string;
  sku: string;
  codigoBarras: string;
  precoCusto: string;
  precoVenda: string;
  ativo: boolean;
  estoqueInicial: string;
};

export type ProdutoForm = {
  codigo: string;
  nome: string;
  categoria: string;
  marca: string;
  descricao: string;
  ativo: boolean;
  variacoes: VariacaoForm[];
  fotoUrl: string | null;
};

// A linha inicial usa chave fixa: chave aleatória diverge entre servidor e navegador (erro de hidratação).
const novaVariacao = (descricao = "Padrão", chave = Math.random().toString(36).slice(2)): VariacaoForm => ({
  chave,
  descricao,
  cor: "",
  tamanho: "",
  sku: "",
  codigoBarras: "",
  precoCusto: "",
  precoVenda: "",
  ativo: true,
  estoqueInicial: "0",
});

/** Reduz a foto no navegador (lado maior 800px, WebP) antes de enviar. */
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("falha"))), "image/webp", 0.82));
}

export function FormProduto({
  acao,
  inicial,
  categorias,
  marcas,
  lojaAtual,
  podeVerCusto,
}: {
  acao: (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;
  inicial?: ProdutoForm;
  categorias: string[];
  marcas: string[];
  lojaAtual?: string;
  podeVerCusto: boolean;
}) {
  const edicao = Boolean(inicial);
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>(inicial?.variacoes ?? [novaVariacao("Padrão", "inicial")]);
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [removerFoto, setRemoverFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const inputFoto = useRef<HTMLInputElement>(null);

  const { estado, aoEnviar, pendente } = useFormAcao(acao, (dados) => {
    dados.set(
      "variacoes",
      JSON.stringify(variacoes.map(({ chave: _c, ...v }) => ({ ...v, estoqueInicial: edicao ? 0 : Number(v.estoqueInicial || 0) }))),
    );
    dados.delete("foto");
    if (foto) dados.set("foto", new File([foto.blob], "foto.webp", { type: "image/webp" }));
    if (removerFoto) dados.set("removerFoto", "on");
  });
  const erro = (c: string) => estado.campos?.[c];

  const alterar = (chave: string, campo: keyof VariacaoForm, valor: string | boolean) =>
    setVariacoes((vs) => vs.map((v) => (v.chave === chave ? { ...v, [campo]: valor } : v)));

  async function escolherFoto(arquivo?: File) {
    setErroFoto("");
    if (!arquivo) return;
    try {
      const blob = await reduzirFoto(arquivo);
      setFoto({ blob, url: URL.createObjectURL(blob) });
      setRemoverFoto(false);
    } catch {
      setErroFoto("Não foi possível ler esta imagem.");
    }
  }

  const fotoExibida = foto?.url ?? (removerFoto ? null : inicial?.fotoUrl);

  return (
    <form onSubmit={aoEnviar} className="space-y-6" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}

      <Cartao>
        <div className="grid gap-6 md:grid-cols-[180px_1fr]">
          <div>
            <p className="mb-1.5 text-sm font-medium">Foto</p>
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-borda bg-fundo text-texto-suave hover:border-marca hover:text-marca"
            >
              {fotoExibida ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoExibida} alt="Foto do produto" className="size-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs">
                  <ImagePlus className="size-6" aria-hidden /> Adicionar foto
                </span>
              )}
            </button>
            <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={(e) => escolherFoto(e.target.files?.[0])} />
            {erroFoto && <p className="mt-1 text-xs text-erro">{erroFoto}</p>}
            {fotoExibida && (
              <button
                type="button"
                className="mt-2 text-xs text-texto-suave hover:text-erro"
                onClick={() => {
                  setFoto(null);
                  setRemoverFoto(true);
                }}
              >
                Remover foto
              </button>
            )}
          </div>

          <div className="grid content-start gap-4 sm:grid-cols-2">
            <Campo id="codigo" rotulo="Código *" defaultValue={inicial?.codigo} erro={erro("codigo")} ajuda="Código interno ou do fornecedor" />
            <Campo id="nome" rotulo="Nome *" defaultValue={inicial?.nome} erro={erro("nome")} />
            <Campo id="categoria" rotulo="Categoria *" list="lista-categorias" defaultValue={inicial?.categoria} erro={erro("categoria")} ajuda="Ex.: Acessórios, Calçados, Serviços" />
            <Campo id="marca" rotulo="Marca" list="lista-marcas" defaultValue={inicial?.marca} erro={erro("marca")} />
            <datalist id="lista-categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="lista-marcas">
              {marcas.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <AreaTexto id="descricao" rotulo="Descrição" className="sm:col-span-2" defaultValue={inicial?.descricao} />
            {!edicao && (
              <Campo
                id="estoqueMinimo"
                rotulo="Estoque mínimo por loja"
                type="number"
                min={0}
                defaultValue="1"
                erro={erro("estoqueMinimo")}
                ajuda="Abaixo disso, o sistema alerta. Pode ser ajustado por loja depois."
              />
            )}
            <div className="flex items-end sm:col-span-1">
              <CaixaMarcacao id="ativo" rotulo="Produto ativo" descricao="Inativos não aparecem na venda." defaultChecked={inicial?.ativo ?? true} />
            </div>
          </div>
        </div>
      </Cartao>

      <Cartao>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl font-semibold">Variações</h2>
            <p className="text-xs text-texto-suave">Cor, tamanho, aro, modelo… Cada variação tem preço e estoque próprios. Produto simples: deixe só “Padrão”.</p>
          </div>
          <Botao type="button" variante="secundario" onClick={() => setVariacoes((vs) => [...vs, novaVariacao("")])}>
            <Plus className="size-4" aria-hidden /> Adicionar variação
          </Botao>
        </div>
        {erro("variacoes") && <Aviso>{erro("variacoes")}</Aviso>}

        <div className="space-y-3">
          {variacoes.map((v, i) => {
            const custo = lerValorMonetario(v.precoCusto);
            const venda = lerValorMonetario(v.precoVenda);
            const margem = venda > 0 && custo >= 0 ? ((venda - custo) / venda) * 100 : null;
            const e = (c: string) => erro(`variacoes.${i}.${c}`);
            return (
              <div key={v.chave} className={`rounded-lg border border-borda p-4 ${v.ativo ? "" : "bg-fundo opacity-70"}`}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Campo id={`v-desc-${v.chave}`} name="" rotulo="Descrição *" className="lg:col-span-2" value={v.descricao} onChange={(ev) => alterar(v.chave, "descricao", ev.target.value)} erro={e("descricao")} placeholder="Ex.: Preto / 52mm" />
                  <Campo id={`v-cor-${v.chave}`} name="" rotulo="Cor" value={v.cor} onChange={(ev) => alterar(v.chave, "cor", ev.target.value)} />
                  <Campo id={`v-tam-${v.chave}`} name="" rotulo="Tamanho / aro" value={v.tamanho} onChange={(ev) => alterar(v.chave, "tamanho", ev.target.value)} />
                  <Campo id={`v-sku-${v.chave}`} name="" rotulo="SKU" value={v.sku} readOnly={Boolean(v.id)} placeholder="Automático" onChange={(ev) => alterar(v.chave, "sku", ev.target.value)} erro={e("sku")} />
                  <Campo id={`v-ean-${v.chave}`} name="" rotulo="Código de barras" inputMode="numeric" value={v.codigoBarras} onChange={(ev) => alterar(v.chave, "codigoBarras", ev.target.value)} erro={e("codigoBarras")} />
                  {podeVerCusto && (
                    <Campo id={`v-custo-${v.chave}`} name="" rotulo="Custo (R$) *" inputMode="decimal" value={v.precoCusto} placeholder="0,00" onChange={(ev) => alterar(v.chave, "precoCusto", ev.target.value)} erro={e("precoCusto")} />
                  )}
                  <Campo id={`v-venda-${v.chave}`} name="" rotulo="Venda (R$) *" inputMode="decimal" value={v.precoVenda} placeholder="0,00" onChange={(ev) => alterar(v.chave, "precoVenda", ev.target.value)} erro={e("precoVenda")} />
                  {!edicao && lojaAtual && (
                    <Campo id={`v-est-${v.chave}`} name="" rotulo={`Estoque em ${lojaAtual}`} type="number" min={0} value={v.estoqueInicial} onChange={(ev) => alterar(v.chave, "estoqueInicial", ev.target.value)} erro={e("estoqueInicial")} />
                  )}
                  <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-2">
                    {podeVerCusto && margem !== null && Number.isFinite(margem) ? (
                      <p className={`text-xs ${margem < 0 ? "text-erro" : "text-texto-suave"}`}>
                        Margem bruta: <strong>{margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong> ({formatarMoeda(venda - custo)})
                      </p>
                    ) : (
                      <span />
                    )}
                    {v.id ? (
                      <CaixaMarcacao id={`v-ativo-${v.chave}`} name="" rotulo="Ativa" checked={v.ativo} onChange={(ev) => alterar(v.chave, "ativo", ev.target.checked)} />
                    ) : (
                      variacoes.length > 1 && (
                        <button type="button" onClick={() => setVariacoes((vs) => vs.filter((x) => x.chave !== v.chave))} className="flex items-center gap-1 text-xs text-texto-suave hover:text-erro">
                          <Trash2 className="size-3.5" aria-hidden /> Remover
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {edicao && <p className="mt-3 text-xs text-texto-suave">Variações já cadastradas não são excluídas (preservam o histórico): desmarque “Ativa” para retirá-las da venda.</p>}
      </Cartao>

      <div className="flex justify-end gap-2">
        <LinkBotao href="/produtos" variante="secundario">
          Cancelar
        </LinkBotao>
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : edicao ? "Salvar alterações" : "Cadastrar produto"}
        </Botao>
      </div>
    </form>
  );
}
