#!/usr/bin/env node
/**
 * Pipeline diário de coleta e tradução blindada (pt-BR) para o Horóscopo do Dia.
 * Zero dependências externas (Node 20+ ESM).
 *
 * Uso:
 *   node horoscopo/scripts/update-horoscopo.mjs
 *   node horoscopo/scripts/update-horoscopo.mjs --force
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../data/horoscopo.json');

const SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

const PERIODS = ['daily', 'weekly', 'monthly'];

const SOURCE_HOST = 'freehoroscopeapi.com';
const SOURCE_BASE_URL = `https://${SOURCE_HOST}/api/v1/get-horoscope`;
const GTX_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const FETCH_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;
const CONCURRENCY = 3;
const GTX_MAX_CHARS = 900;
const MYMEMORY_MAX_CHARS = 420;

const VALID_PROVIDERS = new Set(['google-gtx', 'gemini', 'mymemory', 'mixed']);

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'sra',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'approx',
]);

// Palavras estritamente em inglês (evitando homógrafos do português como "for", "time", "a", "me", "no")
const EN_STOPWORDS = new Set([
  'the',
  'and',
  'you',
  'your',
  'yours',
  'with',
  'this',
  'that',
  'these',
  'those',
  'are',
  'is',
  'was',
  'were',
  'it',
  'its',
  'to',
  'of',
  'in',
  'on',
  'will',
  'would',
  'could',
  'should',
  'have',
  'has',
  'had',
  'from',
  'they',
  'their',
  'them',
  'today',
  'week',
  'month',
  'likely',
  'things',
  'good',
  'bad',
  'take',
  'make',
  'into',
  'about',
  'more',
  'some',
  'what',
  'when',
  'which',
  'where',
  'there',
  'been',
  'being',
  'may',
  'might',
  'can',
  'not',
  'but',
  'all',
  'also',
  'just',
  'very',
  'much',
  'most',
  'many',
  'other',
  'others',
  'feel',
  'feeling',
  'stay',
  'focus',
  'avoid',
  'important',
  'try',
  'need',
  'work',
  'life',
  'day',
  'days',
  'new',
  'get',
  'getting',
  'help',
  'around',
  'through',
  'while',
  'however',
  'overall',
  'because',
  'during',
  'before',
  'after',
  'first',
  'next',
]);

const PT_WORDS = new Set([
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'uns',
  'umas',
  'e',
  'o',
  'os',
  'as',
  'é',
  'são',
  'está',
  'estão',
  'para',
  'com',
  'por',
  'que',
  'se',
  'ao',
  'aos',
  'à',
  'às',
  'ou',
  'mas',
  'você',
  'seu',
  'sua',
  'seus',
  'suas',
  'hoje',
  'semana',
  'mês',
  'dia',
  'dias',
  'pode',
  'podem',
  'ser',
  'estar',
  'ter',
  'fazer',
  'mais',
  'muito',
  'muita',
  'muitos',
  'muitas',
  'também',
  'sobre',
  'entre',
  'isso',
  'este',
  'esta',
  'esse',
  'essa',
  'quando',
  'como',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'momento',
  'energia',
  'atenção',
  'pessoas',
  'vida',
  'trabalho',
  'sentir',
  'manter',
  'evitar',
  'coisas',
  'importante',
  'melhor',
  'bom',
  'boa',
  'tudo',
  'algo',
  'alguém',
  'outros',
  'outras',
  'novo',
  'nova',
  'novos',
  'novas',
  'tempo',
  'forma',
  'maneira',
  'parte',
  'lado',
  'caminho',
  'sentido',
  'equilíbrio',
  'paciência',
  'calma',
  'coração',
  'mente',
  'decisões',
  'oportunidades',
  'mudanças',
  'relações',
  'relacionamentos',
  'pessoal',
  'profissional',
  'financeiro',
  'saúde',
  'bem',
  'foco',
  'focar',
  'cuidado',
  'cuidar',
  'precisa',
  'precisam',
  'aproveite',
  'tente',
  'geral',
  'entanto',
  'enquanto',
  'durante',
  'antes',
  'depois',
  'primeiro',
  'próximo',
  'sempre',
  'nunca',
  'ainda',
  'já',
  'mesmo',
  'mesma',
  'próprio',
  'própria',
  'próprios',
  'próprias',
  'porque',
  'pois',
  'embora',
  'apesar',
  'assim',
  'então',
  'talvez',
  'provável',
  'provavelmente',
  'bastante',
  'pouco',
  'poucos',
  'diferentes',
  'situação',
  'situações',
  'atividades',
  'tarefas',
  'passos',
  'passo',
  'confiança',
  'esforço',
  'sucesso',
]);

const API_ERROR_PATTERNS = [
  'MYMEMORY WARNING',
  'QUERY LENGTH LIMIT',
  'PLEASE SELECT TWO DISTINCT LANGUAGES',
  'INVALID LANGUAGE PAIR',
  'NO QUERY SPECIFIED',
  'QUOTA EXCEEDED',
  'TOO MANY REQUESTS',
  'RATE LIMIT',
  'ACCESS DENIED',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeUrlForLog(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.has('q')) {
      parsed.searchParams.set('q', `<${parsed.searchParams.get('q').length}chars>`);
    }
    if (parsed.searchParams.has('de')) {
      parsed.searchParams.set('de', '<redacted>');
    }
    if (parsed.searchParams.has('key')) {
      parsed.searchParams.set('key', '<redacted>');
    }
    return parsed.toString();
  } catch {
    return String(rawUrl).split('?')[0];
  }
}

async function fetchWithRetry(url, init = {}, options = {}) {
  const {
    timeoutMs = FETCH_TIMEOUT_MS,
    maxAttempts = MAX_ATTEMPTS,
    baseDelayMs = 800,
    parseAs = 'json',
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`Timeout após ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status} em ${sanitizeUrlForLog(url)}`);
        err.status = response.status;
        err.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw err;
      }

      if (parseAs === 'text') {
        return await response.text();
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable !== false;
      if (!retryable || attempt >= maxAttempts) {
        break;
      }
      const jitter = Math.floor(Math.random() * 250);
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`Falha desconhecida ao acessar ${sanitizeUrlForLog(url)}`);
}

/**
 * Divide texto em sentenças preservando abreviações e números decimais.
 */
