import React from 'react';
import type { VideoAudioTrack } from '@/types';
import { RangeField } from './VideoStudioControls';
import { MAX_AUDIO_BYTES } from './videoStudioConstants';

interface AudioPanelProps {
  audio: VideoAudioTrack | undefined;
  totalSeconds: number;
  onAudioPatchPreview: (patch: Partial<VideoAudioTrack>) => void;
  onAudioPatchCommit: (patch: Partial<VideoAudioTrack>, label: string) => void;
  onAudioUpload: (file: File) => void;
  onRemoveAudio: () => void;
  uploadError: string | null;
  panelId: string;
  tabId: string;
}

const AudioPanel: React.FC<AudioPanelProps> = ({
  audio,
  totalSeconds,
  onAudioPatchPreview,
  onAudioPatchCommit,
  onAudioUpload,
  onRemoveAudio,
  uploadError,
  panelId,
  tabId,
}) => {
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAudioUpload(file);
    event.target.value = '';
  };

  return (
    <div className="vs-tab-panel" role="tabpanel" id={panelId} aria-labelledby={tabId}>
      <p className="vs-section-title">Trilha de áudio</p>
      {audio ? (
        <>
          <p className="vs-audio-label">{audio.label}</p>
          <RangeField
            id="vs-audio-volume"
            label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={audio.volume}
            onChange={(volume) => onAudioPatchPreview({ volume })}
            onCommit={(volume) => onAudioPatchCommit({ volume }, 'Volume')}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <RangeField
            id="vs-audio-offset"
            label="Início (offset)"
            min={0}
            max={Math.max(0.5, totalSeconds)}
            step={0.1}
            value={audio.startOffsetSeconds ?? 0}
            onChange={(startOffsetSeconds) => onAudioPatchPreview({ startOffsetSeconds })}
            onCommit={(startOffsetSeconds) => onAudioPatchCommit({ startOffsetSeconds }, 'Offset de áudio')}
            format={(value) => `${value.toFixed(1)}s`}
          />
          <div className="vs-row-2">
            <RangeField
              id="vs-audio-fade-in"
              label="Fade in"
              min={0}
              max={4}
              step={0.1}
              value={audio.fadeInSeconds ?? 0}
              onChange={(fadeInSeconds) => onAudioPatchPreview({ fadeInSeconds })}
              onCommit={(fadeInSeconds) => onAudioPatchCommit({ fadeInSeconds }, 'Fade in')}
              format={(value) => `${value.toFixed(1)}s`}
            />
            <RangeField
              id="vs-audio-fade-out"
              label="Fade out"
              min={0}
              max={4}
              step={0.1}
              value={audio.fadeOutSeconds ?? 0}
              onChange={(fadeOutSeconds) => onAudioPatchPreview({ fadeOutSeconds })}
              onCommit={(fadeOutSeconds) => onAudioPatchCommit({ fadeOutSeconds }, 'Fade out')}
              format={(value) => `${value.toFixed(1)}s`}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost vs-restore"
            onClick={() => {
              if (typeof window === 'undefined' || window.confirm('Remover trilha de áudio?')) {
                onRemoveAudio();
              }
            }}
          >
            Remover trilha
          </button>
        </>
      ) : (
        <>
          <label className="vs-audio-upload">
            <input type="file" accept="audio/*" onChange={handleFile} aria-label="Carregar trilha de áudio" />
            <span>Carregar arquivo de áudio</span>
          </label>
          <p className="vs-hint">MP3, WAV ou M4A. Limite {Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB.</p>
          {uploadError && <p className="vs-warning" role="alert">{uploadError}</p>}
        </>
      )}
    </div>
  );
};

export default AudioPanel;
