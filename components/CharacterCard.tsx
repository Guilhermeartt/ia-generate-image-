import React, { useState, useRef } from 'react';
import type { Character, Scene } from '../types';
import { SparklesIcon, EditIcon, DownloadIcon, RevertIcon, UploadIcon, IsolateIcon, TextAnalysisIcon } from './icons';
import ImageLoader from './ImageLoader';
import ImageEditModal from './ImageEditModal';

interface CharacterCardProps {
  character: Character;
  scenes: Scene[];
  onImageUpdate: (name: string, newImageUrl: string, newMimeType: string) => void;
  onGenerateImage: (name: string) => void;
  onDescriptionChange: (name: string, newDescription: string) => void;
  onPromptChange: (name: string, newPrompt: string) => void;
  editImageService: (base64: string, prompt: string) => Promise<{ base64Data: string; mimeType: string; }>;
  onPreview: (url: string) => void;
  onRevertImage: (name: string) => void;
  onSelectImageVersion: (name: string, versionId: string) => void;
  onIsolateImage: (name: string) => void;
  onAnalyzeText: (character: Character) => void;
}

const modelLabelShort = (model: string): string => {
  switch (model) {
    case 'gemini-2.5-flash-image':         return 'NB 2.5';
    case 'gemini-3.1-flash-image-preview': return 'NB 3.1';
    case 'gemini-3-pro-image-preview':     return 'NB Pro';
    case 'imagen-4.0-generate-001':        return 'Imagen 4';
    default:                               return model.split('-')[0];
  }
};

const Spinner: React.FC<{size?: number}> = ({ size = 12 }) => (
  <div style={{
    width: size, height: size, flexShrink: 0,
    border: `2px solid var(--border-md)`,
    borderTopColor: 'var(--indigo)',
    borderRadius: '50%',
    animation: 'spin .8s linear infinite',
  }} />
);

const IconBtn: React.FC<{onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode}> = ({onClick, disabled, title, children}) => (
  <button onClick={onClick} disabled={disabled} title={title} style={{
    padding: 6, borderRadius: 6,
    background: 'var(--surface)', border: '1px solid var(--border-md)',
    cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex',
    color: 'var(--text-2)', opacity: disabled ? 0.4 : 1,
    transition: 'background .12s ease',
  }}>
    {children}
  </button>
);

