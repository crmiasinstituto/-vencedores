// ============================================================
// _prospeccao-shared/gemini.ts
// Wrapper de chamada Gemini com retry automático pra 503/429.
//
// Erros tratados:
//  - 503 Service Unavailable (modelo sobrecarregado): retry com backoff
//  - 429 Too Many Requests (quota): retry após delay maior
//  - Network errors: retry simples
// ============================================================

interface GeminiCallOpts {
  model?: string; // default 'gemini-2.5-flash'
  temperature?: number;
  responseMimeType?: "application/json" | "text/plain";
  maxRetries?: number; // default 3
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  opts: GeminiCallOpts = {}
): Promise<{ text: string; raw: unknown }> {
  const {
    model = "gemini-2.5-flash",
    temperature = 0.4,
    responseMimeType = "application/json",
    maxRetries = 3,
  } = opts;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, responseMimeType },
  });

  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return { text, raw: data };
      }

      const errText = await res.text();
      lastError = `HTTP ${res.status}: ${errText.slice(0, 300)}`;

      // 503 (overloaded) ou 429 (quota): retry com backoff
      if (res.status === 503 || res.status === 429) {
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000); // 1s, 2s, 4s, 8s
          console.warn(`[gemini] ${res.status} retry ${attempt + 1}/${maxRetries} em ${delayMs}ms`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }

      // Erros não-retryable (400, 401, 404, etc): não tenta de novo
      throw new Error(lastError);
    } catch (e) {
      lastError = (e as Error).message || String(e);
      // Network/timeout: retry simples
      if (attempt < maxRetries && !/HTTP 4\d\d/.test(lastError)) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw e;
    }
  }

  throw new Error(`Gemini falhou após ${maxRetries + 1} tentativas: ${lastError}`);
}
