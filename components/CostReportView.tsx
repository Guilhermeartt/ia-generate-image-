import React, { useMemo } from 'react';
import type { Character, Scene } from '../types';

interface CostReportViewProps {
  characters: Character[];
  scenes: Scene[];
}

interface ImageEntry {
  label: string;
  sublabel: string;
  type: 'character' | 'scene' | 'split';
  modelUsed?: string;
  tokens?: number;
  costBRL?: number;
  imageUrl?: string;
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-2.5-flash-image':         'Gemini 2.5 Flash',
  'gemini-3.1-flash-image-preview': 'Gemini 3.1 Flash',
  'gemini-3-pro-image-preview':     'Gemini 3 Pro',
  'imagen-4.0-generate-001':        'Imagen 4',
};

const MODEL_COLORS: Record<string, string> = {
  'gemini-2.5-flash-image':         'bg-blue-900/40 text-blue-300 border-blue-700/50',
  'gemini-3.1-flash-image-preview': 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  'gemini-3-pro-image-preview':     'bg-purple-900/40 text-purple-300 border-purple-700/50',
  'imagen-4.0-generate-001':        'bg-orange-900/40 text-orange-300 border-orange-700/50',
};

const MODEL_DOT: Record<string, string> = {
  'gemini-2.5-flash-image':         'bg-blue-400',
  'gemini-3.1-flash-image-preview': 'bg-cyan-400',
  'gemini-3-pro-image-preview':     'bg-purple-400',
  'imagen-4.0-generate-001':        'bg-orange-400',
};

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

