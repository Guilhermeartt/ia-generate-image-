// JSZip é carregado via <script> global no index.html.
declare const JSZip: { loadAsync: (file: Blob) => Promise<JSZipInstance> } | undefined;
interface JSZipInstance {
  file: (path: string) => { async: (type: 'string') => Promise<string> } | null;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Detecta se um arquivo é .docx pela extensão ou pelo MIME type. */
export const isDocxFile = (candidate: File): boolean =>
  candidate.name.toLowerCase().endsWith('.docx') || candidate.type === DOCX_MIME;

/**
 * Extrai o texto corrido de um .docx (word/document.xml), juntando parágrafos
 * por linha em branco. Lança Error se JSZip estiver ausente, o conteúdo não
 * for encontrado ou houver texto insuficiente.
 */
export const extractTextFromDocx = async (docxFile: File): Promise<string> => {
  if (typeof JSZip === 'undefined') {
    throw new Error('A biblioteca JSZip é necessária para ler arquivos .docx.');
  }

  const zip = await JSZip.loadAsync(docxFile);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Não foi possível encontrar o conteúdo principal do arquivo .docx.');
  }

  const xml = await documentFile.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
  const text = paragraphs
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName('w:t'))
        .map((node) => node.textContent || '')
        .join(''),
    )
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');

  if (text.length < 20) {
    throw new Error('O arquivo .docx não possui texto suficiente para análise.');
  }

  return text;
};
