import { useState, useCallback } from 'react';

export interface VHSRegionData {
  estado: string;
  cidade: string;
  emoji: string;
  cor: string;
  mensagem: string;
  mensagemMotivacional: string;
  region: string;
}

// Mensagens motivacionais para o evento VHS ao Prompt - Profissionais 35+
const VHS_REGIOES_DDD: Record<string, VHSRegionData> = {
  // São Paulo
  '11': { 
    estado: 'SP', 
    cidade: 'São Paulo', 
    emoji: '🏙️', 
    cor: '#4F46E5', 
    mensagem: 'Metrópole dos sonhos!',
    mensagemMotivacional: 'Sampa! Aqui os visionários transformam experiência em revolução! Você acaba de dar o primeiro passo para liderar a nova era digital! 🏙️✨',
    region: 'Sudeste' 
  },
  '12': { 
    estado: 'SP', 
    cidade: 'Vale do Paraíba', 
    emoji: '🏞️', 
    cor: '#4F46E5', 
    mensagem: 'Vale do Paraíba!',
    mensagemMotivacional: 'Vale do Paraíba, berço de inovadores! Sua bagagem de vida é o combustível para dominar a IA! Vamos juntos! 🚀',
    region: 'Sudeste' 
  },
  '13': { 
    estado: 'SP', 
    cidade: 'Santos', 
    emoji: '⚓', 
    cor: '#4F46E5', 
    mensagem: 'Cidade portuária!',
    mensagemMotivacional: 'Santos, porto de oportunidades! Assim como os navios, você está prestes a zarpar para um futuro extraordinário! ⚓🌊',
    region: 'Sudeste' 
  },
  '14': { 
    estado: 'SP', 
    cidade: 'Bauru', 
    emoji: '🌾', 
    cor: '#4F46E5', 
    mensagem: 'Coração do interior!',
    mensagemMotivacional: 'Bauru! Do coração de São Paulo surge um protagonista da revolução da IA! Sua hora chegou! 💡',
    region: 'Sudeste' 
  },
  '15': { 
    estado: 'SP', 
    cidade: 'Sorocaba', 
    emoji: '🏭', 
    cor: '#4F46E5', 
    mensagem: 'Cidade industrial!',
    mensagemMotivacional: 'Sorocaba, terra de empreendedores! A indústria do futuro é a IA, e você está entrando nela agora! 🏭✨',
    region: 'Sudeste' 
  },
  '16': { 
    estado: 'SP', 
    cidade: 'Ribeirão Preto', 
    emoji: '☕', 
    cor: '#4F46E5', 
    mensagem: 'Terra do café!',
    mensagemMotivacional: 'Ribeirão Preto! Assim como o café revolucionou o Brasil, você vai revolucionar sua carreira com IA! ☕🚀',
    region: 'Sudeste' 
  },
  '17': { 
    estado: 'SP', 
    cidade: 'São José do Rio Preto', 
    emoji: '🌻', 
    cor: '#4F46E5', 
    mensagem: 'Portal do noroeste!',
    mensagemMotivacional: 'Rio Preto! Terra de pessoas determinadas que não param no tempo! Bem-vindo ao futuro! 🌻💪',
    region: 'Sudeste' 
  },
  '18': { 
    estado: 'SP', 
    cidade: 'Presidente Prudente', 
    emoji: '🐄', 
    cor: '#4F46E5', 
    mensagem: 'Terra do agro!',
    mensagemMotivacional: 'Presidente Prudente! Do agronegócio à IA, você está provando que experiência + tecnologia = sucesso! 🌾✨',
    region: 'Sudeste' 
  },
  '19': { 
    estado: 'SP', 
    cidade: 'Campinas', 
    emoji: '🎓', 
    cor: '#4F46E5', 
    mensagem: 'Vale do Silício BR!',
    mensagemMotivacional: 'Campinas, Vale do Silício brasileiro! Você já está no epicentro da inovação, agora é hora de dominar! 🎓🔥',
    region: 'Sudeste' 
  },

  // Rio de Janeiro
  '21': { 
    estado: 'RJ', 
    cidade: 'Rio de Janeiro', 
    emoji: '🏖️', 
    cor: '#06B6D4', 
    mensagem: 'Cidade Maravilhosa!',
    mensagemMotivacional: 'Carioca de mente aberta e coração quente! O Rio sempre foi berço de inovadores. Sua vez de brilhar chegou! 🌊🚀',
    region: 'Sudeste' 
  },
  '22': { 
    estado: 'RJ', 
    cidade: 'Campos dos Goytacazes', 
    emoji: '🛢️', 
    cor: '#06B6D4', 
    mensagem: 'Terra do petróleo!',
    mensagemMotivacional: 'Campos! Assim como o petróleo transformou a região, a IA vai transformar sua vida profissional! 🛢️✨',
    region: 'Sudeste' 
  },
  '24': { 
    estado: 'RJ', 
    cidade: 'Volta Redonda', 
    emoji: '⚙️', 
    cor: '#06B6D4', 
    mensagem: 'Cidade do aço!',
    mensagemMotivacional: 'Volta Redonda! Cidade que forjou o Brasil! Agora você vai forjar seu futuro com IA! ⚙️💪',
    region: 'Sudeste' 
  },

  // Minas Gerais
  '31': { 
    estado: 'MG', 
    cidade: 'Belo Horizonte', 
    emoji: '⛰️', 
    cor: '#059669', 
    mensagem: 'Coração de Minas!',
    mensagemMotivacional: 'Mineiro raiz, cabeça global! De BH para o mundo, seu futuro digital começa aqui! Uai, bora? ⛰️💡',
    region: 'Sudeste' 
  },
  '32': { 
    estado: 'MG', 
    cidade: 'Juiz de Fora', 
    emoji: '🏛️', 
    cor: '#059669', 
    mensagem: 'Manchester mineira!',
    mensagemMotivacional: 'Juiz de Fora, cidade de visionários! Sua experiência é ouro na era da IA! Vamos juntos! 🏛️✨',
    region: 'Sudeste' 
  },
  '33': { 
    estado: 'MG', 
    cidade: 'Governador Valadares', 
    emoji: '💎', 
    cor: '#059669', 
    mensagem: 'Vale do Rio Doce!',
    mensagemMotivacional: 'Valadares! Terra de gente corajosa que não tem medo de buscar o novo! Você é protagonista! 💎🚀',
    region: 'Sudeste' 
  },
  '34': { 
    estado: 'MG', 
    cidade: 'Uberlândia', 
    emoji: '🚛', 
    cor: '#059669', 
    mensagem: 'Portal do cerrado!',
    mensagemMotivacional: 'Uberlândia! Hub logístico do Brasil, agora hub de profissionais que dominam IA! 🚛💡',
    region: 'Sudeste' 
  },
  '35': { 
    estado: 'MG', 
    cidade: 'Poços de Caldas', 
    emoji: '♨️', 
    cor: '#059669', 
    mensagem: 'Águas termais!',
    mensagemMotivacional: 'Poços de Caldas! Assim como as águas renovam, a IA vai renovar sua carreira! ♨️✨',
    region: 'Sudeste' 
  },
  '37': { 
    estado: 'MG', 
    cidade: 'Divinópolis', 
    emoji: '🏭', 
    cor: '#059669', 
    mensagem: 'Polo da moda!',
    mensagemMotivacional: 'Divinópolis! Cidade que reinventa a moda, agora você reinventa sua carreira! 🏭👔',
    region: 'Sudeste' 
  },
  '38': { 
    estado: 'MG', 
    cidade: 'Montes Claros', 
    emoji: '🌵', 
    cor: '#059669', 
    mensagem: 'Capital do norte!',
    mensagemMotivacional: 'Montes Claros! Do norte de Minas surge um líder da nova economia! Você! 🌵🔥',
    region: 'Sudeste' 
  },

  // Espírito Santo
  '27': { 
    estado: 'ES', 
    cidade: 'Vitória', 
    emoji: '🏝️', 
    cor: '#0891B2', 
    mensagem: 'Ilha da vida!',
    mensagemMotivacional: 'Vitória! Ilha de oportunidades! Sua experiência combinada com IA é imbatível! 🏝️✨',
    region: 'Sudeste' 
  },
  '28': { 
    estado: 'ES', 
    cidade: 'Cachoeiro de Itapemirim', 
    emoji: '🗿', 
    cor: '#0891B2', 
    mensagem: 'Terra do mármore!',
    mensagemMotivacional: 'Cachoeiro! Sólido como o mármore, seu futuro na IA está garantido! 🗿💪',
    region: 'Sudeste' 
  },

  // Paraná
  '41': { 
    estado: 'PR', 
    cidade: 'Curitiba', 
    emoji: '🌲', 
    cor: '#16A34A', 
    mensagem: 'Capital ecológica!',
    mensagemMotivacional: 'Curitibano inovador! A capital da tecnologia do Sul te espera no futuro! Bora revolucionar! 🌲🚀',
    region: 'Sul' 
  },
  '42': { 
    estado: 'PR', 
    cidade: 'Ponta Grossa', 
    emoji: '🌾', 
    cor: '#16A34A', 
    mensagem: 'Princesa dos campos!',
    mensagemMotivacional: 'Ponta Grossa! Princesa dos Campos Gerais, agora príncipe/princesa da IA! 🌾👑',
    region: 'Sul' 
  },
  '43': { 
    estado: 'PR', 
    cidade: 'Londrina', 
    emoji: '☕', 
    cor: '#16A34A', 
    mensagem: 'Pequena Londres!',
    mensagemMotivacional: 'Londrina! Terra do café e de gente que não para! Seu café com IA está pronto! ☕💡',
    region: 'Sul' 
  },
  '44': { 
    estado: 'PR', 
    cidade: 'Maringá', 
    emoji: '🌸', 
    cor: '#16A34A', 
    mensagem: 'Cidade canção!',
    mensagemMotivacional: 'Maringá, cidade planejada! Assim como ela, sua carreira terá um novo planejamento com IA! 🌸✨',
    region: 'Sul' 
  },
  '45': { 
    estado: 'PR', 
    cidade: 'Foz do Iguaçu', 
    emoji: '💦', 
    cor: '#16A34A', 
    mensagem: 'Cataratas!',
    mensagemMotivacional: 'Foz do Iguaçu! A força das cataratas está em você! Prepare-se para uma cascata de oportunidades! 💦🌈',
    region: 'Sul' 
  },
  '46': { 
    estado: 'PR', 
    cidade: 'Francisco Beltrão', 
    emoji: '🏞️', 
    cor: '#16A34A', 
    mensagem: 'Portal do sudoeste!',
    mensagemMotivacional: 'Francisco Beltrão! Do sudoeste paranaense surge um profissional do futuro! Você! 🏞️🚀',
    region: 'Sul' 
  },

  // Santa Catarina
  '47': { 
    estado: 'SC', 
    cidade: 'Joinville', 
    emoji: '🏭', 
    cor: '#7C3AED', 
    mensagem: 'Cidade das flores!',
    mensagemMotivacional: 'Joinville! Cidade das flores e da indústria! Agora floresce também na IA! 🌺🏭',
    region: 'Sul' 
  },
  '48': { 
    estado: 'SC', 
    cidade: 'Florianópolis', 
    emoji: '🏝️', 
    cor: '#7C3AED', 
    mensagem: 'Ilha da magia!',
    mensagemMotivacional: 'Floripa! Ilha da Magia e das startups! Você já está no ecossistema certo! 🏝️✨',
    region: 'Sul' 
  },
  '49': { 
    estado: 'SC', 
    cidade: 'Chapecó', 
    emoji: '🐷', 
    cor: '#7C3AED', 
    mensagem: 'Capital do oeste!',
    mensagemMotivacional: 'Chapecó! Capital do agro catarinense, agora capital dos profissionais de IA! 🌽💪',
    region: 'Sul' 
  },

  // Rio Grande do Sul
  '51': { 
    estado: 'RS', 
    cidade: 'Porto Alegre', 
    emoji: '🧉', 
    cor: '#DC2626', 
    mensagem: 'Terra do chimarrão!',
    mensagemMotivacional: 'Tchê! Gaúcho de fibra e determinação! O pampa está orgulhoso de você! Bah, bora dominar a IA! 🧉🔥',
    region: 'Sul' 
  },
  '53': { 
    estado: 'RS', 
    cidade: 'Pelotas', 
    emoji: '🍰', 
    cor: '#DC2626', 
    mensagem: 'Princesa do sul!',
    mensagemMotivacional: 'Pelotas! Doce como seus tradicionais doces, seu futuro será ainda mais doce com IA! 🍰💛',
    region: 'Sul' 
  },
  '54': { 
    estado: 'RS', 
    cidade: 'Caxias do Sul', 
    emoji: '🍇', 
    cor: '#DC2626', 
    mensagem: 'Terra do vinho!',
    mensagemMotivacional: 'Caxias! Terra do vinho e do trabalho! Como um bom vinho, você só melhora com o tempo! 🍇🍷',
    region: 'Sul' 
  },
  '55': { 
    estado: 'RS', 
    cidade: 'Santa Maria', 
    emoji: '🎓', 
    cor: '#DC2626', 
    mensagem: 'Cidade universitária!',
    mensagemMotivacional: 'Santa Maria! Cidade do conhecimento! Agora é hora de um novo conhecimento: IA! 🎓💡',
    region: 'Sul' 
  },

  // Brasília
  '61': { 
    estado: 'DF', 
    cidade: 'Brasília', 
    emoji: '🏛️', 
    cor: '#F59E0B', 
    mensagem: 'Capital do Brasil!',
    mensagemMotivacional: 'Brasília! Do coração do poder, surge um profissional poderoso! Você vai liderar! 🏛️👑',
    region: 'Centro-Oeste' 
  },

  // Goiás
  '62': { 
    estado: 'GO', 
    cidade: 'Goiânia', 
    emoji: '🌻', 
    cor: '#F59E0B', 
    mensagem: 'Capital do cerrado!',
    mensagemMotivacional: 'Goiânia! Cidade que não para de crescer, assim como você! O cerrado aplaude! 🌻🚀',
    region: 'Centro-Oeste' 
  },
  '64': { 
    estado: 'GO', 
    cidade: 'Rio Verde', 
    emoji: '🌾', 
    cor: '#F59E0B', 
    mensagem: 'Celeiro do Brasil!',
    mensagemMotivacional: 'Rio Verde! Se você alimenta o Brasil, agora vai alimentar sua carreira com IA! 🌾💪',
    region: 'Centro-Oeste' 
  },

  // Mato Grosso
  '65': { 
    estado: 'MT', 
    cidade: 'Cuiabá', 
    emoji: '🐆', 
    cor: '#F59E0B', 
    mensagem: 'Portal do Pantanal!',
    mensagemMotivacional: 'Cuiabá! Quente como o coração do Brasil! Sua determinação é inspiradora! 🐆🔥',
    region: 'Centro-Oeste' 
  },
  '66': { 
    estado: 'MT', 
    cidade: 'Rondonópolis', 
    emoji: '🌾', 
    cor: '#F59E0B', 
    mensagem: 'Capital do agro!',
    mensagemMotivacional: 'Rondonópolis! Do agronegócio ao futuro digital, você está colhendo sucesso! 🌾✨',
    region: 'Centro-Oeste' 
  },

  // Mato Grosso do Sul
  '67': { 
    estado: 'MS', 
    cidade: 'Campo Grande', 
    emoji: '🐄', 
    cor: '#F59E0B', 
    mensagem: 'Cidade morena!',
    mensagemMotivacional: 'Campo Grande! Cidade Morena de gente guerreira! Seu primeiro passo foi dado! 🐄💛',
    region: 'Centro-Oeste' 
  },

  // Acre
  '68': { 
    estado: 'AC', 
    cidade: 'Rio Branco', 
    emoji: '🌳', 
    cor: '#10B981', 
    mensagem: 'Portal da Amazônia!',
    mensagemMotivacional: 'Rio Branco! Da floresta para o mundo digital! Você prova que localização não é limite! 🌳🌍',
    region: 'Norte' 
  },

  // Rondônia
  '69': { 
    estado: 'RO', 
    cidade: 'Porto Velho', 
    emoji: '🛶', 
    cor: '#10B981', 
    mensagem: 'Capital de Rondônia!',
    mensagemMotivacional: 'Porto Velho! Pioneiro ontem, pioneiro hoje! A IA é sua nova fronteira! 🛶🚀',
    region: 'Norte' 
  },

  // Bahia
  '71': { 
    estado: 'BA', 
    cidade: 'Salvador', 
    emoji: '🥁', 
    cor: '#EA580C', 
    mensagem: 'Terra do axé!',
    mensagemMotivacional: 'Axé, meu rei! Salvador, primeira capital, primeiro em inovação! O ritmo da IA é seu! 🥁🔥',
    region: 'Nordeste' 
  },
  '73': { 
    estado: 'BA', 
    cidade: 'Ilhéus', 
    emoji: '🍫', 
    cor: '#EA580C', 
    mensagem: 'Terra do cacau!',
    mensagemMotivacional: 'Ilhéus! Do cacau ao digital, você escreve uma nova história! Gabriela aplaudiria! 🍫✨',
    region: 'Nordeste' 
  },
  '74': { 
    estado: 'BA', 
    cidade: 'Juazeiro', 
    emoji: '🍇', 
    cor: '#EA580C', 
    mensagem: 'Oásis do sertão!',
    mensagemMotivacional: 'Juazeiro! Se floresce no sertão, floresce em qualquer lugar! Você é resistência! 🍇💪',
    region: 'Nordeste' 
  },
  '75': { 
    estado: 'BA', 
    cidade: 'Feira de Santana', 
    emoji: '🦅', 
    cor: '#EA580C', 
    mensagem: 'Princesa do Sertão!',
    mensagemMotivacional: 'Interior da Bahia, terra de pessoas com mente brilhante! Você acaba de dar o primeiro passo para ser o protagonista da sua vida! 🦅✨',
    region: 'Nordeste' 
  },
  '77': { 
    estado: 'BA', 
    cidade: 'Vitória da Conquista', 
    emoji: '🏔️', 
    cor: '#EA580C', 
    mensagem: 'Cidade das montanhas!',
    mensagemMotivacional: 'Vitória da Conquista! O nome já diz tudo! Você está conquistando seu futuro agora! 🏔️👑',
    region: 'Nordeste' 
  },

  // Sergipe
  '79': { 
    estado: 'SE', 
    cidade: 'Aracaju', 
    emoji: '🦀', 
    cor: '#EA580C', 
    mensagem: 'Terra do caranguejo!',
    mensagemMotivacional: 'Aracaju! Pequeno estado, grandes profissionais! Você é prova disso! 🦀💛',
    region: 'Nordeste' 
  },

  // Pernambuco
  '81': { 
    estado: 'PE', 
    cidade: 'Recife', 
    emoji: '🌉', 
    cor: '#DC2626', 
    mensagem: 'Veneza brasileira!',
    mensagemMotivacional: 'Recife! Porto Digital, Veneza Brasileira! Você já está no ecossistema de inovação! 🌉🚀',
    region: 'Nordeste' 
  },
  '87': { 
    estado: 'PE', 
    cidade: 'Petrolina', 
    emoji: '🍇', 
    cor: '#DC2626', 
    mensagem: 'Vale do São Francisco!',
    mensagemMotivacional: 'Petrolina! Do sertão que deu certo! Sua história de sucesso está começando! 🍇🔥',
    region: 'Nordeste' 
  },

  // Alagoas
  '82': { 
    estado: 'AL', 
    cidade: 'Maceió', 
    emoji: '🏝️', 
    cor: '#06B6D4', 
    mensagem: 'Paraíso das águas!',
    mensagemMotivacional: 'Maceió! Das águas cristalinas ao futuro digital! Seu caminho está claro! 🏝️✨',
    region: 'Nordeste' 
  },

  // Paraíba
  '83': { 
    estado: 'PB', 
    cidade: 'João Pessoa', 
    emoji: '🌅', 
    cor: '#06B6D4', 
    mensagem: 'Porta do sol!',
    mensagemMotivacional: 'João Pessoa! Onde o sol nasce primeiro! Seu novo dia está nascendo agora! 🌅💡',
    region: 'Nordeste' 
  },

  // Rio Grande do Norte
  '84': { 
    estado: 'RN', 
    cidade: 'Natal', 
    emoji: '🌴', 
    cor: '#FBBF24', 
    mensagem: 'Cidade do sol!',
    mensagemMotivacional: 'Natal! Cidade do Sol e da alegria! Seu futuro brilha como o sol potiguar! 🌴☀️',
    region: 'Nordeste' 
  },

  // Ceará
  '85': { 
    estado: 'CE', 
    cidade: 'Fortaleza', 
    emoji: '🌊', 
    cor: '#EA580C', 
    mensagem: 'Terra do sol!',
    mensagemMotivacional: 'Fortaleza! Terra da Luz e de gente forte! Você é um guerreiro do futuro! 🌊💪',
    region: 'Nordeste' 
  },
  '88': { 
    estado: 'CE', 
    cidade: 'Sobral', 
    emoji: '🌵', 
    cor: '#EA580C', 
    mensagem: 'Princesa do norte!',
    mensagemMotivacional: 'Sobral! Cidade que viu Einstein comprovar sua teoria! Agora você comprova a sua! 🌵✨',
    region: 'Nordeste' 
  },

  // Piauí
  '86': { 
    estado: 'PI', 
    cidade: 'Teresina', 
    emoji: '🌡️', 
    cor: '#F59E0B', 
    mensagem: 'Cidade verde!',
    mensagemMotivacional: 'Teresina! Quente em clima, quente em determinação! Você está pegando fogo! 🌡️🔥',
    region: 'Nordeste' 
  },
  '89': { 
    estado: 'PI', 
    cidade: 'Picos', 
    emoji: '🏔️', 
    cor: '#F59E0B', 
    mensagem: 'Coração do Piauí!',
    mensagemMotivacional: 'Picos! Do coração do Piauí para o mundo! Sua jornada épica começa! 🏔️🚀',
    region: 'Nordeste' 
  },

  // Maranhão
  '98': { 
    estado: 'MA', 
    cidade: 'São Luís', 
    emoji: '🏰', 
    cor: '#7C3AED', 
    mensagem: 'Ilha do amor!',
    mensagemMotivacional: 'São Luís! Patrimônio da Humanidade criando patrimônios digitais! Reggae do futuro! 🏰🎵',
    region: 'Nordeste' 
  },
  '99': { 
    estado: 'MA', 
    cidade: 'Imperatriz', 
    emoji: '🌊', 
    cor: '#7C3AED', 
    mensagem: 'Portal da Amazônia!',
    mensagemMotivacional: 'Imperatriz! Nome de realeza para um profissional de realeza! 🌊👑',
    region: 'Nordeste' 
  },

  // Amazonas
  '92': { 
    estado: 'AM', 
    cidade: 'Manaus', 
    emoji: '🐬', 
    cor: '#10B981', 
    mensagem: 'Coração da Amazônia!',
    mensagemMotivacional: 'Manaus! Do Teatro Amazonas ao teatro digital! Sua apresentação está começando! 🐬🎭',
    region: 'Norte' 
  },
  '97': { 
    estado: 'AM', 
    cidade: 'Tefé', 
    emoji: '🐟', 
    cor: '#10B981', 
    mensagem: 'Portal do Amazonas!',
    mensagemMotivacional: 'Tefé! Do coração da floresta, você conecta com o mundo! Parabéns, desbravador! 🐟🌳',
    region: 'Norte' 
  },

  // Pará
  '91': { 
    estado: 'PA', 
    cidade: 'Belém', 
    emoji: '🌺', 
    cor: '#10B981', 
    mensagem: 'Portal da Amazônia!',
    mensagemMotivacional: 'Belém! Onde o açaí encontra a inovação! Seu futuro está purple! 🌺💜',
    region: 'Norte' 
  },
  '93': { 
    estado: 'PA', 
    cidade: 'Santarém', 
    emoji: '🛶', 
    cor: '#10B981', 
    mensagem: 'Pérola do Tapajós!',
    mensagemMotivacional: 'Santarém! Encontro das águas, encontro de oportunidades! Você está no lugar certo! 🛶💎',
    region: 'Norte' 
  },
  '94': { 
    estado: 'PA', 
    cidade: 'Marabá', 
    emoji: '⛏️', 
    cor: '#10B981', 
    mensagem: 'Terra do ferro!',
    mensagemMotivacional: 'Marabá! Forte como o ferro que produz! Sua força é inspiradora! ⛏️💪',
    region: 'Norte' 
  },

  // Roraima
  '95': { 
    estado: 'RR', 
    cidade: 'Boa Vista', 
    emoji: '🌄', 
    cor: '#10B981', 
    mensagem: 'Portal do Caribe!',
    mensagemMotivacional: 'Boa Vista! Do extremo norte, uma visão ampla do futuro! Você enxerga longe! 🌄👁️',
    region: 'Norte' 
  },

  // Amapá
  '96': { 
    estado: 'AP', 
    cidade: 'Macapá', 
    emoji: '🌍', 
    cor: '#10B981', 
    mensagem: 'Marco zero do mundo!',
    mensagemMotivacional: 'Macapá! No marco zero, você marca o início de uma nova era! Linha do Equador te saúda! 🌍✨',
    region: 'Norte' 
  },

  // Tocantins
  '63': { 
    estado: 'TO', 
    cidade: 'Palmas', 
    emoji: '🌅', 
    cor: '#F59E0B', 
    mensagem: 'Estado mais novo!',
    mensagemMotivacional: 'Palmas! Estado jovem, profissionais jovens de espírito! Você renova sempre! 🌅🚀',
    region: 'Norte' 
  },
};

export const useVHSRegionDetector = () => {
  const [regionData, setRegionData] = useState<VHSRegionData | null>(null);

  const detectRegion = useCallback((ddd: string) => {
    const data = VHS_REGIOES_DDD[ddd];
    setRegionData(data || null);
  }, []);

  const clearRegion = useCallback(() => {
    setRegionData(null);
  }, []);

  return {
    regionData,
    detectRegion,
    clearRegion,
    allRegions: VHS_REGIOES_DDD
  };
};
