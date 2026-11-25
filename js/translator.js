/**
 * Traducao fallback en -> pt-BR via MyMemory e normalizacao astrologica em pt-BR.
 * Modulos ES puros, zero dependencias externas.
 */

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_CHARS = 420;
const REQUEST_TIMEOUT_MS = 10000;

const SIGN_REPLACEMENTS = [
  [/(?<![\p{L}\p{N}])(?:aries|áries)(?![\p{L}\p{N}])/giu, 'Áries'],
  [/(?<![\p{L}\p{N}])(?:taurus|touro)(?![\p{L}\p{N}])/giu, 'Touro'],
  [/(?<![\p{L}\p{N}])(?:gemini|gêmeos|gemeos)(?![\p{L}\p{N}])/giu, 'Gêmeos'],
  [/(?<![\p{L}\p{N}])(?:cancer|câncer)(?![\p{L}\p{N}])/giu, 'Câncer'],
  [/(?<![\p{L}\p{N}])(?:leo|leão|leao)(?![\p{L}\p{N}])/giu, 'Leão'],
  [/(?<![\p{L}\p{N}])virgo(?![\p{L}\p{N}])/giu, 'Virgem'],
  [/(?<![\p{L}\p{N}])Virgem(?![\p{L}\p{N}])/gu, 'Virgem'],
  [/(?<![\p{L}\p{N}])(para|de|em|como|signo de|nativos de)\s+virgem(?![\p{L}\p{N}])/giu, '$1 Virgem'],
  [/(?<![\p{L}\p{N}])Libra(?![\p{L}\p{N}])/gu, 'Libra'],
  [/(?<![\p{L}\p{N}])(para|de|em|como|signo de|nativos de)\s+libra(?![\p{L}\p{N}])/giu, '$1 Libra'],
  [/(?<![\p{L}\p{N}])(?:scorpio|escorpião|escorpiao)(?![\p{L}\p{N}])/giu, 'Escorpião'],
  [/(?<![\p{L}\p{N}])(?:sagittarius|sagitário|sagitario)(?![\p{L}\p{N}])/giu, 'Sagitário'],
  [/(?<![\p{L}\p{N}])(?:capricorn|capricórnio|capricornio)(?![\p{L}\p{N}])/giu, 'Capricórnio'],
  [/(?<![\p{L}\p{N}])(?:aquarius|aquário|aquario)(?![\p{L}\p{N}])/giu, 'Aquário'],
  [/(?<![\p{L}\p{N}])pisces(?![\p{L}\p{N}])/giu, 'Peixes'],
  [/(?<![\p{L}\p{N}])Peixes(?![\p{L}\p{N}])/gu, 'Peixes'],
  [/(?<![\p{L}\p{N}])(para|de|em|como|signo de|nativos de)\s+peixes(?![\p{L}\p{N}])/giu, '$1 Peixes'],
];

const API_ERROR_PATTERN =
  /MYMEMORY WARNING|QUERY LENGTH LIMIT|PLEASE SELECT|INVALID LANGUAGE|NO QUERY SPECIFIED|ALL AVAILABLE FREE TRANSLATIONS|LIMIT EXCEEDED|<html|<!doctype|<body/i;

const EN_STOPWORDS = new Set([
  'the', 'and', 'with', 'you', 'your', 'yours', 'for', 'that', 'this', 'these',
  'those', 'today', 'week', 'month', 'will', 'would', 'could', 'should', 'might',
  'may', 'are', 'is', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'from', 'they', 'their', 'them', 'into', 'about', 'things', 'good', 'time',
  'day', 'new', 'work', 'life', 'make', 'more', 'some', 'what', 'when', 'where',
  'which', 'while', 'also', 'very', 'just', 'only', 'other', 'others', 'likely',
  'pretty', 'try', 'focus', 'take', 'care', 'feel', 'feeling', 'need', 'find',
  'keep', 'stay', 'between', 'through', 'before', 'after', 'than', 'then',
  'not', 'but', 'can', 'all', 'out', 'get',
]);

const PT_STOPWORDS = new Set([
  'que', 'para', 'com', 'você', 'voce', 'sua', 'seu', 'seus', 'suas', 'hoje',
  'semana', 'mês', 'mes', 'dia', 'pode', 'podem', 'uma', 'um', 'uns', 'umas',
  'mais', 'como', 'por', 'sobre', 'ser', 'estar', 'está', 'estão', 'tempo',
  'bom', 'boa', 'boas', 'bons', 'novas', 'novo', 'nova', 'novos', 'vida',
  'trabalho', 'fazer', 'coisas', 'alguns', 'algumas', 'algo', 'este', 'esta',
  'esse', 'essa', 'isso', 'não', 'nao', 'sim', 'mas', 'também', 'tambem',
  'entre', 'apenas', 'muito', 'muita', 'tudo', 'bem', 'ou', 'ao', 'aos', 'à',
  'às', 'das', 'dos', 'nas', 'nos', 'pela', 'pelo', 'pelas', 'pelos', 'dele',
  'dela', 'eles', 'elas', 'isto', 'são', 'foi', 'vai', 'vão', 'tenha', 'ter',
  'faz', 'sem', 'até', 'ate', 'ainda', 'onde', 'quando', 'porque', 'embora',
  'apesar', 'cuidado', 'energia', 'momento', 'signo', 'neste', 'nesta', 'nesse',
  'nessa', 'há', 'ha', 'é', 'e',
]);

function decodeBasicEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Normaliza nomes de signos para grafia acentuada em pt-BR e limpa espacos extras.
 * @param {string} text
 * @returns {string}
 */
export function normalizeAstrologyPtBr(text) {
  if (typeof text !== 'string') return '';
  let out = decodeBasicEntities(text).replace(/\r\n/g, '\n');

  for (const [pattern, replacement] of SIGN_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }

  out = out
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/([,;!?])([^\s\d"”’')».,!?])/g, '$1 $2')
    .replace(/(?<!\.)\.([^\s\d"”’')».,!?])/g, '. $1')
    .trim();

  return out;
}

/**
 * Valida se o texto traduzido e valido em pt-BR (nao vazio, sem avisos da API e nao em ingles).
 * @param {string} translated
 * @param {string} [original]
 * @returns {boolean}
 */
export function isValidPtBrTranslation(translated, original = '') {
  if (typeof translated !== 'string') return false;
  const clean = translated.trim();
  if (!clean) return false;
  if (API_ERROR_PATTERN.test(clean)) return false;

  if (original && original.trim().length > 20) {
    if (clean.toLowerCase() === original.trim().toLowerCase()) {
      return false;
    }
  }

  if (clean.length > 25) {
    const words = clean.toLowerCase().match(/[\p{L}]+/gu) || [];
    let enCount = 0;
    let ptCount = 0;
    for (const w of words) {
      if (EN_STOPWORDS.has(w)) enCount += 1;
      if (PT_STOPWORDS.has(w)) ptCount += 1;
    }
    const hasPtAccents = /[áàâãéêíóôõúç]/i.test(clean);
    if (enCount >= 3 && ptCount === 0 && !hasPtAccents) {
      return false;
    }
    if (enCount >= 4 && enCount > ptCount * 2) {
      return false;
    }
  }

  return true;
}

/**
 * Quebra um texto longo por frases (ou clausulas/palavras se necessario) em blocos <= maxLen.
 * @param {string} text
 * @param {number} [maxLen]
 * @returns {string[]}
 */
function splitIntoChunks(text, maxLen = MAX_CHUNK_CHARS) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const pieces = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  const pushPart = (part) => {
    if (part.length <= maxLen) {
      if (!current) {
        current = part;
      } else if (`${current} ${part}`.length <= maxLen) {
        current = `${current} ${part}`;
      } else {
        chunks.push(current);
        current = part;
      }
      return;
    }

    // Frase isolada maior que maxLen: divide em virgulas ou espacos
    if (current) {
      chunks.push(current);
      current = '';
    }
    const words = part.split(/\s+/);
    let buf = '';
    for (const word of words) {
      if (word.length > maxLen) {
        if (buf) {
          chunks.push(buf);
          buf = '';
        }
        for (let i = 0; i < word.length; i += maxLen) {
          chunks.push(word.slice(i, i + maxLen));
        }
      } else if (!buf) {
        buf = word;
      } else if (`${buf} ${word}`.length <= maxLen) {
        buf = `${buf} ${word}`;
      } else {
        chunks.push(buf);
        buf = word;
      }
    }
    if (buf) current = buf;
  };

  for (const piece of pieces) {
    pushPart(piece);
  }
  if (current) chunks.push(current);
  return chunks;
}

function createAbortError() {
  const err = new Error('Operacao cancelada');
  err.name = 'AbortError';
  return err;
}

function waitMs(ms, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    };
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchChunkTranslation(chunk, signal) {
  const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(chunk)}&langpair=en|pt-BR`;
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal?.aborted) throw createAbortError();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.responseStatus && Number(data.responseStatus) !== 200) {
        throw new Error(`Status API ${data.responseStatus}`);
      }
      const translated = data?.responseData?.translatedText;
      if (!isValidPtBrTranslation(translated, chunk)) {
        throw new Error('Traducao invalida ou em ingles');
      }
      return translated.trim();
    } catch (err) {
      if (signal?.aborted) throw createAbortError();
      lastError = err;
      if (attempt < 2) {
        await waitMs(350 * (attempt + 1), signal);
      }
    } finally {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onCallerAbort);
    }
  }

  throw lastError || new Error('Falha ao traduzir trecho');
}

/**
 * Traduz texto do ingles para portugues brasileiro via MyMemory em blocos <= 420 chars.
 * @param {string} text
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string>}
 */
export async function translateEnToPtBr(text, { signal } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Texto vazio para traducao');
  }
  if (signal?.aborted) throw createAbortError();

  const chunks = splitIntoChunks(text, MAX_CHUNK_CHARS);
  if (chunks.length === 0) {
    throw new Error('Texto vazio para traducao');
  }

  const translatedParts = [];
  for (const chunk of chunks) {
    const part = await fetchChunkTranslation(chunk, signal);
    translatedParts.push(part);
  }

  const combined = normalizeAstrologyPtBr(translatedParts.join(' '));
  if (!isValidPtBrTranslation(combined, text)) {
    throw new Error('Resultado da traducao nao passou na validacao pt-BR');
  }
  return combined;
}
