import { PDFDocument } from 'pdf-lib';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface SplitPdfPage {
  pageNumber: number;
  fileName: string;
  bytes: Uint8Array;
}

export interface GeneratedPdfDocument {
  fileName: string;
  bytes: Uint8Array;
  pageNumbers: number[];
}

export interface PdfPageTextMatch {
  pageNumber: number;
  text: string;
}

export interface PdfPersoneelPageMatch {
  pageNumber: number;
  personeelNaam: string;
}

const IGNORED_PAGE_TEXTS = [
  'Totaal overzicht betalingen',
  'Voorlopige journaalposten',
  'Voorblad',
];

function getPdfBaseName(sourceName: string): string {
  const trimmed = String(sourceName || '').trim();
  if (!trimmed) {
    return 'rapportenset';
  }
  return trimmed.replace(/\.pdf$/i, '') || 'rapportenset';
}

function normalizeForMatch(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function shouldIgnorePageText(text: string): boolean {
  const normalizedText = ` ${normalizeForMatch(text)} `;
  return IGNORED_PAGE_TEXTS.some((value) => normalizedText.includes(` ${normalizeForMatch(value)} `));
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toDetachedSafeUint8Array(pdfBytes: ArrayBuffer | Uint8Array): Uint8Array {
  const source = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

export function buildPersoneelNameCandidates(fullName: string): string[] {
  const tokens = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  if (tokens.length === 1) {
    return uniqueValues([normalizeForMatch(tokens[0])]);
  }

  const surname = tokens.slice(1).join(' ');
  const firstNames = tokens.slice(0, -1);
  const firstName = tokens[0];
  const firstInitial = firstName.charAt(0);
  const allInitials = firstNames.map((part) => part.charAt(0)).join(' ');
  const compactInitials = firstNames.map((part) => part.charAt(0)).join('');

  return uniqueValues([
    normalizeForMatch(tokens.join(' ')),
    normalizeForMatch(`${firstInitial} ${surname}`),
    normalizeForMatch(`${allInitials} ${surname}`),
    normalizeForMatch(`${compactInitials} ${surname}`),
    normalizeForMatch(surname),
  ]);
}

export async function extractPdfPageTexts(pdfBytes: ArrayBuffer | Uint8Array): Promise<PdfPageTextMatch[]> {
  const data = toDetachedSafeUint8Array(pdfBytes);
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: PdfPageTextMatch[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? String(item.str || '') : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push({ pageNumber, text });
  }

  await pdf.destroy();
  return pages;
}

export function findPdfPagesForPersoneel(pageTexts: PdfPageTextMatch[], personeelNaam: string): number[] {
  const candidates = buildPersoneelNameCandidates(personeelNaam);
  if (candidates.length === 0) {
    return [];
  }

  return pageTexts
    .filter((page) => {
      const normalizedText = ` ${normalizeForMatch(page.text)} `;
      return candidates.some((candidate) => normalizedText.includes(` ${candidate} `));
    })
    .map((page) => page.pageNumber);
}

export function matchPdfPagesToPersoneel(pageTexts: PdfPageTextMatch[], personeelNamen: string[]): PdfPersoneelPageMatch[] {
  const normalizedPersoneel = personeelNamen
    .map((naam) => {
      const normalizedFullName = normalizeForMatch(naam);
      return {
        naam,
        normalizedFullName,
        candidates: buildPersoneelNameCandidates(naam),
      };
    })
    .filter((item) => item.candidates.length > 0);

  const matches: PdfPersoneelPageMatch[] = [];

  for (const page of pageTexts) {
    if (shouldIgnorePageText(page.text)) {
      continue;
    }

    const normalizedText = ` ${normalizeForMatch(page.text)} `;
    let bestMatch: { personeelNaam: string; score: number } | null = null;

    for (const personeel of normalizedPersoneel) {
      let highestCandidateScore = 0;

      for (const candidate of personeel.candidates) {
        if (!candidate) {
          continue;
        }
        if (!normalizedText.includes(` ${candidate} `)) {
          continue;
        }

        const baseScore = candidate.length;
        const bonus = candidate === personeel.normalizedFullName ? 1000 : 0;
        const score = baseScore + bonus;
        if (score > highestCandidateScore) {
          highestCandidateScore = score;
        }
      }

      if (highestCandidateScore === 0) {
        continue;
      }

      if (!bestMatch || highestCandidateScore > bestMatch.score) {
        bestMatch = {
          personeelNaam: personeel.naam,
          score: highestCandidateScore,
        };
      }
    }

    if (bestMatch) {
      matches.push({
        pageNumber: page.pageNumber,
        personeelNaam: bestMatch.personeelNaam,
      });
    }
  }

  return matches;
}

export async function splitPdfIntoSinglePageDocuments(
  pdfBytes: ArrayBuffer | Uint8Array,
  sourceName: string,
  pageNumbers?: number[],
  outputBaseName?: string
): Promise<SplitPdfPage[]> {
  const sourcePdf = await PDFDocument.load(toDetachedSafeUint8Array(pdfBytes));
  const pageCount = sourcePdf.getPageCount();
  const selectedPages =
    Array.isArray(pageNumbers) && pageNumbers.length > 0
      ? pageNumbers.filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount)
      : Array.from({ length: pageCount }, (_, index) => index + 1);
  const baseName = getPdfBaseName(outputBaseName || sourceName);
  const pages: SplitPdfPage[] = [];
  const usePageSuffix = selectedPages.length > 1;

  for (const pageNumber of selectedPages) {
    const nextPdf = await PDFDocument.create();
    const [page] = await nextPdf.copyPages(sourcePdf, [pageNumber - 1]);
    nextPdf.addPage(page);

    pages.push({
      pageNumber,
      fileName: usePageSuffix ? `${baseName} - pagina ${String(pageNumber).padStart(3, '0')}.pdf` : `${baseName}.pdf`,
      bytes: await nextPdf.save(),
    });
  }

  return pages;
}

export async function createPdfDocumentForPages(
  pdfBytes: ArrayBuffer | Uint8Array,
  sourceName: string,
  pageNumbers: number[],
  outputBaseName?: string
): Promise<GeneratedPdfDocument | null> {
  const sourcePdf = await PDFDocument.load(toDetachedSafeUint8Array(pdfBytes));
  const pageCount = sourcePdf.getPageCount();
  const selectedPages = pageNumbers.filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount);
  if (selectedPages.length === 0) {
    return null;
  }

  const nextPdf = await PDFDocument.create();
  const copiedPages = await nextPdf.copyPages(sourcePdf, selectedPages.map((pageNumber) => pageNumber - 1));
  copiedPages.forEach((page) => nextPdf.addPage(page));

  return {
    fileName: `${getPdfBaseName(outputBaseName || sourceName)}.pdf`,
    bytes: await nextPdf.save(),
    pageNumbers: selectedPages,
  };
}