function splitSentences(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = [];
  let start = 0;
  const punctuationRegex = /([.!?]["'”’)]?)(?:\s+|$)/g;
  let match;

  while ((match = punctuationRegex.exec(clean)) !== null) {
    const endIdx = match.index + match[1].length;
    const candidate = clean.slice(start, endIdx).trim();

    if (match[1].startsWith('.')) {
      const beforeDot = clean.slice(start, match.index);
      const lastWordMatch = beforeDot.match(/([A-Za-z.]+)$/);
      const token = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';
      const nextChar = clean[match.index + match[0].length] ?? '';

      if (ABBREVIATIONS.has(token) || (/^[a-z]$/.test(token) && nextChar)) {
        continue;
      }
    }

    if (candidate) {
      sentences.push(candidate);
    }
    start = match.index + match[0].length;
  }

  if (start < clean.length) {
    const tail = clean.slice(start).trim();
    if (tail) {
      sentences.push(tail);
    }
  }

  return sentences.length > 0 ? sentences : [clean];
}

function splitLongSegment(segment, maxChars) {
  if (segment.length <= maxChars) return [segment];

  const pieces = [];
  const clauses = segment.split(/(?<=[,;:])\s+/);
  let current = '';

  for (const clause of clauses) {
    if (clause.length > maxChars) {
      if (current) {
        pieces.push(current);
        current = '';
      }
      const words = clause.split(/\s+/);
      for (const word of words) {
        if (!word) continue;
        if (word.length > maxChars) {
          if (current) {
            pieces.push(current);
            current = '';
          }
          for (let i = 0; i < word.length; i += maxChars) {
            pieces.push(word.slice(i, i + maxChars));
          }
        } else if (!current) {
          current = word;
        } else if (current.length + 1 + word.length <= maxChars) {
          current += ` ${word}`;
        } else {
          pieces.push(current);
          current = word;
        }
      }
    } else if (!current) {
      current = clause;
    } else if (current.length + 1 + clause.length <= maxChars) {
      current += ` ${clause}`;
    } else {
      pieces.push(current);
      current = clause;
    }
  }

  if (current) {
    pieces.push(current);
  }
  return pieces;
}

/**
 * Divide texto em blocos por sentenças respeitando limite máximo de caracteres.
 */
export function splitIntoChunks(text, maxChars) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = splitSentences(clean);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitLongSegment(sentence, maxChars));
      continue;
    }

    if (!current) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= maxChars) {
      current += ` ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function decodeBasicEntities(text) {
  return String(text ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeComparable(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function analyzeLexicon(text) {
  const words = String(text ?? '').toLowerCase().match(/\p{L}+/gu) ?? [];
  let enCount = 0;
  let ptCount = 0;

  for (const word of words) {
    if (EN_STOPWORDS.has(word)) enCount += 1;
    if (PT_WORDS.has(word)) ptCount += 1;
  }

  const hasPtDiacritics = /[áàâãéêíóôõúç]/i.test(text);
  return { words, enCount, ptCount, hasPtDiacritics };
}

/**
 * Valida texto traduzido para pt-BR, rejeitando vazios, avisos de API, HTML ou inglês remanescente.
 */
export function validatePtBrTranslation(translated, original = '') {
  if (typeof translated !== 'string') {
    return { ok: false, reason: 'texto não é string' };
  }

  const trimmed = translated.trim();
  if (!trimmed) {
    return { ok: false, reason: 'texto vazio' };
  }

  const origTrimmed = String(original ?? '').trim();
  if (origTrimmed.length > 40 && trimmed.length < 15) {
    return { ok: false, reason: 'texto curto demais em relação ao original' };
  }
  if (!origTrimmed && trimmed.length < 20) {
    return { ok: false, reason: 'texto curto demais' };
  }
  if (trimmed.length < 3) {
    return { ok: false, reason: 'texto curto demais' };
  }

  const upper = trimmed.toUpperCase();
  for (const pattern of API_ERROR_PATTERNS) {
    if (upper.includes(pattern)) {
      return { ok: false, reason: `aviso de API detectado (${pattern})` };
    }
  }

  if (
    /<!doctype\s+html/i.test(trimmed) ||
    /<\/?(?:html|head|body|script|style|div|span|p|br|title|h[1-6]|pre|code|error)\b[^>]*>/i.test(trimmed) ||
    /<\/[a-z][a-z0-9-]*>/i.test(trimmed)
  ) {
    return { ok: false, reason: 'HTML detectado na resposta' };
  }

  if (origTrimmed) {
    const normTrans = normalizeComparable(trimmed);
    const normOrig = normalizeComparable(origTrimmed);
    if (normTrans && normTrans === normOrig) {
      return { ok: false, reason: 'texto idêntico ao original em inglês' };
    }
  }

  const { words, enCount, ptCount, hasPtDiacritics } = analyzeLexicon(trimmed);
  if (enCount >= 2 && ptCount === 0) {
    return { ok: false, reason: `texto parece estar em inglês (en=${enCount}, pt=${ptCount})` };
  }
  if (enCount >= 3 && enCount >= ptCount) {
    return { ok: false, reason: `excesso de palavras em inglês (en=${enCount}, pt=${ptCount})` };
  }
  if (words.length >= 12 && ptCount === 0 && !hasPtDiacritics) {
    return { ok: false, reason: 'nenhum marcador de português encontrado' };
  }

  // Detecta frases isoladas em inglês dentro de um texto parcialmente traduzido
  const sentences = splitSentences(trimmed);
  for (const sentence of sentences) {
    const stats = analyzeLexicon(sentence);
    if (stats.words.length >= 6 && stats.enCount >= 3 && stats.ptCount === 0) {
      return { ok: false, reason: 'frase inteira permaneceu em inglês' };
    }
  }

  return { ok: true, reason: null };
}

/**
 * Normaliza nomes astrológicos para pt-BR com acentuação correta e limpa espaçamentos.
 */
export function normalizeAstrologyPtBr(text) {
  let out = decodeBasicEntities(String(text ?? ''));

  const capitalizeIfSentenceStart = (replacement, offset, fullText) => {
    const before = fullText.slice(0, offset);
    if (/^\s*$/.test(before) || /[.!?]\s+$/.test(before)) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  };

  // Corrige plurais ingleses frequentemente preservados pela tradução automática
  const pluralReplacements = [
    [/\bLeos\b/gu, 'leoninos'],
    [/\bGeminis\b/giu, 'geminianos'],
    [/\bScorpios\b/giu, 'escorpianos'],
    [/\bCapricorns\b/giu, 'capricornianos'],
    [/\bVirgos\b/giu, 'virginianos'],
    [/\bTaureans?\b/giu, 'taurinos'],
    [/\bArians?\b/giu, 'arianos'],
    [/\bCancerians?\b/giu, 'cancerianos'],
    [/\bSagittarians?\b/giu, 'sagitarianos'],
    [/\bAquarians?\b/giu, 'aquarianos'],
    [/\bPisceans?\b/giu, 'piscianos'],
    [
      /(?<=\b(?:os|Os|para os|alguns|muitos|pelos|dos)\s+)Libras\b|\bLibras(?=\s+(?:podem|costumam|tendem|vão|devem|precisam|estarão|sentem)\b)/gu,
      'librianos',
    ],
  ];

  for (const [regex, replacement] of pluralReplacements) {
    out = out.replace(regex, (...args) => {
      const offset = args[args.length - 2];
      const fullText = args[args.length - 1];
      return capitalizeIfSentenceStart(replacement, offset, fullText);
    });
  }

  // Normaliza nomes dos 12 signos com acentuação pt-BR
  const signReplacements = [
    [/\b[aáAÁ]ries\b/gu, 'Áries'],
    [/\btaurus\b/giu, 'Touro'],
    [/\bTouro\b/gu, 'Touro'],
    [/(?<=\b(?:para|de|em|signo de)\s+)touro\b/giu, 'Touro'],
    [/\bgemini\b/giu, 'Gêmeos'],
    [/\bG[eê]meos\b/gu, 'Gêmeos'],
    [/\bgemeos\b/giu, 'Gêmeos'],
    [/(?<=\b(?:para|de|em|signo de)\s+)gêmeos\b/giu, 'Gêmeos'],
    [/\b[cC][aâ]ncer\b/gu, 'Câncer'],
    [/\bLeo\b/gu, 'Leão'],
    [/\bLe[aã]o\b/gu, 'Leão'],
    [/\bleao\b/giu, 'Leão'],
    [/(?<=\b(?:para|de|em|signo de)\s+)leão\b/giu, 'Leão'],
    [/\bvirgo\b/giu, 'Virgem'],
    [/\bVirgem\b/gu, 'Virgem'],
    [/(?<=\b(?:para|de|em|signo de)\s+)virgem\b/giu, 'Virgem'],
    [/\bLibra\b/gu, 'Libra'],
    [/(?<=\b(?:para|de|em|signo de)\s+)libra\b/giu, 'Libra'],
    [/\bscorpio\b/giu, 'Escorpião'],
    [/\bEscorpi[aã]o\b/gu, 'Escorpião'],
    [/\bescorpiao\b/giu, 'Escorpião'],
    [/(?<=\b(?:para|de|em|signo de)\s+)escorpião\b/giu, 'Escorpião'],
    [/\bsagittarius\b/giu, 'Sagitário'],
    [/\bSagit[aá]rio\b/gu, 'Sagitário'],
    [/\bsagitario\b/giu, 'Sagitário'],
    [/(?<=\b(?:para|de|em|signo de)\s+)sagitário\b/giu, 'Sagitário'],
    [/\bcapricorn\b/giu, 'Capricórnio'],
    [/\bCapric[oó]rnio\b/gu, 'Capricórnio'],
    [/\bcapricornio\b/giu, 'Capricórnio'],
    [/(?<=\b(?:para|de|em|signo de)\s+)capricórnio\b/giu, 'Capricórnio'],
    [/\baquarius\b/giu, 'Aquário'],
    [/\bAqu[aá]rio\b/gu, 'Aquário'],
    [/\baquario\b/giu, 'Aquário'],
    [/(?<=\b(?:para|de|em|signo de)\s+)aquário\b/giu, 'Aquário'],
    [/\bpisces\b/giu, 'Peixes'],
    [/\bPeixes\b/gu, 'Peixes'],
    [/(?<=\b(?:para|de|em|signo de)\s+)peixes\b/giu, 'Peixes'],
  ];

  for (const [regex, canonical] of signReplacements) {
    out = out.replace(regex, canonical);
  }

  // Limpeza de caracteres invisíveis, espaços e pontuação
  out = out
    .replace(/\u200B+/g, ' ')
    .replace(/[\u200C\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[\p{L}])/gu, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return out;
}

async function translateWithGemini(englishText, apiKey) {
  const prompt = [
    'Traduza o texto astrológico abaixo do inglês para português do Brasil (pt-BR).',
    'Requisitos:',
    '- Tom natural, claro, acolhedor e fiel ao sentido original.',
    '- Use os nomes dos signos corretamente acentuados em pt-BR (Áries, Touro, Gêmeos, Câncer, Leão, Virgem, Libra, Escorpião, Sagitário, Capricórnio, Aquário, Peixes).',
    '- Retorne APENAS o texto traduzido em parágrafo contínuo, sem títulos, aspas, marcações Markdown ou comentários extras.',
    '',
    'Texto original:',
    englishText,
  ].join('\n');

  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const payload = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });

      const raw =
        payload?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text ?? '')
          .join('') ?? '';

      const rawValidation = validatePtBrTranslation(raw, englishText);
      if (!rawValidation.ok) {
        throw new Error(`Gemini (${model}) reprovado na validação: ${rawValidation.reason}`);
      }

      const normalized = normalizeAstrologyPtBr(raw);
      const finalValidation = validatePtBrTranslation(normalized, englishText);
      if (!finalValidation.ok) {
        throw new Error(`Gemini (${model}) reprovado após normalização: ${finalValidation.reason}`);
      }

      return normalized;
    } catch (err) {
      lastErr = err;
      if (err?.status !== 404) {
        break;
      }
    }
  }

  throw lastErr ?? new Error('Falha no provedor Gemini');
}

async function translateWithGoogleGtx(englishText) {
  const chunks = splitIntoChunks(englishText, GTX_MAX_CHARS);
  const translatedChunks = [];

  for (const chunk of chunks) {
    const url = `${GTX_ENDPOINT}?client=gtx&sl=en&tl=pt-BR&dt=t&q=${encodeURIComponent(chunk)}`;
    const payload = await fetchWithRetry(url);
    const segments = Array.isArray(payload?.[0]) ? payload[0] : null;
    if (!segments) {
      throw new Error('Google GTX retornou estrutura inesperada');
    }

    const translatedChunk = segments
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim();

    const check = validatePtBrTranslation(translatedChunk, chunk);
    if (!check.ok) {
      throw new Error(`Google GTX reprovado no bloco: ${check.reason}`);
    }

    translatedChunks.push(translatedChunk);
  }

  const normalized = normalizeAstrologyPtBr(translatedChunks.join(' '));
  const finalCheck = validatePtBrTranslation(normalized, englishText);
  if (!finalCheck.ok) {
    throw new Error(`Google GTX reprovado na validação final: ${finalCheck.reason}`);
  }

  return normalized;
}

async function translateWithMyMemory(englishText, email) {
  const chunks = splitIntoChunks(englishText, MYMEMORY_MAX_CHARS);
  const translatedChunks = [];

  for (const chunk of chunks) {
    let url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(chunk)}&langpair=en|pt-BR`;
    if (email) {
      url += `&de=${encodeURIComponent(email)}`;
    }

    const payload = await fetchWithRetry(url);
    if (payload?.quotaFinished === true) {
      throw new Error('MyMemory atingiu o limite diário de cota');
    }
    if (payload?.responseStatus && Number(payload.responseStatus) !== 200) {
      throw new Error(`MyMemory retornou status ${payload.responseStatus}`);
    }

    const details = String(payload?.responseDetails ?? '');
    if (details.toUpperCase().includes('WARNING')) {
      throw new Error(`MyMemory respondeu com aviso: ${details}`);
    }

    const translatedChunk = String(payload?.responseData?.translatedText ?? '').trim();
    const check = validatePtBrTranslation(translatedChunk, chunk);
    if (!check.ok) {
      throw new Error(`MyMemory reprovado no bloco: ${check.reason}`);
    }

    translatedChunks.push(translatedChunk);
  }

  const normalized = normalizeAstrologyPtBr(translatedChunks.join(' '));
  const finalCheck = validatePtBrTranslation(normalized, englishText);
  if (!finalCheck.ok) {
    throw new Error(`MyMemory reprovado na validação final: ${finalCheck.reason}`);
  }

  return normalized;
}