const CharacterCard: React.FC<CharacterCardProps> = ({
  character, scenes, onImageUpdate, onGenerateImage, onDescriptionChange,
  onPromptChange, editImageService, onPreview, onRevertImage, onSelectImageVersion, onIsolateImage, onAnalyzeText,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editState, setEditState] = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scenesWithCharacter = scenes.filter(s => s.tagged_description.includes(`[${character.name}]`));
  const isBusy = character.isLoading || character.isIsolating || character.isAnalyzingText;
  const imageHistory = character.imageHistory || [];
  const imageVersions = character.imageUrl ? [
    {
      id: 'current',
      label: 'Atual',
      imageUrl: character.imageUrl,
      imageMimeType: character.imageMimeType,
      costBRL: character.costBRL,
      modelUsed: character.modelUsed,
      tokens: character.tokens,
    },
    ...imageHistory,
  ] : imageHistory;
  const totalCharacterCost = imageVersions.reduce((sum, version) => sum + (version.costBRL || 0), 0);

  let busyMessage = '';
  if (character.isLoading) busyMessage = 'Gerando…';
  else if (character.isIsolating) busyMessage = 'Isolando…';
  else if (character.isAnalyzingText) busyMessage = 'Analisando…';

  const handleConfirmEdit = async (prompt: string) => {
    if (!character.imageUrl) return;
    setEditState({ isLoading: true, error: null });
    try {
      const { base64Data, mimeType } = await editImageService(character.imageUrl, prompt);
      onImageUpdate(character.name, `data:${mimeType};base64,${base64Data}`, mimeType);
      setIsEditModalOpen(false);
      setEditState({ isLoading: false, error: null });
    } catch (e) {
      setEditState({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao editar.' });
    }
  };

  const handleDownload = () => {
    if (!character.imageUrl) return;
    const link = document.createElement('a');
    link.href = character.imageUrl;
    link.download = `${character.name.replace(/\s+/g, '_')}.${character.imageMimeType?.split('/')[1] || 'png'}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('Selecione uma imagem válida (PNG, JPG, WebP).'); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') onImageUpdate(character.name, result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const renderImageArea = () => {
    if (character.imageUrl) {
      return (
        <div className="img-group" style={{position:'relative',width:'100%',aspectRatio:'4/3',overflow:'hidden',borderRadius:'9px 9px 0 0',background:'var(--surface-2)'}}>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/png,image/jpeg,image/webp" />
          <button onClick={() => onPreview(character.imageUrl!)} style={{display:'block',width:'100%',height:'100%',border:'none',padding:0,cursor:'pointer',background:'none'}}>
            <img
              src={character.imageUrl}
              alt={`Retrato de ${character.name}`}
              style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .3s ease',display:'block'}}
            />
          </button>

          {isBusy && <ImageLoader message={busyMessage} />}

          {/* Gradient overlay */}
          <div className="img-overlay" style={{borderRadius:'9px 9px 0 0'}} />

          {/* Top-right icons */}
          <div className="img-hover-row" style={{position:'absolute',top:6,right:6,display:'flex',gap:4,opacity:0,transition:'opacity .15s ease'}}>
            <IconBtn onClick={() => onAnalyzeText(character)} disabled={isBusy} title="Analisar texto">
              <TextAnalysisIcon width={13} height={13} />
            </IconBtn>
            <IconBtn onClick={handleDownload} disabled={isBusy} title="Baixar">
              <DownloadIcon width={13} height={13} />
            </IconBtn>
            <IconBtn onClick={() => setIsEditModalOpen(true)} disabled={isBusy} title="Editar">
              <EditIcon width={13} height={13} />
            </IconBtn>
            <IconBtn onClick={() => { if (!isBusy) { fileInputRef.current!.value = ''; fileInputRef.current?.click(); } }} disabled={isBusy} title="Substituir imagem">
              <UploadIcon width={13} height={13} />
            </IconBtn>
          </div>

          {/* Bottom actions */}
          <div style={{position:'absolute',bottom:6,right:6,display:'flex',gap:4,opacity:1,transition:'opacity .15s ease'}}>
            <button onClick={() => onIsolateImage(character.name)} disabled={isBusy} style={{
              display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:5,
              fontSize:11,fontWeight:500,color:'var(--text-1)',
              background:'var(--surface)',border:'1px solid var(--border-md)',cursor:isBusy ? 'not-allowed' : 'pointer',
              opacity:isBusy ? 0.5 : 1,
            }}>
              <IsolateIcon width={11} height={11} />
              Isolar
            </button>
            <button onClick={() => onGenerateImage(character.name)} disabled={isBusy} title="Gerar novamente este personagem" style={{
              display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:5,
              fontSize:11,fontWeight:600,color:'#fff',
              background:'var(--indigo)',border:'none',cursor:isBusy ? 'not-allowed' : 'pointer',
              opacity:isBusy ? 0.6 : 1,
              boxShadow:'0 8px 18px rgba(79,70,229,0.28)',
            }}>
              <SparklesIcon width={11} height={11} />
              Gerar novamente
            </button>
          </div>

          {/* Revert */}
          {character.previousImageUrl && (
            <div style={{position:'absolute',bottom:6,left:6,display:'flex',alignItems:'center',gap:4,padding:'3px 4px',borderRadius:7,background:'var(--surface)',border:'1px solid var(--border-md)',opacity:0,transition:'opacity .15s ease'}} className="group-hover:opacity-100">
              <img src={character.previousImageUrl} alt="Anterior" style={{width:26,height:26,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)'}} />
              <button onClick={() => onRevertImage(character.name)} title="Reverter" style={{padding:4,borderRadius:4,background:'var(--surface-2)',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex'}}>
                <RevertIcon width={11} height={11} />
              </button>
            </div>
          )}
        </div>
      );
    }

    if (character.isLoading) {
      return (
        <div style={{width:'100%',aspectRatio:'4/3',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,background:'var(--surface-2)',borderRadius:'9px 9px 0 0'}}>
          <Spinner size={16} />
          <p style={{fontSize:11,color:'var(--text-3)'}}>Gerando retrato…</p>
        </div>
      );
    }

    if (character.error) {
      return (
        <div style={{width:'100%',aspectRatio:'4/3',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:16,textAlign:'center',background:'rgba(248,113,113,0.04)',borderRadius:'9px 9px 0 0'}}>
          <p style={{fontSize:12,fontWeight:600,color:'var(--red)'}}>Erro</p>
          <p style={{fontSize:11,color:'rgba(248,113,113,0.6)',lineHeight:1.5}}>{character.error}</p>
          <button onClick={() => onGenerateImage(character.name)} className="btn btn-primary" style={{fontSize:11,padding:'4px 10px'}}>
            Tentar novamente
          </button>
        </div>
      );
    }

    return (
      <div style={{width:'100%',aspectRatio:'4/3',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:16,background:'var(--surface-2)',borderRadius:'9px 9px 0 0'}}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/png,image/jpeg,image/webp" />
        <div style={{display:'flex',gap:6}}>
          <button onClick={() => onGenerateImage(character.name)} className="btn btn-primary" style={{fontSize:12}}>
            <SparklesIcon width={12} height={12} />
            Gerar
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-ghost" style={{fontSize:12}}>
            <UploadIcon width={12} height={12} />
            Enviar
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="card card-hover anim-up" style={{overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {/* Image */}
        <div style={{position:'relative',flexShrink:0}}>
          {renderImageArea()}
        </div>

        {/* Cost strip */}
        {character.imageUrl && (character.costBRL !== undefined || character.modelUsed || totalCharacterCost > 0) && (
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(3,minmax(0,1fr))',
            gap:6,
            padding:'8px 10px',
            borderBottom:'1px solid var(--border)',
            background:'var(--surface-2)',
          }}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:9,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Atual</p>
              <p style={{fontSize:13,fontWeight:800,color:'#34D399',fontFamily:'var(--mono)',marginTop:2,whiteSpace:'nowrap'}}>
                {character.costBRL !== undefined ? `R$ ${character.costBRL.toFixed(3).replace('.',',')}` : '—'}
              </p>
              <p style={{fontSize:10,color:'#818CF8',fontWeight:700,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {character.modelUsed ? modelLabelShort(character.modelUsed) : 'Modelo não registrado'}
              </p>
            </div>

            <div style={{
              minWidth:0,
              paddingLeft:7,
              borderLeft:'1px solid var(--border)',
            }} title="Custo acumulado da imagem atual mais versões anteriores deste personagem">
              <p style={{fontSize:9,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Acumulado</p>
              <p style={{fontSize:13,fontWeight:800,color:'#FCD34D',fontFamily:'var(--mono)',marginTop:2,whiteSpace:'nowrap'}}>
                R$ {totalCharacterCost.toFixed(3).replace('.',',')}
              </p>
              <p style={{fontSize:10,color:'var(--text-4)',marginTop:1,whiteSpace:'nowrap'}}>
                {imageVersions.length} versão{imageVersions.length !== 1 ? 'ões' : ''}
              </p>
            </div>

            <div style={{
              minWidth:0,
              paddingLeft:7,
              borderLeft:'1px solid var(--border)',
            }}>
              <p style={{fontSize:9,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Tokens</p>
              <p style={{fontSize:13,fontWeight:800,color:'var(--text-2)',fontFamily:'var(--mono)',marginTop:2,whiteSpace:'nowrap'}}>
                {character.tokens ? character.tokens.toLocaleString('pt-BR') : '—'}
              </p>
              <p style={{fontSize:10,color:'var(--text-4)',marginTop:1,whiteSpace:'nowrap'}}>geração atual</p>
            </div>
          </div>
        )}

        {imageVersions.length > 1 && (
          <div style={{
            display:'flex',gap:6,alignItems:'center',padding:'7px 10px',
            borderBottom:'1px solid var(--border)',background:'var(--surface)',
            overflowX:'auto',
          }}>
            <span style={{fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0}}>Versões</span>
            {imageVersions.map((version, index) => {
              const isCurrent = version.id === 'current';
              return (
                <button
                  key={version.id}
                  onClick={() => isCurrent ? undefined : onSelectImageVersion(character.name, version.id)}
                  disabled={isBusy || isCurrent}
                  title={isCurrent ? 'Imagem atual' : `Usar ${version.label || `versão ${index + 1}`}`}
                  style={{
                    width:34,height:28,padding:0,borderRadius:5,overflow:'hidden',flexShrink:0,
                    border:isCurrent ? '2px solid var(--indigo)' : '1px solid var(--border-md)',
                    background:'var(--surface-2)',cursor:isCurrent || isBusy ? 'default' : 'pointer',
                    opacity:isBusy && !isCurrent ? 0.45 : 1,
                    position:'relative',
                  }}
                >
                  <img src={version.imageUrl} alt={version.label || `Versão ${index + 1}`} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  {isCurrent && <span style={{position:'absolute',right:2,bottom:2,width:6,height:6,borderRadius:'50%',background:'var(--indigo)',border:'1px solid #fff'}} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div style={{padding:'10px 12px 12px',display:'flex',flexDirection:'column',flex:1,gap:8}}>
          <p style={{fontSize:13,fontWeight:600,color:'var(--text-1)'}}>{character.name}</p>

          <div>
            <label className="label">Características Físicas</label>
            <textarea
              value={character.physical_characteristics}
              onChange={(e) => onDescriptionChange(character.name, e.target.value)}
              className="field"
              rows={2}
              style={{resize:'none',fontSize:12}}
              disabled={isBusy}
            />
          </div>

          <div>
            <label className="label">Prompt de Imagem</label>
            <textarea
              value={character.image_prompt}
              onChange={(e) => onPromptChange(character.name, e.target.value)}
              className="field"
              rows={3}
              style={{resize:'none',fontSize:12}}
              disabled={isBusy}
            />
          </div>

          {/* Scene appearances */}
          <div style={{paddingTop:8,borderTop:'1px solid var(--border)'}}>
            <label className="label" style={{marginBottom:4}}>Aparece em</label>
            {scenesWithCharacter.length > 0 ? (
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {scenesWithCharacter.map(s => (
                  <span key={s.id} style={{
                    fontSize:10,fontWeight:600,fontFamily:'var(--mono)',
                    padding:'2px 6px',borderRadius:4,
                    background:'var(--indigo-s)',color:'#818CF8',border:'1px solid var(--indigo-b)',
                  }}>
                    {s.scene_id}-{s.sub_id}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{fontSize:11,color:'var(--text-4)'}}>Não detectado em cenas.</p>
            )}
          </div>
        </div>
      </div>

      {character.imageUrl && (
        <ImageEditModal
          isOpen={isEditModalOpen}
          imageUrl={character.imageUrl}
          onClose={() => { setIsEditModalOpen(false); setEditState({ isLoading: false, error: null }); }}
          onConfirm={handleConfirmEdit}
          isEditing={editState.isLoading}
          error={editState.error}
        />
      )}
    </>
  );
};

export default React.memo(CharacterCard);
