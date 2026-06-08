# Backend: Endpoint `POST /api/gemini/refine-scene`

Adicionar este endpoint ao servidor para suportar o passo de refinamento automático.

## Request body
```json
{
  "location": "string",        // ex: "INT. CAFÉ - DIA"
  "description": "string",     // descrição original da cena
  "imagePrompt": "string",     // prompt de imagem gerado no passo anterior
  "generalContext": "string",  // contexto geral da história
  "characterList": [           // lista de personagens da análise
    { "name": "string", "physical_characteristics": "string" }
  ]
}
```

## Response
```json
{
  "needsSplit": true,
  "splitReason": "A cena contém dois momentos distintos...",
  "splitSuggestion": [
    { "description": "Momento 1 – ...", "prompt": "Cinematic wide shot..." },
    { "description": "Momento 2 – ...", "prompt": "Close-up of..." }
  ],
  "alternativePrompt": "Low-angle shot emphasizing...",
  "alternativeReason": "Ângulo mais dramático que reforça a tensão emocional."
}
```

Se `needsSplit` for `false`, `splitReason` e `splitSuggestion` podem ser `null`.

## Prompt sugerido para o Gemini (Flash 2.5 — modelo de texto, sem geração de imagem)

```
You are a visual story consultant reviewing a single scene from a screenplay or storyboard.

Story general context:
{generalContext}

Characters in the story:
{characterList — each as "Name: physical_characteristics"}

Scene being reviewed:
- Location: {location}
- Description: {description}
- Current image prompt: {imagePrompt}

Perform TWO analyses:

1. SPLIT ANALYSIS
   Decide if this scene is too complex for a single image.
   A scene should be split if it:
   - Contains two or more distinct narrative beats or emotional moments
   - Has a significant location or time change within the description
   - Would require contradictory camera framings to capture all key elements
   
   If yes: suggest 2 or 3 sub-scenes. Each sub-scene must have:
   - "description": a brief (1-2 sentence) Portuguese description of what happens
   - "prompt": a ready-to-use English image generation prompt for that sub-scene

2. ALTERNATIVE PROMPT
   Write ONE alternative English image generation prompt for this scene.
   The alternative should convey the same narrative moment but use a different:
   - Camera angle or distance (e.g., overhead, low-angle, extreme close-up)
   - Lighting mood (e.g., silhouette, harsh midday, neon-lit)
   - Visual metaphor or compositional emphasis
   
   Also provide a brief Portuguese sentence explaining why this alternative might work better.

Respond ONLY with valid JSON. No markdown, no code fences, no extra text:
{
  "needsSplit": boolean,
  "splitReason": "string or null",
  "splitSuggestion": [{"description":"string","prompt":"string"}] or null,
  "alternativePrompt": "string",
  "alternativeReason": "string"
}
```

## Notes
- Use a **text-only** Gemini model (e.g., `gemini-2.5-flash` or `gemini-2.0-flash`). This endpoint does NOT generate images.
- The response must be wrapped in the same `{ result, costEntry, user }` envelope used by other endpoints.
- Failures are handled gracefully on the frontend (silent skip), so a 500 error is acceptable if Gemini fails.
