// Utilitário central de normalização de WhatsApp BR.
// Formato canônico esperado: 55 + DDD (2 dig) + 9 + 8 dígitos = 13 dígitos.
//
// Aceita inputs variados e tenta consertar:
//   '71991234567'        → '5571991234567' (faltava 55)
//   '5571991234567'      → '5571991234567' (já OK)
//   '557191234567'       → '5571991234567' (faltava o 9 da operadora)
//   '(71) 99123-4567'    → '5571991234567' (limpa pontuação)
//
// Não força reformatação de números fixos legítimos (12 dígitos sem 9 podem
// ser fixos comerciais — mas no contexto WhatsApp brasileiro 99% são celulares
// mal formatados, então convertemos).

export function normalizePhoneBR(raw: string | null | undefined): string {
  let n = (raw || "").replace(/\D/g, "");
  if (!n) return "";

  // 10-11 dígitos sem o 55 → adiciona 55
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) {
    n = "55" + n;
  }

  // 12 dígitos começando com 55 → adiciona o 9 da operadora (posição 4)
  // 5571 + 12345678 → 5571 9 12345678 = 13 dig
  if (n.startsWith("55") && n.length === 12) {
    n = n.slice(0, 4) + "9" + n.slice(4);
  }

  return n;
}

// True se o número está no formato esperado (55 + DDD válido + 13 dígitos).
export function isValidPhoneBR(raw: string | null | undefined): boolean {
  const n = normalizePhoneBR(raw);
  if (n.length !== 13) return false;
  if (!n.startsWith("55")) return false;
  const ddd = parseInt(n.slice(2, 4), 10);
  if (ddd < 11 || ddd > 99) return false;
  // Celular brasileiro começa com 9 após o DDD
  if (n[4] !== "9") return false;
  return true;
}

// Formato pretty pra exibição: +55 (71) 99123-4567
export function formatPhonePretty(raw: string | null | undefined): string {
  const n = normalizePhoneBR(raw);
  if (n.length !== 13) return raw || "";
  return `+55 (${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`;
}
