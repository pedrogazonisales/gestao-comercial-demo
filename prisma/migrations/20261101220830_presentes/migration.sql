-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "presente" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PresenteCliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "data" DATE,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenteCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenteContato" (
    "id" TEXT NOT NULL,
    "presenteId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canal" "CanalContato" NOT NULL,
    "resultado" TEXT NOT NULL,

    CONSTRAINT "PresenteContato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresenteCliente_vendaId_key" ON "PresenteCliente"("vendaId");

-- CreateIndex
CREATE INDEX "PresenteCliente_clienteId_idx" ON "PresenteCliente"("clienteId");

-- CreateIndex
CREATE INDEX "PresenteContato_presenteId_ano_idx" ON "PresenteContato"("presenteId", "ano");

-- AddForeignKey
ALTER TABLE "PresenteCliente" ADD CONSTRAINT "PresenteCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteCliente" ADD CONSTRAINT "PresenteCliente_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteContato" ADD CONSTRAINT "PresenteContato_presenteId_fkey" FOREIGN KEY ("presenteId") REFERENCES "PresenteCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteContato" ADD CONSTRAINT "PresenteContato_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
