
import type { AppSettings } from '../types';

export const DEFAULT_PROMPTS: AppSettings = {
  generalContextPrompt: `Analise todo o conteúdo do roteiro fornecido abaixo de um arquivo CSV. Com base em todos os locais e descrições de cena, gere um único parágrafo conciso que resuma o contexto geral. Este contexto deve descrever o cenário geral, o humor dominante, a atmosfera e o estilo visual da história (por exemplo, "Um thriller noir corajoso e encharcado de chuva, ambientado na Nova York dos anos 1940. O clima é tenso e melancólico, com um estilo visual que enfatiza sombras de alto contraste e cores dessaturadas."). Este contexto será usado para guiar todas as gerações de imagens. Responda APENAS com o parágrafo de contexto como uma única string.`,

  characterGenerationPrompt: `Analise o seguinte conteúdo de um roteiro em CSV. Extraia uma lista de todos os personagens únicos. Para cada personagem, forneça seu nome e uma descrição concisa de suas características físicas com base nas descrições das cenas.

**Instrução Crítica:** Ao criar as descrições, garanta que o elenco de personagens seja diverso em etnia, idade e aparência geral, a menos que o roteiro especifique o contrário. Seja criativo ao preencher os detalhes que faltam para evitar a criação de personagens que pareçam semelhantes.

Responda SOMENTE com um array JSON.`,

  sceneAnalysisPrompt: `Dada uma lista de personagens conhecidos, a localização e a descrição da cena de um roteiro, execute duas tarefas:
1. Reescreva a descrição da cena, localizando menções dos personagens da lista fornecida e adicionando uma tag com seu nome exato no formato [Nome do Personagem]. Seja rigoroso e use apenas os nomes da lista.
2. Crie um prompt detalhado e vívido para um modelo de geração de imagem que capture a essência da cena, incluindo a localização, ações, os personagens marcados e a atmosfera. {style_instruction}

**Instrução Importante:** Ignore quaisquer marcadores de referência de cena no texto da descrição (como "[ref:3]", "(img 3)", ou "continuidade da cena 3") ao criar a descrição com tags e o prompt da imagem. Essas são notas para o sistema e não devem fazer parte da descrição visual.

Lista de Personagens Conhecidos: {character_list}

Localização: {location}
Descrição: {description}

Responda SOMENTE com um objeto JSON.`,

  characterImagePrompt: `Retrato fotorrealista de altíssima qualidade de uma única pessoa. Detalhes do personagem: {physical_characteristics}. A pessoa deve estar centralizada no quadro. Estilo: iluminação cinematográfica e natural, foco nítido no personagem, fundo sutil e levemente desfocado que complementa o personagem sem distrair. Qualidade: nível de fotografia profissional, com atenção a detalhes como textura da pele, cabelo e olhos. Crítico: Sem desenhos, sem renderizações 3D, sem elementos de fantasia ou artefatos de IA. A imagem DEVE ter uma proporção estrita de 16:9 (widescreen).`,
};
