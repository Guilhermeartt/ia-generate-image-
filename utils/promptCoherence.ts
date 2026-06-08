import type { ScenePromptJson } from '../types';

const BLURRY_BG_PATTERNS = [
  /(?:^|\s)(?:no|avoid|without)\s+(?:blurry|blurred)\s+background/i,
  /(?:^|\s)(?:no|avoid|without)\s+background\s+blur/i,
  /^\s*(?:blurry|blurred)\s+background\s*$/i,
  /^\s*sharp\s+background\s+only/i,
];

const NO_PEOPLE_PATTERNS = [
  /no\s+people/i,
  /no\s+humans?/i,
  /no\s+persons?\b/i,
  /without\s+people/i,
];

const OBJECT_FOCUS_SIGNALS = [
  /\b(screen|interface|tablet|monitor|device|laptop)\b/i,
  /\b(product|object|item|package)\b/i,
  /\b(close[-\s]?up|insert\s*shot|detail\s*shot|macro)\s*(on|of)?\s*(the\s*)?(screen|device|product|object|form|interface)\b/i,
  /\b(form|registration\s*form|ui|gui|dashboard)\s+(on|in)\s+(the\s+)?screen\b/i,
];

const HUMAN_SUBJECT_STYLE_RULE = /\b(real\s+human\s+subjects?|human\s+subjects?|real\s+people|real\s+persons?)\b/i;

// Style-family tokens that imply non-photoreal output. When negative_constraints
// forbids these, we must scrub them from visual_style fields too.
const CGI_STYLE_TOKEN = /\b(cgi|3d(?:[\s-]+\w+)?|polygonal|volumetric\s+lighting|cel[\s-]?shading|stylized\s+3d|toon|pixar|disney|dreamworks|render(?:ed)?|raytrac\w*)\b/i;
const ANIMATED_STYLE_TOKEN = /\b(anime|cartoon|illustration|illustrated|comic|manga|chibi|vector|hand[\s-]?drawn|painted|painterly)\b/i;

const PORTUGUESE_ACCENT_RE = /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/;

const BULLET_LINE_RE = /^\s*[•·*\-–—]\s+\S/;
const NUMBERED_LINE_RE = /^\s*\d+[.)]\s+\S/;
const LIST_LINE_RE = /^\s*(?:[•·*\-–—]|\d+[.)])\s+\S/;

export type LetteringFormat = 'single' | 'multi_line' | 'bulleted_list' | 'numbered_list';

/**
 * Extract all LETTERING segments from a raw script/CSV context, preserving
 * multi-line list/topic structure. Each list item becomes its own entry in
 * the returned array so the UI can show them as bullets and the prompt can
 * keep them on separate lines.
 */
export const extractLetteringFromScript = (text: string): string[] => {
  if (!text) return [];
  const results: string[] = [];
  const SECTION_BOUNDARY_LINE = /^(?:LETTERING|IMAGEM|LOC|CENA)\b/i;
  const SECTION_BOUNDARY_INLINE = /\b(?:LETTERING|IMAGEM|LOC|CENA)\s*[:\s]/i;

  const clean = (s: string) => s.replace(/["“”''‘’,.\s]+$/, '').trim();

  const chunks = text.split(/LETTERING:?\s*/i);
  for (let i = 1; i < chunks.length; i++) {
    // Stop the chunk at the next inline section keyword to avoid swallowing
    // adjacent fields when there are no line breaks between them.
    const safe = chunks[i].split(SECTION_BOUNDARY_INLINE)[0];
    const lines = safe.split('\n').map(l => l.trim());
    const collected: string[] = [];
    for (const line of lines) {
      if (!line) {
        if (collected.length > 0) break; // blank line ends the block once we have content
        continue;
      }
      if (SECTION_BOUNDARY_LINE.test(line)) break;
      collected.push(line);
    }
    if (collected.length === 0) continue;

    const hasListMarkers = collected.some(l => LIST_LINE_RE.test(l));
    if (hasListMarkers) {
      // Multi-line list: keep each line (including any header line on top)
      for (const line of collected) {
        const v = clean(line);
        if (v.length >= 2 && !results.includes(v)) results.push(v);
      }
    } else {
      // Single-line lettering — current behavior
      const v = clean(collected[0]);
      if (v.length >= 2 && !results.includes(v)) results.push(v);
    }
  }

  // Also handle other lettering-equivalent keywords with colon syntax.
  const colonPatterns = [
    /texto\s+(?:na|em)\s+tela:\s*["“”''‘’]?((?:(?!LETTERING)[^"“”''‘’\n]){2,160})["“”''‘’]?/gi,
    /legenda:\s*["“”''‘’]?((?:(?!LETTERING)[^"“”''‘’\n]){2,160})["“”''‘’]?/gi,
    /letreiro:\s*["“”''‘’]?((?:(?!LETTERING)[^"“”''‘’\n]){2,160})["“”''‘’]?/gi,
    /t[ií]tulo:\s*["“”''‘’]?((?:(?!LETTERING)[^"“”''‘’\n]){2,160})["“”''‘’]?/gi,
  ];
  for (const regex of colonPatterns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const v = clean(m[1]);
      if (v && !results.includes(v)) results.push(v);
    }
  }

  return results;
};

