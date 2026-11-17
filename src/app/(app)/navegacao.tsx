"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, BarChart3, Boxes, Gem, HandCoins, HeartHandshake, Home, Receipt, ShoppingBag, Target, Users, UsersRound, type LucideIcon } from "lucide-react";
import type { Perfil } from "@prisma/client";

// Só entram aqui páginas que já funcionam. Cada módulo é adicionado quando for concluído e testado.
const ITENS: { href: string; rotulo: string; icone: LucideIcon; perfis?: Perfil[] }[] = [
  { href: "/", rotulo: "Início", icone: Home },
  { href: "/vendas/nova", rotulo: "Nova venda", icone: ShoppingBag },
  { href: "/vendas", rotulo: "Vendas", icone: Receipt },
  { href: "/pos-venda", rotulo: "Pós-venda", icone: HeartHandshake },
  { href: "/recebimentos", rotulo: "Recebimentos", icone: HandCoins },
  { href: "/inadimplencia", rotulo: "Inadimplência", icone: AlertTriangle, perfis: ["ADMIN", "GERENTE"] },
  { href: "/clientes", rotulo: "Clientes", icone: Users },
  { href: "/produtos", rotulo: "Produtos", icone: Gem },
  { href: "/estoque", rotulo: "Estoque", icone: Boxes },
  { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3, perfis: ["ADMIN", "GERENTE"] },
  { href: "/meu-desempenho", rotulo: "Meu desempenho", icone: Target, perfis: ["VENDEDOR"] },
  { href: "/equipe", rotulo: "Equipe", icone: UsersRound, perfis: ["ADMIN"] },
];

export function Navegacao({ perfil }: { perfil: Perfil }) {
  const caminho = usePathname();
  const itens = ITENS.filter((i) => !i.perfis || i.perfis.includes(perfil));
  // Destaca só o item mais específico (ex.: /vendas/nova não acende também /vendas).
  const ativoHref = itens
    .map((i) => i.href)
    .filter((h) => (h === "/" ? caminho === "/" : caminho === h || caminho.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label="Menu principal" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {itens.map(({ href, rotulo, icone: Icone }) => {
        const ativo = href === ativoHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              ativo ? "bg-marca-claro text-marca" : "text-texto-suave hover:bg-marca-claro/60 hover:text-marca"
            }`}
          >
            <Icone className="size-4" aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
