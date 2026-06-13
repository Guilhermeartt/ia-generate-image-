import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type {
  Scene,
  SceneVideoClipOverride,
  SceneVideoLettering,
  VideoAudioTrack,
} from '@/types';
import { StoryboardComposition, type StoryboardVideoScene } from './StoryboardComposition';
import {
  DEFAULT_KEN_BURNS,
  DEFAULT_TRANSITION,
  DEFAULT_TRANSITION_EASING,
  DEFAULT_TRANSITION_SECONDS,
  createVideoScenes,
  maximumTransitionSeconds,
  isVideoClipTransition,
  isVideoTransitionEasing,
  placeClipsOnTimeline,
  selectedVideoImageSourcesForScene,
  videoImageSourcesForScene,
} from './videoScenes';
import VideoTimeline from './VideoTimeline';
import { Tabs } from './VideoStudioControls';
import { useHistoryStack } from './useHistoryStack';
import { useDraftPatch } from './useDraftPatch';
import LetteringPanel from './LetteringPanel';
import MotionPanel, { type MotionDefaults } from './MotionPanel';
import AudioPanel from './AudioPanel';
import PreviewPanel from './PreviewPanel';
import { useTemplateMarkups } from '../../hooks/useTemplates';
import {
  ASPECT_RATIOS,
  FPS,
  MAX_AUDIO_BYTES,
  STORAGE_KEY,
  TEXTAREA_DEBOUNCE_MS,
  type TabId,
} from './videoStudioConstants';

interface VideoStudioProps {
  scenes: Scene[];
  aspectRatio: string;
  onLetteringChange: (sceneId: number, lettering: SceneVideoLettering | undefined) => void;
  onImageSourcesChange: (sceneId: number, sourceIds: string[]) => void;
  onClipOverridesChange?: (sceneId: number, overrides: SceneVideoClipOverride[] | undefined) => void;
  onExportRequest?: (options: { aspectRatio: string; audio?: VideoAudioTrack; totalSeconds: number }) => void;
}

type HistorySnapshot =
  | { kind: 'scene'; sceneId: number; previousLettering: SceneVideoLettering | undefined; previousOverrides: SceneVideoClipOverride[] | undefined }
  | { kind: 'defaults'; previousDefaults: MotionDefaults }
  | { kind: 'audio'; previousAudio: VideoAudioTrack | undefined }
  | { kind: 'aspect'; previousAspect: string };

const buildOverrideUpdate = (
  current: SceneVideoClipOverride[] | undefined,
  sourceId: string,
  patch: Partial<SceneVideoClipOverride>,
): SceneVideoClipOverride[] => {
  const list = current ? [...current] : [];
  const index = list.findIndex(item => item.sourceId === sourceId);
  if (index === -1) {
    list.push({ sourceId, ...patch });
  } else {
    list[index] = { ...list[index], ...patch };
  }
  return list;
};

const removeOverride = (
  current: SceneVideoClipOverride[] | undefined,
  sourceId: string,
): SceneVideoClipOverride[] | undefined => {
  if (!current) return undefined;
  const next = current.filter(item => item.sourceId !== sourceId);
  return next.length === 0 ? undefined : next;
};

const DEFAULT_MOTION: MotionDefaults = {
  secondsPerClip: 3,
  transition: DEFAULT_TRANSITION,
  transitionSeconds: DEFAULT_TRANSITION_SECONDS,
  transitionEasing: DEFAULT_TRANSITION_EASING,
  kenBurns: DEFAULT_KEN_BURNS,
};

const loadPersistedDefaults = (fallback: string): { defaults: MotionDefaults; aspect: string } => {
  if (typeof window === 'undefined') return { defaults: DEFAULT_MOTION, aspect: fallback };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { defaults: DEFAULT_MOTION, aspect: fallback };
    const parsed = JSON.parse(raw);
    const persistedDefaults = parsed.defaults ?? {};
    return {
      defaults: {
        ...DEFAULT_MOTION,
        ...persistedDefaults,
        transition: isVideoClipTransition(persistedDefaults.transition)
          ? persistedDefaults.transition
          : DEFAULT_MOTION.transition,
        transitionSeconds:
          Number.isFinite(persistedDefaults.transitionSeconds)
          && persistedDefaults.transitionSeconds >= 0
            ? persistedDefaults.transitionSeconds
            : DEFAULT_MOTION.transitionSeconds,
        transitionEasing: isVideoTransitionEasing(persistedDefaults.transitionEasing)
          ? persistedDefaults.transitionEasing
          : DEFAULT_MOTION.transitionEasing,
      },
      aspect: typeof parsed.aspect === 'string' && parsed.aspect in ASPECT_RATIOS ? parsed.aspect : fallback,
    };
  } catch {
    return { defaults: DEFAULT_MOTION, aspect: fallback };
  }
};

