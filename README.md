# Gestão Comercial — demonstração

> Versão de portfólio com dados fictícios. Com `MODO_DEMO=1`, o acesso público é `admin` / `admin` e o link `/demo` entra direto. Para restaurar os dados: `npm run demo:resetar`.

Sistema de gestão comercial para lojas: vendas, estoque por loja, clientes, pós-venda,
recebimentos, inadimplência, indicadores e relatórios. Uma instalação por empresa
(banco e hospedagem próprios); nome, logotipo e cor vêm do `.env` (`EMPRESA_*`).

- Documento central do projeto (contexto, decisões, estado atual): `../CLAUDE.md`
- Manual de uso: `../docs/manual-usuario.md`
- Publicação, backup, restauração e atualizações: `../docs/manual-tecnico.md`

## Desenvolvimento

```powershell
npm install            # dependências + cliente Prisma
copy .env.example .env # preencher as strings do banco e os dados da empresa
npm run db:migrate     # tabelas
npm run db:seed        # lojas, status, configurações e 1º administrador
npm run dev            # http://localhost:3000
```

Verificações antes de publicar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Backup: `npm run backup` · Restauração: `npm run restaurar -- arquivo.json.gz`.

Tecnologias: Next.js 15 (App Router) · React 19 · TypeScript · Prisma 6 · PostgreSQL (Neon) · Tailwind CSS 4 · Zod · Recharts.
