import React, { useRef, useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const CSV_TEMPLATE = `scene_id,sub_id,order,loc,context,style
1,1,1,INT. CAFÉ - DIA,"João entra no café e procura um lugar para sentar. O ambiente está movimentado, com barulho de xícaras e conversas.",Wide Shot
1,2,2,INT. CAFÉ - DIA,"João avista Maria sentada sozinha em uma mesa ao fundo. Seus olhos se encontram por um breve momento.",Close-up
2,1,3,EXT. RUA - NOITE,"Maria caminha rapidamente pela calçada molhada. A chuva começa a cair forte. Ela não tem guarda-chuva.",Medium Shot
2,2,4,EXT. RUA - NOITE,"João aparece correndo com dois guarda-chuvas e oferece um a Maria. Ela sorri aliviada.",American Shot`;

const COLUMNS = [
  { name: 'scene_id', desc: 'Número da cena (ex: 1, 2, 3)', required: true },
  { name: 'sub_id', desc: 'Número da sub-cena (ex: 1, 2)', required: true },
  { name: 'order', desc: 'Ordem de processamento', required: true },
  { name: 'loc', desc: 'Localização / Ambiente da cena', required: true },
  { name: 'context', desc: 'Descrição detalhada da cena', required: true },
  { name: 'style', desc: 'Estilo do plano (ex: Close-up, Wide Shot)', required: false },
];

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((files: FileList | null) => {
    if (files && files[0]) {
      if (files[0].type === 'text/csv' || files[0].name.endsWith('.csv')) {
        onFileSelect(files[0]);
      } else {
        alert('Por favor, envie um arquivo .csv válido.');
      }
    }
  }, [onFileSelect]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleCopyTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CSV_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para navegadores sem suporte a clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = CSV_TEMPLATE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_roteiro.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Área de upload */}
      <form
        className={`p-10 border border-dashed rounded-lg transition-colors ${dragActive ? 'border-cyan-400 bg-slate-800/50' : 'border-slate-700 bg-slate-800/20'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onSubmit={(e) => e.preventDefault()}
      >
        <input ref={inputRef} type="file" id="file-upload" className="hidden" accept=".csv" onChange={handleChange} />
        <label className="flex flex-col items-center justify-center cursor-pointer" onClick={onButtonClick}>
          <svg className="w-12 h-12 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          <p className="text-slate-400">
            <span className="font-semibold text-cyan-400 hover:underline">Clique para enviar</span> ou arraste e solte
          </p>
          <p className="text-xs text-slate-500 mt-1">Apenas arquivos CSV</p>
        </label>
      </form>

      {/* Seção do template CSV */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/20 overflow-hidden">
        <button
          onClick={() => setShowTemplate(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ver formato esperado do CSV
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${showTemplate ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showTemplate && (
          <div className="px-4 pb-4 space-y-4">
            {/* Tabela de colunas */}
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Colunas</p>
              <div className="space-y-1">
                {COLUMNS.map(col => (
                  <div key={col.name} className="flex items-start gap-3 text-sm">
                    <code className="text-cyan-400 font-mono w-20 shrink-0">{col.name}</code>
                    <span className="text-slate-400">{col.desc}</span>
                    {col.required
                      ? <span className="ml-auto text-xs text-red-400 shrink-0">obrigatório</span>
                      : <span className="ml-auto text-xs text-slate-500 shrink-0">opcional</span>
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Preview do CSV */}
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Exemplo</p>
              <pre className="text-xs text-slate-300 bg-slate-900 rounded p-3 overflow-x-auto whitespace-pre leading-relaxed border border-slate-700">
                {CSV_TEMPLATE}
              </pre>
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar CSV
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-slate-700/50 text-slate-300 border border-slate-600 hover:bg-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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