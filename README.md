# 🎬 Estúdio de Roteiro Visual com IA

Uma aplicação web para transformar roteiros em CSV em storyboards visuais cinematográficos usando Google Gemini AI. A IA analisa cada cena, extrai personagens, gera contexto narrativo e cria imagens de alta qualidade para todo o roteiro.

---

## ✨ Funcionalidades

- **Análise de Roteiro** — Faz upload de um CSV com cenas e a IA analisa o contexto geral, extrai personagens e cria prompts otimizados para geração de imagens.
- **Geração de Personagens** — Cria retratos de cada personagem com base em suas características físicas descritas no roteiro.
- **Geração de Cenas** — Gera imagens cinematográficas para cada cena, usando os personagens como referência visual para manter consistência.
- **Preview de Vídeo com Remotion** — Monta as cenas geradas em uma timeline reproduzível, com transições, legendas e duração configurável.
- **Gerar com Referência Visual** — Selecione uma região da imagem existente arrastando o mouse para usá-la como referência na próxima geração.
- **Galeria do Projeto** — Veja e edite qualquer imagem gerada (personagens e cenas, incluindo versões anteriores) em um único painel.
- **Edição de Imagens** — Edite qualquer imagem com um prompt de texto (ex: "mude o fundo para noturno", "adicione chuva").
- **Continuidade de Cenas** — Suporte a referência entre cenas para manter consistência visual ao longo do roteiro.
- **Exportar Projeto** — Salva todo o projeto (imagens + prompts + configurações) em um arquivo `.zip` para reabrir depois.
- **Isolamento de Personagem** — Remove o fundo do retrato de um personagem para usar como referência limpa.
- **Análise de Texto em Imagem** — Detecta e corrige textos nas imagens geradas.
- **Múltiplos Modelos** — Suporte a Gemini 2.5 Flash Image, Gemini 3 Pro Image e Imagen 4.

---

## 📋 Pré-requisitos

