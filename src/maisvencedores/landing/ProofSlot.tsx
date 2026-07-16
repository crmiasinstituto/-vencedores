/**
 * Espaço reservado pra prova social (depoimento, vídeo, foto de evento, print de resultado).
 *
 * Aparece SÓ em desenvolvimento. Em produção some sem deixar buraco — a landing entra no ar
 * enxuta em vez de mostrar caixa tracejada pro lead, e a gente não é tentado a preencher com
 * depoimento inventado só pra tapar o vazio. Quando o material real chegar, troque o
 * <ProofSlot> pelo conteúdo de verdade.
 *
 * Isto substitui os depoimentos que vinham no template da Lovada ("Ricardo Mendes, CEO
 * TechVentures", foto de banco de imagem, "fechei R$ 180 mil"): eram pessoas e números
 * inventados numa página que vende.
 */
export function ProofSlot({
  indice,
  o_que,
  porque,
}: {
  indice: number;
  o_que: string;
  porque: string;
}) {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="slot">
      <span className="k">Espaço para prova — {indice} de 3</span>
      <p>{o_que}</p>
      <p className="h">{porque}</p>
    </div>
  );
}

export default ProofSlot;
