import { CabecalhoPagina, Cartao } from "@/components/ui";
import { exigirSessao } from "@/server/auth";
import { db } from "@/server/db";
import { LinhaStatus } from "./form-status";

export default async function StatusPosVenda() {
  await exigirSessao("config.editar");
  const status = await db.statusPosVenda.findMany({
    orderBy: { ordem: "asc" },
    include: { _count: { select: { posVendas: { where: { venda: { status: "CONFIRMADA" } } } } } },
  });
  const proximaOrdem = Math.max(0, ...status.map((s) => s.ordem)) + 1;

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        titulo="Status do pós-venda"
        subtitulo="Etapas do acompanhamento. “Encerra” conclui o atendimento e para a contagem de prazo. Status em uso não podem ser desativados."
      />
      <Cartao className="p-0">
        {status.map((s) => (
          <LinhaStatus key={s.id} status={{ ...s, emUso: s._count.posVendas }} />
        ))}
        <LinhaStatus key={`novo-${proximaOrdem}`} status={{ nome: "", ordem: proximaOrdem, finaliza: false, ativo: true }} />
      </Cartao>
    </div>
  );
}