/**
 * Inspect a list of lettering notes and detect their format so the image
 * model gets the right rendering hint (bullets, numbers, or plain lines).
 */
export const detectLetteringFormat = (notes: string[]): LetteringFormat => {
  if (notes.length <= 1) return 'single';
  const allBullets = notes.every(n => BULLET_LINE_RE.test(n));
  const allNumbered = notes.every(n => NUMBERED_LINE_RE.test(n));
  if (allNumbered) return 'numbered_list';
  if (allBullets) return 'bulleted_list';
  // Header + items
  const restAreList = notes.slice(1).every(n => LIST_LINE_RE.test(n));
  if (restAreList && notes.slice(1).length > 0) {
    const restAreNumbered = notes.slice(1).every(n => NUMBERED_LINE_RE.test(n));
    return restAreNumbered ? 'numbered_list' : 'bulleted_list';
  }
  return 'multi_line';
};

const norm = (s: string): string => s.trim().toLowerCase().replace(/[.,;!?]+$/, '');

const dedupeStrings = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = norm(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const hasShallowDoF = (json: ScenePromptJson): boolean => {
  const dof = json.camera?.depth_of_field ?? '';
  return /shallow|bokeh|out\s*of\s*focus/i.test(dof);
};

const hasNoCharacters = (json: ScenePromptJson): boolean => {
  const chars = json.characters;
  if (Array.isArray(chars)) return chars.length === 0;
  if (typeof chars === 'string') return chars.trim().length === 0;
  return true;
};

/**
 * The scene is plausibly an object/screen close-up (no humans needed)
 * only when there are explicit visual signals — not just empty characters,
 * which can also mean "the AI didn't parse them out".
 */
const isObjectFocusedScene = (json: ScenePromptJson): boolean => {
  const haystack = [
    json.camera?.scene_type,
    json.camera?.shot_type,
    json.camera?.framing,
    json.action?.main_action,
    json.environment?.location,
    json.environment?.set_design,
    json.scene_goal,
  ].filter((v): v is string => typeof v === 'string').join(' ');
  if (!haystack) return false;
  return OBJECT_FOCUS_SIGNALS.some(re => re.test(haystack));
};

const isLiveActionStyle = (json: ScenePromptJson): boolean => {
  const fields = [
    json.visual_style?.style_family,
    json.visual_style?.medium,
    json.visual_style?.realism_level,
  ].filter((v): v is string => typeof v === 'string').join(' ').toLowerCase();
  return /live[-\s]?action|photoreal|cinemat|photograph/i.test(fields);
};

/**
 * Normalize a prompt_json returned by the AI, enforcing the coherence rules
 * that the prompt asks for but the model occasionally violates. This is a
 * defense-in-depth pass — the prompt itself remains the source of truth.
 */
export const normalizePromptJson = (input: unknown): ScenePromptJson | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const json = { ...(input as ScenePromptJson) } as ScenePromptJson;

  // ── 1. action.subject_relationship: "N/A"/"none"/"" → null ─────────────
  if (json.action) {
    const sr = (json.action as { subject_relationship?: unknown }).subject_relationship;
    if (typeof sr === 'string' && /^(?:n\/?a|none|nenhum|—|-)?\s*$/i.test(sr.trim())) {
      json.action = { ...json.action, subject_relationship: null as unknown as string };
    }
  }

  // ── 2. negative_constraints: dedupe + remove contradictions ────────────
  let negatives = Array.isArray(json.negative_constraints)
    ? [...json.negative_constraints]
    : [];

  // Remove "no blurry background" when shallow DoF was chosen.
  if (hasShallowDoF(json)) {
    negatives = negatives.filter(n =>
      typeof n === 'string' && !BLURRY_BG_PATTERNS.some(re => re.test(n))
    );
  }

  // Inject "no people" ONLY when there's strong object-focus signal AND
  // characters is empty AND style is live-action. Empty characters alone
  // can also mean the AI failed to detect the character, so we need extra
  // evidence (screen/device/product close-up).
  const objectFocused = hasNoCharacters(json) && isObjectFocusedScene(json) && isLiveActionStyle(json);
  if (objectFocused) {
    const alreadyHas = negatives.some(n =>
      typeof n === 'string' && NO_PEOPLE_PATTERNS.some(re => re.test(n))
    );
    if (!alreadyHas) {
      negatives.push('no people, no hands, no faces');
    }
  }

  json.negative_constraints = dedupeStrings(negatives);

  // When "no people" is enforced, also strip contradicting style_rules
  // entries like "real human subjects".
  const noPeopleNow = json.negative_constraints.some(n =>
    typeof n === 'string' && NO_PEOPLE_PATTERNS.some(re => re.test(n))
  );

  // When negative_constraints forbids CGI/3D or animation/illustration,
  // scrub the corresponding tokens from visual_style fields. Otherwise the
  // JSON literally asks the model to produce what it just forbade.
  const negativesJoined = json.negative_constraints.join(' ').toLowerCase();
  const noCgi = /\b(no\s+cgi|no\s+3d|no\s+render(?:ed)?|no\s+cel[\s-]?shading)\b/i.test(negativesJoined);
  const noAnimation = /\b(no\s+anime|no\s+cartoon|no\s+illustration|no\s+comic|no\s+manga)\b/i.test(negativesJoined);

  if (json.visual_style) {
    const vs = { ...json.visual_style };
    const cleanStringField = (val?: string): string | undefined => {
      if (!val) return val;
      let out = val;
      if (noCgi) out = out.replace(CGI_STYLE_TOKEN, '').trim();
      if (noAnimation) out = out.replace(ANIMATED_STYLE_TOKEN, '').trim();
      out = out.replace(/\s{2,}/g, ' ').replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '').trim();
      return out || undefined;
    };

    if (noCgi || noAnimation) {
      // If style_family/medium/realism_level explicitly named a forbidden
      // family, replace with a neutral live-action label.
      const familyHaystack = `${vs.style_family ?? ''} ${vs.medium ?? ''} ${vs.realism_level ?? ''}`;
      const familyConflicts =
        (noCgi && CGI_STYLE_TOKEN.test(familyHaystack)) ||
        (noAnimation && ANIMATED_STYLE_TOKEN.test(familyHaystack));
      if (familyConflicts) {
        vs.style_family = 'Cinematic photoreal';
        vs.medium = 'live-action cinematic photography';
        vs.realism_level = 'photorealistic movie still';
      } else {
        vs.style_family = cleanStringField(vs.style_family) ?? vs.style_family;
        vs.medium = cleanStringField(vs.medium) ?? vs.medium;
        vs.realism_level = cleanStringField(vs.realism_level) ?? vs.realism_level;
      }
    }

    if (Array.isArray(vs.style_rules)) {
      vs.style_rules = vs.style_rules.filter(r => {
        if (typeof r !== 'string') return false;
        if (noPeopleNow && HUMAN_SUBJECT_STYLE_RULE.test(r)) return false;
        if (noCgi && CGI_STYLE_TOKEN.test(r)) return false;
        if (noAnimation && ANIMATED_STYLE_TOKEN.test(r)) return false;
        return true;
      });
      vs.style_rules = dedupeStrings(vs.style_rules);
    }

    json.visual_style = vs;
  }

  // ── 3. required_elements: drop the lettering text duplicate ────────────
  const letteringText = json.lettering?.exact_text?.trim();
  if (letteringText && Array.isArray(json.required_elements)) {
    const letteringLower = letteringText.toLowerCase();
    json.required_elements = json.required_elements.filter(el => {
      if (typeof el !== 'string') return false;
      // Drop any required_element that contains the exact lettering string —
      // it already lives in lettering.exact_text and the duplication confuses
      // the image model (especially with quotes/casing variants).
      return !el.toLowerCase().includes(letteringLower);
    });
    json.required_elements = dedupeStrings(json.required_elements);
  }

  // ── 4. lettering.language: auto-fill for Portuguese ─────────────────────
  if (json.lettering?.has_text && letteringText) {
    const currentLang = (json.lettering.language ?? '').trim();
    if (!currentLang && PORTUGUESE_ACCENT_RE.test(letteringText)) {
      json.lettering = { ...json.lettering, language: 'Portuguese (pt-BR)' };
    }
  }

  // ── 5. framing: drop redundant shot_type prefix ────────────────────────
  if (json.camera?.shot_type && json.camera?.framing) {
    const shotType = json.camera.shot_type.trim();
    const framing = json.camera.framing.trim();
    if (shotType && framing && norm(framing).startsWith(norm(shotType))) {
      const stripped = framing.slice(shotType.length).replace(/^[\s,—\-:.]+/, '').trim();
      if (stripped) {
        json.camera = { ...json.camera, framing: stripped };
      }
    }
  }

  return json;
};

