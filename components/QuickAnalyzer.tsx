import React, { useState } from 'react';
import { analyzeUploadedImage } from '../services/geminiService';
import { UploadIcon, SparklesIcon, XIcon } from './icons';

const QuickAnalyzer: React.FC = () => {
  const [image, setImage]       = useState<{ url: string; base64: string; mime: string } | null>(null);
  const [prompt, setPrompt]     = useState('O que está nesta imagem?');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult]     = useState('');
  const [error, setError]       = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Selecione uma imagem válida (PNG, JPG, WebP).');
      return;
    }
    setError(''); setResult('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) setImage({ url, base64: url.split(',')[1], mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!image || !prompt) return;
    setIsLoading(true); setResult(''); setError('');
    try {
      setResult(await analyzeUploadedImage(image.base64, image.mime, prompt));
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido durante a análise.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="quick-tool-section">
      <div className="section-hd" style={{ marginBottom: 12 }}>
        <div>
          <p className="section-title">Ferramenta rápida</p>
          <p className="section-sub">Analise referências visuais sem criar um projeto completo.</p>
        </div>
        <span className="badge badge-zinc">Imagem</span>
      </div>

      <div className="quick-tool-card">
        {/* Left — image area */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {image ? (
            <div className="group" style={{ position: 'relative', width: '100%' }}>
              <img
                src={image.url}
                alt="Preview"
                style={{ width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: 240, display: 'block' }}
              />
              <button
                onClick={() => { setImage(null); setResult(''); }}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--surface)', border: '1px solid var(--border-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-2)',
                  opacity: 0, transition: 'opacity .15s ease',
                }}
                className="group-hover:opacity-100"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                <XIcon width={12} height={12} />
              </button>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <label
                htmlFor="quick-upload"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 8, padding: '36px 20px',
                  border: '1px dashed var(--border-md)', borderRadius: 10,
                  background: 'var(--surface-2)', cursor: 'pointer',
                  transition: 'border-color .12s ease, background .12s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--indigo)';
                  (e.currentTarget as HTMLElement).style.background  = 'var(--indigo-s)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-md)';
                  (e.currentTarget as HTMLElement).style.background  = 'var(--surface-2)';
                }}
              >
                <UploadIcon width={32} height={32} style={{ color: 'var(--text-4)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--indigo)' }}>Clique para carregar</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>PNG, JPG, WebP</span>
              </label>
              <input
                id="quick-upload"
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
              />
            </div>
          )}
        </div>

        {/* Right — controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="field"
              rows={3}
              style={{ resize: 'none', fontSize: 12 }}
              placeholder="Ex: Que animal é este? Existe algum texto nesta imagem?"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!image || isLoading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
          >
            {isLoading
              ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              : <SparklesIcon width={14} height={14} />}
            {isLoading ? 'Analisando…' : 'Analisar Imagem'}
          </button>

          {(result || isLoading || error) && (
            <div style={{
              padding: '12px 14px', borderRadius: 8, flex: 1,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
            }}>
              <p className="label" style={{ marginBottom: 8 }}>Resultado</p>
              {isLoading && (
                <p style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>
                  A IA está pensando…
                </p>
              )}
              {error && (
                <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>
              )}
              {result && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {result}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default QuickAnalyzer;
