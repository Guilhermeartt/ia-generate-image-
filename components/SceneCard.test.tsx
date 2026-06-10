// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach } from 'vitest';
import SceneCard from './SceneCard';
import type { Scene, Character } from '../types';

afterEach(cleanup);

const makeScene = (overrides: Partial<Scene> = {}): Scene => ({
  id: 1,
  scene_id: 1,
  sub_id: 1,
  order: 1,
  original_location: 'INT. APARTAMENTO — NOITE',
  original_description: 'Maria observa a chuva pela janela.',
  tagged_description: '[Maria] observa a chuva.',
  image_prompt: 'A woman by the window at night, cinematic',
  style: 'drama',
  detected_characters: ['Maria'],
  ...overrides,
});

const makeProps = (scene: Scene, characters: Character[] = []) => ({
  scene,
  scenes: [scene],
  characters,
  sceneIndex: 0,
  availableStyles: ['drama', 'noir'],
  onImageUpdate: vi.fn(),
  onVisualize: vi.fn(),
  onVisualizeWithReference: vi.fn(),
  editImageService: vi.fn().mockResolvedValue({ base64Data: '', mimeType: 'image/png' }),
  onPreview: vi.fn(),
  onPromptChange: vi.fn(),
  onStyleChange: vi.fn(),
  onSceneVisualStyleChange: vi.fn(),
  onContinuationChange: vi.fn(),
  onContinuationReferenceChange: vi.fn(),
  onUpdatePrompt: vi.fn(),
  onRevertImage: vi.fn(),
  onAnalyzeText: vi.fn(),
  onEditRegion: vi.fn(),
  onSplitScene: vi.fn(),
  onClearSplit: vi.fn(),
  onSceneCharacterEdit: vi.fn(),
  onIncludeLetteringChange: vi.fn(),
  onGenerateEndFrame: vi.fn(),
});

describe('SceneCard (render)', () => {
  it('renderiza a localização e a descrição da cena', () => {
    const scene = makeScene();
    render(<SceneCard {...makeProps(scene)} />);
    expect(screen.getByText(/INT\. APARTAMENTO/i)).toBeInTheDocument();
    expect(screen.getByText(/observa a chuva/i)).toBeInTheDocument();
  });

  it('mostra o botão de visualizar quando a cena não tem imagem', () => {
    render(<SceneCard {...makeProps(makeScene())} />);
    expect(screen.getAllByText(/Visualizar|Gerar/i).length).toBeGreaterThan(0);
  });

  it('renderiza a seção de personagens quando há elenco', () => {
    const characters: Character[] = [
      { name: 'Maria', physical_characteristics: 'Mulher, 34 anos', image_prompt: 'Maria' },
      { name: 'Paulo', physical_characteristics: 'Homem, 40 anos', image_prompt: 'Paulo' },
    ];
    render(<SceneCard {...makeProps(makeScene(), characters)} />);
    expect(screen.getByText(/Personagens:/i)).toBeInTheDocument();
  });

  it('mostra o aviso de subcena recomendada quando suggests_split', () => {
    const scene = makeScene({ suggests_split: true, split_reason: 'Duas ações distintas' });
    render(<SceneCard {...makeProps(scene)} />);
    expect(screen.getByText(/Subcena recomendada/i)).toBeInTheDocument();
    expect(screen.getByText(/Duas ações distintas/i)).toBeInTheDocument();
  });

  it('mostra o lettering indicado quando a cena tem notas', () => {
    const scene = makeScene({ lettering_notes: ['TÍTULO: O Reencontro'] });
    render(<SceneCard {...makeProps(scene)} />);
    expect(screen.getByText(/Texto na imagem/i)).toBeInTheDocument();
    expect(screen.getByText(/O Reencontro/i)).toBeInTheDocument();
  });

  it('explicita a proibição de lettering quando a cena não tem notas', () => {
    render(<SceneCard {...makeProps(makeScene())} />);
    expect(screen.getByText(/Sem lettering/i)).toBeInTheDocument();
    expect(screen.getByText(/inclusive no frame final/i)).toBeInTheDocument();
  });

  it('mostra no checklist uma continuidade que aponta para a própria cena', () => {
    const scene = makeScene({ isContinuation: true, continuationReferenceId: 1 });
    render(<SceneCard {...makeProps(scene)} />);
    fireEvent.click(screen.getByRole('button', { name: /Checklist de geração/i }));
    expect(screen.getByText(/aponta para a própria cena/i)).toBeInTheDocument();
  });

  it('permite desligar uma continuidade inválida importada na primeira cena', () => {
    const scene = makeScene({ isContinuation: true });
    const props = makeProps(scene);
    render(<SceneCard {...props} />);
    const checkbox = screen.getByRole('checkbox', { name: /Continuação da cena anterior/i });
    expect(checkbox).not.toBeDisabled();
    fireEvent.click(checkbox);
    expect(props.onContinuationChange).toHaveBeenCalledWith(scene.id, false);
  });

  it('renderiza marcadores [Nome] como <strong> sem injetar HTML', () => {
    const scene = makeScene({
      tagged_description: '[Maria] grita "<script>alert(1)</script>" para [Paulo].',
    });
    const { container } = render(<SceneCard {...makeProps(scene)} />);
    // O script bruto não deve criar elemento real
    expect(container.querySelector('script')).toBeNull();
    // Mas a marcação visual deve estar lá
    const strongs = container.querySelectorAll('.sc-description strong');
    expect(strongs.length).toBe(2);
    expect(strongs[0].textContent).toBe('[Maria]');
    expect(strongs[1].textContent).toBe('[Paulo]');
  });

  it('exibe erro categorizado com CTA específico para falta de créditos', () => {
    const scene = makeScene({ error: 'Sem créditos suficientes para gerar' });
    render(<SceneCard {...makeProps(scene)} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/Sem créditos/i);
    expect(screen.getByRole('button', { name: /Comprar créditos/i })).toBeDisabled();
  });

  it('mostra um CTA de tentar novamente quando o erro é de rede', () => {
    const scene = makeScene({ error: 'fetch failed: network error' });
    render(<SceneCard {...makeProps(scene)} />);
    expect(screen.getByText(/Erro de conexão/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).not.toBeDisabled();
  });

  it('abre o modal de comparação quando há versão anterior e usuário clica em Comparar', () => {
    const scene = makeScene({
      imageUrl: 'data:image/png;base64,current',
      previousImageUrl: 'data:image/png;base64,previous',
    });
    render(<SceneCard {...makeProps(scene)} />);
    fireEvent.click(screen.getByRole('button', { name: /Comparar com versão anterior/i }));
    expect(screen.getByRole('dialog', { name: /Comparar versões/i })).toBeInTheDocument();
  });
});