const CostReportView: React.FC<CostReportViewProps> = ({ characters, scenes }) => {
  const { entries, totalCost, totalTokens, totalImages, modelBreakdown } = useMemo(() => {
    const entries: ImageEntry[] = [];

    // Characters
    for (const char of characters) {
      if (char.imageUrl) {
        entries.push({
          label: char.name,
          sublabel: 'Personagem',
          type: 'character',
          modelUsed: char.modelUsed,
          tokens: char.tokens,
          costBRL: char.costBRL,
          imageUrl: char.imageUrl,
        });
      }
    }

    // Scenes + splits
    for (const scene of scenes) {
      if (scene.imageUrl) {
        entries.push({
          label: `Cena ${scene.scene_id}-${scene.sub_id}`,
          sublabel: scene.original_location,
          type: 'scene',
          modelUsed: scene.modelUsed,
          tokens: scene.tokens,
          costBRL: scene.costBRL,
          imageUrl: scene.imageUrl,
        });
      }
      if (scene.splitImages) {
        scene.splitImages.forEach((img, i) => {
          if (img.imageUrl) {
            entries.push({
              label: `Cena ${scene.scene_id}-${scene.sub_id} · Plano ${i + 1}`,
              sublabel: scene.original_location,
              type: 'split',
              modelUsed: img.modelUsed,
              tokens: img.tokens,
              costBRL: img.costBRL,
              imageUrl: img.imageUrl,
            });
          }
        });
      }
    }

    const totalCost = entries.reduce((sum, e) => sum + (e.costBRL ?? 0), 0);
    const totalTokens = entries.reduce((sum, e) => sum + (e.tokens ?? 0), 0);
    const totalImages = entries.length;

    // Group by model
    const modelMap = new Map<string, { count: number; tokens: number; cost: number }>();
    for (const e of entries) {
      const key = e.modelUsed ?? 'unknown';
      const prev = modelMap.get(key) ?? { count: 0, tokens: 0, cost: 0 };
      modelMap.set(key, {
        count: prev.count + 1,
        tokens: prev.tokens + (e.tokens ?? 0),
        cost: prev.cost + (e.costBRL ?? 0),
      });
    }
    const modelBreakdown = Array.from(modelMap.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([model, data]) => ({ model, ...data }));

    return { entries, totalCost, totalTokens, totalImages, modelBreakdown };
  }, [characters, scenes]);

  const generatedChars = characters.filter(c => c.imageUrl).length;
  const generatedScenes = scenes.filter(s => s.imageUrl).length;
  const generatedSplits = scenes.reduce((sum, s) => sum + (s.splitImages?.filter(i => i.imageUrl).length ?? 0), 0);

  if (totalImages === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhuma imagem gerada ainda</h3>
        <p className="text-slate-500 max-w-sm">
          O relatório de custos aparecerá aqui depois que você gerar imagens para personagens ou cenas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Cartões de resumo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Custo Total</p>
          <p className="text-3xl font-bold text-emerald-400">R$ {fmt(totalCost)}</p>
          <p className="text-xs text-slate-500 mt-1">≈ U$ {(totalCost / 5.80).toFixed(4)}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tokens de Saída</p>
          <p className="text-3xl font-bold text-cyan-400">{totalTokens > 0 ? fmtK(totalTokens) : '—'}</p>
          <p className="text-xs text-slate-500 mt-1">{totalTokens > 0 ? totalTokens.toLocaleString('pt-BR') + ' tokens' : 'Imagen não usa tokens'}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Imagens Geradas</p>
          <p className="text-3xl font-bold text-slate-100">{totalImages}</p>
          <p className="text-xs text-slate-500 mt-1">
            {generatedChars} person. · {generatedScenes} cenas · {generatedSplits} planos
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Custo Médio/Imagem</p>
          <p className="text-3xl font-bold text-amber-400">
            R$ {totalImages > 0 ? fmt(totalCost / totalImages) : '0,000'}
          </p>
          <p className="text-xs text-slate-500 mt-1">por imagem gerada</p>
        </div>
      </div>

      {/* ── Breakdown por modelo ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-slate-100 mb-4">Uso por Modelo</h3>
        <div className="space-y-3">
          {modelBreakdown.map(({ model, count, tokens, cost }) => {
            const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
            const label = MODEL_LABELS[model] ?? model;
            const colorClass = MODEL_COLORS[model] ?? 'bg-slate-700/40 text-slate-300 border-slate-600/50';
            const dotClass = MODEL_DOT[model] ?? 'bg-slate-400';
            return (
              <div key={model}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>{label}</span>
                    <span className="text-xs text-slate-500">{count} imagem{count !== 1 ? 's' : ''}</span>
                    {tokens > 0 && <span className="text-xs text-slate-600">· {fmtK(tokens)} tk</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span>
                    <span className="text-sm font-bold text-emerald-400 w-24 text-right">R$ {fmt(cost)}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${dotClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tabela detalhada ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-bold text-slate-100">Detalhamento por Imagem</h3>
          <p className="text-xs text-slate-500 mt-0.5">{totalImages} imagens · apenas imagens com custo registrado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-14"></th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Imagem</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Modelo</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Tokens</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Custo (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {entries.map((entry, i) => {
                const colorClass = entry.modelUsed ? (MODEL_COLORS[entry.modelUsed] ?? 'bg-slate-700/40 text-slate-300 border-slate-600/50') : 'bg-slate-700/40 text-slate-400 border-slate-600/50';
                const typeColors = {
                  character: 'bg-teal-900/40 text-teal-300',
                  scene:     'bg-indigo-900/40 text-indigo-300',
                  split:     'bg-slate-700/60 text-slate-400',
                };
                const typeLabels = {
                  character: 'Personagem',
                  scene:     'Cena',
                  split:     'Plano',
                };
                return (
                  <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                    {/* Thumbnail */}
                    <td className="px-4 py-2">
                      {entry.imageUrl ? (
                        <img
                          src={entry.imageUrl}
                          alt={entry.label}
                          className="w-12 h-8 object-cover rounded border border-slate-600"
                        />
                      ) : (
                        <div className="w-12 h-8 bg-slate-700 rounded border border-slate-600" />
                      )}
                    </td>
                    {/* Label */}
                    <td className="px-4 py-2">
                      <p className="font-medium text-slate-200 leading-tight">{entry.label}</p>
                      <p className="text-xs text-slate-500 leading-tight mt-0.5 truncate max-w-xs">{entry.sublabel}</p>
                    </td>
                    {/* Tipo */}
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeColors[entry.type]}`}>
                        {typeLabels[entry.type]}
                      </span>
                    </td>
                    {/* Modelo */}
                    <td className="px-4 py-2">
                      {entry.modelUsed ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colorClass}`}>
                          {MODEL_LABELS[entry.modelUsed] ?? entry.modelUsed}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    {/* Tokens */}
                    <td className="px-4 py-2 text-right">
                      {entry.tokens !== undefined ? (
                        <span className="text-slate-300 font-mono">{entry.tokens.toLocaleString('pt-BR')}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">fixo</span>
                      )}
                    </td>
                    {/* Custo */}
                    <td className="px-4 py-2 text-right">
                      {entry.costBRL !== undefined ? (
                        <span className="text-emerald-400 font-semibold font-mono">
                          {fmt(entry.costBRL)}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-slate-600 bg-slate-700/40">
                <td className="px-4 py-3" colSpan={4}>
                  <span className="text-sm font-bold text-slate-200">Total</span>
                  <span className="text-xs text-slate-500 ml-2">{totalImages} imagens</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-slate-300 font-mono font-semibold">
                    {totalTokens > 0 ? totalTokens.toLocaleString('pt-BR') : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-emerald-400 font-bold font-mono text-base">
                    R$ {fmt(totalCost)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
};

export default CostReportView;
