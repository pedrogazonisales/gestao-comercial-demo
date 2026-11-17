import { z } from "zod";

export const esquemaNovaSenha = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres")
  .regex(/[A-Za-z]/, "A senha deve conter letras")
  .regex(/\d/, "A senha deve conter números");
