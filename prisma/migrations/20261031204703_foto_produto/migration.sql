/*
  Warnings:

  - You are about to drop the column `fotoUrl` on the `Produto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "fotoUrl";

-- CreateTable
CREATE TABLE "ProdutoFoto" (
    "produtoId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoFoto_pkey" PRIMARY KEY ("produtoId")
);

-- AddForeignKey
ALTER TABLE "ProdutoFoto" ADD CONSTRAINT "ProdutoFoto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
