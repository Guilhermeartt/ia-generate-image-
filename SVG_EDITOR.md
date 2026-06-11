# Editor SVG - Documento vivo

> Atualize este arquivo durante cada mudança relevante no módulo. Ele é o
> ponto de entrada para qualquer agente ou pessoa que continuar o trabalho.

## Estado atual

**Marco concluído:** MVP funcional integrado, testado e validado visualmente.

**Marco 2 concluído:** evolução visual e funcional baseada no protótipo
`/Users/guilherme.artt/Downloads/svg_editor_module.html`.

**Marco 3 concluído:** fundação profissional de interação, segurança e
persistência.

Entregue neste marco:

- prancheta com proporção exata, borda exportável e margem segura visível;
- zoom, pan, ajuste à tela e snapping em grade;
- resize genérico e rotação por alças;
- atualização direta do nó durante gestos e uma serialização por ação;
- histórico agrupado para alterações contínuas;
- camadas hierárquicas com visibilidade e bloqueio;
- autosave local versionado;
- dimensões personalizadas do modelo;
- mutações com a mesma validação de segurança da importação;
- importação em lote de SVG, imagens e fontes vinculadas pelo Illustrator;
- incorporação de JPEG/PNG/WebP e fontes TTF/OTF/WOFF no SVG exportado;
- sanitização de ícones e URLs de imagem do renderizador de templates;
- duplicação com remapeamento de IDs e referências internas;
- proteção de textos estruturados com `tspan` e `textPath`;
- atalhos de nudge, duplicação e ajuste da câmera.

Escopo aceito para este marco:

- toolbar compacta;
- painel lateral com aparência, transformação, camadas e upload;
- linha, texto, estrela e triângulo;
- ordem das camadas;
- tracejado;
- redimensionamento de retângulos e elipses;
- statusbar com ferramenta, posição e contagem.

Fora deste marco: edição Bézier, agrupamento e filtros avançados. Esses recursos
não serão copiados usando manipulação de string ou CSS `style`, pois isso
quebraria a segurança e a fidelidade de SVGs importados.

## Referência visual

O arquivo `svg_editor_module.html` foi usado como referência de produto e
interação, não como código para incorporação direta. O protótipo mantém formas
em um array proprietário, usa estilos CSS dentro do SVG e traduz paths por
regex. A implementação React preserva o markup SVG sanitizado como fonte da
verdade.

Portado neste marco:

- toolbar compacta com ferramentas e comandos;
- painel lateral esquerdo;
- paleta de cores;
- tracejados;
- transformação numérica;
- painel de camadas;
- upload no painel;
- linha, texto, estrela e triângulo;
- trazer para frente e enviar para o fundo;
- redimensionamento de retângulos, círculos e elipses;
- statusbar com ferramenta, coordenadas e contagem.

Não portado ainda:

- ferramenta de nós Bézier;
- blur, brilho, contraste e sombra;
- operações booleanas;
- edição simultânea multiusuário.

O editor será implementado em `components/svg-editor/` e terá uma view própria
registrada em `config/views.tsx`.

## Objetivo

Permitir que o usuário:

- crie formas vetoriais básicas;
- importe SVG sem executar conteúdo ativo;
- selecione, mova e edite propriedades visuais;
- mantenha o conteúdo como SVG real;
- desfaça e refaça alterações;
- exporte o resultado como `.svg`;
- evolua depois para edição detalhada de nós e alças Bézier.

## Decisões de arquitetura

### SVG nativo como fonte da verdade

O documento não é convertido para canvas ou para um formato proprietário.
Mantemos uma string SVG sanitizada e renderizamos os elementos dentro de um
`<svg>`. As alterações são aplicadas aos atributos SVG e serializadas de volta.

Motivos:

- preserva `path`, grupos, gradientes e filtros compatíveis;
- evita perdas de importação/exportação;
- o arquivo exportado continua editável em ferramentas externas;
- facilita inspecionar e depurar o resultado.

### Camada de interação em React

React controla ferramenta ativa, seleção, histórico, propriedades e comandos.
O conteúdo vetorial continua no DOM SVG. Alças de seleção são desenhadas em
uma camada SVG separada para não entrarem no arquivo exportado.

### Segurança no upload