async function translateToPtBr(englishText, { geminiApiKey, myMemoryEmail }) {
  const errors = [];

  if (geminiApiKey) {
    try {
      const text = await translateWithGemini(englishText, geminiApiKey);
      return { text, provider: 'gemini' };
    } catch (err) {
      errors.push(`gemini: ${err.message}`);
    }
  }

  try {
    const text = await translateWithGoogleGtx(englishText);
    return { text, provider: 'google-gtx' };
  } catch (err) {
    errors.push(`google-gtx: ${err.message}`);
  }

  try {
    const text = await translateWithMyMemory(englishText, myMemoryEmail);
    return { text, provider: 'mymemory' };
  } catch (err) {
    errors.push(`mymemory: ${err.message}`);
  }

  throw new Error(`Todos os provedores de tradução falharam (${errors.join(' | ')})`);
}

async function fetchSourceHoroscope(signId, period) {
  const url = `${SOURCE_BASE_URL}/${period}?sign=${signId}`;
  const payload = await fetchWithRetry(url);
  const data = payload?.data;
  const date = typeof data?.date === 'string' ? data.date.trim() : '';
  const horoscope = typeof data?.horoscope === 'string' ? data.horoscope.trim() : '';

  if (!date || !horoscope) {
    throw new Error(`Resposta incompleta da API para ${signId}/${period}`);
  }

  return { date, horoscope };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  const count = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: count }, () => runWorker()));
  return results;
}