/**
 * Remove all lettering instructions from a prompt_json so the image model
 * does not render any on-screen text. Used when the user toggles "include
 * lettering" off on a scene.
 */
export const stripLetteringFromPromptJson = (input: unknown): ScenePromptJson | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const json = { ...(input as ScenePromptJson) } as ScenePromptJson;

  // Disable the lettering block
  json.lettering = {
    has_text: false,
    exact_text: '',
    language: '',
    placement: '',
    text_rules: ['Do not render any text, letters, numbers, or typography in the image.'],
  };

  // Drop any required_elements that referenced text
  if (Array.isArray(json.required_elements)) {
    json.required_elements = json.required_elements.filter(el => {
      if (typeof el !== 'string') return false;
      return !/\b(?:text|lettering|letrar|texto|caption|legend)\b/i.test(el);
    });
  }

  // Reinforce in negatives
  const negatives = Array.isArray(json.negative_constraints) ? [...json.negative_constraints] : [];
  const noTextHints = ['no visible text', 'no letters', 'no typography', 'no captions'];
  for (const hint of noTextHints) {
    if (!negatives.some(n => typeof n === 'string' && norm(n) === hint)) {
      negatives.push(hint);
    }
  }
  json.negative_constraints = dedupeStrings(negatives);

  return json;
};