SVG é um documento ativo e pode conter scripts, eventos, URLs externas e
outros vetores de XSS. A importação deve:

1. usar `DOMParser`;
2. rejeitar XML inválido ou sem raiz `<svg>`;
3. copiar somente elementos e atributos presentes em listas permitidas;
4. remover atributos `on*`, `href`, `xlink:href`, estilos e URLs externas;
5. gerar IDs internos novos quando necessário.

Não renderizar conteúdo enviado pelo usuário com `dangerouslySetInnerHTML`
antes da sanitização.

## Estrutura planejada

```text
components/svg-editor/
├── SvgEditor.tsx             # composição da interface
├── SvgCanvas.tsx             # render, seleção, drag e zoom
├── SvgToolbar.tsx            # ferramentas e ações
├── SvgPropertiesPanel.tsx    # aparência e geometria
├── types.ts                  # contratos do módulo
├── svgDocument.ts            # parse, sanitize, serialize e mutações
└── svgDocument.test.ts       # testes puros do documento
```

O painel de camadas continua dentro de `SvgPropertiesPanel.tsx`. A árvore já é
hierárquica; extraí-la para `SvgLayersPanel.tsx` passa a ser uma melhoria de
organização, não um requisito funcional.

## Modelo de estado do MVP

```ts
interface SvgEditorDocument {
  name: string;
  markup: string; // SVG já sanitizado e serializado
}

type SvgTool = 'select' | 'rect' | 'ellipse' | 'line' | 'freehand' | 'text' | 'star' | 'triangle';
```

O histórico armazena snapshots do `markup`, mas agrupa alterações contínuas por
ação. Durante gestos, o DOM SVG ativo é atualizado diretamente e serializado
somente no commit, evitando remontar o documento a cada movimento.

## Escopo do primeiro marco

- [x] view `svg-editor` na navegação, disponível sem carregar roteiro;
- [x] documento inicial em branco;
- [x] upload por seletor e drag-and-drop;
- [x] sanitização por allowlist;
- [x] criação de retângulo, elipse e path livre;
- [x] seleção por clique;
- [x] movimento por arraste;
- [x] edição de preenchimento, contorno, espessura e opacidade;
- [x] remoção e duplicação;
- [x] undo/redo;
- [x] exportação `.svg`;
- [x] testes do parser/sanitizador e mutações principais;
- [x] validação visual no navegador e gate completo do projeto.

## Fora do primeiro marco

- alças Bézier e conversão de tipo de nó;
- operações booleanas;
- texto editável;
- gradientes e filtros com interface dedicada;
- persistência no projeto `.zip` ou na nuvem;
- biblioteca compartilhada de templates;
- seleção múltipla;
- importação de imagens raster dentro do SVG.

## Sequência sugerida depois do MVP

1. Extrair comandos de geometria e implementar edição de nós de `path`.
2. Adicionar painel de camadas com grupos, ordem e visibilidade.
3. Adicionar gradientes, sombras, blur, máscaras e `clipPath`.
4. Persistir documentos SVG junto ao projeto e na API.
5. Criar biblioteca de modelos SVG e modelos de pontos em JSON.
6. Adicionar operações booleanas com biblioteca vetorial isolada.

## Como continuar

1. Leia este arquivo e `ARCHITECTURE.md`.
2. Rode `npm run typecheck` e o teste isolado antes de editar.
3. Para paths, crie um parser de comandos `d` em arquivo próprio. Não edite a
   string com regex espalhada em componentes.
4. Represente nós normalizados com posição, tipo e alças de entrada/saída.
5. Desenhe nós e alças em uma camada de interação que não seja serializada.
6. Ao terminar um gesto, gere uma única entrada no histórico.
7. Atualize este documento antes de encerrar a sessão.

Teste isolado rápido:

```bash
npx vitest run components/svg-editor/svgDocument.test.ts \
  --pool=threads --maxWorkers=1 --no-file-parallelism
```

Neste ambiente, o pool padrão `forks` pode ficar aguardando quando o servidor
Vite também está ativo. Encerre o servidor ou use o comando acima.

## Validação do marco

Executado em 2026-06-10:

```text
TypeScript: passou
ESLint do módulo: 0 erros e 0 avisos
Vitest: 20 arquivos, 165 testes aprovados
Vite build: passou
Prettier dos arquivos do módulo: passou
Browser: criação, seleção, propriedade, undo e reload da rota aprovados
Console do navegador: sem erros do módulo
```

