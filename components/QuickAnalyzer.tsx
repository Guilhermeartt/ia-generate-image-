import React, { useState, useCallback } from 'react';
import { analyzeUploadedImage } from '../services/geminiService';
import { UploadIcon, SparklesIcon } from './icons';

const QuickAnalyzer: React.FC = () => {
    const [image, setImage] = useState<{ url: string; base64: string; mime: string; } | null>(null);
    const [prompt, setPrompt] = useState<string>('O que está nesta imagem?');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [result, setResult] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).');
            return;
        }
        setError('');
        setResult('');

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const resultUrl = loadEvent.target?.result as string;
            if (resultUrl) {
                const base64Data = resultUrl.split(',')[1];
                setImage({
                    url: resultUrl,
                    base64: base64Data,
                    mime: file.type,
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        if (!image || !prompt) {
            setError('Por favor, carregue uma imagem e insira um prompt.');
            return;
        }
        setIsLoading(true);
        setResult('');
        setError('');
        try {
            const analysisResult = await analyzeUploadedImage(image.base64, image.mime, prompt);
            setResult(analysisResult);
        } catch (e: any) {
            setError(e.message || 'Ocorreu um erro desconhecido durante a análise.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-16">
            <div className="text-center mb-6">
                 <h2 className="text-xl font-semibold text-slate-300">Ferramenta de Análise Rápida</h2>
                 <p className="text-sm text-slate-500">Faça upload de uma imagem e pergunte à IA sobre ela.</p>
            </div>
            <div className="max-w-4xl mx-auto p-6 bg-slate-800 border border-slate-700 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center">
                    {image ? (
                        <div className="relative group w-full max-w-sm">
                            <img src={image.url} alt="Uploaded preview" className="rounded-lg shadow-lg w-full h-auto object-contain" />
                            <button onClick={() => {setImage(null); setResult('');}} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    ) : (
                        <div className="w-full">
                            <label htmlFor="quick-upload" className="cursor-pointer p-10 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center h-full hover:border-cyan-400 transition-colors bg-slate-800/20">
                                <UploadIcon width={48} height={48} className="text-slate-500 mb-4" />
                                <span className="font-semibold text-cyan-400 hover:underline">Clique para carregar</span>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP</p>
                            </label>
                            <input id="quick-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileSelect} />
                        </div>
                    )}
                </div>
                <div className="flex flex-col space-y-4">
                    <div>
                        <label htmlFor="analyzer-prompt" className="text-sm font-medium text-slate-300 mb-1 block">Seu Prompt:</label>
                        <textarea
                            id="analyzer-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-slate-900/70 border border-slate-600 rounded-md p-2 text-sm text-slate-300 focus:ring-cyan-500 focus:border-cyan-500"
                            rows={3}
                            placeholder="Ex: Que animal é este? Existe algum texto nesta imagem?"
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={!image || isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-md font-semibold text-white bg-cyan-600 rounded-lg shadow-md hover:bg-cyan-700 disabled:bg-slate-600 transition-colors"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <SparklesIcon width={20} height={20} />
                        )}
                        <span>{isLoading ? 'Analisando...' : 'Analisar Imagem'}</span>
                    </button>
                    {(result || isLoading || error) && (
                        <div className="bg-slate-900/50 p-4 rounded-lg flex-grow min-h-[100px]">
                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Resultado da Análise:</h4>
                            {isLoading && <p className="text-sm text-slate-400 animate-pulse">A IA está pensando...</p>}
                            {error && <p className="text-sm text-red-400">{error}</p>}
                            {result && <p className="text-sm text-slate-300 whitespace-pre-wrap">{result}</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuickAnalyzer;