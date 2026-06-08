import React, { useState, useRef } from 'react';

export interface StyleOption {
  id: string;
  label: string;
  description: string;
  gradient: string;
  accent: string;
  icon: string;
  promptSuffix: string;
}

interface StyleCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  accent: string;
  gradient: string;
  substyles: StyleOption[];
}

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    id: 'fotorrealista',
    label: 'Fotorrealista',
    icon: '📷',
    description: 'Fotografias e imagens com alta fidelidade à realidade',
    accent: '#4F8CFF',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%)',
    substyles: [
      {
        id: 'foto_cinematografico',
        label: 'Cinematográfico',
        description: 'Estilo de filme, cor graded, anamórfico',
        gradient: 'linear-gradient(135deg, #0d1f3c 0%, #1e4080 100%)',
        accent: '#4F8CFF',
        icon: '🎬',
        promptSuffix: 'live-action photorealistic cinematic photography, real human subjects, anamorphic lens, film color grading, shallow depth of field, movie still, professional cinematography, no anime, no cartoon, no illustration, no CGI, no cel shading',
      },
      {
        id: 'foto_documental',
        label: 'Documental',
        description: 'Fotojornalismo, momentos autênticos',
        gradient: 'linear-gradient(135deg, #1a2e1a 0%, #2e5c2e 100%)',
        accent: '#4ADE80',
        icon: '🌍',
        promptSuffix: 'documentary photojournalism, natural lighting, candid authentic moment, editorial photography, 35mm film grain, raw honest aesthetic, reportage style',
      },
      {
        id: 'foto_publicidade',
        label: 'Publicidade',
        description: 'Alta produção, revista, editorial',
        gradient: 'linear-gradient(135deg, #3a1a4a 0%, #7a3f9a 100%)',
        accent: '#C084FC',
        icon: '✨',
        promptSuffix: 'high-end commercial photography, studio lighting, advertising quality, polished composition, magazine editorial, sharp focus, professional product shoot',
      },
    ],
  },
  {
    id: '3d',
    label: '3D / CGI',
    icon: '🎮',
    description: 'Renderizações tridimensionais e animações CGI',
    accent: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #2d1b69 0%, #6b3fa0 100%)',
    substyles: [
      {
        id: '3d_pixar',
        label: 'Pixar',
        description: 'Estilo Toy Story, Up, Inside Out',
        gradient: 'linear-gradient(135deg, #1a1060 0%, #4a3eb0 100%)',
        accent: '#818CF8',
        icon: '🤖',
        promptSuffix: 'Pixar 3D animation style, Toy Story Up Inside Out aesthetic, expressive characters, subsurface scattering skin, volumetric lighting, warm vibrant colors, polished CGI render',
      },
      {
        id: '3d_disney',
        label: 'Disney 3D',
        description: 'Frozen, Moana, Encanto',
        gradient: 'linear-gradient(135deg, #0a2a5e 0%, #1a6abf 100%)',
        accent: '#38BDF8',
        icon: '❄️',
        promptSuffix: 'Walt Disney Animation 3D style, Frozen Moana Encanto aesthetic, luminous soft rendering, expressive eyes, magical fairy tale lighting, polished studio quality',
      },
      {
        id: '3d_dreamworks',
        label: 'DreamWorks',
        description: 'How to Train Your Dragon, Shrek',
        gradient: 'linear-gradient(135deg, #1a3a1a 0%, #2a7a3a 100%)',
        accent: '#4ADE80',
        icon: '🐉',
        promptSuffix: 'DreamWorks Animation 3D CGI style, How to Train Your Dragon Shrek aesthetic, stylized realism, dynamic cinematic lighting, warm color grading, epic atmosphere',
      },
      {
        id: '3d_stopmotion',
        label: 'Stop Motion',
        description: 'Coraline, Kubo, Frankenweenie',
        gradient: 'linear-gradient(135deg, #3a1500 0%, #8a4000 100%)',
        accent: '#FB923C',
        icon: '🪆',
        promptSuffix: 'Laika stop motion animation style, Coraline Kubo aesthetic, clay-like textures, tactile handcrafted surface, puppet look, practical lighting, frame-by-frame craft',
      },
      {
        id: '3d_lowpoly',
        label: 'Low Poly',
        description: 'Geométrico, facetado, minimalista',
        gradient: 'linear-gradient(135deg, #003a3a 0%, #006a6a 100%)',
        accent: '#2DD4BF',
        icon: '💎',
        promptSuffix: 'low poly 3D art style, geometric faceted mesh, flat shading, minimal polygon count, clean geometric forms, pastel color palette, abstract minimalist',
      },
      {
        id: '3d_voxel',
        label: 'Voxel',
        description: 'Cúbico, estilo Minecraft',
        gradient: 'linear-gradient(135deg, #1a3a00 0%, #3a7a00 100%)',
        accent: '#86EFAC',
        icon: '🧊',
        promptSuffix: 'voxel art style, cubic 3D pixels, Minecraft game aesthetic, isometric voxel rendering, blocky geometric forms, colorful voxel game art, pixel-cube world',
      },
    ],
  },
  {
    id: 'anime',
    label: 'Anime / 2D',
    icon: '⛩️',
    description: 'Animação japonesa e cartoons 2D',
    accent: '#FB7185',
    gradient: 'linear-gradient(135deg, #4a0e5e 0%, #c94094 100%)',
    substyles: [
      {
        id: 'anime_classico',
        label: 'Anime Clássico',
        description: 'Anos 90: Naruto, DBZ, Sailor Moon',
        gradient: 'linear-gradient(135deg, #2a0a3a 0%, #7a2a9a 100%)',
        accent: '#C084FC',
        icon: '🥷',
        promptSuffix: '1990s classic anime style, Naruto Dragon Ball Z Sailor Moon aesthetic, hand-drawn cel animation, bold outlines, screen tone shading, dynamic action lines',
      },
      {
        id: 'anime_moderno',
        label: 'Anime Moderno',
        description: 'Demon Slayer, My Hero Academia',
        gradient: 'linear-gradient(135deg, #4a0a0a 0%, #c02020 100%)',
        accent: '#F87171',
        icon: '⚡',
        promptSuffix: 'modern anime style 2020s, Demon Slayer My Hero Academia aesthetic, highly detailed illustration, vibrant saturated colors, dynamic composition, fluid movement feel',
      },
      {
        id: 'anime_ghibli',
        label: 'Studio Ghibli',
        description: 'Spirited Away, Princesa Mononoke',
        gradient: 'linear-gradient(135deg, #003a20 0%, #006a40 100%)',
        accent: '#4ADE80',
        icon: '🌿',
        promptSuffix: 'Studio Ghibli watercolor animation style, Hayao Miyazaki aesthetic, Spirited Away Princess Mononoke, soft hand-drawn backgrounds, lush nature, magical realism, gentle light',
      },
      {
        id: 'anime_chibi',
        label: 'Chibi / Kawaii',
        description: 'Super-deformed, fofo, proporcional',
        gradient: 'linear-gradient(135deg, #4a003a 0%, #b0309a 100%)',
        accent: '#F472B6',
        icon: '🩷',
        promptSuffix: 'chibi kawaii anime art style, super-deformed proportions, oversized head, round cute body, pastel colors, adorable expressions, Q-version character design',
      },
      {
        id: 'cartoon_americano',
        label: 'Cartoon Clássico',
        description: 'Looney Tunes, Tom & Jerry',
        gradient: 'linear-gradient(135deg, #3a1a00 0%, #c06000 100%)',
        accent: '#FCD34D',
        icon: '🐰',
        promptSuffix: 'classic American cartoon animation style, Looney Tunes Tom and Jerry aesthetic, exaggerated rubber hose proportions, bold outlines, vibrant flat colors, slapstick energy',
      },
      {
        id: 'cartoon_moderno',
        label: 'Cartoon Moderno',
        description: 'Gravity Falls, Steven Universe',
        gradient: 'linear-gradient(135deg, #1a1a4a 0%, #4a4aaa 100%)',
        accent: '#A5B4FC',
        icon: '🌟',
        promptSuffix: 'modern cartoon style, Gravity Falls Steven Universe Adventure Time aesthetic, retro-futuristic palette, quirky character design, expressive lines, indie animation quality',
      },
    ],
  },
  {
    id: 'quadrinhos',
    label: 'Quadrinhos / HQ',
    icon: '💥',
    description: 'HQs, mangás e graphic novels',
    accent: '#F59E0B',
    gradient: 'linear-gradient(135deg, #5c2a00 0%, #c45200 100%)',
    substyles: [
      {
        id: 'hq_marvel',
        label: 'Marvel Comics',
        description: 'Super-heróis, ação dinâmica',
        gradient: 'linear-gradient(135deg, #5a0000 0%, #b00000 100%)',
        accent: '#F87171',
        icon: '🦸',
        promptSuffix: 'Marvel Comics art style, superhero comic book illustration, dynamic perspective, bold inking, dramatic action composition, Jack Kirby Jim Lee aesthetic, American comic art',
      },
      {
        id: 'hq_dc',
        label: 'DC Comics',
        description: 'Batman, sombrio, alto contraste',
        gradient: 'linear-gradient(135deg, #000a2a 0%, #001a6a 100%)',
        accent: '#60A5FA',
        icon: '🦇',
        promptSuffix: 'DC Comics art style, Batman Gotham aesthetic, darker gritty comic book, dramatic shadow inking, noir-influenced composition, Neal Adams Frank Miller style',
      },
      {
        id: 'hq_manga',
        label: 'Mangá',
        description: 'Preto e branco, screentone',
        gradient: 'linear-gradient(135deg, #0a0a0a 0%, #2a2a2a 100%)',
        accent: '#E2E8F0',
        icon: '📖',
        promptSuffix: 'manga shonen art style, black and white manga illustration, screentone shading, bold expressive linework, dramatic speed lines, Shonen Jump aesthetic',
      },
      {
        id: 'hq_graphicnovel',
        label: 'Graphic Novel',
        description: 'Frank Miller, Dave McKean',
        gradient: 'linear-gradient(135deg, #1a0a0a 0%, #4a1a1a 100%)',
        accent: '#FCA5A5',
        icon: '📚',
        promptSuffix: 'graphic novel illustration style, atmospheric painted comic art, Frank Miller Dave McKean aesthetic, moody storytelling, stark contrast, cinematic panel composition',
      },
      {
        id: 'hq_europeia',
        label: 'HQ Europeia',
        description: 'Tintin, Astérix, Moebius',
        gradient: 'linear-gradient(135deg, #003a4a 0%, #006a8a 100%)',
        accent: '#22D3EE',
        icon: '🥐',
        promptSuffix: 'European bande dessinée comic style, Tintin Moebius Asterix ligne claire aesthetic, clean precise lines, watercolor flat tones, Franco-Belgian adventure illustration',
      },
      {
        id: 'hq_webtoon',
        label: 'Webtoon',
        description: 'Manhwa digital, cores vibrantes',
        gradient: 'linear-gradient(135deg, #1a003a 0%, #4a009a 100%)',
        accent: '#A78BFA',
        icon: '📱',
        promptSuffix: 'webtoon digital comic style, Korean manhwa aesthetic, clean bright digital illustration, smooth gradients, expressive character design, modern digital comic art',
      },
    ],
  },
  {
    id: 'arte_tradicional',
    label: 'Arte Tradicional',
    icon: '🖌️',
    description: 'Técnicas clássicas de pintura e desenho',
    accent: '#FB923C',
    gradient: 'linear-gradient(135deg, #4a1500 0%, #b04000 100%)',
    substyles: [
      {
        id: 'trad_aquarela',
        label: 'Aquarela',
        description: 'Lavagens suaves, transparência',
        gradient: 'linear-gradient(135deg, #0c3547 0%, #1a7a9a 100%)',
        accent: '#22D3EE',
        icon: '💧',
        promptSuffix: 'traditional watercolor painting, soft transparent washes, wet-on-wet technique, luminous pigments, visible paper texture, delicate ink contours, artistic fluidity',
      },
      {
        id: 'trad_oleo',
        label: 'Pintura a Óleo',
        description: 'Impasto, Rembrandt, clássico',
        gradient: 'linear-gradient(135deg, #2a1a00 0%, #6a4000 100%)',
        accent: '#D97706',
        icon: '🎨',
        promptSuffix: 'classical oil painting style, rich impasto texture, Rembrandt Vermeer aesthetic, warm glazing layers, visible brushstrokes, canvas texture, old masters technique',
      },
      {
        id: 'trad_gouache',
        label: 'Gouache',
        description: 'Opaco, matérico, mid-century',
        gradient: 'linear-gradient(135deg, #1a3a00 0%, #4a8a00 100%)',
        accent: '#84CC16',
        icon: '🍃',
        promptSuffix: 'gouache illustration painting, opaque matte colors, bold flat shapes, mid-century illustration style, velvety paint texture, graphic quality, vintage poster feel',
      },
      {
        id: 'trad_pastel',
        label: 'Pastel Seco',
        description: 'Suave, aveludado, difuso',
        gradient: 'linear-gradient(135deg, #3a003a 0%, #8a3a6a 100%)',
        accent: '#F9A8D4',
        icon: '🌸',
        promptSuffix: 'soft pastel drawing style, blended chalk pastels, velvet texture, vibrant yet soft hues, artistic grain, Impressionist pastel technique, diffused light',
      },
    ],
  },
  {
    id: 'lineart',
    label: 'Line Art / Esboço',
    icon: '✏️',
    description: 'Traços, contornos e desenhos lineares',
    accent: '#94A3B8',
    gradient: 'linear-gradient(135deg, #1a1a1a 0%, #3d3d3d 100%)',
    substyles: [
      {
        id: 'line_lapis',
        label: 'Lápis / Grafite',
        description: 'Esboço a grafite, storyboard',
        gradient: 'linear-gradient(135deg, #111 0%, #333 100%)',
        accent: '#CBD5E1',
        icon: '✏️',
        promptSuffix: 'pencil sketch illustration, graphite drawing, cross-hatching shading, varied line weight, hand-drawn gestural sketch, storyboard quality, monochrome pencil',
      },
      {
        id: 'line_nanquim',
        label: 'Nanquim / Caneta',
        description: 'Tinta preta, pontilhismo, preciso',
        gradient: 'linear-gradient(135deg, #0a0a0a 0%, #222 100%)',
        accent: '#E2E8F0',
        icon: '🖊️',
        promptSuffix: 'ink pen illustration, precise black lines, cross-hatching and stippling, technical pen style, fine art inking, black ink on white paper, detailed line art',
      },
      {
        id: 'line_clean',
        label: 'Line Art Limpa',
        description: 'Contornos limpos, livro de colorir',
        gradient: 'linear-gradient(135deg, #1a1a3a 0%, #3a3a7a 100%)',
        accent: '#A5B4FC',
        icon: '📐',
        promptSuffix: 'clean line art illustration, crisp precise outlines, no shading, coloring book quality, flat color fills, vector-like precision, minimalist graphic linework',
      },
      {
        id: 'line_carvao',
        label: 'Carvão',
        description: 'Sfumato, dramático, expressivo',
        gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 100%)',
        accent: '#FCA5A5',
        icon: '🪨',
        promptSuffix: 'charcoal drawing art style, smudged tones, dramatic chiaroscuro contrast, expressive charcoal marks, textured paper grain, classical life drawing, sfumato technique',
      },
      {
        id: 'line_storyboard',
        label: 'Storyboard',
        description: 'Produção cinematográfica, rascunho',
        gradient: 'linear-gradient(135deg, #1a1a0a 0%, #3a3a1a 100%)',
        accent: '#FCD34D',
        icon: '🎞️',
        promptSuffix: 'film storyboard sketch style, rough production drawing, quick gestural lines, cinematic framing, pre-production illustration, grayscale value sketch, director\'s visual notes',
      },
    ],
  },
  {
    id: 'digital',
    label: 'Arte Digital',
    icon: '🖥️',
    description: 'Ilustração e design digitais contemporâneos',
    accent: '#34D399',
    gradient: 'linear-gradient(135deg, #003a2a 0%, #006a4a 100%)',
    substyles: [
      {
        id: 'dig_conceitual',
        label: 'Arte Conceitual',
        description: 'Game art, worldbuilding, épico',
        gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
        accent: '#8B5CF6',
        icon: '🌌',
        promptSuffix: 'concept art illustration, detailed environment design, rich atmospheric painting, professional concept design, game cinematic quality, sci-fi fantasy worldbuilding',
      },
      {
        id: 'dig_editorial',
        label: 'Ilustração Editorial',
        description: 'Revista, reportagem, expressivo',
        gradient: 'linear-gradient(135deg, #1a0030 0%, #4a0080 100%)',
        accent: '#C084FC',
        icon: '📰',
        promptSuffix: 'editorial illustration style, expressive digital painting, magazine illustration quality, narrative storytelling art, graphic and painterly, professional editorial',
      },
      {
        id: 'dig_flat',
        label: 'Flat Design',
        description: 'Minimalista, geométrico, vetorial',
        gradient: 'linear-gradient(135deg, #003a3a 0%, #007070 100%)',
        accent: '#2DD4BF',
        icon: '⬜',
        promptSuffix: 'flat design illustration, minimal geometric shapes, no shadows, clean vector aesthetic, bold solid colors, modern graphic design, app icon quality',
      },
      {
        id: 'dig_pixel',
        label: 'Pixel Art',
        description: 'Retrô, 16-bit, game vintage',
        gradient: 'linear-gradient(135deg, #1a003a 0%, #4a0080 100%)',
        accent: '#A78BFA',
        icon: '👾',
        promptSuffix: '16-bit pixel art style, retro video game aesthetic, limited color palette, crisp pixel grid, SNES era gaming visual, sprite art quality, nostalgic 8-bit 16-bit',
      },
    ],
  },
  {
    id: 'especial',
    label: 'Estilos Especiais',
    icon: '🎭',
    description: 'Estilos únicos e atmosferas icônicas',
    accent: '#CBD5E1',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #2a2a2a 100%)',
    substyles: [
      {
        id: 'esp_noir',
        label: 'Noir Clássico',
        description: 'P&B dramático, anos 40',
        gradient: 'linear-gradient(135deg, #050505 0%, #1a1a1a 100%)',
        accent: '#CBD5E1',
        icon: '🎭',
        promptSuffix: 'film noir black and white style, high contrast chiaroscuro, 1940s detective atmosphere, venetian blind shadow patterns, rain-soaked streets, moody dramatic lighting',
      },
      {
        id: 'esp_cyberpunk',
        label: 'Cyberpunk',
        description: 'Neons, Blade Runner, distopia',
        gradient: 'linear-gradient(135deg, #0d0030 0%, #00308a 100%)',
        accent: '#22D3EE',
        icon: '🌆',
        promptSuffix: 'cyberpunk neon aesthetic, Blade Runner Ghost in the Shell visual style, rain-soaked dystopian streets, glowing neon signs, holographic displays, dark synthwave atmosphere',
      },
      {
        id: 'esp_steampunk',
        label: 'Steampunk',
        description: 'Vitoriano, vapor, engrenagens',
        gradient: 'linear-gradient(135deg, #2a1500 0%, #6a3a00 100%)',
        accent: '#D97706',
        icon: '⚙️',
        promptSuffix: 'steampunk art style, Victorian era steam technology, brass copper machinery, industrial gears, sepia warm tones, retrofuturistic Victorian fantasy, airship aesthetic',
      },
      {
        id: 'esp_artnouv',
        label: 'Art Nouveau',
        description: 'Mucha, ornamental, floral',
        gradient: 'linear-gradient(135deg, #2a1a00 0%, #7a5a00 100%)',
        accent: '#FCD34D',
        icon: '🌺',
        promptSuffix: 'Art Nouveau illustration style, Alphonse Mucha aesthetic, flowing organic lines, ornamental floral borders, decorative poster art, elegant sinuous design, golden proportions',
      },
      {
        id: 'esp_popart',
        label: 'Pop Art',
        description: 'Warhol, Lichtenstein, halftone',
        gradient: 'linear-gradient(135deg, #5a0000 0%, #aa0050 100%)',
        accent: '#FB7185',
        icon: '🎪',
        promptSuffix: 'Pop Art style Andy Warhol Roy Lichtenstein aesthetic, bold primary colors, halftone Ben-Day dots, graphic high contrast, commercial imagery, speech bubble comic feel',
      },
      {
        id: 'esp_ukiyoe',
        label: 'Ukiyo-e',
        description: 'Xilogravura japonesa, Hokusai',
        gradient: 'linear-gradient(135deg, #1a000a 0%, #5a001a 100%)',
        accent: '#FDA4AF',
        icon: '🌊',
        promptSuffix: 'Ukiyo-e Japanese woodblock print style, Hokusai Hiroshige aesthetic, flat color areas, bold contour lines, traditional Japanese art, decorative patterns, Edo period aesthetic',
      },
      {
        id: 'esp_retrofuturismo',
        label: 'Retrofuturismo',
        description: 'Sci-fi anos 60, Atomic Age',
        gradient: 'linear-gradient(135deg, #00102a 0%, #003a6a 100%)',
        accent: '#60A5FA',
        icon: '🚀',
        promptSuffix: '1960s retro-futurism aesthetic, space age Atomic Age design, vibrant optimistic colors, mid-century modern sci-fi, vintage future illustration, Popular Mechanics magazine style',
      },
    ],
  },
];

interface Props {
  onConfirm: (style: StyleOption | null, referenceImage: { base64: string; mimeType: string } | null) => void;
  onSkip: () => void;
}

const StyleSelectionModal: React.FC<Props> = ({ onConfirm, onSkip }) => {
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleOption | null>(null);
  const [referenceImage, setReferenceImage] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setReferenceImage({ base64: dataUrl.split(',')[1], mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const handleSelectCategory = (cat: StyleCategory) => {
    setSelectedCategory(cat);
    // if the selected style is from a different category, deselect it
    if (selectedStyle && !cat.substyles.find(s => s.id === selectedStyle.id)) {
      setSelectedStyle(null);
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  const currentAccent = selectedStyle?.accent ?? selectedCategory?.accent ?? '#818CF8';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div
        className="anim-up"
        style={{
          width: '100%', maxWidth: 960, maxHeight: '92vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-md)',
          borderRadius: 20,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '22px 28px 18px',
          background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--surface) 100%)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Back button */}
          {selectedCategory && (
            <button
              onClick={handleBack}
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--surface-3)', border: '1px solid var(--border-md)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)', transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-3)')}
              title="Voltar às categorias"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              {selectedCategory && (
                <span style={{ fontSize: 16 }}>{selectedCategory.icon}</span>
              )}
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                {selectedCategory ? selectedCategory.label : 'Estilo Visual'}
              </p>
              {selectedCategory && (
                <>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Escolha o substilo</span>
                </>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-4)' }}>
              {selectedCategory
                ? selectedCategory.description
                : 'Escolha a linguagem visual do seu projeto — aplicada a todas as cenas geradas'}
            </p>
          </div>

          {/* Selected pill */}
          {selectedStyle && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 10px 5px 8px',
              background: `${currentAccent}18`,
              border: `1px solid ${currentAccent}50`,
              borderRadius: 20, flexShrink: 0,
            }}>
              <span style={{ fontSize: 13 }}>{selectedStyle.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: currentAccent }}>
                {selectedStyle.label}
              </span>
              <button
                onClick={() => setSelectedStyle(null)}
                style={{
                  width: 15, height: 15, borderRadius: '50%',
                  background: 'var(--surface-3)', border: 'none',
                  cursor: 'pointer', fontSize: 9, color: 'var(--text-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Category breadcrumb when in substyle view */}
          {!selectedCategory && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 10,
            }}>
              {STYLE_CATEGORIES.map(cat => {
                const hasSelection = cat.substyles.some(s => s.id === selectedStyle?.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      background: hasSelection ? `${cat.accent}14` : 'var(--surface-2)',
                      border: `1px solid ${hasSelection ? cat.accent + '60' : 'var(--border)'}`,
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'all .15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = hasSelection ? `${cat.accent}22` : 'var(--surface-3)';
                      (e.currentTarget as HTMLElement).style.borderColor = cat.accent + '80';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = hasSelection ? `${cat.accent}14` : 'var(--surface-2)';
                      (e.currentTarget as HTMLElement).style.borderColor = hasSelection ? cat.accent + '60' : 'var(--border)';
                    }}
                  >
                    {/* Icon area */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: cat.gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      {cat.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: hasSelection ? cat.accent : 'var(--text-1)' }}>
                          {cat.label}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {hasSelection && (
                            <span style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 4,
                              background: `${cat.accent}25`, color: cat.accent,
                              fontWeight: 700, border: `1px solid ${cat.accent}40`,
                            }}>
                              {cat.substyles.find(s => s.id === selectedStyle?.id)?.label}
                            </span>
                          )}
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={hasSelection ? cat.accent : 'var(--text-4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.35 }}>
                        {cat.substyles.length} estilos · {cat.description.split(',')[0]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Substyle grid */}
          {selectedCategory && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
              }}>
                {selectedCategory.substyles.map(style => {
                  const isSelected = selectedStyle?.id === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(isSelected ? null : style)}
                      style={{
                        position: 'relative', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                        padding: 0,
                        border: `2px solid ${isSelected ? style.accent : 'transparent'}`,
                        borderRadius: 12,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color .15s, transform .12s, box-shadow .15s',
                        transform: isSelected ? 'scale(1.025)' : 'scale(1)',
                        boxShadow: isSelected
                          ? `0 0 0 3px ${style.accent}22, 0 8px 24px rgba(0,0,0,0.3)`
                          : '0 1px 4px rgba(0,0,0,0.15)',
                        background: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.borderColor = `${style.accent}50`;
                          (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {/* Gradient top */}
                      <div style={{
                        height: 68,
                        background: style.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, position: 'relative',
                      }}>
                        {style.icon}
                        {isSelected && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6,
                            width: 18, height: 18, borderRadius: '50%',
                            background: style.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, color: '#fff', fontWeight: 800,
                          }}>✓</div>
                        )}
                      </div>
                      {/* Label */}
                      <div style={{
                        padding: '10px 12px 12px',
                        background: isSelected ? `${style.accent}10` : 'var(--surface-2)',
                        flex: 1,
                        transition: 'background .15s',
                      }}>
                        <p style={{
                          fontSize: 12, fontWeight: 700,
                          color: isSelected ? style.accent : 'var(--text-1)',
                          marginBottom: 3, lineHeight: 1.2,
                        }}>
                          {style.label}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.35 }}>
                          {style.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reference image */}
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-4)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
            }}>
              Imagem de Referência{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— opcional</span>
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !referenceImage && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--indigo)' : 'var(--border-md)'}`,
                borderRadius: 12,
                background: isDragging ? 'var(--indigo-s)' : 'var(--surface-2)',
                padding: referenceImage ? '12px 16px' : '24px',
                display: 'flex', alignItems: 'center',
                justifyContent: referenceImage ? 'flex-start' : 'center',
                cursor: referenceImage ? 'default' : 'pointer',
                transition: 'all .15s', gap: 16,
              }}
            >
              {referenceImage ? (
                <>
                  <img
                    src={`data:${referenceImage.mimeType};base64,${referenceImage.base64}`}
                    alt="Referência"
                    style={{
                      height: 72, width: 'auto', maxWidth: 120,
                      objectFit: 'cover', borderRadius: 8, flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>
                      {referenceImage.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8 }}>
                      A IA usará esta imagem como referência visual para as cenas
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReferenceImage(null); }}
                      style={{
                        fontSize: 11, color: 'var(--red)', cursor: 'pointer',
                        background: 'rgba(248,113,113,0.08)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        borderRadius: 5, padding: '3px 8px',
                      }}
                    >
                      Remover imagem
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--surface-3)', border: '1px solid var(--border-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, margin: '0 auto 10px',
                  }}>🖼️</div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 3 }}>
                    {isDragging ? 'Solte a imagem aqui' : 'Arraste ou clique para selecionar'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-4)' }}>
                    PNG, JPG, WEBP · Referência visual para a IA
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, background: 'var(--surface-2)', gap: 12,
        }}>
          <button
            onClick={onSkip}
            style={{
              fontSize: 13, color: 'var(--text-4)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '8px 4px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            Pular — continuar sem estilo
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedStyle && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--text-3)',
              }}>
                <span>{selectedStyle.icon}</span>
                <span style={{ fontWeight: 600, color: currentAccent }}>{selectedStyle.label}</span>
                <span style={{ color: 'var(--text-4)' }}>selecionado</span>
              </div>
            )}
            <button
              onClick={() => onConfirm(
                selectedStyle,
                referenceImage ? { base64: referenceImage.base64, mimeType: referenceImage.mimeType } : null
              )}
              disabled={!selectedStyle}
              className="btn btn-primary"
              style={{
                fontSize: 13, opacity: selectedStyle ? 1 : 0.45,
                cursor: selectedStyle ? 'pointer' : 'not-allowed',
                background: selectedStyle ? `linear-gradient(135deg, ${currentAccent}, ${currentAccent}cc)` : undefined,
                borderColor: selectedStyle ? currentAccent : undefined,
              }}
            >
              {selectedStyle ? `✓ Prosseguir com ${selectedStyle.label}` : 'Selecione um estilo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleSelectionModal;
