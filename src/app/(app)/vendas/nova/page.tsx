import { Aviso, CabecalhoPagina } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { configNumero } from "@/server/config";
import { pode } from "@/server/permissoes";
import { hojeSP } from "@/lib/venda";
import { FormVenda } from "./form-venda";

export default async function NovaVenda({ searchParams }: { searchParams: Promise<{ clienteId?: string }> }) {
  const sessao = await exigirSessao("venda.registrar");
  const { clienteId } = await searchParams;

  const [vendedores, maxCredito, maxCrediario, prazoMaxVenc] = await Promise.all([
    db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    configNumero("venda.maxParcelasCredito", 12),
    configNumero("venda.maxParcelasCrediario", 10),
    configNumero("venda.prazoMaxPrimeiroVencimentoDias", 60),
  ]);
  const vendedorPadrao = sessao.usuario.vendedor?.ativo ? sessao.usuario.vendedor.id : "";

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Nova venda" subtitulo={sessao.loja ? `Loja ${sessao.loja.nome}` : undefined} />
      {!sessao.loja ? (
        <Aviso tipo="alerta">Selecione a loja atual no topo da tela para registrar vendas.</Aviso>
      ) : vendedores.length === 0 ? (
        <Aviso tipo="alerta">Nenhum vendedor ativo. Cadastre um usuário com “Realiza vendas” em Equipe.</Aviso>
      ) : (
        <FormVenda
          vendedores={vendedores}
          vendedorPadrao={vendedorPadrao}
          clienteIdInicial={clienteId}
          limites={{ maxCredito, maxCrediario, prazoMaxVenc }}
          hoje={hojeSP()}
          podeAutorizarNegativo={pode(sessao.usuario.perfil, "estoque.negativo")}
        />
      )}
    </div>
  );
}