async function readPreviousJson(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.signs && typeof parsed.signs === 'object') {
      return parsed;
    }
  } catch {
    // Arquivo inexistente ou corrompido — segue sem reaproveitamento
  }
  return null;
}

function pickMostFrequentDate(values, pattern, fallback) {
  const counts = new Map();
  for (const val of values) {
    if (typeof val === 'string' && pattern.test(val)) {
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }
  }
  let best = fallback;
  let bestCount = 0;
  for (const [val, count] of counts.entries()) {
    if (count > bestCount) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

function resolveOverallProvider(usedProviders, reusedCount, previousProvider) {
  const validPrev = VALID_PROVIDERS.has(previousProvider) ? previousProvider : null;

  if (usedProviders.size === 0) {
    return validPrev ?? 'google-gtx';
  }

  if (usedProviders.size === 1) {
    const [onlyProvider] = usedProviders;
    if (reusedCount > 0 && validPrev && validPrev !== onlyProvider) {
      return 'mixed';
    }
    return onlyProvider;
  }

  return 'mixed';
}

function validateOutputStructure(output) {
  if (!output || typeof output !== 'object') {
    throw new Error('Estrutura JSON final inválida');
  }
  for (const signId of SIGNS) {
    const signData = output.signs?.[signId];
    if (!signData) {
      throw new Error(`Signo ausente no JSON final: ${signId}`);
    }
    for (const period of PERIODS) {
      const entry = signData[period];
      if (!entry || typeof entry.date !== 'string' || !entry.date.trim()) {
        throw new Error(`Campo date inválido em ${signId}.${period}`);
      }
      const check = validatePtBrTranslation(entry.text);
      if (!check.ok) {
        throw new Error(`Texto inválido em ${signId}.${period}: ${check.reason}`);
      }
    }
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const myMemoryEmail = process.env.MYMEMORY_EMAIL?.trim() || '';

  const previous = await readPreviousJson(DATA_PATH);
  const previousProvider = previous?.translation?.provider ?? null;

  const tasks = [];
  for (const signId of SIGNS) {
    for (const period of PERIODS) {
      tasks.push({ signId, period });
    }
  }

  const usedProviders = new Set();
  let reusedCount = 0;
  let translatedCount = 0;
  let fallbackCount = 0;

  const signsMap = Object.fromEntries(SIGNS.map((signId) => [signId, {}]));

  const outcomes = await runWithConcurrency(tasks, CONCURRENCY, async ({ signId, period }) => {
    const prevEntry = previous?.signs?.[signId]?.[period];

    try {
      const { date, horoscope } = await fetchSourceHoroscope(signId, period);

      if (
        !force &&
        prevEntry &&
        prevEntry.date === date &&
        typeof prevEntry.text === 'string'
      ) {
        const prevNormalized = normalizeAstrologyPtBr(prevEntry.text);
        const prevCheck = validatePtBrTranslation(prevNormalized, horoscope);
        if (prevCheck.ok) {
          reusedCount += 1;
          return {
            signId,
            period,
            entry: { date, text: prevNormalized },
            ok: true,
          };
        }
      }

      const { text, provider } = await translateToPtBr(horoscope, {
        geminiApiKey,
        myMemoryEmail,
      });

      usedProviders.add(provider);
      translatedCount += 1;
      return {
        signId,
        period,
        entry: { date, text },
        ok: true,
      };
    } catch (err) {
      if (prevEntry && typeof prevEntry.date === 'string' && typeof prevEntry.text === 'string') {
        const prevNormalized = normalizeAstrologyPtBr(prevEntry.text);
        const prevCheck = validatePtBrTranslation(prevNormalized);
        if (prevCheck.ok) {
          fallbackCount += 1;
          console.warn(
            `[fallback] Reaproveitando previsão anterior para ${signId}/${period}: ${err.message}`,
          );
          return {
            signId,
            period,
            entry: { date: prevEntry.date, text: prevNormalized },
            ok: true,
          };
        }
      }

      console.error(`[erro] Falha definitiva em ${signId}/${period}: ${err.message}`);
      return {
        signId,
        period,
        ok: false,
        error: err.message,
      };
    }
  });

  const failures = outcomes.filter((item) => !item.ok);
  if (failures.length > 0) {
    throw new Error(
      `Pipeline abortado: ${failures.length} de ${tasks.length} entradas falharam sem fallback.`,
    );
  }

  for (const outcome of outcomes) {
    signsMap[outcome.signId][outcome.period] = outcome.entry;
  }

  const todayUTC = new Date().toISOString().slice(0, 10);
  const dailyDates = SIGNS.map((s) => signsMap[s].daily.date);
  const weeklyDates = SIGNS.map((s) => signsMap[s].weekly.date);
  const monthlyDates = SIGNS.map((s) => signsMap[s].monthly.date);

  const resolvedDate = pickMostFrequentDate(dailyDates, /^\d{4}-\d{2}-\d{2}$/, todayUTC);
  const resolvedWeekOf = pickMostFrequentDate(weeklyDates, /^\d{4}-\d{2}-\d{2}$/, resolvedDate);
  const resolvedMonth = pickMostFrequentDate(
    monthlyDates,
    /^\d{4}-\d{2}$/,
    resolvedDate.slice(0, 7),
  );

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    date: resolvedDate,
    weekOf: resolvedWeekOf,
    month: resolvedMonth,
    source: SOURCE_HOST,
    translation: {
      provider: resolveOverallProvider(usedProviders, reusedCount, previousProvider),
      lang: 'pt-BR',
    },
    signs: signsMap,
  };

  validateOutputStructure(output);

  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  const tmpPath = `${DATA_PATH}.tmp`;
  const serialized = `${JSON.stringify(output, null, 2)}\n`;

  try {
    await writeFile(tmpPath, serialized, 'utf8');
    const verified = JSON.parse(await readFile(tmpPath, 'utf8'));
    validateOutputStructure(verified);
    await rename(tmpPath, DATA_PATH);
  } catch (err) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }

  console.log(
    `[ok] horoscopo.json atualizado (${translatedCount} traduzidos, ${reusedCount} reaproveitados, ${fallbackCount} fallback) | provider=${output.translation.provider} | date=${output.date} | weekOf=${output.weekOf} | month=${output.month}`,
  );
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  main().catch((err) => {
    console.error(`[fatal] ${err.message}`);
    process.exit(1);
  });
}
