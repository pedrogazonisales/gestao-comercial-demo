-- AlterTable
ALTER TABLE "Recebimento" ADD COLUMN     "estornadoEm" TIMESTAMP(3),
ADD COLUMN     "estornadoPorId" TEXT,
ADD COLUMN     "lojaId" TEXT,
ADD COLUMN     "motivoEstorno" TEXT;

-- CreateIndex
CREATE INDEX "Recebimento_parcelaId_idx" ON "Recebimento"("parcelaId");

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_estornadoPorId_fkey" FOREIGN KEY ("estornadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
