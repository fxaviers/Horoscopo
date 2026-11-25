/**
 * Cliente de previsoes astrologicas com fluxo blindado:
 * Opcao B (./data/horoscopo.json) -> Opcao C (freehoroscopeapi + MyMemory) -> Cache offline.
 */

import { getSignById } from './zodiac.js';
import { getCachedHoroscope, saveCachedHoroscope } from './storage.js';
import { isValidPtBrTranslation, normalizeAstrologyPtBr, translateEnToPtBr } from './translator.js';

const LIVE_API_BASE = 'https://freehoroscopeapi.com/api/v1/get-horoscope';
const REQUEST_TIMEOUT_MS = 12000;
const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly']);

const preloadedJsonCache = new Map();

/**
 * Retorna a data no fuso horario local no formato 'YYYY-MM-DD' (nunca UTC).
 * @param {Date | number | string} [date]
 * @returns {string}
 */
export function getLocalDateISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalWeekBoundsISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday + 6);
  return {
    mondayISO: getLocalDateISO(monday),
    sundayISO: getLocalDateISO(sunday),
  };
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function isEntryCurrent(entryDate, period, todayISO, weekBounds) {
  if (typeof entryDate !== 'string' || !entryDate.trim()) return false;
  const clean = entryDate.trim();
  if (period === 'daily') {
    return clean === todayISO;
  }
  if (period === 'weekly') {
    return clean >= weekBounds.mondayISO && clean <= weekBounds.sundayISO;
  }
  if (period === 'monthly') {
    return clean.slice(0, 7) === todayISO.slice(0, 7);
  }
  return false;
}

function defaultPeriodDate(period, todayISO, weekBounds) {
  if (period === 'weekly') return weekBounds.mondayISO;
  if (period === 'monthly') return todayISO.slice(0, 7);
  return todayISO;
}

function createAbortError() {
  const err = new Error('Operacao cancelada');
  err.name = 'AbortError';
  return err;
}

async function fetchJsonWithTimeout(url, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}

async function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) throw createAbortError();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

async function loadPreloadedHoroscopes(todayISO, signal) {
  if (signal?.aborted) throw createAbortError();

  if (!preloadedJsonCache.has(todayISO)) {
    const promise = (async () => {
      try {
        const data = await fetchJsonWithTimeout(`./data/horoscopo.json?d=${todayISO}`, null);
        if (data && typeof data === 'object' && data.signs) {
          return data;
        }
        return null;
      } catch {
        return null;
      }
    })();
    preloadedJsonCache.set(todayISO, promise);
    promise.then((resolved) => {
      if (!resolved && preloadedJsonCache.get(todayISO) === promise) {
        preloadedJsonCache.delete(todayISO);
      }
    });
  }

  return raceWithAbort(preloadedJsonCache.get(todayISO), signal);
}

function pickFresherFallback(cachedEntry, preloadedEntry) {
  const validCached =
    cachedEntry && isValidPtBrTranslation(cachedEntry.text)
      ? {
          date: String(cachedEntry.date || ''),
          text: normalizeAstrologyPtBr(cachedEntry.text),
        }
      : null;

  const validPreloaded =
    preloadedEntry && isValidPtBrTranslation(preloadedEntry.text)
      ? {
          date: String(preloadedEntry.date || ''),
          text: normalizeAstrologyPtBr(preloadedEntry.text),
        }
      : null;

  if (validCached && validPreloaded) {
    if (validPreloaded.date && (!validCached.date || validPreloaded.date > validCached.date)) {
      return validPreloaded;
    }
    return validCached;
  }
  return validCached || validPreloaded || null;
}

/**
 * Busca o horoscopo de um signo e periodo seguindo:
 * 1) JSON pre-carregado (./data/horoscopo.json) se atual
 * 2) Cache local se ja traduzido para o periodo corrente
 * 3) API ao vivo + traducao pt-BR (MyMemory)
 * 4) Fallback seguro para o ultimo cache salvo ou pre-carregado
 *
 * @param {string} signId
 * @param {'daily' | 'weekly' | 'monthly'} period
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ signId: string, period: 'daily'|'weekly'|'monthly', date: string, text: string, status: 'fresh'|'live-fallback'|'cached', notice: string | null }>}
 */
