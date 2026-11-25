/**
 * Persistencia local segura (localStorage) com prefixo `horoscopo_v1_`.
 * Todos os acessos usam try/catch para funcionar em modo privado ou sem armazenamento.
 */

const PREFIX = 'horoscopo_v1_';

const KEYS = {
  sign: `${PREFIX}sign`,
  period: `${PREFIX}period`,
  fontLevel: `${PREFIX}font_level`,
  colorScheme: `${PREFIX}color_scheme`,
  seenPeriods: `${PREFIX}seen_periods`,
};

const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly']);

function getStorage() {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function readRaw(key) {
  const store = getStorage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  const store = getStorage();
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key) {
  const store = getStorage();
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getSavedSign() {
  const val = readRaw(KEYS.sign);
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

export function saveSign(signId) {
  if (typeof signId === 'string' && signId.trim()) {
    writeRaw(KEYS.sign, signId.trim().toLowerCase());
  } else {
    removeRaw(KEYS.sign);
  }
}

export function getSavedPeriod() {
  const val = readRaw(KEYS.period);
  return val && VALID_PERIODS.has(val) ? val : 'daily';
}

export function savePeriod(period) {
  if (VALID_PERIODS.has(period)) {
    writeRaw(KEYS.period, period);
  }
}

export function getFontLevel() {
  const raw = readRaw(KEYS.fontLevel);
  if (raw === null) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 1;
}

export function saveFontLevel(level) {
  const n = Number(level);
  if (Number.isInteger(n) && n >= 0 && n <= 3) {
    writeRaw(KEYS.fontLevel, String(n));
  }
}

export function getSeenPeriods(signId) {
  if (!signId) return { weekly: null, monthly: null };
  const raw = readRaw(KEYS.seenPeriods);
  if (!raw) return { weekly: null, monthly: null };
  try {
    const map = JSON.parse(raw);
    const entry = map && typeof map === 'object' ? map[signId] : null;
    return {
      weekly: typeof entry?.weekly === 'string' ? entry.weekly : null,
      monthly: typeof entry?.monthly === 'string' ? entry.monthly : null,
    };
  } catch {
    return { weekly: null, monthly: null };
  }
}

export function saveSeenPeriod(signId, period, signature) {
  if (!signId || (period !== 'weekly' && period !== 'monthly') || typeof signature !== 'string' || !signature) {
    return;
  }
  let map = {};
  try {
    const existing = readRaw(KEYS.seenPeriods);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        map = parsed;
      }
    }
  } catch {
    map = {};
  }

  const prev = map[signId] && typeof map[signId] === 'object' ? map[signId] : {};
  map[signId] = { ...prev, [period]: signature };

  try {
    writeRaw(KEYS.seenPeriods, JSON.stringify(map));
  } catch {
    // Ignora erro de cota
  }
}

/**
 * Retorna a preferencia explicita de tema ('light' | 'dark') ou null para seguir o sistema.
 * Usa exatamente a chave `horoscopo_v1_color_scheme` alinhada com o script inline do index.html.
 * @returns {'light' | 'dark' | null}
 */
export function getColorSchemeOverride() {
  const val = readRaw(KEYS.colorScheme);
  return val === 'light' || val === 'dark' ? val : null;
}

/**
 * Salva 'light' ou 'dark' em `horoscopo_v1_color_scheme`, ou remove a chave quando null.
 * @param {'light' | 'dark' | null} scheme
 */
export function saveColorSchemeOverride(scheme) {
  if (scheme === 'light' || scheme === 'dark') {
    writeRaw(KEYS.colorScheme, scheme);
  } else {
    removeRaw(KEYS.colorScheme);
  }
}

export function getCachedHoroscope(signId, period) {
  if (!signId || !VALID_PERIODS.has(period)) return null;
  const raw = readRaw(`${PREFIX}horoscope_${signId}_${period}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.text !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedHoroscope(signId, period, entry) {
  if (!signId || !VALID_PERIODS.has(period) || !entry || typeof entry.text !== 'string') return;
  try {
    writeRaw(`${PREFIX}horoscope_${signId}_${period}`, JSON.stringify(entry));
  } catch {
    // Ignora falhas de serializacao ou cota
  }
}

export function getCachedAstro(cityId, dateISO) {
  if (!cityId || !dateISO) return null;
  const raw = readRaw(`${PREFIX}astro_${cityId}`);
  if (!raw) return null;
  try {
    const map = JSON.parse(raw);
    if (map && typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, dateISO)) {
      return map[dateISO] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCachedAstro(cityId, dateISO, data) {
  if (!cityId || !dateISO || !data) return;
  const key = `${PREFIX}astro_${cityId}`;
  let map = {};
  try {
    const existing = readRaw(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        map = parsed;
      }
    }
  } catch {
    map = {};
  }

  map[dateISO] = data;

  // Mantem no maximo as 3 datas mais recentes para evitar crescimento indefinido no localStorage
  const dates = Object.keys(map).sort();
  while (dates.length > 3) {
    const oldest = dates.shift();
    if (oldest) delete map[oldest];
  }

  try {
    writeRaw(key, JSON.stringify(map));
  } catch {
    // Ignora erro de cota
  }
}
