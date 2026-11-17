export function urlFoto(produtoId: string, atualizadaEm?: Date | null) {
  return atualizadaEm ? `/api/produtos/${produtoId}/foto?v=${atualizadaEm.getTime()}` : null;
}

/** Valor em formato de digitação brasileira (1299,90) para preencher campos. */
export function valorParaCampo(valor: { toString(): string } | number) {
  return Number(valor).toFixed(2).replace(".", ",");
}
