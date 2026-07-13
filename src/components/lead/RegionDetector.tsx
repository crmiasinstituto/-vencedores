import { useState, useCallback } from 'react';

export interface RegionData {
  estado: string;
  cidade: string;
  emoji: string;
  cor: string;
  mensagem: string;
  region: string;
}

const REGIOES_DDD: Record<string, RegionData> = {
  // São Paulo
  '11': { estado: 'SP', cidade: 'São Paulo', emoji: '🏙️', cor: '#4F46E5', mensagem: 'Metrópole dos sonhos! Onde cada empresário é um guerreiro urbano! 🚀', region: 'Sudeste' },
  '12': { estado: 'SP', cidade: 'Vale do Paraíba', emoji: '🏞️', cor: '#4F46E5', mensagem: 'Vale do Paraíba! Terra das montanhas!', region: 'Sudeste' },
  '13': { estado: 'SP', cidade: 'Santos', emoji: '⚓', cor: '#4F46E5', mensagem: 'Santos! Cidade do porto!', region: 'Sudeste' },
  '14': { estado: 'SP', cidade: 'Bauru', emoji: '🌾', cor: '#4F46E5', mensagem: 'Bauru! Coração do interior paulista!', region: 'Sudeste' },
  '15': { estado: 'SP', cidade: 'Sorocaba', emoji: '🏭', cor: '#4F46E5', mensagem: 'Sorocaba! Cidade industrial!', region: 'Sudeste' },
  '16': { estado: 'SP', cidade: 'Ribeirão Preto', emoji: '☕', cor: '#4F46E5', mensagem: 'Ribeirão Preto! Terra do café!', region: 'Sudeste' },
  '17': { estado: 'SP', cidade: 'São José do Rio Preto', emoji: '🌻', cor: '#4F46E5', mensagem: 'São José do Rio Preto! Portal do noroeste!', region: 'Sudeste' },
  '18': { estado: 'SP', cidade: 'Presidente Prudente', emoji: '🐄', cor: '#4F46E5', mensagem: 'Presidente Prudente! Terra do agronegócio!', region: 'Sudeste' },
  '19': { estado: 'SP', cidade: 'Campinas', emoji: '🎓', cor: '#4F46E5', mensagem: 'Campinas! Vale do Silício brasileiro!', region: 'Sudeste' },

  // Rio de Janeiro
  '21': { estado: 'RJ', cidade: 'Rio de Janeiro', emoji: '🏖️', cor: '#06B6D4', mensagem: 'Cidade maravilhosa onde a criatividade empresarial é contagiante! 🌊✨', region: 'Sudeste' },
  '22': { estado: 'RJ', cidade: 'Campos dos Goytacazes', emoji: '🛢️', cor: '#06B6D4', mensagem: 'Campos! Terra do petróleo!', region: 'Sudeste' },
  '24': { estado: 'RJ', cidade: 'Volta Redonda', emoji: '⚙️', cor: '#06B6D4', mensagem: 'Volta Redonda! Cidade do aço!', region: 'Sudeste' },

  // Minas Gerais
  '31': { estado: 'MG', cidade: 'Belo Horizonte', emoji: '⛰️', cor: '#059669', mensagem: 'BH! Coração de Minas!', region: 'Sudeste' },
  '32': { estado: 'MG', cidade: 'Juiz de Fora', emoji: '🏛️', cor: '#059669', mensagem: 'Juiz de Fora! Manchester mineira!', region: 'Sudeste' },
  '33': { estado: 'MG', cidade: 'Governador Valadares', emoji: '💎', cor: '#059669', mensagem: 'Governador Valadares! Vale do Rio Doce!', region: 'Sudeste' },
  '34': { estado: 'MG', cidade: 'Uberlândia', emoji: '🚛', cor: '#059669', mensagem: 'Uberlândia! Portal do cerrado!', region: 'Sudeste' },
  '35': { estado: 'MG', cidade: 'Poços de Caldas', emoji: '♨️', cor: '#059669', mensagem: 'Poços de Caldas! Águas termais!', region: 'Sudeste' },
  '37': { estado: 'MG', cidade: 'Divinópolis', emoji: '🏭', cor: '#059669', mensagem: 'Divinópolis! Coração de Minas!', region: 'Sudeste' },
  '38': { estado: 'MG', cidade: 'Montes Claros', emoji: '🌵', cor: '#059669', mensagem: 'Montes Claros! Capital do norte de Minas!', region: 'Sudeste' },

  // Espírito Santo
  '27': { estado: 'ES', cidade: 'Vitória', emoji: '🏝️', cor: '#0891B2', mensagem: 'Vitória! Ilha da vida!', region: 'Sudeste' },
  '28': { estado: 'ES', cidade: 'Cachoeiro de Itapemirim', emoji: '🗿', cor: '#0891B2', mensagem: 'Cachoeiro! Terra do mármore!', region: 'Sudeste' },

  // Paraná
  '41': { estado: 'PR', cidade: 'Curitiba', emoji: '🌲', cor: '#16A34A', mensagem: 'Curitibano! Capital ecológica!', region: 'Sul' },
  '42': { estado: 'PR', cidade: 'Ponta Grossa', emoji: '🌾', cor: '#16A34A', mensagem: 'Ponta Grossa! Princesa dos campos!', region: 'Sul' },
  '43': { estado: 'PR', cidade: 'Londrina', emoji: '☕', cor: '#16A34A', mensagem: 'Londrina! Pequena Londres!', region: 'Sul' },
  '44': { estado: 'PR', cidade: 'Maringá', emoji: '🌸', cor: '#16A34A', mensagem: 'Maringá! Cidade canção!', region: 'Sul' },
  '45': { estado: 'PR', cidade: 'Foz do Iguaçu', emoji: '💦', cor: '#16A34A', mensagem: 'Foz do Iguaçu! Cataratas maravilhosas!', region: 'Sul' },
  '46': { estado: 'PR', cidade: 'Francisco Beltrão', emoji: '🏞️', cor: '#16A34A', mensagem: 'Francisco Beltrão! Portal do sudoeste!', region: 'Sul' },

  // Santa Catarina
  '47': { estado: 'SC', cidade: 'Joinville', emoji: '🏭', cor: '#7C3AED', mensagem: 'Joinville! Cidade das flores!', region: 'Sul' },
  '48': { estado: 'SC', cidade: 'Florianópolis', emoji: '🏝️', cor: '#7C3AED', mensagem: 'Floripa! Ilha da magia!', region: 'Sul' },
  '49': { estado: 'SC', cidade: 'Chapecó', emoji: '🐷', cor: '#7C3AED', mensagem: 'Chapecó! Capital do oeste catarinense!', region: 'Sul' },

  // Rio Grande do Sul
  '51': { estado: 'RS', cidade: 'Porto Alegre', emoji: '🧉', cor: '#DC2626', mensagem: 'Tchê! Terra do chimarrão!', region: 'Sul' },
  '53': { estado: 'RS', cidade: 'Pelotas', emoji: '🍰', cor: '#DC2626', mensagem: 'Pelotas! Princesa do sul!', region: 'Sul' },
  '54': { estado: 'RS', cidade: 'Caxias do Sul', emoji: '🍇', cor: '#DC2626', mensagem: 'Caxias! Terra da uva e do vinho!', region: 'Sul' },
  '55': { estado: 'RS', cidade: 'Santa Maria', emoji: '🎓', cor: '#DC2626', mensagem: 'Santa Maria! Cidade universitária!', region: 'Sul' },

  // Brasília
  '61': { estado: 'DF', cidade: 'Brasília', emoji: '🏛️', cor: '#F59E0B', mensagem: 'Brasília! Capital do Brasil!', region: 'Centro-Oeste' },

  // Goiás
  '62': { estado: 'GO', cidade: 'Goiânia', emoji: '🌻', cor: '#F59E0B', mensagem: 'Goiânia! Capital do cerrado!', region: 'Centro-Oeste' },
  '64': { estado: 'GO', cidade: 'Rio Verde', emoji: '🌾', cor: '#F59E0B', mensagem: 'Rio Verde! Celeiro do Brasil!', region: 'Centro-Oeste' },

  // Mato Grosso
  '65': { estado: 'MT', cidade: 'Cuiabá', emoji: '🐆', cor: '#F59E0B', mensagem: 'Cuiabá! Portal do Pantanal!', region: 'Centro-Oeste' },
  '66': { estado: 'MT', cidade: 'Rondonópolis', emoji: '🌾', cor: '#F59E0B', mensagem: 'Rondonópolis! Capital do agronegócio!', region: 'Centro-Oeste' },

  // Mato Grosso do Sul
  '67': { estado: 'MS', cidade: 'Campo Grande', emoji: '🐄', cor: '#F59E0B', mensagem: 'Campo Grande! Cidade morena!', region: 'Centro-Oeste' },

  // Acre
  '68': { estado: 'AC', cidade: 'Rio Branco', emoji: '🌳', cor: '#10B981', mensagem: 'Rio Branco! Portal da Amazônia!', region: 'Norte' },

  // Rondônia
  '69': { estado: 'RO', cidade: 'Porto Velho', emoji: '🛶', cor: '#10B981', mensagem: 'Porto Velho! Capital de Rondônia!', region: 'Norte' },

  // Bahia
  '71': { estado: 'BA', cidade: 'Salvador', emoji: '🥥', cor: '#EA580C', mensagem: 'Axé! Terra dos negócios que nunca param! 🥁🔥', region: 'Nordeste' },
  '73': { estado: 'BA', cidade: 'Ilhéus', emoji: '🍫', cor: '#EA580C', mensagem: 'Ilhéus! Terra do cacau!', region: 'Nordeste' },
  '74': { estado: 'BA', cidade: 'Juazeiro', emoji: '🍇', cor: '#EA580C', mensagem: 'Juazeiro! Oásis do sertão!', region: 'Nordeste' },
  '75': { estado: 'BA', cidade: 'Feira de Santana', emoji: '🦅', cor: '#EA580C', mensagem: 'Princesa do Sertão onde os empresários têm espírito de águia! 🦅✨', region: 'Nordeste' },
  '77': { estado: 'BA', cidade: 'Vitória da Conquista', emoji: '🏔️', cor: '#EA580C', mensagem: 'Conquista! Cidade das montanhas!', region: 'Nordeste' },

  // Sergipe
  '79': { estado: 'SE', cidade: 'Aracaju', emoji: '🦀', cor: '#EA580C', mensagem: 'Aracaju! Terra do caranguejo!', region: 'Nordeste' },

  // Pernambuco
  '81': { estado: 'PE', cidade: 'Recife', emoji: '🦈', cor: '#DC2626', mensagem: 'Recife! Veneza brasileira!', region: 'Nordeste' },
  '87': { estado: 'PE', cidade: 'Petrolina', emoji: '🍇', cor: '#DC2626', mensagem: 'Petrolina! Vale do São Francisco!', region: 'Nordeste' },

  // Alagoas
  '82': { estado: 'AL', cidade: 'Maceió', emoji: '🏝️', cor: '#06B6D4', mensagem: 'Maceió! Paraíso das águas!', region: 'Nordeste' },

  // Paraíba
  '83': { estado: 'PB', cidade: 'João Pessoa', emoji: '🏖️', cor: '#06B6D4', mensagem: 'João Pessoa! Porta do sol!', region: 'Nordeste' },

  // Rio Grande do Norte
  '84': { estado: 'RN', cidade: 'Natal', emoji: '🌴', cor: '#FBBF24', mensagem: 'Natal! Cidade do sol!', region: 'Nordeste' },

  // Ceará
  '85': { estado: 'CE', cidade: 'Fortaleza', emoji: '🌴', cor: '#EA580C', mensagem: 'Fortaleza! Terra do sol!', region: 'Nordeste' },
  '88': { estado: 'CE', cidade: 'Sobral', emoji: '🌵', cor: '#EA580C', mensagem: 'Sobral! Princesa do norte!', region: 'Nordeste' },

  // Piauí
  '86': { estado: 'PI', cidade: 'Teresina', emoji: '🌡️', cor: '#F59E0B', mensagem: 'Teresina! Cidade verde!', region: 'Nordeste' },
  '89': { estado: 'PI', cidade: 'Picos', emoji: '🏔️', cor: '#F59E0B', mensagem: 'Picos! Coração do Piauí!', region: 'Nordeste' },

  // Maranhão
  '98': { estado: 'MA', cidade: 'São Luís', emoji: '🏰', cor: '#7C3AED', mensagem: 'São Luís! Ilha do amor!', region: 'Nordeste' },
  '99': { estado: 'MA', cidade: 'Imperatriz', emoji: '🌊', cor: '#7C3AED', mensagem: 'Imperatriz! Portal da Amazônia!', region: 'Nordeste' },

  // Amazonas
  '92': { estado: 'AM', cidade: 'Manaus', emoji: '🐬', cor: '#10B981', mensagem: 'Manaus! Coração da Amazônia!', region: 'Norte' },
  '97': { estado: 'AM', cidade: 'Tefé', emoji: '🐟', cor: '#10B981', mensagem: 'Tefé! Portal do Amazonas!', region: 'Norte' },

  // Pará
  '91': { estado: 'PA', cidade: 'Belém', emoji: '🌺', cor: '#10B981', mensagem: 'Belém! Portal da Amazônia!', region: 'Norte' },
  '93': { estado: 'PA', cidade: 'Santarém', emoji: '🛶', cor: '#10B981', mensagem: 'Santarém! Pérola do Tapajós!', region: 'Norte' },
  '94': { estado: 'PA', cidade: 'Marabá', emoji: '⛏️', cor: '#10B981', mensagem: 'Marabá! Terra do ferro!', region: 'Norte' },

  // Roraima
  '95': { estado: 'RR', cidade: 'Boa Vista', emoji: '🌄', cor: '#10B981', mensagem: 'Boa Vista! Portal do Caribe!', region: 'Norte' },

  // Amapá
  '96': { estado: 'AP', cidade: 'Macapá', emoji: '🌍', cor: '#10B981', mensagem: 'Macapá! Marco zero do mundo!', region: 'Norte' },
};

export const useRegionDetector = () => {
  const [regionData, setRegionData] = useState<RegionData | null>(null);

  const detectRegion = useCallback((ddd: string) => {
    const data = REGIOES_DDD[ddd];
    setRegionData(data || null);
  }, []);

  const clearRegion = useCallback(() => {
    setRegionData(null);
  }, []);

  return {
    regionData,
    detectRegion,
    clearRegion,
    allRegions: REGIOES_DDD
  };
};