/**
 * Apply the scene's includeLettering toggle to a prompt_json. Returns the
 * input unchanged when lettering should be kept (the default).
 */
export const applyLetteringToggle = (
  input: ScenePromptJson | undefined,
  includeLettering: boolean | undefined,
): ScenePromptJson | undefined => {
  if (!input) return input;
  if (includeLettering === false) return stripLetteringFromPromptJson(input);
  return input;
};

/**
 * Build a lettering block from the extracted lettering_notes when the AI
 * forgot to populate prompt_json.lettering. Detects list/topic format,
 * preserves the structure, and auto-detects Portuguese text.
 */
const buildLetteringFromNotes = (
  notes: string[],
  existing?: ScenePromptJson['lettering'],
): ScenePromptJson['lettering'] => {
  const format = detectLetteringFormat(notes);
  // Lists and multi-line: preserve structure with newlines so the model
  // renders each item on its own line. Single line: use the plain text.
  const text = format === 'single' ? (notes[0] ?? '') : notes.join('\n');
  const isPortuguese = PORTUGUESE_ACCENT_RE.test(text);

  const baseRules = [
    'Preserve exact spelling, casing, and accents',
    'Do not translate, paraphrase, or shorten',
    'Render as crisp legible UI typography (not handwritten)',
  ];
  const formatRule =
    format === 'bulleted_list'
      ? 'Render as a vertical bulleted list; each item on its own line; preserve the bullet markers (•) and order'
      : format === 'numbered_list'
      ? 'Render as a vertical numbered list (1., 2., 3.); each item on its own line; preserve the numbers and order'
      : format === 'multi_line'
      ? 'Render each line on a separate row; preserve line breaks and order; align left'
      : '';

  return {
    has_text: true,
    exact_text: text,
    language: (existing?.language ?? '') || (isPortuguese ? 'Portuguese (pt-BR)' : ''),
    placement: existing?.placement ?? '',
    text_rules: (existing?.text_rules && existing.text_rules.length > 0)
      ? existing.text_rules
      : formatRule
        ? [...baseRules, formatRule]
        : baseRules,
  };
};

/**
 * Serialize a prompt_json into the final image_prompt string, applying the
 * lettering toggle. Used whenever any control changes so the textarea
 * always reflects what will actually be sent to the image model.
 *
 * letteringNotes is the source-of-truth list extracted from the script. When
 * the toggle is ON but the AI's prompt_json omitted the lettering block, we
 * inject it from the notes so the image model gets the text.
 */
export const serializeImagePrompt = (
  promptJson: ScenePromptJson | undefined,
  includeLettering: boolean | undefined,
  letteringNotes?: string[],
): string => {
  if (!promptJson) return '';
  let finalJson = applyLetteringToggle(promptJson, includeLettering) ?? promptJson;

  if (includeLettering !== false && letteringNotes && letteringNotes.length > 0) {
    const currentText = finalJson.lettering?.exact_text?.trim() ?? '';
    if (!currentText) {
      finalJson = { ...finalJson, lettering: buildLetteringFromNotes(letteringNotes, finalJson.lettering) };
    }
  }

  return JSON.stringify(finalJson, null, 2);
};
