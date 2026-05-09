import React, { useMemo } from 'react';
import type { Character, Scene, TextCostEntry } from '../types';

interface CostReportViewProps {
  characters: Character[];
  scenes: Scene[];
  textCosts?: TextCostEntry[];
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
  'gemini-2.5-flash-image':         'Flash 2.5',
  'gemini-3.1-flash-image-preview': 'Flash 3.1',
  'gemini-3-pro-image-preview':     'Pro 3',
  'imagen-4.0-generate-001':        'Imagen 4',
};

const MODEL_COLORS: Record<string, { badge: string; dot: string; bar: string }> = {
  'gemini-2.5-flash-image':         { badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20',   dot: 'bg-blue-400',   bar: 'bg-blue-500' },
  'gemini-3.1-flash-image-preview': { badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20', dot: 'bg-violet-400', bar: 'bg-violet-500' },
  'gemini-3-pro-image-preview':     { badge: 'bg-purple-500/15 text-purple-300 border-purple-500/20', dot: 'bg-purple-400', bar: 'bg-purple-500' },
  'imagen-4.0-generate-001':        { badge: 'bg-orange-500/15 text-orange-300 border-orange-500/20', dot: 'bg-orange-400', bar: 'bg-orange-500' },
};

const DEFAULT_COLORS = { badge: 'bg-slate-700/40 text-slate-400 border-slate-600/30', dot: 'bg-slate-500', bar: 'bg-slate-500' };

const fmt  = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

const TEXT_MODEL_LABELS: Record<string, string> = {
  'gemini-2.5-pro':   'Pro 2.5',
  'gemini-2.5-flash': 'Flash 2.5',
};

const CostReportView: React.FC<CostReportViewProps> = ({ characters, scenes, textCosts = [] }) => {
  const { entries, totalCost, totalTokens, totalImages, modelBreakdown } = useMemo(() => {
    const entries: ImageEntry[] = [];

    for (const char of characters) {
      if (char.imageUrl) entries.push({
        label: char.name, sublabel: 'Personagem', type: 'character',
        modelUsed: char.modelUsed, tokens: char.tokens, costBRL: char.costBRL, imageUrl: char.imageUrl,
      });
    }

    for (const scene of scenes) {
      if (scene.imageUrl) entries.push({
        label: `Cena ${scene.scene_id}-${scene.sub_id}`, sublabel: scene.original_location, type: 'scene',
        modelUsed: scene.modelUsed, tokens: scene.tokens, costBRL: scene.costBRL, imageUrl: scene.imageUrl,
      });
      scene.splitImages?.forEach((img, i) => {
        if (img.imageUrl) entries.push({
          label: `Cena ${scene.scene_id}-${scene.sub_id} · Plano ${i + 1}`, sublabel: scene.original_location, type: 'split',
          modelUsed: img.modelUsed, tokens: img.tokens, costBRL: img.costBRL, imageUrl: img.imageUrl,
        });
      });
    }

    const totalCost   = entries.reduce((s, e) => s + (e.costBRL ?? 0), 0);
    const totalTokens = entries.reduce((s, e) => s + (e.tokens  ?? 0), 0);

    const modelMap = new Map<string, { count: number; tokens: number; cost: number }>();
    for (const e of entries) {
      const key = e.modelUsed ?? 'unknown';
      const prev = modelMap.get(key) ?? { count: 0, tokens: 0, cost: 0 };
      modelMap.set(key, { count: prev.count + 1, tokens: prev.tokens + (e.tokens ?? 0), cost: prev.cost + (e.costBRL ?? 0) });
    }
    const modelBreakdown = Array.from(modelMap.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([model, data]) => ({ model, ...data }));

    return { entries, totalCost, totalTokens, totalImages: entries.length, modelBreakdown };
  }, [characters, scenes]);

  const textCostTotal = useMemo(() =>
    textCosts.reduce((s, e) => s + e.costBRL, 0),
  [textCosts]);

  const grandTotal = totalCost + textCostTotal;

  const generatedChars  = characters.filter(c => c.imageUrl).length;
  const generatedScenes = scenes.filter(s => s.imageUrl).length;
  const generatedSplits = scenes.reduce((s, sc) => s + (sc.splitImages?.filter(i => i.imageUrl).length ?? 0), 0);

  if (totalImages === 0 && textCosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-20 h-20 glass rounded-2xl flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum custo registrado ainda</h3>
        <p className="text-slate-600 max-w-sm text-sm">
          O relatório aparecerá aqui depois que você processar um CSV ou gerar imagens.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Custo Total',
            value: `R$ ${fmt(grandTotal)}`,
            sub: `≈ U$ ${(grandTotal / 5.80).toFixed(4)}`,
            color: 'text-emerald-400',
            border: 'border-emerald-500/15',
            glow: 'bg-emerald-500/5',
          },
          {
            label: 'Tokens de Saída',
            value: totalTokens > 0 ? fmtK(totalTokens) : '—',
            sub: totalTokens > 0 ? `${totalTokens.toLocaleString('pt-BR')} tokens` : 'Imagen não usa tokens',
            color: 'text-violet-400',
            border: 'border-violet-500/15',
            glow: 'bg-violet-500/5',
          },
          {
            label: 'Imagens Geradas',
            value: String(totalImages),
            sub: `${generatedChars} person. · ${generatedScenes} cenas · ${generatedSplits} planos`,
            color: 'text-white',
            border: 'border-white/8',
            glow: 'bg-white/3',
          },
          {
            label: 'Custo Médio/Img',
            value: `R$ ${totalImages > 0 ? fmt(totalCost / totalImages) : '0,000'}`,
            sub: 'por imagem gerada',
            color: 'text-amber-400',
            border: 'border-amber-500/15',
            glow: 'bg-amber-500/5',
          },
        ].map(card => (
          <div key={card.label} className={`glass rounded-2xl p-5 border ${card.border} ${card.glow}`}>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{card.label}</p>
            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
            <p className="text-xs text-slate-600 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Model breakdown */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-base font-bold text-white mb-5">Uso por Modelo</h3>
        <div className="space-y-4">
          {modelBreakdown.map(({ model, count, tokens, cost }) => {
            const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
            const label = MODEL_LABELS[model] ?? model;
            const colors = MODEL_COLORS[model] ?? DEFAULT_COLORS;
            return (
              <div key={model}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl border ${colors.badge}`}>{label}</span>
                    <span className="text-xs text-slate-600">{count} imagem{count !== 1 ? 's' : ''}</span>
                    {tokens > 0 && <span className="text-xs text-slate-700">· {fmtK(tokens)} tk</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-600">{pct.toFixed(1)}%</span>
                    <span className="text-sm font-bold text-emerald-400 w-24 text-right">R$ {fmt(cost)}</span>
                  </div>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${colors.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-violet-500/10">
          <h3 className="text-base font-bold text-white">Detalhamento por Imagem</h3>
          <p className="text-xs text-slate-600 mt-0.5">{totalImages} imagens com custo registrado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-14"></th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Imagem</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Modelo</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Tokens</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {entries.map((entry, i) => {
                const colors = entry.modelUsed ? (MODEL_COLORS[entry.modelUsed] ?? DEFAULT_COLORS) : DEFAULT_COLORS;
                const typeMap = {
                  character: { label: 'Personagem', cls: 'bg-teal-500/15 text-teal-300' },
                  scene:     { label: 'Cena',       cls: 'bg-violet-500/15 text-violet-300' },
                  split:     { label: 'Plano',      cls: 'bg-white/8 text-slate-400' },
                };
                const typeInfo = typeMap[entry.type];
                return (
                  <tr key={i} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5">
                      {entry.imageUrl
                        ? <img src={entry.imageUrl} alt={entry.label} className="w-12 h-8 object-cover rounded-lg border border-white/8" />
                        : <div className="w-12 h-8 bg-white/5 rounded-lg border border-white/8" />
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-200 leading-tight">{entry.label}</p>
                      <p className="text-xs text-slate-600 mt-0.5 truncate max-w-xs">{entry.sublabel}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-xl ${typeInfo.cls}`}>{typeInfo.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.modelUsed
                        ? <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl border ${colors.badge}`}>{MODEL_LABELS[entry.modelUsed] ?? entry.modelUsed}</span>
                        : <span className="text-xs text-slate-700">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {entry.tokens !== undefined
                        ? <span className="text-slate-400 font-mono text-xs">{entry.tokens.toLocaleString('pt-BR')}</span>
                        : <span className="text-slate-700 text-xs">fixo</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {entry.costBRL !== undefined
                        ? <span className="text-emerald-400 font-bold font-mono">R$ {fmt(entry.costBRL)}</span>
                        : <span className="text-slate-700 text-xs">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-violet-500/15 bg-violet-500/5">
                <td className="px-4 py-3.5" colSpan={4}>
                  <span className="text-sm font-bold text-slate-200">Total</span>
                  <span className="text-xs text-slate-600 ml-2">{totalImages} imagens</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-slate-400 font-mono text-xs font-semibold">
                    {totalTokens > 0 ? totalTokens.toLocaleString('pt-BR') : '—'}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-emerald-400 font-black font-mono">R$ {fmt(totalCost)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {/* Text / Analysis costs section */}
      {textCosts.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-violet-500/10">
            <h3 className="text-base font-bold text-white">Custos de Análise de Texto</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {textCosts.length} chamada{textCosts.length !== 1 ? 's' : ''} · R$ {fmt(textCostTotal)} no total
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Operação</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Modelo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Tokens Entrada</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Tokens Saída</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {textCosts.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-200">{entry.operation}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-xl border bg-violet-500/15 text-violet-300 border-violet-500/20">
                        {TEXT_MODEL_LABELS[entry.model] ?? entry.model}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-slate-400 font-mono text-xs">{entry.inputTokens.toLocaleString('pt-BR')}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-slate-400 font-mono text-xs">{entry.outputTokens.toLocaleString('pt-BR')}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-emerald-400 font-bold font-mono">R$ {fmt(entry.costBRL)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-violet-500/15 bg-violet-500/5">
                  <td className="px-4 py-3.5" colSpan={4}>
                    <span className="text-sm font-bold text-slate-200">Total Texto</span>
                    <span className="text-xs text-slate-600 ml-2">{textCosts.length} chamadas</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-emerald-400 font-black font-mono">R$ {fmt(textCostTotal)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Grand total strip */}
      {textCosts.length > 0 && totalImages > 0 && (
        <div className="glass rounded-2xl px-6 py-4 border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo Total Geral</p>
            <p className="text-xs text-slate-600 mt-0.5">Imagens + Análises de texto</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-emerald-400">R$ {fmt(grandTotal)}</p>
            <p className="text-xs text-slate-600 mt-0.5">≈ U$ {(grandTotal / 5.80).toFixed(4)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostReportView;