O build gera `SvgEditor` como chunk lazy independente, atualmente com cerca de
22,6 kB minificado e 7,7 kB gzip.

## Limitações conhecidas

- Redimensionamento por alças funciona em retângulos, círculos e elipses.
- Paths mostram seleção, mas ainda não têm resize geométrico.
- O desenho de path é livre e formado por segmentos `M/L`; não há curvas.
- Não há régua, guias inteligentes, seleção múltipla ou marquee selection.
- O snapping atual usa grade fixa de 10 unidades; ainda não há snapping entre
  objetos, centros e bordas.
- Gradientes e filtros importados são preservados quando usam atributos
  permitidos, mas ainda não têm interface própria.
- IDs referenciados por gradientes/filtros devem receber testes adicionais
  antes de implementar renomeação global ou colagem entre documentos.
- O documento possui autosave local, mas ainda não é salvo no `.zip` ou nuvem.
- Edição individual de nós Bézier e operações booleanas continuam fora do
  escopo atual.

## Regras para manutenção

- Toda importação passa por `sanitizeSvg`.
- SVGs com links externos devem ser importados junto com suas imagens/fontes;
  o editor resolve os arquivos por nome e os incorpora como data URI.
- Elementos de interface nunca são serializados no documento.
- Uma ação do usuário deve produzir no máximo uma entrada no histórico.
- Transformações devem continuar válidas após exportar e reimportar.
- Novos elementos/atributos permitidos exigem teste de segurança.
- Atualize as seções "Estado atual", checklist e "Registro de mudanças".

## Registro de mudanças

### 2026-06-11

- Concluído o Marco 3 com câmera, prancheta delimitada, margem segura, snapping,
  resize genérico, rotação, camadas hierárquicas, lock/hide e autosave.
- Gestos passaram a alterar somente o nó ativo e gerar uma serialização no
  commit.
- Histórico passou a agrupar alterações contínuas e aceitar até 100 snapshots.
- Segurança centralizada também para mutações, ícones e imagens de templates.
- Duplicação passou a remapear IDs e referências `url(#id)`/`href`.
- Textos estruturados passaram a ser protegidos contra edição destrutiva.
- Importação do Illustrator passou a aceitar o SVG junto com a pasta Links,
  incorporando imagens e fontes para produzir documentos autocontidos.
- A importação agora materializa regras CSS estáticas seguras de classes e IDs
  como atributos SVG, preservando cores, contornos e tipografia sem manter
  stylesheets capazes de afetar a interface.
- O painel resolve propriedades herdadas e `currentColor`.
- Textos passaram a expor família, tamanho e peso da fonte, espaçamento,
  alinhamento, `textLength` e `lengthAdjust`.

### 2026-06-10

- Criado o documento de arquitetura e continuidade.
- Definido SVG nativo como fonte da verdade.
- Definido o escopo do primeiro marco e a estratégia de segurança.
- Criado `svgDocument.ts` com sanitização, criação e mutações isoladas.
- Criados testes de segurança e do ciclo de edição das formas.
- Criados toolbar, canvas, painel de propriedades e composição do editor.
- Integrada a view `#/editor-svg`, acessível sem importar um roteiro.
- O path do MVP é desenho livre. Edição individual de nós permanece no próximo
  marco.
- Validação visual concluída em viewport 1280 x 720: criação, seleção, edição de
  propriedade e undo funcionaram sem erros no console.
- Corrigida serialização compatível com navegador e jsdom para IDs e namespace.
- Confirmada persistência da rota `#/editor-svg` após recarregar a página.
- Gate final: 164 testes aprovados, typecheck e build aprovados.
- Iniciado o Marco 2 a partir de `svg_editor_module.html`.
- Portada a composição visual do protótipo para React.
- Adicionadas linha, texto, estrela, triângulo, tracejado, camadas, ordem e
  statusbar.
- Adicionadas alças funcionais de redimensionamento para formas geométricas.
- Validação visual do Marco 2 confirmou paleta, tracejado, resize e ordem.
- Gate final do Marco 2: 165 testes, typecheck, lint do módulo, Prettier e build
  aprovados.
