// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isDocxFile, extractTextFromDocx } from './docx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('isDocxFile', () => {
  it('reconhece pela extensão .docx', () => {
    expect(isDocxFile(new File([''], 'roteiro.docx'))).toBe(true);
  });

  it('reconhece pela extensão em maiúsculas', () => {
    expect(isDocxFile(new File([''], 'ROTEIRO.DOCX'))).toBe(true);
  });

  it('reconhece pelo MIME type mesmo sem extensão', () => {
    expect(isDocxFile(new File([''], 'arquivo', { type: DOCX_MIME }))).toBe(true);
  });

  it('rejeita .csv e .txt', () => {
    expect(isDocxFile(new File([''], 'dados.csv'))).toBe(false);
    expect(isDocxFile(new File([''], 'roteiro.txt'))).toBe(false);
  });
});

describe('extractTextFromDocx', () => {
  it('lança erro amigável quando JSZip não está disponível', async () => {
    // JSZip é um global de <script>; ausente no ambiente de teste.
    await expect(extractTextFromDocx(new File([''], 'x.docx'))).rejects.toThrow(/JSZip/);
  });
});
