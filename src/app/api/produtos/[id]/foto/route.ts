import { obterSessao } from "@/server/auth";
import { db } from "@/server/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await obterSessao())) return new Response("Não autorizado", { status: 401 });
  const { id } = await params;
  const foto = await db.produtoFoto.findUnique({ where: { produtoId: id } });
  if (!foto) return new Response("Sem foto", { status: 404 });
  return new Response(new Uint8Array(foto.dados), {
    headers: {
      "Content-Type": foto.mime,
      // A URL leva ?v=<data de atualização>, então pode ficar em cache no navegador.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
