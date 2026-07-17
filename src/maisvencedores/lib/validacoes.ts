/**
 * Validações e máscaras dos campos do cadastro.
 *
 * CPF valida os dígitos verificadores de verdade — não só o formato. Um CPF com máscara certa
 * mas inválido passaria numa checagem de regex, e aí o time recebe cadastro com documento
 * falso. O algoritmo é o oficial da Receita.
 */

export function apenasDigitos(v: string): string {
  return (v || '').replace(/\D/g, '');
}

/** Valida CPF pelos dígitos verificadores. Recusa os repetidos (111.111...) que passam na conta. */
export function cpfValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 00000000000, 11111111111...

  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function mascaraCpf(v: string): string {
  const d = apenasDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascaraTelefone(v: string): string {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

/** Telefone brasileiro: 10 (fixo) ou 11 (celular) dígitos. */
export function telefoneValido(v: string): boolean {
  const d = apenasDigitos(v);
  return d.length === 10 || d.length === 11;
}

/** Instagram sem @, só o handle. Aceita letras, números, ponto e underscore. */
export function normalizaInstagram(v: string): string {
  return (v || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
}

export function instagramValido(v: string): boolean {
  const h = normalizaInstagram(v);
  return /^[a-zA-Z0-9._]{1,30}$/.test(h);
}

/** Precisa ser data no passado e pessoa com pelo menos 16 anos (piso pra evitar erro de digitação). */
export function nascimentoValido(iso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  if (d >= hoje) return false;
  const idade = (hoje.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return idade >= 16 && idade <= 120;
}
