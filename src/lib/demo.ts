// Modo demonstração (portfólio): ligado só com MODO_DEMO=1 no .env / Vercel.
// Mostra o acesso público admin/admin no login, abre a sessão direto pelo link /demo
// e impede que um visitante troque a senha ou desative o usuário da demonstração.
export const MODO_DEMO = process.env.MODO_DEMO === "1";
export const LOGIN_DEMO = "admin";
export const SENHA_DEMO = "admin";
export const AVISO_DEMO = "Na demonstração, o usuário admin não pode ter senha, login, perfil ou situação alterados.";

/** Verdadeiro quando a alteração pedida atingiria o usuário público da demonstração. */
export function protegidoNaDemo(login: string | null | undefined) {
  return MODO_DEMO && login === LOGIN_DEMO;
}
