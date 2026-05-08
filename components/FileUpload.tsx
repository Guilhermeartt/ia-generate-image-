import React, { useRef, useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
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

  return (
    <div className="w-full">
      <form 
        className={`p-10 border border-dashed rounded-lg transition-colors ${dragActive ? 'border-cyan-400 bg-slate-800/50' : 'border-slate-700 bg-slate-800/20'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onSubmit={(e) => e.preventDefault()}
      >
        <input ref={inputRef} type="file" id="file-upload" className="hidden" accept=".csv" onChange={handleChange} />
        <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
          <svg className="w-12 h-12 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          <p className="text-slate-400">
            <span className="font-semibold text-cyan-400 hover:underline" onClick={onButtonClick}>Clique para enviar</span> ou arraste e solte
          </p>
          <p className="text-xs text-slate-500 mt-1">Apenas arquivos CSV</p>
        </label>
      </form>
    </div>
  );
};

export default FileUpload;