- **Node.js** v18 ou superior
- **npm** v9 ou superior
- Uma **chave de API do Google Gemini** (obtenha em [aistudio.google.com](https://aistudio.google.com/app/apikey))

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/Guilhermeartt/ia-generate-image-.git
cd ia-generate-image-
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure a chave de API

Crie um arquivo `.env.local` na raiz do projeto:

```
GEMINI_API_KEY=sua_chave_aqui
APP_SECRET=troque_por_um_segredo_longo
APP_ENCRYPTION_KEY=troque_por_uma_chave_longa
ADMIN_EMAILS=admin@seudominio.com
```

> ⚠️ Nunca suba o arquivo `.env.local` para o repositório. A chave da plataforma é lida apenas pelo servidor Node.

Também é possível usar a API Key própria do usuário pela tela de configurações. Nesse modo, o frontend envia essa chave para o servidor da aplicação apenas para executar a chamada ao Gemini.

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev:full
```

Acesse **http://localhost:3000** no seu navegador.

---

## 📦 Build para Produção

```bash
npm run build
```

Os arquivos de saída ficam em `/dist`. Para pré-visualizar localmente:

```bash
npm run preview
```

---

## 📄 Formato do CSV

O arquivo CSV deve conter as seguintes colunas (use vírgula `,` ou ponto e vírgula `;` como separador):

| Coluna | Obrigatório | Descrição |
|--------|-------------|-----------|
| `scene_id` | ✅ | Número da cena (ex: `1`) |
| `sub_id` | ✅ | Subdivisão da cena (ex: `1`) |
| `order` | ✅ | Ordem de geração dentro da cena |
| `loc` | ✅ | Localização / ambiente da cena |
| `context` | ✅ | Descrição do que acontece na cena |
| `style` | ❌ | Estilo de câmera (ex: `Close-up`, `Wide Shot`) |

### Exemplo de CSV

```csv
scene_id,sub_id,order,loc,context,style
1,1,1,Escritório corporativo moderno,"João entra apressado com uma pasta na mão, ao fundo vemos telas de computador",Medium Shot
1,2,2,Escritório corporativo moderno,"Close-up na pasta sendo aberta, documentos espalhados sobre a mesa",Close-up
2,1,3,Corredor do prédio,"João corre pelo corredor. continuidade da img 1",Wide Shot
3,1,4,Sala de reuniões,"[João] e [Maria] se encaram em lados opostos da mesa",American Shot
```

### Referência entre cenas

Para que uma cena use a imagem de outra como referência visual, use no campo `context`:

| Sintaxe | Efeito |
|---|---|
| `[ref:3]` | Referencia a cena de ordem `3` |
| `[ref:previous]` | Referencia a cena imediatamente anterior |
| `continuidade da img 3` | Forma natural de escrita |
| `(img 3)` | Forma abreviada |

### Mencionando personagens

Envolva o nome exato do personagem entre colchetes no campo `context` para que a IA use o retrato gerado como referência visual:

```
[João] discute com [Maria] enquanto segura um documento.
```

> O botão **"Copiar CSV"** na tela de upload fornece um template completo pronto para usar.

---

## 🖥️ Como Usar

### 1. Upload do CSV

- Arraste ou clique para selecionar seu arquivo `.csv`
- Clique em **"Iniciar Análise com IA"**
- A IA irá gerar o contexto geral → extrair personagens → criar prompts para todas as cenas

### 2. Personagens

- Veja os personagens extraídos automaticamente na aba **Personagens**
- Clique em **"Gerar"** em cada card para criar o retrato
- Ou use **"Gerar Todos"** para geração em lote (com pausa automática para respeitar limites da API)
- Use **"Isolar"** para remover o fundo do retrato

### 3. Cenas

- Na aba **Cenas**, clique em **"Gerar Novamente"** para abrir o painel de referência visual:
  - Arraste para selecionar uma região da imagem atual como referência
  - Escolha um prompt rápido ou escreva o seu
  - Clique em **"Gerar"**
- Use **"Rápido"** para regerar sem abrir o painel (usa o prompt original)
- Use **"Gerar Todas as Cenas"** para geração em lote

### 4. Galeria do Projeto

- Clique em **"Galeria do Projeto"** (botão roxo na seção de configurações)
- Veja todas as imagens geradas — personagens e cenas
- Filtre por tipo (Todos / Personagens / Cenas)
- Selecione qualquer imagem, inclusive versões anteriores (badge **+anterior**)
- Descreva o que quer alterar e clique em **"Aplicar Edição"**

### 5. Exportar / Importar

- **Exportar Projeto (.zip)** — salva imagens + prompts + configurações em um arquivo compactado
- **Carregar um Projeto** — reimporta um `.zip` exportado anteriormente para continuar de onde parou

### 6. Vídeo do storyboard

- Abra a aba **Vídeo** depois de gerar imagens para as cenas
- Ajuste a duração de cada cena e ative ou desative os textos sobrepostos
- O preview usa o Remotion Player no navegador; exportação MP4 requer um renderizador Remotion no backend

---

## ⚙️ Configurações de Geração

| Configuração | Descrição |
|---|---|
| **Modelo do Personagem** | Modelo usado para retratos (padrão: Imagen 4) |
| **Modelo da Cena** | Modelo usado para imagens de cena |
| **Proporção** | Aspect ratio das imagens (16:9, 1:1, 9:16, 4:3, 3:4) |
| **Resolução** | 1K / 2K / 4K (disponível no Gemini 3 Pro e Imagen 4) |
| **Presets** | Salve e carregue combinações de configurações |

### Modelos disponíveis

| Modelo | Melhor para |
|---|---|
| `gemini-2.5-flash-image` | Velocidade, uso geral |
| `imagen-4.0-generate-001` | Alta qualidade de imagem |
| `gemini-3-pro-image-preview` | Alta fidelidade, suporte a resoluções maiores |

---

## 🗂️ Estrutura do Projeto

```
projeto/
├── App.tsx                          # Componente raiz, toda a lógica de estado
├── index.tsx                        # Ponto de entrada React
├── index.html                       # HTML base (inclui Tailwind CDN e JSZip)
├── types.ts                         # Tipos TypeScript globais
├── vite.config.ts                   # Configuração Vite + mapeamento GEMINI_API_KEY
├── components/
│   ├── CharacterCard.tsx            # Card de personagem com edição e geração
│   ├── SceneCard.tsx                # Card de cena com geração e edição
│   ├── SceneReferenceModal.tsx      # Modal para selecionar região visual de referência
│   ├── ProjectGalleryModal.tsx      # Galeria de todas as imagens do projeto
│   ├── ImageEditModal.tsx           # Modal de edição de imagem com prompt
│   ├── FileUpload.tsx               # Upload de CSV com template e instruções
│   ├── SettingsModal.tsx            # Configurações avançadas de prompts da IA
│   ├── TextAnalysisModal.tsx        # Análise e correção de texto em imagens
│   ├── ImageRegionSelectorModal.tsx # Seleção de região para análise de texto
│   ├── ImagePreviewModal.tsx        # Visualização em tela cheia
│   ├── HistoryLoader.tsx            # Carregar análises anteriores
│   ├── QuickAnalyzer.tsx            # Análise rápida de imagem avulsa
│   ├── Loader.tsx                   # Indicador de carregamento
│   └── icons.tsx                    # Todos os ícones SVG
├── services/
│   └── geminiService.ts             # Integração com Google Gemini AI
└── hooks/
    └── useSettings.ts               # Hook para persistência de configurações
```

---

## 🔧 Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Chave de API do Google Gemini usada pela plataforma |
| `APP_SECRET` | ✅ em produção | Segredo usado para assinar tokens de sessão |
| `APP_ENCRYPTION_KEY` | ✅ em produção | Chave usada para criptografar API Keys salvas pelos usuários |
| `ADMIN_EMAILS` | Opcional | Lista separada por vírgula de e-mails com acesso ao painel admin |
| `USD_TO_BRL` | Opcional | Cotação usada para estimar custo em BRL |

---

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit suas mudanças: `git commit -m 'feat: adiciona minha feature'`
4. Push para a branch: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## 📝 Licença

Este projeto é privado. Todos os direitos reservados.
