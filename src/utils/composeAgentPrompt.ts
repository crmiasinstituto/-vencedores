import type { Agent } from '@/hooks/useUazapiAgents';

export function composePrompt(agent: Agent): string {
  const parts: string[] = [];

  if (agent.persona?.trim()) {
    parts.push(`[Persona e Papel]\n${agent.persona.trim()}`);
  }

  if (agent.skills?.length > 0) {
    const formatted = agent.skills
      .filter(s => s.title?.trim() || s.content?.trim())
      .map((s, i) => `Habilidade ${i + 1}: ${s.title}\n${s.content}`)
      .join('\n\n');
    if (formatted) parts.push(`[Habilidades]\n${formatted}`);
  }

  if (agent.productInfo?.trim()) {
    parts.push(`[Informações sobre Produtos/Serviços]\n${agent.productInfo.trim()}`);
  }

  if (agent.restrictions?.trim()) {
    parts.push(`[Restrições]\n${agent.restrictions.trim()}`);
  }

  if (agent.basePrompt?.trim()) {
    parts.push(`[Instruções Adicionais]\n${agent.basePrompt.trim()}`);
  }

  return parts.join('\n\n---\n\n');
}
