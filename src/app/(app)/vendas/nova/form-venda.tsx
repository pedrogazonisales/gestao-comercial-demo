"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import type { FormaPagamento } from "@prisma/client";
import { Aviso, Botao, Cartao, Selecao } from "@/components/ui";
import { cpfValido, formatarCpf, somenteDigitos } from "@/lib/cpf";
import { formatarDataSemHora, formatarMoeda, formatarTelefone, lerValorMonetario } from "@/lib/formato";
import { calcularDesconto, dividirParcelas, FORMAS, paraCentavos, somarMesesUTC } from "@/lib/venda";
import { acaoRegistrarVenda, buscarClienteVenda, buscarProdutosVenda, type ClienteVenda, type ProdutoVenda } from "../actions";

const CHAVE_RASCUNHO = "gestao:venda-rascunho";

type Item = { produto: ProdutoVenda; quantidade: number };
type Pagamento = { chave: string; forma: FormaPagamento; valor: string; parcelas: number; primeiroVencimento: string };
type Rascunho = {
  cpf: string;
  vendedorId: string;
  itens: Item[];
  descontoTipo: "PERCENTUAL" | "VALOR";
  desconto: string;
  pagamentos: Pagamento[];
  observacoes: string;
  presente?: boolean | null;
  presenteData?: string;
  presenteObs?: string;
};

