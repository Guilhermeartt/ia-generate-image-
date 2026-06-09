import { describe, it, expect } from 'vitest';
import { parseCSV, escapeCsvValue, rowsToCsvText, storyboardRowsToCsvRows } from './csv';

describe('parseCSV', () => {
  const header = 'scene_id,sub_id,order,loc,context,style';

  it('faz parse de um CSV simples', () => {
    const rows = parseCSV(`${header}\n1,1,1,INT. CASA,Maria entra,drama`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scene_id: '1',
      loc: 'INT. CASA',
      context: 'Maria entra',
      style: 'drama',
    });
  });

  it('detecta delimitador ponto-e-vírgula', () => {
    const rows = parseCSV('scene_id;sub_id;order;loc;context;style\n1;1;1;RUA;Texto;noir');
    expect(rows[0].loc).toBe('RUA');
    expect(rows[0].style).toBe('noir');
  });

  it('respeita campos entre aspas com vírgula embutida', () => {
    const rows = parseCSV(`${header}\n1,1,1,CASA,"Maria, João e Ana",drama`);
    expect(rows[0].context).toBe('Maria, João e Ana');
  });

  it('trata aspas escapadas ("")', () => {
    const rows = parseCSV(`${header}\n1,1,1,CASA,"Ela disse ""oi""",drama`);
    expect(rows[0].context).toBe('Ela disse "oi"');
  });

  it('a coluna style é opcional', () => {
    const rows = parseCSV('scene_id,sub_id,order,loc,context\n1,1,1,CASA,Texto');
    expect(rows[0].style).toBe('');
  });

  it('pula linhas em branco', () => {
    const rows = parseCSV(`${header}\n1,1,1,CASA,Texto,drama\n\n2,1,2,RUA,Outro,noir`);
    expect(rows).toHaveLength(2);
  });

  it('lança erro para CSV vazio', () => {
    expect(() => parseCSV('   ')).toThrow(/vazio/);
  });

  it('lança erro quando faltam colunas obrigatórias', () => {
    expect(() => parseCSV('scene_id,sub_id\n1,1')).toThrow(/colunas necessárias/);
  });

  it('lança erro quando há só o cabeçalho', () => {
    expect(() => parseCSV(header)).toThrow(/cabeçalho e pelo menos uma linha/);
  });
});

describe('escapeCsvValue', () => {
  it('não altera valores simples', () => {
    expect(escapeCsvValue('abc')).toBe('abc');
  });
  it('envolve em aspas valores com vírgula', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
  });
  it('duplica aspas internas', () => {
    expect(escapeCsvValue('a"b')).toBe('"a""b"');
  });
});

describe('rowsToCsvText', () => {
  it('serializa com cabeçalho e faz round-trip', () => {
    const rows = parseCSV('scene_id,sub_id,order,loc,context,style\n1,1,1,CASA,"x, y",drama');
    const text = rowsToCsvText(rows);
    expect(text.split('\n')[0]).toBe('scene_id,sub_id,order,loc,context,style');
    expect(parseCSV(text)[0].context).toBe('x, y');
  });
});

describe('storyboardRowsToCsvRows', () => {
  it('converte linhas de storyboard juntando locução/imagem/lettering', () => {
    const rows = storyboardRowsToCsvRows([
      { ordem: 1, local: 'INT. CASA', locucao: 'narração', imagem: 'Maria entra', lettering: 'TÍTULO', tipo_cena: 'Narração' },
    ]);
    expect(rows[0].scene_id).toBe('1');
    expect(rows[0].loc).toBe('INT. CASA');
    expect(rows[0].context).toContain('LOCUÇÃO: narração');
    expect(rows[0].context).toContain('LETTERING: TÍTULO');
    expect(rows[0].style).toBe('Narração');
  });

  it('usa só a imagem quando não há locução/lettering', () => {
    const rows = storyboardRowsToCsvRows([
      { ordem: 2, local: 'RUA', locucao: '', imagem: 'Cena de rua', lettering: '', tipo_cena: '' },
    ]);
    expect(rows[0].context).toBe('Cena de rua');
  });
});
