export function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/** Valida CPF pelos dígitos verificadores. Aceita com ou sem máscara. */
export function cpfValido(valor: string) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(cpf.slice(0, 9), 10);
  const d2 = digito(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export function formatarCpf(valor: string) {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** Exibição parcial (LGPD) em listagens: ***.456.789-** */
export function mascararCpf(valor: string) {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return valor;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
