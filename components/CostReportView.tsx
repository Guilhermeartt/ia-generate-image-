import React, { useMemo } from 'react';
import type { Character, Scene, TextCostEntry } from '../types';

interface CostReportViewProps {
  characters: Character[];
  scenes: Scene[];
  textCosts?: TextCostEntry[];
  apiSourceLabel?: string;
  apiSourceDescription?: string;
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
  'gemini-2.5-flash-image':         'Nano Banana 2.5',
  'gemini-3.1-flash-image-preview': 'Nano Banana 3.1',
  'gemini-3-pro-image-preview':     'Nano Banana Pro',
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

const CostReportView: React.FC<CostReportViewProps> = ({
  characters,
  scenes,
  textCosts = [],
  apiSourceLabel = 'Origem da IA não definida',
  apiSourceDescription = 'Configure a IA para registrar corretamente a origem das chamadas.',
}) => {
  const { entries, totalCost, totalTokens, totalImages, modelBreakdown } = useMemo(() => {
    const entries: ImageEntry[] = [];

    for (const char of characters) {
      if (char.imageUrl) entries.push({
        label: char.name, sublabel: 'Personagem', type: 'character',
        modelUsed: char.modelUsed, tokens: char.tokens, costBRL: char.costBRL, imageUrl: char.imageUrl,
      });
      char.imageHistory?.forEach((version, index) => {
        entries.push({
          label: `${char.name} · Versão ${index + 1}`,
          sublabel: version.label || 'Imagem anterior do personagem',
          type: 'character',
          modelUsed: version.modelUsed,
          tokens: version.tokens,
          costBRL: version.costBRL,
          imageUrl: version.imageUrl,
        });
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

  const apiSourceCard = (
    <div className="card" style={{
      padding:'14px 16px',
      display:'flex',
      alignItems:'center',
      justifyContent:'space-between',
      gap:12,
      borderColor:'var(--border-md)',
    }}>
      <div style={{minWidth:0}}>
        <p style={{fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>API em uso</p>
        <p style={{fontSize:15,fontWeight:800,color:'var(--text-1)',marginTop:4}}>{apiSourceLabel}</p>
        <p style={{fontSize:12,color:'var(--text-4)',marginTop:3,lineHeight:1.5}}>{apiSourceDescription}</p>
      </div>
      <span style={{
        fontSize:11,
        fontWeight:700,
        color: apiSourceLabel.toLowerCase().includes('plataforma') ? '#34D399' : '#38BDF8',
        background: apiSourceLabel.toLowerCase().includes('plataforma') ? 'rgba(52,211,153,0.12)' : 'rgba(56,189,248,0.12)',
        border:'1px solid var(--border)',
        borderRadius:6,
        padding:'5px 8px',
        whiteSpace:'nowrap',
      }}>
        {apiSourceLabel.toLowerCase().includes('plataforma') ? 'Créditos' : 'BYOK'}
      </span>
    </div>
  );

  if (totalImages === 0 && textCosts.length === 0) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:12}} className="anim-fade">
        {apiSourceCard}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'64px 0',textAlign:'center'}}>
          <div style={{width:48,height:48,borderRadius:10,background:'var(--surface-2)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-4)'}}>
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <p style={{fontSize:14,fontWeight:600,color:'var(--text-2)',marginBottom:4}}>Nenhum custo registrado</p>
          <p style={{fontSize:12,color:'var(--text-4)',maxWidth:320,lineHeight:1.6}}>
            O relatório aparecerá aqui depois que você processar um CSV ou gerar imagens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}} className="anim-fade">
      {apiSourceCard}

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
        {[
          { label:'Custo Total', value:`R$ ${fmt(grandTotal)}`, sub:`≈ U$ ${(grandTotal/5.80).toFixed(4)}`, accent:'#34D399' },
          { label:'Tokens de Saída', value: totalTokens > 0 ? fmtK(totalTokens) : '—', sub: totalTokens > 0 ? `${totalTokens.toLocaleString('pt-BR')} tokens` : 'Imagen não usa tokens', accent:'#818CF8' },
          { label:'Imagens Geradas', value: String(totalImages), sub:`${generatedChars} pers · ${generatedScenes} cenas · ${generatedSplits} planos`, accent:'var(--text-1)' },
          { label:'Custo Médio/Img', value:`R$ ${totalImages > 0 ? fmt(totalCost/totalImages) : '0,000'}`, sub:'por imagem gerada', accent:'#FCD34D' },
        ].map(card => (
          <div key={card.label} className="card" style={{padding:'14px 16px'}}>
            <p style={{fontSize:10,fontWeight:600,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{card.label}</p>
            <p style={{fontSize:20,fontWeight:800,color:card.accent,fontFamily:'var(--mono)',letterSpacing:'-0.02em'}}>{card.value}</p>
            <p style={{fontSize:11,color:'var(--text-4)',marginTop:4}}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Model breakdown */}
      <div className="card" style={{padding:'16px 18px'}}>
        <p style={{fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:14}}>Uso por Modelo</p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {modelBreakdown.map(({ model, count, tokens, cost }) => {
            const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
            const label = MODEL_LABELS[model] ?? model;
            const colors = MODEL_COLORS[model] ?? DEFAULT_COLORS;
            return (
              <div key={model}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:colors.dot.replace('bg-','').includes('-') ? undefined : colors.dot,flexShrink:0}} className={colors.dot} />
                    <span style={{fontSize:11,fontWeight:600,color:'var(--text-2)'}}>{label}</span>
                    <span style={{fontSize:11,color:'var(--text-4)'}}>{count} img{count !== 1 ? 's' : ''}</span>
                    {tokens > 0 && <span style={{fontSize:11,color:'var(--text-4)'}}>· {fmtK(tokens)} tk</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:11,color:'var(--text-4)'}}>{pct.toFixed(1)}%</span>
                    <span style={{fontSize:12,fontWeight:700,fontFamily:'var(--mono)',color:'#34D399',minWidth:70,textAlign:'right'}}>R$ {fmt(cost)}</span>
                  </div>
                </div>
                <div style={{width:'100%',height:3,background:'var(--surface-3)',borderRadius:99,overflow:'hidden'}}>
                  <div className={colors.bar} style={{height:'100%',borderRadius:99,transition:'width .7s ease',width:`${pct}%`}} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      {totalImages > 0 && (
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'baseline',gap:8}}>
            <p style={{fontSize:12,fontWeight:600,color:'var(--text-2)'}}>Detalhamento por Imagem</p>
            <p style={{fontSize:11,color:'var(--text-4)'}}>{totalImages} imagens</p>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['', 'Imagem', 'Tipo', 'Modelo', 'Tokens', 'Custo'].map((h, i) => (
                    <th key={h+i} style={{padding:'8px 12px',textAlign: i >= 4 ? 'right' : 'left',fontSize:10,fontWeight:600,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const colors = entry.modelUsed ? (MODEL_COLORS[entry.modelUsed] ?? DEFAULT_COLORS) : DEFAULT_COLORS;
                  const typeColors = {
                    character: {bg:'rgba(20,184,166,0.1)',color:'#5EEAD4'},
                    scene:     {bg:'var(--indigo-s)',color:'#818CF8'},
                    split:     {bg:'rgba(255,255,255,0.04)',color:'var(--text-3)'},
                  };
                  const tc = typeColors[entry.type];
                  const typeLabels = { character:'Personagem', scene:'Cena', split:'Plano' };
                  return (
                    <tr key={i} style={{borderBottom:'1px solid var(--border)',transition:'background .1s ease'}} className="hover:bg-white/3">
                      <td style={{padding:'6px 12px',width:48}}>
                        {entry.imageUrl
                          ? <img src={entry.imageUrl} alt={entry.label} style={{width:44,height:30,objectFit:'cover',borderRadius:5,border:'1px solid var(--border)',display:'block'}} />
                          : <div style={{width:44,height:30,borderRadius:5,background:'var(--surface-2)',border:'1px solid var(--border)'}} />
                        }
                      </td>
                      <td style={{padding:'6px 12px',maxWidth:200}}>
                        <p style={{fontWeight:500,color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{entry.label}</p>
                        <p style={{fontSize:11,color:'var(--text-4)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{entry.sublabel}</p>
                      </td>
                      <td style={{padding:'6px 12px'}}>
                        <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:4,background:tc.bg,color:tc.color}}>{typeLabels[entry.type]}</span>
                      </td>
                      <td style={{padding:'6px 12px'}}>
                        {entry.modelUsed
                          ? <span className={`${colors.badge}`} style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:4,border:'1px solid'}}>{MODEL_LABELS[entry.modelUsed] ?? entry.modelUsed}</span>
                          : <span style={{color:'var(--text-4)'}}>—</span>
                        }
                      </td>
                      <td style={{padding:'6px 12px',textAlign:'right'}}>
                        {entry.tokens !== undefined
                          ? <span style={{fontFamily:'var(--mono)',color:'var(--text-3)'}}>{entry.tokens.toLocaleString('pt-BR')}</span>
                          : <span style={{color:'var(--text-4)'}}>fixo</span>
                        }
                      </td>
                      <td style={{padding:'6px 12px',textAlign:'right'}}>
                        {entry.costBRL !== undefined
                          ? <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'#34D399'}}>R$ {fmt(entry.costBRL)}</span>
                          : <span style={{color:'var(--text-4)'}}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--border)',background:'var(--surface-2)'}}>
                  <td colSpan={4} style={{padding:'8px 12px'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--text-1)'}}>Total</span>
                    <span style={{fontSize:11,color:'var(--text-4)',marginLeft:8}}>{totalImages} imagens</span>
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text-3)',fontWeight:600}}>
                      {totalTokens > 0 ? totalTokens.toLocaleString('pt-BR') : '—'}
                    </span>
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>
                    <span style={{fontFamily:'var(--mono)',fontWeight:800,color:'#34D399'}}>R$ {fmt(totalCost)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {/* Text / Analysis costs section */}
      {textCosts.length > 0 && (
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'baseline',gap:8}}>
            <p style={{fontSize:12,fontWeight:600,color:'var(--text-2)'}}>Custos de Análise de Texto</p>
            <p style={{fontSize:11,color:'var(--text-4)'}}>{textCosts.length} chamada{textCosts.length !== 1?'s':''} · R$ {fmt(textCostTotal)}</p>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['Operação','Modelo','Tokens Entrada','Tokens Saída','Custo'].map((h,i) => (
                    <th key={h} style={{padding:'8px 12px',textAlign: i >= 2 ? 'right' : 'left',fontSize:10,fontWeight:600,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {textCosts.map((entry) => (
                  <tr key={entry.id} style={{borderBottom:'1px solid var(--border)',transition:'background .1s'}} className="hover:bg-white/3">
                    <td style={{padding:'7px 12px'}}>
                      <p style={{fontWeight:500,color:'var(--text-1)'}}>{entry.operation}</p>
                      <p style={{fontSize:10,color:'var(--text-4)',marginTop:1}}>{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</p>
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:4,background:'var(--indigo-s)',color:'#818CF8',border:'1px solid var(--indigo-b)'}}>
                        {TEXT_MODEL_LABELS[entry.model] ?? entry.model}
                      </span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--text-3)'}}>{entry.inputTokens.toLocaleString('pt-BR')}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--text-3)'}}>{entry.outputTokens.toLocaleString('pt-BR')}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,color:'#34D399'}}>R$ {fmt(entry.costBRL)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--border)',background:'var(--surface-2)'}}>
                  <td colSpan={4} style={{padding:'8px 12px'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--text-1)'}}>Total Texto</span>
                    <span style={{fontSize:11,color:'var(--text-4)',marginLeft:8}}>{textCosts.length} chamadas</span>
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:800,color:'#34D399'}}>R$ {fmt(textCostTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Grand total strip */}
      {textCosts.length > 0 && totalImages > 0 && (
        <div style={{
          display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',
          background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:10,
        }}>
          <div>
            <p style={{fontSize:10,fontWeight:600,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Custo Total Geral</p>
            <p style={{fontSize:11,color:'var(--text-4)',marginTop:2}}>Imagens + análises de texto</p>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:22,fontWeight:800,fontFamily:'var(--mono)',color:'#34D399',letterSpacing:'-0.02em'}}>R$ {fmt(grandTotal)}</p>
            <p style={{fontSize:11,color:'var(--text-4)',marginTop:2}}>≈ U$ {(grandTotal/5.80).toFixed(4)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostReportView;