export async function fetchHoroscope(signId, period = 'daily', { signal } = {}) {
  const sign = getSignById(signId);
  const safeSignId = sign ? sign.id : 'aries';
  const safePeriod = VALID_PERIODS.has(period) ? period : 'daily';

  const now = new Date();
  const todayISO = getLocalDateISO(now);
  const weekBounds = getLocalWeekBoundsISO(now);

  if (signal?.aborted) throw createAbortError();

  // 1) Tenta ./data/horoscopo.json (Opcao B)
  const preloadedJson = await loadPreloadedHoroscopes(todayISO, signal);
  const preloadedEntry = preloadedJson?.signs?.[safeSignId]?.[safePeriod] || null;
  const preloadedDate =
    preloadedEntry?.date ||
    (safePeriod === 'daily'
      ? preloadedJson?.date
      : safePeriod === 'weekly'
        ? preloadedJson?.weekOf
        : preloadedJson?.month) ||
    '';

  if (
    preloadedEntry &&
    isValidPtBrTranslation(preloadedEntry.text) &&
    isEntryCurrent(preloadedDate, safePeriod, todayISO, weekBounds)
  ) {
    const cleanText = normalizeAstrologyPtBr(preloadedEntry.text);
    const entryDate = String(preloadedDate);
    saveCachedHoroscope(safeSignId, safePeriod, {
      date: entryDate,
      text: cleanText,
      savedAt: Date.now(),
    });
    return {
      signId: safeSignId,
      period: safePeriod,
      date: entryDate,
      text: cleanText,
      status: 'fresh',
      notice: null,
    };
  }

  // 2) Verifica cache local para hoje / semana / mes corrente
  const localCached = getCachedHoroscope(safeSignId, safePeriod);
  if (
    localCached &&
    isValidPtBrTranslation(localCached.text) &&
    isEntryCurrent(localCached.date, safePeriod, todayISO, weekBounds)
  ) {
    return {
      signId: safeSignId,
      period: safePeriod,
      date: String(localCached.date),
      text: normalizeAstrologyPtBr(localCached.text),
      status: 'live-fallback',
      notice: null,
    };
  }

  // 3) Se estiver desatualizado e online, busca ao vivo e traduz (Opcao C)
  if (isOnline()) {
    try {
      const apiUrl = `${LIVE_API_BASE}/${safePeriod}?sign=${encodeURIComponent(safeSignId)}`;
      const payload = await fetchJsonWithTimeout(apiUrl, signal);
      const originalText = payload?.data?.horoscope;
      if (typeof originalText === 'string' && originalText.trim()) {
        const translated = await translateEnToPtBr(originalText, { signal });
        const apiDate =
          typeof payload?.data?.date === 'string' && payload.data.date.trim()
            ? payload.data.date.trim()
            : defaultPeriodDate(safePeriod, todayISO, weekBounds);

        saveCachedHoroscope(safeSignId, safePeriod, {
          date: apiDate,
          text: translated,
          savedAt: Date.now(),
        });

        return {
          signId: safeSignId,
          period: safePeriod,
          date: apiDate,
          text: translated,
          status: 'live-fallback',
          notice: null,
        };
      }
    } catch (err) {
      if (signal?.aborted) throw createAbortError();
    }
  }

  // 4) Fallback offline / erro: ultimo cache salvo ou ultimo pre-carregado
  const fallback = pickFresherFallback(
    localCached,
    preloadedEntry ? { date: preloadedDate, text: preloadedEntry.text } : null
  );

  if (fallback) {
    const notice = isOnline()
      ? 'Não foi possível atualizar agora — mostrando a última previsão salva.'
      : 'Sem internet no momento — mostrando a última previsão salva.';
    return {
      signId: safeSignId,
      period: safePeriod,
      date: fallback.date || defaultPeriodDate(safePeriod, todayISO, weekBounds),
      text: fallback.text,
      status: 'cached',
      notice,
    };
  }

  return {
    signId: safeSignId,
    period: safePeriod,
    date: defaultPeriodDate(safePeriod, todayISO, weekBounds),
    text: 'No momento não foi possível carregar a previsão. Quando a conexão voltar, tente abrir novamente em alguns instantes.',
    status: 'cached',
    notice: isOnline()
      ? 'Não foi possível carregar a previsão agora.'
      : 'Sem internet no momento — conecte-se para baixar a previsão.',
  };
}

/**
 * Pre-aquece silenciosamente os 3 periodos em segundo plano sem travar a interface.
 * @param {string} signId
 * @returns {Promise<void>}
 */
export async function prefetchAllPeriods(signId) {
  const sign = getSignById(signId);
  if (!sign) return;
  for (const period of ['daily', 'weekly', 'monthly']) {
    try {
      await fetchHoroscope(sign.id, period);
    } catch {
      // Silencioso em segundo plano
    }
  }
}
