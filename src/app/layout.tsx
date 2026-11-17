import type { Metadata } from "next";
// Fontes incluídas no próprio projeto (não dependem do Google Fonts na compilação nem no acesso).
import "@fontsource-variable/inter";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";
import { cssCorEmpresa, EMPRESA, NOME_SISTEMA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: EMPRESA.nome ? `${EMPRESA.nome} · Gestão` : NOME_SISTEMA,
  description: EMPRESA.nome ? `Sistema de gestão comercial — ${EMPRESA.nome}` : "Sistema de gestão comercial",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const corEmpresa = cssCorEmpresa();
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        {/* Cor principal da empresa (EMPRESA_COR): sobrepõe as variáveis neutras de globals.css. */}
        {corEmpresa && <style>{corEmpresa}</style>}
        {children}
      </body>
    </html>
  );
}