const moeda = (centavos: number) => formatarMoeda(centavos / 100);
const novaChave = () => Math.random().toString(36).slice(2);
const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export function FormVenda({
  vendedores,
  vendedorPadrao,
  clienteIdInicial,
  limites,
  hoje,
  podeAutorizarNegativo,
}: {
  vendedores: { id: string; nome: string }[];
  vendedorPadrao: string;
  clienteIdInicial?: string;
  limites: { maxCredito: number; maxCrediario: number; prazoMaxVenc: number };
  hoje: string;
  podeAutorizarNegativo: boolean;
}) {
  const router = useRouter();
  const chaveIdempotencia = useRef<string>(crypto.randomUUID());
  // A linha inicial usa chave fixa: chave aleatória diverge entre servidor e navegador (erro de hidratação).
  const pagamentoPadrao = (chave = novaChave()): Pagamento => ({ chave, forma: "PIX", valor: "", parcelas: 1, primeiroVencimento: somarDias(hoje, 30) });

  const [cpf, setCpf] = useState("");
  const [cliente, setCliente] = useState<ClienteVenda | null>(null);
  const [statusCliente, setStatusCliente] = useState<"" | "buscando" | "nao-encontrado" | "invalido">("");
  const [vendedorId, setVendedorId] = useState(vendedorPadrao);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoVenda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);
  const [descontoTipo, setDescontoTipo] = useState<"PERCENTUAL" | "VALOR">("PERCENTUAL");
  const [desconto, setDesconto] = useState("");
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([pagamentoPadrao("inicial")]);
  const [observacoes, setObservacoes] = useState("");
  // null = ainda não respondeu: a venda só é liberada depois de marcar sim ou não.
  const [presente, setPresente] = useState<boolean | null>(null);
  const [presenteData, setPresenteData] = useState("");
  const [presenteObs, setPresenteObs] = useState("");
  const [autorizarNegativo, setAutorizarNegativo] = useState(false);
  const [erro, setErro] = useState("");
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [enviando, iniciar] = useTransition();
  const campoBusca = useRef<HTMLInputElement>(null);

  // ── Rascunho: a venda em andamento sobrevive à ida ao cadastro de cliente ──
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(CHAVE_RASCUNHO);
      if (salvo) {
        const r: Rascunho = JSON.parse(salvo);
        if (r.itens.length || r.cpf) {
          setCpf(r.cpf);
          setVendedorId(r.vendedorId || vendedorPadrao);
          setItens(r.itens);
          setDescontoTipo(r.descontoTipo);
          setDesconto(r.desconto);
          setPagamentos(r.pagamentos.length ? r.pagamentos : [pagamentoPadrao()]);
          setObservacoes(r.observacoes);
          setPresente(r.presente ?? null);
          setPresenteData(r.presenteData ?? "");
          setPresenteObs(r.presenteObs ?? "");
          setRascunhoRecuperado(true);
        }
      }
    } catch {
      /* rascunho indisponível: segue com venda vazia */
    }
    setCarregado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      const r: Rascunho = { cpf, vendedorId, itens, descontoTipo, desconto, pagamentos, observacoes, presente, presenteData, presenteObs };
      sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
    } catch {
      /* armazenamento bloqueado: apenas não guarda rascunho */
    }
  }, [carregado, cpf, vendedorId, itens, descontoTipo, desconto, pagamentos, observacoes, presente, presenteData, presenteObs]);

  function descartarRascunho() {
    try {
      sessionStorage.removeItem(CHAVE_RASCUNHO);
    } catch {}
    setCpf("");
    setCliente(null);
    setStatusCliente("");
    setItens([]);
    setDesconto("");
    setPagamentos([pagamentoPadrao()]);
    setObservacoes("");
    setPresente(null);
    setPresenteData("");
    setPresenteObs("");
    setRascunhoRecuperado(false);
  }

  // ── Cliente ──
  useEffect(() => {
    if (!clienteIdInicial) return;
    buscarClienteVenda({ id: clienteIdInicial }).then((c) => {
      if (c) {
        setCliente(c);
        setCpf(formatarCpf(c.cpf));
      }
    });
  }, [clienteIdInicial]);

  async function aoDigitarCpf(valor: string) {
    const formatado = formatarCpf(valor);
    setCpf(formatado);
    setCliente(null);
    const d = somenteDigitos(formatado);
    if (d.length < 11) return setStatusCliente("");
    if (!cpfValido(d)) return setStatusCliente("invalido");
    setStatusCliente("buscando");
    const c = await buscarClienteVenda({ cpf: d });
    setCliente(c);
    setStatusCliente(c ? "" : "nao-encontrado");
    if (c) campoBusca.current?.focus();
  }

  // ── Produtos ──
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) return setResultados([]);
    setBuscando(true);
    const id = setTimeout(async () => {
      setResultados(await buscarProdutosVenda(t));
      setBuscando(false);
    }, 250);
    return () => clearTimeout(id);
  }, [termo]);

  function adicionar(p: ProdutoVenda) {
    setItens((atual) => {
      const existe = atual.find((i) => i.produto.variacaoId === p.variacaoId);
      return existe
        ? atual.map((i) => (i.produto.variacaoId === p.variacaoId ? { ...i, quantidade: i.quantidade + 1 } : i))
        : [...atual, { produto: p, quantidade: 1 }];
    });
    setTermo("");
    setResultados([]);
    campoBusca.current?.focus();
  }

  const alterarQtd = (id: string, qtd: number) =>
    setItens((atual) => atual.map((i) => (i.produto.variacaoId === id ? { ...i, quantidade: Math.max(1, Math.min(999, qtd || 1)) } : i)));

  // ── Totais (centavos) ──
  const bruto = itens.reduce((s, i) => s + i.produto.precoCentavos * i.quantidade, 0);
  const descontoNumero = desconto.trim() ? lerValorMonetario(desconto) : 0;
  const descontoInvalido =
    !Number.isFinite(descontoNumero) || descontoNumero < 0 || (descontoTipo === "PERCENTUAL" && descontoNumero > 100);
  const descontoCentavos = descontoInvalido ? 0 : calcularDesconto(bruto, descontoTipo, descontoNumero);
  const liquido = bruto - descontoCentavos;
  const valoresPagamento = pagamentos.map((p) => {
    const n = lerValorMonetario(p.valor);
    return Number.isFinite(n) && n > 0 ? paraCentavos(n) : 0;
  });
  const pago = valoresPagamento.reduce((s, v) => s + v, 0);
  const restante = liquido - pago;
  const semEstoque = itens.filter((i) => i.quantidade > i.produto.estoqueLoja);

  const alterarPagamento = (chave: string, mudanca: Partial<Pagamento>) =>
    setPagamentos((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...mudanca } : p)));

  const pendencias = useMemo(() => {
    const l: string[] = [];
    if (!cliente) l.push("Identifique o cliente pelo CPF");
    if (!vendedorId) l.push("Selecione o vendedor");
    if (!itens.length) l.push("Adicione os produtos");
    if (presente === null) l.push("Informe se a venda é um presente");
    if (descontoInvalido) l.push("Desconto inválido");
    else if (descontoCentavos > bruto) l.push("Desconto maior que o valor da venda");
    if (itens.length && liquido > 0 && restante !== 0) l.push(restante > 0 ? `Faltam ${moeda(restante)} nos pagamentos` : `Pagamentos excedem em ${moeda(-restante)}`);
    if (pagamentos.some((p, i) => valoresPagamento[i] === 0)) l.push("Informe o valor de cada pagamento");
    if (semEstoque.length && !autorizarNegativo) l.push("Há itens sem estoque suficiente nesta loja");
    return l;
  }, [cliente, vendedorId, itens.length, presente, descontoInvalido, descontoCentavos, bruto, liquido, restante, pagamentos, valoresPagamento, semEstoque.length, autorizarNegativo]);

  function confirmar() {
    setErro("");
    const dados = {
      chaveIdempotencia: chaveIdempotencia.current,
      clienteId: cliente?.id,
      vendedorId,
      itens: itens.map((i) => ({ variacaoId: i.produto.variacaoId, quantidade: i.quantidade })),
      desconto: { tipo: descontoCentavos > 0 ? descontoTipo : null, valor: descontoCentavos > 0 ? descontoNumero : 0 },
      pagamentos: pagamentos.map((p, i) => ({
        forma: p.forma,
        valorCentavos: valoresPagamento[i],
        numeroParcelas: FORMAS[p.forma].parcelado ? p.parcelas : 1,
        primeiroVencimento: FORMAS[p.forma].recebivelProprio ? p.primeiroVencimento : null,
      })),
      observacoes: observacoes.trim() || undefined,
      presente: { eh: presente, data: presente && presenteData ? presenteData : null, observacao: presente ? presenteObs.trim() || undefined : undefined },
      autorizarEstoqueNegativo: autorizarNegativo,
    };
    iniciar(async () => {
      try {
        sessionStorage.removeItem(CHAVE_RASCUNHO);
      } catch {}
      const r = await acaoRegistrarVenda(JSON.stringify(dados));
      // Só chega aqui se houve erro (no sucesso o servidor redireciona).
      if (r?.erro) {
        setErro(r.erro);
        try {
          sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ cpf, vendedorId, itens, descontoTipo, desconto, pagamentos, observacoes, presente, presenteData, presenteObs }));
        } catch {}
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const linkCadastro = `/clientes/novo?cpf=${somenteDigitos(cpf)}&voltar=${encodeURIComponent("/vendas/nova")}`;
  const estiloCampo = "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm focus:border-marca focus:outline-none";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        {rascunhoRecuperado && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ouro/30 bg-ouro-claro px-4 py-2 text-sm text-ouro-texto">
            Venda em andamento recuperada.
            <button type="button" onClick={descartarRascunho} className="font-medium underline">
              Descartar e começar de novo
            </button>
          </div>
        )}
        {erro && <Aviso>{erro}</Aviso>}

        {/* Cliente e vendedor */}
        <Cartao>
          <h2 className="mb-4 font-serif text-xl font-semibold">Cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="cpf-cliente" className="block text-sm font-medium">
                CPF do cliente *
              </label>
              <input
                id="cpf-cliente"
                inputMode="numeric"
                autoFocus
                value={cpf}
                onChange={(e) => aoDigitarCpf(e.target.value)}
                className={estiloCampo}
                placeholder="000.000.000-00"
              />
              {statusCliente === "buscando" && <p className="text-xs text-texto-suave">Buscando…</p>}
              {statusCliente === "invalido" && <p className="text-xs text-erro">CPF inválido.</p>}
            </div>
            <Selecao id="vendedor" rotulo="Vendedor *" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              <option value="">Selecione…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </Selecao>
          </div>

          {cliente && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-marca-claro px-4 py-3">
              <div>
                <p className="font-medium text-marca">{cliente.nome}</p>
                <p className="text-xs text-texto-suave">
                  {formatarTelefone(cliente.celular) || "Sem celular"}
                  {!cliente.consentimentoContato && " · sem autorização de contato"}
                </p>
              </div>
              <a href={`/clientes/${cliente.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-marca hover:underline">
                Ver ficha
              </a>
            </div>
          )}
          {statusCliente === "nao-encontrado" && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-alerta/30 bg-alerta-claro px-4 py-3 text-sm text-alerta">
              Cliente não cadastrado.
              <a href={linkCadastro} className="inline-flex items-center gap-2 rounded-lg bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro">
                <UserPlus className="size-4" aria-hidden /> Cadastrar agora (a venda fica salva)
              </a>
            </div>
          )}
        </Cartao>

        {/* Produtos */}
        <Cartao>
          <h2 className="mb-4 font-serif text-xl font-semibold">Produtos</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
            <label htmlFor="busca-produto" className="sr-only">
              Buscar produto
            </label>
            <input
              id="busca-produto"
              ref={campoBusca}
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (resultados[0]) adicionar(resultados[0]);
                }
              }}
              placeholder="Nome, marca, SKU ou leia o código de barras"
              className={`${estiloCampo} pl-9`}
              autoComplete="off"
            />
            {termo.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-borda bg-superficie shadow-lg">
                {buscando && !resultados.length ? (
                  <p className="px-4 py-3 text-sm text-texto-suave">Buscando…</p>
                ) : !resultados.length ? (
                  <p className="px-4 py-3 text-sm text-texto-suave">Nenhum produto encontrado.</p>
                ) : (
                  resultados.map((p) => (
                    <button
                      key={p.variacaoId}
                      type="button"
                      onClick={() => adicionar(p)}
                      className="flex w-full items-center justify-between gap-3 border-b border-borda/60 px-4 py-2.5 text-left last:border-0 hover:bg-marca-claro/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.nome}</span>
                        <span className="block truncate text-xs text-texto-suave">
                          {p.descricao !== "Padrão" && `${p.descricao} · `}
                          {p.sku}
                          {p.estoqueLoja === 0 && p.outrasLojas.length > 0 && ` · disponível em ${p.outrasLojas.map((o) => `${o.loja} (${o.quantidade})`).join(", ")}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-medium">{moeda(p.precoCentavos)}</span>
                        <span className={`block text-xs ${p.estoqueLoja > 0 ? "text-sucesso" : "text-erro"}`}>
                          {p.estoqueLoja > 0 ? `${p.estoqueLoja} na loja` : "sem estoque na loja"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {itens.length === 0 ? (
            <p className="mt-4 text-sm text-texto-suave">Nenhum produto adicionado.</p>
          ) : (
            <ul className="mt-4 divide-y divide-borda">
              {itens.map((i) => {
                const falta = i.quantidade > i.produto.estoqueLoja;
                return (
                  <li key={i.produto.variacaoId} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.produto.nome}</p>
                      <p className="text-xs text-texto-suave">
                        {i.produto.descricao !== "Padrão" && `${i.produto.descricao} · `}
                        {i.produto.sku} · {moeda(i.produto.precoCentavos)} cada
                      </p>
                      {falta && (
                        <p className="text-xs text-erro">
                          Estoque na loja: {i.produto.estoqueLoja}
                          {i.produto.outrasLojas.length > 0 && ` · em outras lojas: ${i.produto.outrasLojas.map((o) => `${o.loja} (${o.quantidade})`).join(", ")}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center rounded-lg border border-borda">
                      <button type="button" aria-label="Diminuir" onClick={() => alterarQtd(i.produto.variacaoId, i.quantidade - 1)} className="flex size-9 items-center justify-center text-texto-suave hover:text-marca">
                        <Minus className="size-4" />
                      </button>
                      <input
                        aria-label="Quantidade"
                        inputMode="numeric"
                        value={i.quantidade}
                        onChange={(e) => alterarQtd(i.produto.variacaoId, Number(somenteDigitos(e.target.value)))}
                        className="h-9 w-12 border-x border-borda text-center text-sm focus:outline-none"
                      />
                      <button type="button" aria-label="Aumentar" onClick={() => alterarQtd(i.produto.variacaoId, i.quantidade + 1)} className="flex size-9 items-center justify-center text-texto-suave hover:text-marca">
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <p className="w-28 text-right text-sm font-semibold">{moeda(i.produto.precoCentavos * i.quantidade)}</p>
                    <button
                      type="button"
                      aria-label={`Remover ${i.produto.nome}`}
                      onClick={() => setItens((a) => a.filter((x) => x.produto.variacaoId !== i.produto.variacaoId))}
                      className="text-texto-suave hover:text-erro"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {semEstoque.length > 0 && podeAutorizarNegativo && (
            <label className="mt-3 flex items-center gap-2 text-sm text-alerta">
              <input type="checkbox" checked={autorizarNegativo} onChange={(e) => setAutorizarNegativo(e.target.checked)} className="accent-marca" />
              Autorizar venda sem estoque (fica registrado na auditoria)
            </label>
          )}
        </Cartao>

        {/* Presente */}
        <Cartao>
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
              <Gift className="size-5 text-ouro" aria-hidden /> É presente? *
            </legend>
            <div className="flex gap-2">
              {[
                { valor: true, rotulo: "Sim" },
                { valor: false, rotulo: "Não" },
              ].map((o) => (
                <label
                  key={o.rotulo}
                  className={`flex h-10 w-24 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marca/40 ${
                    presente === o.valor ? "border-marca bg-marca-claro text-marca" : "border-borda hover:border-marca"
                  }`}
                >
                  <input type="radio" name="presente" className="accent-marca" checked={presente === o.valor} onChange={() => setPresente(o.valor)} />
                  {o.rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          {presente && (
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="w-48 space-y-1.5">
                <label htmlFor="presente-data" className="block text-sm font-medium">
                  Data da comemoração
                </label>
                <input id="presente-data" type="date" value={presenteData} onChange={(e) => setPresenteData(e.target.value)} className={estiloCampo} />
              </div>
              <div className="min-w-60 flex-1 space-y-1.5">
                <label htmlFor="presente-obs" className="block text-sm font-medium">
                  Observação
                </label>
                <input
                  id="presente-obs"
                  value={presenteObs}
                  onChange={(e) => setPresenteObs(e.target.value)}
                  maxLength={300}
                  placeholder="Para quem é. Ex.: esposa, aniversário de casamento"
                  className={estiloCampo}
                />
              </div>
              <p className="w-full text-xs text-texto-suave">Opcionais. Com a data, o sistema lembra o pós-venda de procurar o cliente nos próximos anos.</p>
            </div>
          )}
        </Cartao>

        {/* Desconto */}
        <Cartao>
          <h2 className="mb-4 font-serif text-xl font-semibold">Desconto</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div role="radiogroup" aria-label="Tipo de desconto" className="flex rounded-lg border border-borda p-0.5">
              {(["PERCENTUAL", "VALOR"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={descontoTipo === t}
                  onClick={() => setDescontoTipo(t)}
                  className={`h-9 rounded-md px-4 text-sm font-medium ${descontoTipo === t ? "bg-marca text-white" : "text-texto-suave hover:text-marca"}`}
                >
                  {t === "PERCENTUAL" ? "%" : "R$"}
                </button>
              ))}
            </div>
            <div className="w-40">
              <label htmlFor="desconto" className="sr-only">
                Valor do desconto
              </label>
              <input
                id="desconto"
                inputMode="decimal"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder={descontoTipo === "PERCENTUAL" ? "0" : "0,00"}
                className={`${estiloCampo} ${descontoInvalido ? "border-erro" : ""}`}
              />
            </div>
            {descontoCentavos > 0 && (
              <p className="pb-2 text-sm text-texto-suave">
                − {moeda(descontoCentavos)}
                {descontoTipo === "VALOR" && bruto > 0 && ` (${((descontoCentavos / bruto) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`}
              </p>
            )}
          </div>
        </Cartao>

        {/* Pagamento */}
        <Cartao>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold">Pagamento</h2>
            <Botao type="button" variante="secundario" onClick={() => setPagamentos((ps) => [...ps, { ...pagamentoPadrao(), valor: restante > 0 ? (restante / 100).toFixed(2).replace(".", ",") : "" }])}>
              <Plus className="size-4" aria-hidden /> Outra forma
            </Botao>
          </div>
          <div className="space-y-4">
            {pagamentos.map((p, idx) => {
              const forma = FORMAS[p.forma];
              const max = p.forma === "CREDITO" ? limites.maxCredito : limites.maxCrediario;
              const valor = valoresPagamento[idx];
              const parcelas = forma.parcelado && valor > 0 ? dividirParcelas(valor, p.parcelas) : [];
              return (
                <div key={p.chave} className="rounded-lg border border-borda p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px_auto]">
                    <Selecao
                      id={`forma-${p.chave}`}
                      rotulo="Forma"
                      value={p.forma}
                      onChange={(e) => alterarPagamento(p.chave, { forma: e.target.value as FormaPagamento, parcelas: 1 })}
                    >
                      {Object.entries(FORMAS).map(([v, f]) => (
                        <option key={v} value={v}>
                          {f.rotulo}
                        </option>
                      ))}
                    </Selecao>
                    <div className="space-y-1.5">
                      <label htmlFor={`valor-${p.chave}`} className="block text-sm font-medium">
                        Valor (R$)
                      </label>
                      <input
                        id={`valor-${p.chave}`}
                        inputMode="decimal"
                        value={p.valor}
                        onChange={(e) => alterarPagamento(p.chave, { valor: e.target.value })}
                        placeholder="0,00"
                        className={estiloCampo}
                      />
                    </div>
                    {forma.parcelado ? (
                      <Selecao id={`parcelas-${p.chave}`} rotulo="Parcelas" value={p.parcelas} onChange={(e) => alterarPagamento(p.chave, { parcelas: Number(e.target.value) })}>
                        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}×
                          </option>
                        ))}
                      </Selecao>
                    ) : (
                      <div />
                    )}
                    <div className="flex items-end gap-2">
                      {restante !== 0 && (
                        <button
                          type="button"
                          onClick={() => alterarPagamento(p.chave, { valor: (Math.max(0, valor + restante) / 100).toFixed(2).replace(".", ",") })}
                          className="h-10 rounded-lg px-2 text-xs font-medium text-marca hover:bg-marca-claro"
                        >
                          {restante > 0 ? "Usar restante" : "Ajustar"}
                        </button>
                      )}
                      {pagamentos.length > 1 && (
                        <button
                          type="button"
                          aria-label="Remover pagamento"
                          onClick={() => setPagamentos((ps) => ps.filter((x) => x.chave !== p.chave))}
                          className="flex size-10 items-center justify-center text-texto-suave hover:text-erro"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {forma.recebivelProprio && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
                      <div className="space-y-1.5">
                        <label htmlFor={`venc-${p.chave}`} className="block text-sm font-medium">
                          1º vencimento
                        </label>
                        <input
                          id={`venc-${p.chave}`}
                          type="date"
                          min={hoje}
                          max={somarDias(hoje, limites.prazoMaxVenc)}
                          value={p.primeiroVencimento}
                          onChange={(e) => alterarPagamento(p.chave, { primeiroVencimento: e.target.value })}
                          className={estiloCampo}
                        />
                      </div>
                      {parcelas.length > 0 && p.primeiroVencimento && (
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 self-end text-xs text-texto-suave sm:grid-cols-3">
                          {parcelas.map((c, n) => (
                            <li key={n}>
                              {n + 1}ª {formatarDataSemHora(somarMesesUTC(new Date(`${p.primeiroVencimento}T00:00:00Z`), n))} · {moeda(c)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {p.forma === "CREDITO" && p.parcelas > 1 && valor > 0 && (
                    <p className="mt-2 text-xs text-texto-suave">
                      {p.parcelas}× de {moeda(parcelas[parcelas.length - 1])} no cartão (recebido pela operadora)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Cartao>

        <Cartao>
          <label htmlFor="observacoes" className="mb-1.5 block text-sm font-medium">
            Observações
          </label>
          <textarea id="observacoes" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={`${estiloCampo} h-auto py-2`} maxLength={1000} />
        </Cartao>
      </div>

      {/* Resumo */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Cartao>
          <h2 className="mb-4 font-serif text-xl font-semibold">Resumo</h2>
          <dl className="space-y-2 text-sm">
            <Linha
              rotulo={`Subtotal (${itens.reduce((s, i) => s + i.quantidade, 0)} ${itens.reduce((s, i) => s + i.quantidade, 0) === 1 ? "item" : "itens"})`}
              valor={moeda(bruto)}
            />
            <Linha rotulo="Desconto" valor={descontoCentavos ? `− ${moeda(descontoCentavos)}` : moeda(0)} />
            <div className="my-2 h-px bg-borda" />
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">Total</dt>
              <dd className="font-serif text-3xl font-semibold text-marca">{moeda(liquido)}</dd>
            </div>
            <Linha rotulo="Pagamentos" valor={moeda(pago)} />
            <Linha rotulo={restante >= 0 ? "Restante" : "Excedente"} valor={moeda(Math.abs(restante))} destaque={restante !== 0} />
          </dl>

          {pendencias.length > 0 && itens.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-alerta">
              {pendencias.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}
          <Botao type="button" className="mt-5 h-12 w-full text-base" disabled={pendencias.length > 0 || enviando} onClick={confirmar}>
            {enviando ? "Registrando…" : "Confirmar venda"}
          </Botao>
          <button
            type="button"
            onClick={() => {
              if (itens.length && !window.confirm("Descartar esta venda?")) return;
              descartarRascunho();
              router.push("/");
            }}
            className="mt-2 w-full text-center text-xs text-texto-suave hover:text-erro"
          >
            Descartar venda
          </button>
        </Cartao>
      </aside>
    </div>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className={destaque ? "font-semibold text-alerta" : ""}>{valor}</dd>
    </div>
  );
}
