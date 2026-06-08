import React, { useRef, useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  /** Modo compacto: mostra só a dropzone, sem template expandível */
  compact?: boolean;
}

const CSV_TEMPLATE = `scene_id,sub_id,order,loc,context,style
1,1,1,INT. CAFÉ - DIA,"João entra no café e procura um lugar para sentar. O ambiente está movimentado, com barulho de xícaras e conversas.",Wide Shot
1,2,2,INT. CAFÉ - DIA,"João avista Maria sentada sozinha em uma mesa ao fundo. Seus olhos se encontram por um breve momento.",Close-up
2,1,3,EXT. RUA - NOITE,"Maria caminha rapidamente pela calçada molhada. A chuva começa a cair forte. Ela não tem guarda-chuva.",Medium Shot
2,2,4,EXT. RUA - NOITE,"João aparece correndo com dois guarda-chuvas e oferece um a Maria. Ela sorri aliviada.",American Shot`;

const COLUMNS = [
  { name: 'scene_id',  desc: 'Número da cena (ex: 1, 2, 3)',              required: true  },
  { name: 'sub_id',    desc: 'Número da sub-cena (ex: 1, 2)',              required: true  },
  { name: 'order',     desc: 'Ordem de processamento',                     required: true  },
  { name: 'loc',       desc: 'Localização / Ambiente da cena',             required: true  },
  { name: 'context',   desc: 'Descrição detalhada da cena',                required: true  },
  { name: 'style',     desc: 'Tipo de plano/câmera (ex: Close-up, Wide Shot, POV Shot)',  required: false },
];

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, compact = false }) => {
  const [dragActive, setDragActive]   = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied]           = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      const name = file.name.toLowerCase();
      const isCsv = file.type === 'text/csv' || name.endsWith('.csv');
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx');
      if (isCsv || isDocx) {
        onFileSelect(file);
      } else {
        alert('Por favor, envie um arquivo .csv ou .docx válido.');
      }
    }
  }, [onFileSelect]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    handleFile(e.dataTransfer.files);
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleFile(e.target.files);
  };

  const handleCopyTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CSV_TEMPLATE);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = CSV_TEMPLATE;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'template_roteiro.csv'; link.click();
    URL.revokeObjectURL(url);
  }, []);

  if (compact) {
    return (
      <div
        onDragEnter={handleDrag} onDragOver={handleDrag}
        onDragLeave={handleDrag} onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '10px 12px',
          border: `1px dashed ${dragActive ? 'var(--indigo)' : 'var(--border-md)'}`,
          borderRadius: 8,
          background: dragActive ? 'var(--indigo-s)' : 'rgba(255,255,255,0.02)',
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          transition: 'border-color .12s ease, background .12s ease',
        }}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".csv,.docx,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleChange} />
        <svg width={14} height={14} fill="none" stroke={dragActive ? 'var(--indigo)' : 'var(--text-4)'} strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0L9 11m3-3 3 3M4.75 17.25A2.25 2.25 0 0 0 7 19.5h10a2.25 2.25 0 0 0 2.25-2.25V9.75L14.25 4.5H7A2.25 2.25 0 0 0 4.75 6.75v10.5z" />
        </svg>
        <span style={{ fontSize: 11, color: dragActive ? 'var(--indigo)' : 'var(--text-4)' }}>
          Clique ou arraste CSV/DOCX
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag} onDragOver={handleDrag}
        onDragLeave={handleDrag} onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '32px 24px',
          border: `1px dashed ${dragActive ? 'var(--indigo)' : 'var(--border-md)'}`,
          borderRadius: 10,
          background: dragActive ? 'var(--indigo-s)' : 'var(--surface-2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, cursor: 'pointer',
          transition: 'border-color .12s ease, background .12s ease',
          textAlign: 'center',
        }}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".csv,.docx,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleChange} />
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--surface-3)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: dragActive ? 'var(--indigo)' : 'var(--text-3)',
        }}>
          <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0L9 11m3-3 3 3M4.75 17.25A2.25 2.25 0 0 0 7 19.5h10a2.25 2.25 0 0 0 2.25-2.25V9.75L14.25 4.5H7A2.25 2.25 0 0 0 4.75 6.75v10.5z" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--indigo)', fontWeight: 600 }}>Clique para enviar</span> ou arraste e solte
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>Arquivos CSV ou DOCX</p>
        </div>
      </div>

      {/* Template section */}
      <div style={{
        borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--surface-2)', overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowTemplate(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 500, color: 'var(--text-3)',
            transition: 'color .12s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
            </svg>
            Ver formato esperado do CSV
          </span>
          <svg
            width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            style={{ transform: showTemplate ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showTemplate && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Columns */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 8 }}>
                Colunas
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {COLUMNS.map(col => (
                  <div key={col.name} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12 }}>
                    <code style={{ fontFamily: 'var(--mono)', color: 'var(--indigo)', flexShrink: 0, width: 76 }}>{col.name}</code>
                    <span style={{ color: 'var(--text-3)', flex: 1 }}>{col.desc}</span>
                    {col.required
                      ? <span style={{ fontSize: 10, color: 'var(--red)', flexShrink: 0 }}>obrigatório</span>
                      : <span style={{ fontSize: 10, color: 'var(--text-4)', flexShrink: 0 }}>opcional</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 8 }}>
                Exemplo
              </p>
              <pre style={{
                fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-2)',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '10px 12px',
                overflowX: 'auto', whiteSpace: 'pre', lineHeight: 1.7,
              }}>
                {CSV_TEMPLATE}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopyTemplate} className="btn btn-ghost" style={{ fontSize: 12 }}>
                {copied ? (
                  <><svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Copiado!</>
                ) : (
                  <><svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" /></svg> Copiar CSV</>
                )}
              </button>
              <button onClick={handleDownloadTemplate} className="btn btn-ghost" style={{ fontSize: 12 }}>
                <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
                </svg>
                Baixar template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
