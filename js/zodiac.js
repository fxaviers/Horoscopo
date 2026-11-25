/**
 * Dados e utilitarios dos 12 signos do zodiaco em pt-BR.
 * Modulos ES puros, sem dependencias externas.
 */

/** @type {ReadonlyArray<{id: string, name: string, range: string, element: 'Fogo'|'Terra'|'Ar'|'Água', start: [number, number], end: [number, number]}>} */
export const SIGNS = [
  { id: 'aries', name: 'Áries', range: '21 mar – 19 abr', element: 'Fogo', start: [3, 21], end: [4, 19] },
  { id: 'taurus', name: 'Touro', range: '20 abr – 20 mai', element: 'Terra', start: [4, 20], end: [5, 20] },
  { id: 'gemini', name: 'Gêmeos', range: '21 mai – 20 jun', element: 'Ar', start: [5, 21], end: [6, 20] },
  { id: 'cancer', name: 'Câncer', range: '21 jun – 22 jul', element: 'Água', start: [6, 21], end: [7, 22] },
  { id: 'leo', name: 'Leão', range: '23 jul – 22 ago', element: 'Fogo', start: [7, 23], end: [8, 22] },
  { id: 'virgo', name: 'Virgem', range: '23 ago – 22 set', element: 'Terra', start: [8, 23], end: [9, 22] },
  { id: 'libra', name: 'Libra', range: '23 set – 22 out', element: 'Ar', start: [9, 23], end: [10, 22] },
  { id: 'scorpio', name: 'Escorpião', range: '23 out – 21 nov', element: 'Água', start: [10, 23], end: [11, 21] },
  { id: 'sagittarius', name: 'Sagitário', range: '22 nov – 21 dez', element: 'Fogo', start: [11, 22], end: [12, 21] },
  { id: 'capricorn', name: 'Capricórnio', range: '22 dez – 19 jan', element: 'Terra', start: [12, 22], end: [1, 19] },
  { id: 'aquarius', name: 'Aquário', range: '20 jan – 18 fev', element: 'Ar', start: [1, 20], end: [2, 18] },
  { id: 'pisces', name: 'Peixes', range: '19 fev – 20 mar', element: 'Água', start: [2, 19], end: [3, 20] },
];

const ABBREVIATIONS = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'etc', 'ex', 'obs',
  'aprox', 'pag', 'pág', 'vol', 'cap', 'art', 'tel', 'mr', 'mrs', 'ms',
  'st', 'vs', 'fig', 'ref', 'num', 'núm', 'min', 'max', 'máx', 'n', 'p',
]);

/**
 * Retorna o objeto do signo correspondente ao identificador, ou null.
 * @param {string} id
 */
export function getSignById(id) {
  if (typeof id !== 'string') return null;
  const normalized = id.trim().toLowerCase();
  return SIGNS.find((sign) => sign.id === normalized) || null;
}

/**
 * Verifica se um ponto final pertence a uma abreviacao ou inicial unica.
 * @param {string} text
 * @param {number} dotIndex
 */
function isAbbreviationDot(text, dotIndex) {
  const before = text.slice(0, dotIndex);
  const match = before.match(/([\p{L}\p{N}]+)$/u);
  if (!match) return false;
  const token = match[1].toLowerCase();
  if (ABBREVIATIONS.has(token)) return true;
  if (token.length === 1 && /\p{L}/u.test(token)) return true;
  return false;
}

/**
 * Divide um bloco de texto em frases preservando abreviacoes, reticencias e numeros.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = [];
  let start = 0;
  const re = /([.!?]+)(["”’')»]*)\s+(?=.)/gu;
  let match;

  while ((match = re.exec(cleaned)) !== null) {
    const punct = match[1];
    const punctStart = match.index;
    const endOfSentence = match.index + punct.length + match[2].length;
    const nextChar = cleaned[match.index + match[0].length];

    // Nao quebrar reticencias seguidas de letra minuscula
    if (punct.length >= 2 && punct[0] === '.' && /\p{Ll}/u.test(nextChar)) {
      continue;
    }

    // Nao quebrar abreviacoes nem quando o proximo caractere inicia com minuscula apos ponto simples
    if (punct === '.') {
      if (isAbbreviationDot(cleaned, punctStart)) {
        continue;
      }
      if (/^\p{Ll}/u.test(nextChar)) {
        continue;
      }
    }

    const slice = cleaned.slice(start, endOfSentence).trim();
    if (slice) sentences.push(slice);
    start = match.index + match[0].length;
  }

  const tail = cleaned.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/**
 * Divide o texto do horoscopo em 1 a 3 paragrafos de aproximadamente 2 frases cada.
 * @param {string} text
 * @returns {string[]}
 */
export function formatHoroscopeParagraphs(text) {
  if (typeof text !== 'string') return [];
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const explicitParagraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (explicitParagraphs.length >= 2 && explicitParagraphs.length <= 3) {
    const counts = explicitParagraphs.map((p) => splitSentences(p).length);
    if (counts.every((c) => c >= 1 && c <= 4)) {
      return explicitParagraphs;
    }
  }

  const sentences = splitSentences(explicitParagraphs.join(' '));
  if (sentences.length === 0) return [];
  if (sentences.length <= 2) return [sentences.join(' ')];

  const targetParagraphs = sentences.length <= 4 ? 2 : 3;
  const baseSize = Math.floor(sentences.length / targetParagraphs);
  const remainder = sentences.length % targetParagraphs;

  const result = [];
  let cursor = 0;
  for (let i = 0; i < targetParagraphs; i += 1) {
    const size = baseSize + (i < remainder ? 1 : 0);
    result.push(sentences.slice(cursor, cursor + size).join(' '));
    cursor += size;
  }
  return result.filter(Boolean);
}
