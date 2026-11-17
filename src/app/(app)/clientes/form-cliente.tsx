"use client";

import { useState } from "react";
import { Aviso, AreaTexto, Botao, CaixaMarcacao, Campo, Cartao, LinkBotao, Selecao } from "@/components/ui";
import { mascara, useFormAcao } from "@/components/form-acao";
import { formatarCpf, somenteDigitos } from "@/lib/cpf";
import { formatarCep, formatarTelefone } from "@/lib/formato";
import type { EstadoForm } from "@/lib/acao";

const TIPOS_LOGRADOURO = ["Rua", "Avenida", "Travessa", "Alameda", "Praça", "Rodovia", "Estrada", "Viela", "Largo", "Via"];

export type ClienteForm = {
  cpf: string;
  nome: string;
  nomeSocial: string | null;
  dataNascimento: string | null; // yyyy-mm-dd
  celular: string | null;
  telefoneFixo: string | null;
  email: string | null;
  cep: string | null;
  uf: string | null;
  cidade: string | null;
  bairro: string | null;
  tipoLogradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  observacoes: string | null;
  consentimentoContato: boolean;
  vendedorResponsavelId: string | null;
};

export function FormCliente({
  acao,
  inicial,
  vendedores,
  edicao,
  voltar,
  cancelar,
}: {
  acao: (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;
  inicial?: Partial<ClienteForm>;
  vendedores: { id: string; nome: string }[];
  edicao?: boolean;
  voltar?: string;
  cancelar: string;
}) {
  const { estado, aoEnviar, pendente } = useFormAcao(acao);
  const erro = (campo: string) => estado.campos?.[campo];

  const [endereco, setEndereco] = useState({
    uf: inicial?.uf ?? "",
    cidade: inicial?.cidade ?? "",
    bairro: inicial?.bairro ?? "",
    tipoLogradouro: inicial?.tipoLogradouro ?? "",
    logradouro: inicial?.logradouro ?? "",
  });
  const [cepStatus, setCepStatus] = useState<"" | "buscando" | "nao-encontrado" | "falhou">("");

  async function buscarCep(valor: string) {
    const cep = somenteDigitos(valor);
    if (cep.length !== 8) return;
    setCepStatus("buscando");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) return setCepStatus("nao-encontrado");
      const [primeira, ...resto] = String(j.logradouro ?? "").split(" ");
      const temTipo = TIPOS_LOGRADOURO.includes(primeira);
      setEndereco({
        uf: j.uf ?? "",
        cidade: j.localidade ?? "",
        bairro: j.bairro ?? "",
        tipoLogradouro: temTipo ? primeira : "",
        logradouro: temTipo ? resto.join(" ") : (j.logradouro ?? ""),
      });
      setCepStatus("");
      document.getElementById("numero")?.focus();
    } catch {
      setCepStatus("falhou");
    }
  }

  const campoEndereco = (k: keyof typeof endereco) => ({
    value: endereco[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEndereco((s) => ({ ...s, [k]: e.target.value })),
  });

  return (
    <form onSubmit={aoEnviar} className="space-y-6" noValidate>
      {voltar && <input type="hidden" name="voltar" value={voltar} />}
      {estado.erro && <Aviso>{estado.erro}</Aviso>}

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="cpf"
            rotulo="CPF *"
            inputMode="numeric"
            defaultValue={inicial?.cpf ? formatarCpf(inicial.cpf) : ""}
            onInput={mascara(formatarCpf)}
            readOnly={edicao}
            ajuda={edicao ? "O CPF não pode ser alterado." : undefined}
            erro={erro("cpf")}
            autoFocus={!edicao && !inicial?.cpf}
          />
          <Campo id="nome" rotulo="Nome completo *" defaultValue={inicial?.nome ?? ""} erro={erro("nome")} autoFocus={!edicao && !!inicial?.cpf} />
          <Campo id="nomeSocial" rotulo="Nome social" defaultValue={inicial?.nomeSocial ?? ""} erro={erro("nomeSocial")} />
          <Campo id="dataNascimento" rotulo="Data de nascimento" type="date" defaultValue={inicial?.dataNascimento ?? ""} erro={erro("dataNascimento")} />
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Contato</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="celular"
            rotulo="Celular (WhatsApp) *"
            inputMode="tel"
            defaultValue={formatarTelefone(inicial?.celular)}
            onInput={mascara(formatarTelefone)}
            erro={erro("celular")}
          />
          <Campo
            id="telefoneFixo"
            rotulo="Telefone fixo"
            inputMode="tel"
            defaultValue={formatarTelefone(inicial?.telefoneFixo)}
            onInput={mascara(formatarTelefone)}
            erro={erro("telefoneFixo")}
          />
          <Campo id="email" rotulo="E-mail" type="email" defaultValue={inicial?.email ?? ""} erro={erro("email")} />
        </div>
        <div className="mt-4">
          <CaixaMarcacao
            id="consentimentoContato"
            rotulo="Cliente autoriza contato por WhatsApp, telefone e e-mail"
            descricao="Necessário para pós-venda, aniversário e campanhas (LGPD). Pergunte ao cliente."
            defaultChecked={inicial?.consentimentoContato ?? false}
          />
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Endereço</h2>
        <div className="grid gap-4 sm:grid-cols-6">
          <Campo
            id="cep"
            rotulo="CEP"
            inputMode="numeric"
            className="sm:col-span-2"
            defaultValue={formatarCep(inicial?.cep)}
            onInput={mascara((v) => formatarCep(somenteDigitos(v).slice(0, 8)))}
            onBlur={(e) => buscarCep(e.currentTarget.value)}
            ajuda={
              cepStatus === "buscando"
                ? "Buscando endereço…"
                : cepStatus === "nao-encontrado"
                  ? "CEP não encontrado. Preencha manualmente."
                  : cepStatus === "falhou"
                    ? "Não foi possível consultar o CEP agora. Preencha manualmente."
                    : "O endereço é preenchido automaticamente."
            }
            erro={erro("cep")}
          />
          <Campo id="cidade" rotulo="Cidade" className="sm:col-span-3" {...campoEndereco("cidade")} erro={erro("cidade")} />
          <Campo id="uf" rotulo="UF" maxLength={2} className="sm:col-span-1" {...campoEndereco("uf")} erro={erro("uf")} />
          <Campo id="bairro" rotulo="Bairro" className="sm:col-span-2" {...campoEndereco("bairro")} erro={erro("bairro")} />
          <Selecao id="tipoLogradouro" rotulo="Tipo" className="sm:col-span-1" {...campoEndereco("tipoLogradouro")}>
            <option value="">—</option>
            {TIPOS_LOGRADOURO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Selecao>
          <Campo id="logradouro" rotulo="Logradouro" className="sm:col-span-3" {...campoEndereco("logradouro")} erro={erro("logradouro")} />
          <Campo id="numero" rotulo="Número" className="sm:col-span-2" defaultValue={inicial?.numero ?? ""} erro={erro("numero")} />
          <Campo id="complemento" rotulo="Complemento" className="sm:col-span-4" defaultValue={inicial?.complemento ?? ""} erro={erro("complemento")} />
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Relacionamento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao id="vendedorResponsavelId" rotulo="Vendedor responsável" defaultValue={inicial?.vendedorResponsavelId ?? ""}>
            <option value="">Nenhum</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </Selecao>
          <AreaTexto id="observacoes" rotulo="Observações" defaultValue={inicial?.observacoes ?? ""} erro={erro("observacoes")} />
        </div>
      </Cartao>

      <div className="flex flex-wrap justify-end gap-2">
        <LinkBotao href={cancelar} variante="secundario">
          Cancelar
        </LinkBotao>
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : edicao ? "Salvar alterações" : "Cadastrar cliente"}
        </Botao>
      </div>
    </form>
  );
}
