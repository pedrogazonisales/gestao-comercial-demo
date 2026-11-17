"use client";

import { useState } from "react";
import { Aviso, Botao, CaixaMarcacao, Campo, Cartao, LinkBotao, Selecao } from "@/components/ui";
import { mascara, useFormAcao } from "@/components/form-acao";
import { formatarCpf } from "@/lib/cpf";
import { formatarTelefone } from "@/lib/formato";
import type { EstadoForm } from "@/lib/acao";

export type UsuarioForm = {
  nome: string;
  login: string;
  email: string | null;
  perfil: "ADMIN" | "GERENTE" | "VENDEDOR";
  lojaPadraoId: string | null;
  ativo: boolean;
  realizaVendas: boolean;
  cpf: string | null;
  telefone: string | null;
  dataAdmissao: string | null;
};

export function FormUsuario({
  acao,
  inicial,
  lojas,
  novo,
}: {
  acao: (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;
  inicial?: UsuarioForm;
  lojas: { id: string; nome: string }[];
  novo?: boolean;
}) {
  const { estado, aoEnviar, pendente } = useFormAcao(acao);
  const erro = (c: string) => estado.campos?.[c];
  const [realizaVendas, setRealizaVendas] = useState(inicial?.realizaVendas ?? true);

  return (
    <form onSubmit={aoEnviar} className="space-y-6" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}

      <Cartao>
        <h2 className="mb-4 font-serif text-xl font-semibold">Acesso ao sistema</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="nome" rotulo="Nome completo *" defaultValue={inicial?.nome} erro={erro("nome")} />
          <Campo id="login" rotulo="Usuário (login) *" autoCapitalize="none" defaultValue={inicial?.login} erro={erro("login")} ajuda="Ex.: maria.silva" />
          <Campo id="email" rotulo="E-mail" type="email" defaultValue={inicial?.email ?? ""} erro={erro("email")} />
          <Selecao id="perfil" rotulo="Perfil *" defaultValue={inicial?.perfil ?? "VENDEDOR"} erro={erro("perfil")}>
            <option value="VENDEDOR">Vendedor — registra vendas, clientes e pós-venda</option>
            <option value="GERENTE">Gerente — acesso gerencial, estoque e relatórios</option>
            <option value="ADMIN">Administrador — acesso completo</option>
          </Selecao>
          <Selecao id="lojaPadraoId" rotulo="Loja principal" defaultValue={inicial?.lojaPadraoId ?? ""}>
            <option value="">Nenhuma (circula entre as lojas)</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </Selecao>
          {novo && (
            <Campo
              id="senha"
              rotulo="Senha provisória *"
              type="password"
              autoComplete="new-password"
              erro={erro("senha")}
              ajuda="Mínimo de 10 caracteres com letras e números. Será trocada no primeiro acesso."
            />
          )}
        </div>
        <div className="mt-4">
          <CaixaMarcacao id="ativo" rotulo="Usuário ativo" descricao="Usuários inativos não conseguem entrar." defaultChecked={inicial?.ativo ?? true} />
        </div>
      </Cartao>

      <Cartao>
        <CaixaMarcacao
          id="realizaVendas"
          rotulo="Realiza vendas"
          descricao="Aparece como vendedor na venda, no pós-venda e nos indicadores."
          checked={realizaVendas}
          onChange={(e) => setRealizaVendas(e.target.checked)}
        />
        {realizaVendas && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Campo
              id="cpf"
              rotulo="CPF *"
              inputMode="numeric"
              defaultValue={inicial?.cpf ? formatarCpf(inicial.cpf) : ""}
              onInput={mascara(formatarCpf)}
              erro={erro("cpf")}
            />
            <Campo
              id="telefone"
              rotulo="Telefone"
              inputMode="tel"
              defaultValue={formatarTelefone(inicial?.telefone)}
              onInput={mascara(formatarTelefone)}
            />
            <Campo id="dataAdmissao" rotulo="Data de admissão *" type="date" defaultValue={inicial?.dataAdmissao ?? ""} erro={erro("dataAdmissao")} />
          </div>
        )}
      </Cartao>

      <div className="flex justify-end gap-2">
        <LinkBotao href="/equipe" variante="secundario">
          Cancelar
        </LinkBotao>
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : novo ? "Cadastrar" : "Salvar alterações"}
        </Botao>
      </div>
    </form>
  );
}

export function FormRedefinirSenha({ acao }: { acao: (estado: EstadoForm, form: FormData) => Promise<EstadoForm> }) {
  const { estado, aoEnviar, pendente } = useFormAcao(acao);
  return (
    <form onSubmit={aoEnviar} className="space-y-3" noValidate>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="flex flex-wrap items-end gap-2">
        <Campo id="senha" rotulo="Nova senha provisória" type="password" autoComplete="new-password" className="min-w-60 flex-1" />
        <Botao type="submit" variante="secundario" disabled={pendente}>
          {pendente ? "Salvando…" : "Redefinir senha"}
        </Botao>
      </div>
      <p className="text-xs text-texto-suave">O usuário será desconectado e deverá criar uma nova senha no próximo acesso.</p>
    </form>
  );
}