const persistDefaults = (defaults: MotionDefaults, aspect: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ defaults, aspect }));
  } catch { /* noop */ }
};

const VideoStudio: React.FC<VideoStudioProps> = ({
  scenes,
  aspectRatio,
  onLetteringChange,
  onImageSourcesChange,
  onClipOverridesChange,
  onExportRequest,
}) => {
  const persistedRef = useRef(loadPersistedDefaults(aspectRatio));
  const [defaults, setDefaults] = useState<MotionDefaults>(persistedRef.current.defaults);
  const [aspectOverride, setAspectOverride] = useState<string>(persistedRef.current.aspect);
  const [showCaptions, setShowCaptions] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('lettering');
  const [playheadFrame, setPlayheadFrame] = useState(0);
  const [audio, setAudio] = useState<VideoAudioTrack | undefined>();
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [letteringDraftText, setLetteringDraftText] = useState<string>('');
  const [overrideScope, setOverrideScope] = useState<'parent' | 'clip'>('parent');
  const [colorHistory, setColorHistory] = useState<string[]>(['#ffffff', '#FBBF24', '#22D3EE', '#F472B6']);
  const [missingClipWarning, setMissingClipWarning] = useState<string | null>(null);

  const playerRef = useRef<PlayerRef>(null);
  const history = useHistoryStack<HistorySnapshot>();
  const audioUrlRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasPlayingRef = useRef(false);

  const letteringDraft = useDraftPatch<Partial<SceneVideoLettering>>();
  const overrideDraft = useDraftPatch<Partial<SceneVideoClipOverride>>();
  const audioDraft = useDraftPatch<Partial<VideoAudioTrack>>();
  const defaultsDraft = useDraftPatch<Partial<MotionDefaults>>();

  // Persistir defaults + aspect
  useEffect(() => {
    persistDefaults(defaults, aspectOverride);
  }, [defaults, aspectOverride]);

  // Compor videoScenes considerando draft de defaults
  const effectiveDefaults: MotionDefaults = useMemo(() => ({
    ...defaults,
    ...(defaultsDraft.draft ?? {}),
  }), [defaults, defaultsDraft.draft]);

  const videoScenes = useMemo(
    () =>
      createVideoScenes(scenes, {
        defaultSecondsPerClip: effectiveDefaults.secondsPerClip,
        defaultTransition: effectiveDefaults.transition,
        defaultTransitionSeconds: effectiveDefaults.transitionSeconds,
        defaultTransitionEasing: effectiveDefaults.transitionEasing,
        defaultKenBurns: effectiveDefaults.kenBurns,
      }),
    [scenes, effectiveDefaults],
  );

  const templateMarkups = useTemplateMarkups(
    useMemo(() => scenes.map(scene => scene.templateId), [scenes]),
  );

  const selectedClipFromList = useMemo(
    () => videoScenes.find(scene => scene.id === selectedClipId),
    [videoScenes, selectedClipId],
  );
  const selectedClip = selectedClipFromList ?? videoScenes[0];
  const selectedClipIndex = selectedClip
    ? videoScenes.findIndex(clip => clip.id === selectedClip.id)
    : -1;
  const previousClip = selectedClipIndex > 0 ? videoScenes[selectedClipIndex - 1] : undefined;
  const maxTransitionSeconds = selectedClip && previousClip
    ? maximumTransitionSeconds(selectedClip.durationSeconds, previousClip.durationSeconds)
    : 0;

  // Detectar clipe selecionado que sumiu
  useEffect(() => {
    if (selectedClipId && !selectedClipFromList && videoScenes.length > 0) {
      setMissingClipWarning('O plano selecionado foi removido. Mostrando o primeiro disponível.');
      setSelectedClipId(null);
    }
  }, [selectedClipId, selectedClipFromList, videoScenes.length]);

  // Aplicar drafts ao vivo no clip selecionado (preview)
  const displayLettering: SceneVideoLettering | undefined = useMemo(() => {
    if (!selectedClip) return undefined;
    if (!letteringDraft.draft) return selectedClip.lettering;
    return { ...selectedClip.lettering, ...letteringDraft.draft };
  }, [selectedClip, letteringDraft.draft]);

  const displayClips = useMemo<StoryboardVideoScene[]>(() => {
    if (!letteringDraft.draft && !overrideDraft.draft) return videoScenes;
    if (!selectedClip) return videoScenes;
    return videoScenes.map((c) => {
      if (c.id !== selectedClip.id) return c;
      const next: StoryboardVideoScene = { ...c };
      if (letteringDraft.draft) next.lettering = { ...c.lettering, ...letteringDraft.draft };
      if (overrideDraft.draft) {
        if (overrideDraft.draft.durationSeconds !== undefined) next.durationSeconds = overrideDraft.draft.durationSeconds;
        if (overrideDraft.draft.kenBurns) next.kenBurns = overrideDraft.draft.kenBurns;
        if (overrideDraft.draft.transitionIn) next.transitionIn = overrideDraft.draft.transitionIn;
        if (overrideDraft.draft.transitionDurationSeconds !== undefined) next.transitionDurationSeconds = overrideDraft.draft.transitionDurationSeconds;
        if (overrideDraft.draft.transitionEasing) next.transitionEasing = overrideDraft.draft.transitionEasing;
      }
      return next;
    });
  }, [videoScenes, letteringDraft.draft, overrideDraft.draft, selectedClip]);

  const { placements, totalFrames } = useMemo(
    () => placeClipsOnTimeline(displayClips, FPS),
    [displayClips],
  );

  const dimensions = ASPECT_RATIOS[aspectOverride] ?? ASPECT_RATIOS['16:9'];

  const selectedSourceScene = useMemo(
    () => scenes.find(scene => scene.id === selectedClip?.sceneId),
    [scenes, selectedClip],
  );

  const availableSources = useMemo(
    () => (selectedSourceScene ? videoImageSourcesForScene(selectedSourceScene) : []),
    [selectedSourceScene],
  );

  const selectedSourceIds = useMemo(() => {
    if (!selectedSourceScene) return [];
    if (selectedSourceScene.videoImageSourceIds) return selectedSourceScene.videoImageSourceIds;
    const fallback = availableSources.find(source => source.id === 'main') ?? availableSources[0];
    return fallback ? [fallback.id] : [];
  }, [selectedSourceScene, availableSources]);

  const scenesWithoutSelectedImages = useMemo(
    () => scenes.filter(scene => selectedVideoImageSourcesForScene(scene).length === 0).length,
    [scenes],
  );

  const parentSceneClipCount = useMemo(() => {
    if (!selectedClip) return 0;
    return videoScenes.filter(c => c.parentSceneId === selectedClip.parentSceneId).length;
  }, [videoScenes, selectedClip]);

  // Sincronizar texto do textarea com o clipe selecionado
  useEffect(() => {
    setLetteringDraftText(selectedClip?.lettering.text ?? '');
  }, [selectedClip?.id, selectedClip?.lettering.text]);

  // Reset scope quando clip sem override e scope=clip
  useEffect(() => {
    if (overrideScope === 'clip' && selectedClip && !selectedClip.hasOverride) {
      setOverrideScope('parent');
    }
  }, [selectedClip, overrideScope]);

  // Reset scope quando o parent só tem 1 clipe
  useEffect(() => {
    if (parentSceneClipCount <= 1 && overrideScope === 'clip') setOverrideScope('parent');
  }, [parentSceneClipCount, overrideScope]);

  // Frame subscriber + Page Visibility
  useEffect(() => {
    let stopped = false;
    const updateFrame = () => {
      if (stopped) return;
      const frame = playerRef.current?.getCurrentFrame();
      if (typeof frame === 'number') setPlayheadFrame(frame);
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(updateFrame, 100);
    };
    const stop = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    if (typeof document === 'undefined' || !document.hidden) start();

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      stopped = true;
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  // History helpers
  const snapshotScene = useCallback((scene: Scene | undefined): HistorySnapshot | undefined => {
    if (!scene) return undefined;
    return {
      kind: 'scene',
      sceneId: scene.id,
      previousLettering: scene.videoLettering,
      previousOverrides: scene.videoClipOverrides,
    };
  }, []);

  const pushSceneHistory = useCallback((label: string) => {
    const snap = snapshotScene(selectedSourceScene);
    if (snap) history.push(label, snap);
  }, [snapshotScene, selectedSourceScene, history]);

  // Silent appliers (no history)
  const applyLetteringPatchSilent = useCallback(
    (patch: Partial<SceneVideoLettering>) => {
      if (!selectedSourceScene || !selectedClip) return;
      if (overrideScope === 'clip' && onClipOverridesChange) {
        const currentOverrides = selectedSourceScene.videoClipOverrides;
        const currentOverride = currentOverrides?.find(item => item.sourceId === selectedClip.sourceId);
        const nextLettering = { ...(currentOverride?.lettering ?? selectedClip.lettering), ...patch };
        const next = buildOverrideUpdate(currentOverrides, selectedClip.sourceId, { lettering: nextLettering });
        onClipOverridesChange(selectedSourceScene.id, next);
      } else {
        onLetteringChange(selectedClip.sceneId, { ...selectedClip.lettering, ...patch });
      }
    },
    [selectedSourceScene, selectedClip, overrideScope, onClipOverridesChange, onLetteringChange],
  );

  const applyOverridePatchSilent = useCallback(
    (patch: Partial<SceneVideoClipOverride>) => {
      if (!selectedSourceScene || !selectedClip || !onClipOverridesChange) return;
      const next = buildOverrideUpdate(selectedSourceScene.videoClipOverrides, selectedClip.sourceId, patch);
      onClipOverridesChange(selectedSourceScene.id, next);
    },
    [selectedSourceScene, selectedClip, onClipOverridesChange],
  );

  // Commit handlers
  const commitLetteringPatch = useCallback(
    (patch: Partial<SceneVideoLettering>, label: string) => {
      pushSceneHistory(label);
      applyLetteringPatchSilent(patch);
      letteringDraft.cancel();
    },
    [pushSceneHistory, applyLetteringPatchSilent, letteringDraft],
  );

  const commitOverridePatch = useCallback(
    (patch: Partial<SceneVideoClipOverride>, label: string) => {
      pushSceneHistory(label);
      applyOverridePatchSilent(patch);
      overrideDraft.cancel();
    },
    [pushSceneHistory, applyOverridePatchSilent, overrideDraft],
  );

  const commitDefaults = useCallback((patch: Partial<MotionDefaults>, label: string) => {
    history.push(label, { kind: 'defaults', previousDefaults: defaults });
    setDefaults(prev => ({ ...prev, ...patch }));
    defaultsDraft.cancel();
  }, [history, defaults, defaultsDraft]);

  const commitAudioPatch = useCallback((patch: Partial<VideoAudioTrack>, label: string) => {
    if (!audio) return;
    history.push(label, { kind: 'audio', previousAudio: audio });
    setAudio({ ...audio, ...patch });
    audioDraft.cancel();
  }, [history, audio, audioDraft]);

  const handleAspectChange = useCallback((next: string) => {
    history.push(`Aspect ${next}`, { kind: 'aspect', previousAspect: aspectOverride });
    setAspectOverride(next);
  }, [history, aspectOverride]);

  const clearClipOverride = useCallback(() => {
    if (!selectedSourceScene || !selectedClip || !onClipOverridesChange) return;
    pushSceneHistory('Resetar overrides');
    onClipOverridesChange(
      selectedSourceScene.id,
      removeOverride(selectedSourceScene.videoClipOverrides, selectedClip.sourceId),
    );
    setOverrideScope('parent');
    overrideDraft.cancel();
  }, [selectedSourceScene, selectedClip, onClipOverridesChange, pushSceneHistory, overrideDraft]);

  // Undo / Redo
  const applyHistorySnapshot = useCallback((snap: HistorySnapshot) => {
    if (snap.kind === 'scene') {
      onLetteringChange(snap.sceneId, snap.previousLettering);
      if (onClipOverridesChange) onClipOverridesChange(snap.sceneId, snap.previousOverrides);
    } else if (snap.kind === 'defaults') {
      setDefaults(snap.previousDefaults);
    } else if (snap.kind === 'audio') {
      setAudio(snap.previousAudio);
    } else if (snap.kind === 'aspect') {
      setAspectOverride(snap.previousAspect);
    }
  }, [onLetteringChange, onClipOverridesChange]);

  const handleUndo = useCallback(() => {
    const entry = history.undo();
    if (entry) applyHistorySnapshot(entry.snapshot);
  }, [history, applyHistorySnapshot]);

  const handleRedo = useCallback(() => {
    const entry = history.redo();
    if (entry) applyHistorySnapshot(entry.snapshot);
  }, [history, applyHistorySnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = document.activeElement as HTMLElement | null;
      const inField = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (isMod && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
      } else if (event.code === 'Space' && !inField) {
        event.preventDefault();
        const player = playerRef.current;
        if (player?.isPlaying()) player.pause();
        else player?.play();
      } else if (event.key === 'ArrowLeft' && !inField) {
        playerRef.current?.seekTo(Math.max(0, (playerRef.current?.getCurrentFrame() ?? 0) - FPS));
      } else if (event.key === 'ArrowRight' && !inField) {
        playerRef.current?.seekTo(Math.min(totalFrames, (playerRef.current?.getCurrentFrame() ?? 0) + FPS));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, totalFrames]);

  // Scene selection from timeline
  const selectScene = useCallback((scene: StoryboardVideoScene, startFrame: number) => {
    setSelectedClipId(scene.id);
    playerRef.current?.seekTo(startFrame);
  }, []);

  // Scrub pause/resume
  const handleScrubStart = useCallback(() => {
    const player = playerRef.current;
    if (player?.isPlaying()) {
      wasPlayingRef.current = true;
      player.pause();
    } else {
      wasPlayingRef.current = false;
    }
  }, []);

  const handleScrub = useCallback((frame: number) => {
    playerRef.current?.seekTo(frame);
    setPlayheadFrame(frame);
  }, []);

  const handleScrubEnd = useCallback(() => {
    if (wasPlayingRef.current) playerRef.current?.play();
  }, []);

  const restartPreview = useCallback(() => {
    playerRef.current?.pause();
    playerRef.current?.seekTo(0);
    setSelectedClipId(null);
    setPlayheadFrame(0);
  }, []);

  // Textarea debounced commit
  const handleLetteringTextChange = useCallback((value: string) => {
    setLetteringDraftText(value);
    letteringDraft.begin();
    letteringDraft.patch({ text: value });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commitLetteringPatch({ text: value }, 'Editar texto');
    }, TEXTAREA_DEBOUNCE_MS);
  }, [letteringDraft, commitLetteringPatch]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const toggleImageSource = (sourceId: string) => {
    if (!selectedSourceScene) return;
    if (selectedSourceIds.includes(sourceId) && selectedSourceIds.length === 1) return;
    const nextIds = selectedSourceIds.includes(sourceId)
      ? selectedSourceIds.filter(id => id !== sourceId)
      : [...selectedSourceIds, sourceId];
    onImageSourcesChange(selectedSourceScene.id, nextIds);
  };

  // Audio handlers
  const handleAudioUpload = useCallback((file: File) => {
    setAudioUploadError(null);
    if (file.size > MAX_AUDIO_BYTES) {
      setAudioUploadError(`Arquivo acima de ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB. Use um arquivo menor.`);
      return;
    }
    if (!file.type.startsWith('audio/')) {
      setAudioUploadError('Tipo de arquivo não suportado. Use MP3, WAV ou M4A.');
      return;
    }
    try {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(file);
      audioUrlRef.current = url;
      history.push('Carregar áudio', { kind: 'audio', previousAudio: audio });
      setAudio({
        id: `${file.name}-${file.size}`,
        label: file.name,
        src: url,
        volume: 0.8,
        startOffsetSeconds: 0,
        fadeInSeconds: 0.4,
        fadeOutSeconds: 0.4,
      });
    } catch {
      setAudioUploadError('Falha ao carregar áudio. Tente outro arquivo.');
    }
  }, [audio, history]);

  const removeAudio = useCallback(() => {
    history.push('Remover áudio', { kind: 'audio', previousAudio: audio });
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudio(undefined);
    setAudioUploadError(null);
  }, [history, audio]);

  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const recordSelectedColor = useCallback((next: string) => {
    setColorHistory(current => {
      const filtered = current.filter(color => color.toLowerCase() !== next.toLowerCase());
      return [next, ...filtered].slice(0, 6);
    });
  }, []);

  const handleExport = useCallback(() => {
    if (!onExportRequest) return;
    onExportRequest({ aspectRatio: aspectOverride, audio, totalSeconds: totalFrames / FPS });
  }, [onExportRequest, aspectOverride, audio, totalFrames]);

  const parentSceneDuration = selectedClip?.parentSceneDurationSeconds ?? defaults.secondsPerClip;

  const hasMotionOverride = useMemo(() => {
    if (!selectedSourceScene || !selectedClip) return false;
    const ov = selectedSourceScene.videoClipOverrides?.find(o => o.sourceId === selectedClip.sourceId);
    if (!ov) return false;
    return ov.durationSeconds !== undefined
      || ov.kenBurns !== undefined
      || ov.transitionIn !== undefined
      || ov.transitionDurationSeconds !== undefined
      || ov.transitionEasing !== undefined;
  }, [selectedSourceScene, selectedClip]);

  const hasLetteringOverride = useMemo(() => {
    if (!selectedSourceScene || !selectedClip) return false;
    const ov = selectedSourceScene.videoClipOverrides?.find(o => o.sourceId === selectedClip.sourceId);
    return Boolean(ov?.lettering);
  }, [selectedSourceScene, selectedClip]);

  const tabs = useMemo<ReadonlyArray<{ id: TabId; label: string; badge?: boolean }>>(() => [
    { id: 'lettering', label: 'Lettering', badge: hasLetteringOverride },
    { id: 'motion', label: 'Movimento', badge: hasMotionOverride },
    { id: 'audio', label: 'Áudio', badge: Boolean(audio) },
    { id: 'preview', label: 'Preview' },
  ], [hasLetteringOverride, hasMotionOverride, audio]);

  if (videoScenes.length === 0) {
    return (
      <section className="anim-fade">
        <div className="section-hd" style={{ marginBottom: 16 }}>
          <div>
            <p className="section-title">Vídeo do storyboard</p>
            <p className="section-sub">Preview programático com Remotion.</p>
          </div>
        </div>
        <div className="vs-empty">
          <p className="vs-empty-title">Gere ao menos uma imagem de cena</p>
          <p className="vs-empty-sub">
            O Remotion usa as imagens prontas para montar e reproduzir a sequência.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="anim-fade vs-root">
      <div className="section-hd vs-header">
        <div>
          <p className="section-title">Estúdio de vídeo</p>
          <p className="section-sub">
            {videoScenes.length} clipe{videoScenes.length !== 1 ? 's' : ''} •{' '}
            {(totalFrames / FPS).toFixed(1)}s • {placements.length} corte{placements.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="vs-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleUndo}
            disabled={!history.canUndo}
            aria-label="Desfazer (Cmd/Ctrl+Z)"
            title={history.canUndo ? `Desfazer: ${history.lastLabel}` : 'Sem ações para desfazer'}
          >
            ↶ Desfazer
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRedo}
            disabled={!history.canRedo}
            aria-label="Refazer (Cmd/Ctrl+Shift+Z)"
          >
            ↷ Refazer
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={!onExportRequest}
            title={onExportRequest ? 'Enfileirar export MP4' : 'Configure um endpoint de export no servidor'}
          >
            Exportar MP4
          </button>
        </div>
      </div>

      {missingClipWarning && (
        <div className="vs-warning-bar" role="status" onClick={() => setMissingClipWarning(null)}>
          {missingClipWarning} <span className="vs-warning-dismiss">×</span>
        </div>
      )}

      <div className="vs-grid">
        <div className="vs-stage">
          <div className="vs-player-wrap">
            <Player
              ref={playerRef}
              component={StoryboardComposition}
              inputProps={{ scenes: displayClips, showCaptions, fps: FPS, audio, templateMarkups }}
              durationInFrames={Math.max(1, totalFrames)}
              compositionWidth={dimensions.width}
              compositionHeight={dimensions.height}
              fps={FPS}
              controls
              loop
              style={{ width: '100%', aspectRatio: `${dimensions.width}/${dimensions.height}` }}
            />
          </div>
          <VideoTimeline
            placements={placements}
            totalFrames={totalFrames}
            fps={FPS}
            selectedClipId={selectedClip?.id ?? null}
            onSelectClip={selectScene}
            playheadFrame={playheadFrame}
            onScrubStart={handleScrubStart}
            onScrub={handleScrub}
            onScrubEnd={handleScrubEnd}
          />
        </div>

        <aside className="vs-panel">
          <Tabs value={activeTab} onChange={setActiveTab} tabs={tabs} />

          {selectedClip && selectedSourceScene && (
            <div className="vs-panel-meta">
              <div>
                <p className="vs-panel-meta-title">{selectedClip.title}</p>
                <p className="vs-panel-meta-sub">{selectedClip.sourceLabel}</p>
              </div>
              {onClipOverridesChange && parentSceneClipCount > 1 && (
                <div className="vs-scope-toggle" role="radiogroup" aria-label="Escopo da edição">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={overrideScope === 'parent'}
                    className={`vs-scope-option${overrideScope === 'parent' ? ' is-active' : ''}`}
                    onClick={() => setOverrideScope('parent')}
                  >
                    Cena toda
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={overrideScope === 'clip'}
                    className={`vs-scope-option${overrideScope === 'clip' ? ' is-active' : ''}`}
                    onClick={() => setOverrideScope('clip')}
                  >
                    Só este plano
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lettering' && selectedClip && selectedSourceScene && displayLettering && (
            <LetteringPanel
              clip={selectedClip}
              sourceScene={selectedSourceScene}
              displayLettering={displayLettering}
              availableSources={availableSources}
              selectedSourceIds={selectedSourceIds}
              letteringTextDraft={letteringDraftText}
              parentSceneDuration={parentSceneDuration}
              colorHistory={colorHistory}
              onLetteringTextChange={handleLetteringTextChange}
              onToggleImageSource={toggleImageSource}
              onLetteringPatchPreview={(patch) => {
                letteringDraft.begin();
                letteringDraft.patch(patch);
              }}
              onLetteringPatchCommit={commitLetteringPatch}
              onRecordColor={recordSelectedColor}
              panelId="vs-tab-panel-lettering"
              tabId="vs-tab-lettering"
            />
          )}

          {activeTab === 'motion' && selectedClip && (
            <MotionPanel
              clip={selectedClip}
              displayDuration={selectedClip.durationSeconds}
              displayTransition={selectedClip.transitionIn}
              displayTransitionSeconds={selectedClip.transitionDurationSeconds}
              displayTransitionEasing={selectedClip.transitionEasing}
              displayKenBurns={selectedClip.kenBurns}
              canTransition={videoScenes[0]?.id !== selectedClip.id}
              maxTransitionSeconds={maxTransitionSeconds}
              defaults={effectiveDefaults}
              hasOverride={hasMotionOverride}
              onOverridePatchPreview={(patch) => {
                overrideDraft.begin();
                overrideDraft.patch(patch);
              }}
              onOverridePatchCommit={commitOverridePatch}
              onDefaultsPreview={(patch) => {
                defaultsDraft.begin();
                defaultsDraft.patch(patch);
              }}
              onDefaultsCommit={commitDefaults}
              onClearOverride={clearClipOverride}
              panelId="vs-tab-panel-motion"
              tabId="vs-tab-motion"
            />
          )}

          {activeTab === 'audio' && (
            <AudioPanel
              audio={audio}
              totalSeconds={totalFrames / FPS}
              onAudioPatchPreview={(patch) => {
                if (!audio) return;
                audioDraft.begin();
                audioDraft.patch(patch);
                setAudio({ ...audio, ...patch });
              }}
              onAudioPatchCommit={commitAudioPatch}
              onAudioUpload={handleAudioUpload}
              onRemoveAudio={removeAudio}
              uploadError={audioUploadError}
              panelId="vs-tab-panel-audio"
              tabId="vs-tab-audio"
            />
          )}

          {activeTab === 'preview' && (
            <PreviewPanel
              aspectOverride={aspectOverride}
              showCaptions={showCaptions}
              totalFrames={totalFrames}
              scenesWithoutSelectedImages={scenesWithoutSelectedImages}
              onAspectChange={handleAspectChange}
              onShowCaptionsChange={setShowCaptions}
              onRestartPreview={restartPreview}
              panelId="vs-tab-panel-preview"
              tabId="vs-tab-preview"
            />
          )}
        </aside>
      </div>
    </section>
  );
};

export default VideoStudio;
