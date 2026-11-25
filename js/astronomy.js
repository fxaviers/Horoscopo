/**
 * Calculos astronomicos da Lua (Jean Meeus, Cap. 49) e do Sol (NOAA),
 * alem de integracao ao vivo com cache por cidade/data.
 * Modulos ES puros, zero dependencias externas.
 */

import { getCachedAstro, saveCachedAstro } from './storage.js';

const TIMES_API_BASE = 'https://freehoroscopeapi.com/api/v1/times';
const REQUEST_TIMEOUT_MS = 10000;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MS_PER_DAY = 86400000;
const SYNODIC_MONTH_DAYS = 29.530588861;
const DELTA_T_DAYS = 69.2 / 86400; // Aproximacao moderna de TD - UT (~69.2s)

/** @type {{id: string, name: string, state: string, lat: number, lng: number, tz: string}} */
export const FIXED_LOCATION = {
  id: 'sao-joaquim-da-barra',
  name: 'São Joaquim da Barra',
  state: 'SP',
  lat: -20.5808,
  lng: -47.855,
  tz: 'America/Sao_Paulo',
};

const PHASE_KEYS = ['new', 'first-quarter', 'full', 'last-quarter'];
const MAIN_PHASE_NAMES = {
  new: 'Lua Nova',
  'first-quarter': 'Quarto Crescente',
  full: 'Lua Cheia',
  'last-quarter': 'Quarto Minguante',
};

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function dateToJulianDay(date) {
  return date.getTime() / MS_PER_DAY + 2440587.5;
}

function julianDayToDate(jd) {
  return new Date(Math.round((jd - 2440587.5) * MS_PER_DAY));
}

function sinDeg(deg) {
  return Math.sin(deg * DEG_TO_RAD);
}

function cosDeg(deg) {
  return Math.cos(deg * DEG_TO_RAD);
}

function tanDeg(deg) {
  return Math.tan(deg * DEG_TO_RAD);
}

/**
 * Calcula o instante exato (Date UTC) de uma das 4 fases principais da Lua
 * usando o algoritmo de Jean Meeus (Astronomical Algorithms, Cap. 49).
 * @param {number} k numero de lunacao (inteiro + 0, 0.25, 0.5 ou 0.75)
 * @returns {Date}
 */
function computeMeeusMoonPhase(k) {
  const quarterStep = Math.round(k * 4);
  const phaseIndex = ((quarterStep % 4) + 4) % 4;
  const kExact = quarterStep / 4;
  const T = kExact / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  let jde =
    2451550.09766 +
    SYNODIC_MONTH_DAYS * kExact +
    0.00015437 * T2 -
    0.00000015 * T3 +
    0.00000000073 * T4;

  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const E2 = E * E;

  const M = 2.5534 + 29.1053567 * kExact - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * kExact + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * kExact - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const Omega = 124.7746 - 1.56375588 * kExact + 0.0020672 * T2 + 0.00000215 * T3;

  if (phaseIndex === 0) {
    // Lua Nova
    jde +=
      -0.4072 * sinDeg(Mp) +
      0.17241 * E * sinDeg(M) +
      0.01608 * sinDeg(2 * Mp) +
      0.01039 * sinDeg(2 * F) +
      0.00739 * E * sinDeg(Mp - M) -
      0.00514 * E * sinDeg(Mp + M) +
      0.00208 * E2 * sinDeg(2 * M) -
      0.00111 * sinDeg(Mp - 2 * F) -
      0.00057 * sinDeg(Mp + 2 * F) +
      0.00056 * E * sinDeg(2 * Mp + M) -
      0.00042 * sinDeg(3 * Mp) +
      0.00042 * E * sinDeg(M + 2 * F) +
      0.00038 * E * sinDeg(M - 2 * F) -
      0.00024 * E * sinDeg(2 * Mp - M) -
      0.00017 * sinDeg(Omega) -
      0.00007 * sinDeg(Mp + 2 * M) +
      0.00004 * sinDeg(2 * Mp - 2 * F) +
      0.00004 * sinDeg(3 * M) +
      0.00003 * sinDeg(Mp + M - 2 * F) +
      0.00003 * sinDeg(2 * Mp + 2 * F) -
      0.00003 * sinDeg(Mp + M + 2 * F) +
      0.00003 * sinDeg(Mp - M + 2 * F) -
      0.00002 * sinDeg(Mp - M - 2 * F) -
      0.00002 * sinDeg(3 * Mp + M) +
      0.00002 * sinDeg(4 * Mp);
  } else if (phaseIndex === 2) {
    // Lua Cheia
    jde +=
      -0.40614 * sinDeg(Mp) +
      0.17302 * E * sinDeg(M) +
      0.01614 * sinDeg(2 * Mp) +
      0.01043 * sinDeg(2 * F) +
      0.00734 * E * sinDeg(Mp - M) -
      0.00515 * E * sinDeg(Mp + M) +
      0.00209 * E2 * sinDeg(2 * M) -
      0.00111 * sinDeg(Mp - 2 * F) -
      0.00057 * sinDeg(Mp + 2 * F) +
      0.00056 * E * sinDeg(2 * Mp + M) -
      0.00042 * sinDeg(3 * Mp) +
      0.00042 * E * sinDeg(M + 2 * F) +
      0.00038 * E * sinDeg(M - 2 * F) -
      0.00024 * E * sinDeg(2 * Mp - M) -
      0.00017 * sinDeg(Omega) -
      0.00007 * sinDeg(Mp + 2 * M) +
      0.00004 * sinDeg(2 * Mp - 2 * F) +
      0.00004 * sinDeg(3 * M) +
      0.00003 * sinDeg(Mp + M - 2 * F) +
      0.00003 * sinDeg(2 * Mp + 2 * F) -
      0.00003 * sinDeg(Mp + M + 2 * F) +
      0.00003 * sinDeg(Mp - M + 2 * F) -
      0.00002 * sinDeg(Mp - M - 2 * F) -
      0.00002 * sinDeg(3 * Mp + M) +
      0.00002 * sinDeg(4 * Mp);
  } else {
    // Quarto Crescente (1) ou Quarto Minguante (3)
    jde +=
      -0.62801 * sinDeg(Mp) +
      0.17172 * E * sinDeg(M) -
      0.01183 * E * sinDeg(Mp + M) +
      0.00862 * sinDeg(2 * Mp) +
      0.00804 * sinDeg(2 * F) +
      0.00454 * E * sinDeg(Mp - M) +
      0.00204 * E2 * sinDeg(2 * M) -
      0.0018 * sinDeg(Mp - 2 * F) -
      0.0007 * sinDeg(Mp + 2 * F) -
      0.0004 * sinDeg(3 * Mp) -
      0.00034 * E * sinDeg(2 * Mp - M) +
      0.00032 * E * sinDeg(M + 2 * F) +
      0.00032 * E * sinDeg(M - 2 * F) -
      0.00028 * E2 * sinDeg(Mp + 2 * M) +
      0.00027 * E * sinDeg(2 * Mp + M) -
      0.00017 * sinDeg(Omega) -
      0.00005 * sinDeg(Mp - M - 2 * F) +
      0.00004 * sinDeg(2 * Mp + 2 * F) -
      0.00004 * sinDeg(Mp + M + 2 * F) +
      0.00004 * sinDeg(Mp - 2 * M) +
      0.00003 * sinDeg(Mp + M - 2 * F) +
      0.00003 * sinDeg(3 * M) +
      0.00002 * sinDeg(2 * Mp - 2 * F) +
      0.00002 * sinDeg(Mp - M + 2 * F) -
      0.00002 * sinDeg(3 * Mp + M);

    const W =
      0.00306 -
      0.00038 * E * cosDeg(M) +
      0.00026 * cosDeg(Mp) -
      0.00002 * cosDeg(Mp - M) +
      0.00002 * cosDeg(Mp + M) +
      0.00002 * cosDeg(2 * F);
    jde += phaseIndex === 1 ? W : -W;
  }

  // Correcoes planetarias comuns A1..A14
  const A1 = 299.77 + 0.107408 * kExact - 0.009173 * T2;
  const A2 = 251.88 + 0.016321 * kExact;
  const A3 = 251.83 + 26.651886 * kExact;
  const A4 = 349.42 + 36.412478 * kExact;
  const A5 = 84.66 + 18.206239 * kExact;
  const A6 = 141.74 + 53.303771 * kExact;
  const A7 = 207.14 + 2.453732 * kExact;
  const A8 = 154.84 + 7.30686 * kExact;
  const A9 = 34.52 + 27.261239 * kExact;
  const A10 = 207.19 + 0.121824 * kExact;
  const A11 = 291.34 + 1.844379 * kExact;
  const A12 = 161.72 + 24.198154 * kExact;
  const A13 = 239.56 + 25.513099 * kExact;
  const A14 = 331.55 + 3.592518 * kExact;

  jde +=
    0.000325 * sinDeg(A1) +
    0.000165 * sinDeg(A2) +
    0.000164 * sinDeg(A3) +
    0.000126 * sinDeg(A4) +
    0.00011 * sinDeg(A5) +
    0.000062 * sinDeg(A6) +
    0.00006 * sinDeg(A7) +
    0.000056 * sinDeg(A8) +
    0.000047 * sinDeg(A9) +
    0.000042 * sinDeg(A10) +
    0.00004 * sinDeg(A11) +
    0.000037 * sinDeg(A12) +
    0.000035 * sinDeg(A13) +
    0.000023 * sinDeg(A14);

  return julianDayToDate(jde - DELTA_T_DAYS);
}

/**
 * Encontra os 5 instantes principais de Meeus (prevNew .. nextNew) que cercam `date`.
 * @param {Date} date
 */
function getBracketingLunation(date) {
  const jd = dateToJulianDay(date);
  let lunation = Math.floor((jd - 2451550.09766) / SYNODIC_MONTH_DAYS);
  const t = date.getTime();

  // Garante prevNew <= t < nextNew mesmo proximo da fronteira
  let prevNew = computeMeeusMoonPhase(lunation);
  while (prevNew.getTime() > t) {
    lunation -= 1;
    prevNew = computeMeeusMoonPhase(lunation);
  }
  let nextNew = computeMeeusMoonPhase(lunation + 1);
  while (nextNew.getTime() <= t) {
    lunation += 1;
    prevNew = nextNew;
    nextNew = computeMeeusMoonPhase(lunation + 1);
  }

  return {
    lunation,
    instants: [
      prevNew,
      computeMeeusMoonPhase(lunation + 0.25),
      computeMeeusMoonPhase(lunation + 0.5),
      computeMeeusMoonPhase(lunation + 0.75),
      nextNew,
    ],
  };
}

function classifyMoonPhase(phaseFraction) {
  if (phaseFraction < 0.035 || phaseFraction >= 0.965) {
    return { phaseKey: 'new', namePt: 'Lua Nova', detailPt: 'Lua Nova' };
  }
  if (phaseFraction < 0.215) {
    return { phaseKey: 'first-quarter', namePt: 'Lua Crescente', detailPt: 'Crescente inicial' };
  }
  if (phaseFraction < 0.285) {
    return { phaseKey: 'first-quarter', namePt: 'Quarto Crescente', detailPt: 'Quarto Crescente' };
  }
  if (phaseFraction < 0.455) {
    return { phaseKey: 'first-quarter', namePt: 'Lua Crescente', detailPt: 'Crescente gibosa' };
  }
  if (phaseFraction <= 0.545) {
    return { phaseKey: 'full', namePt: 'Lua Cheia', detailPt: 'Lua Cheia' };
  }
  if (phaseFraction < 0.715) {
    return { phaseKey: 'last-quarter', namePt: 'Lua Minguante', detailPt: 'Minguante gibosa' };
  }
  if (phaseFraction <= 0.785) {
    return { phaseKey: 'last-quarter', namePt: 'Quarto Minguante', detailPt: 'Quarto Minguante' };
  }
  return { phaseKey: 'last-quarter', namePt: 'Lua Minguante', detailPt: 'Minguante final' };
}

/**
 * Calcula a fase atual da Lua usando os instantes exatos de Jean Meeus (Cap. 49).
 * @param {Date | number | string} [date]
 * @returns {{ phaseKey: 'new'|'first-quarter'|'full'|'last-quarter', namePt: string, detailPt: string, illuminationPct: number, phaseFraction: number, isWaxing: boolean, ageDays: number }}
 */
export function getCurrentMoonPhase(date = new Date()) {
  const d = toDate(date);
  const t = d.getTime();
  const { instants } = getBracketingLunation(d);
  const [prevNew, firstQ, full, lastQ, nextNew] = instants;

  const milestones = [
    { time: prevNew.getTime(), frac: 0 },
    { time: firstQ.getTime(), frac: 0.25 },
    { time: full.getTime(), frac: 0.5 },
    { time: lastQ.getTime(), frac: 0.75 },
    { time: nextNew.getTime(), frac: 1 },
  ];

  let phaseFraction = 0;
  for (let i = 0; i < 4; i += 1) {
    const start = milestones[i];
    const end = milestones[i + 1];
    if (t >= start.time && t <= end.time) {
      const span = end.time - start.time;
      phaseFraction = span > 0 ? start.frac + ((t - start.time) / span) * 0.25 : start.frac;
      break;
    }
  }

  phaseFraction = ((phaseFraction % 1) + 1) % 1;
  const ageDays = Math.round(((t - prevNew.getTime()) / MS_PER_DAY) * 10) / 10;
  const illuminationPct = Math.round(((1 - Math.cos(2 * Math.PI * phaseFraction)) / 2) * 100);
  const isWaxing = phaseFraction < 0.5;
  const { phaseKey, namePt, detailPt } = classifyMoonPhase(phaseFraction);

  return {
    phaseKey,
    namePt,
    detailPt,
    illuminationPct,
    phaseFraction,
    isWaxing,
    ageDays,
  };
}

function getDatePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: map.hour,
    minute: map.minute,
  };
}

function formatDateISOInTimeZone(date, timeZone) {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTimePtInTimeZone(date, timeZone) {
  const { hour, minute } = getDatePartsInTimeZone(date, timeZone);
  return `${hour}h${minute}`;
}

function formatDatePtInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function calendarDaysBetween(fromDate, toDateTarget, timeZone) {
  const a = getDatePartsInTimeZone(fromDate, timeZone);
  const b = getDatePartsInTimeZone(toDateTarget, timeZone);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / MS_PER_DAY);
}

/**
 * Calcula a proxima mudanca principal da Lua (Nova, Quarto Crescente, Cheia ou Quarto Minguante)
 * estritamente apos `date` usando Jean Meeus (Cap. 49).
 * @param {Date | number | string} [date]
 * @param {string} [timeZone]
 * @returns {{ phaseKey: 'new'|'first-quarter'|'full'|'last-quarter', namePt: string, instant: Date, datePt: string, timePt: string, daysUntil: number, relativePt: string }}
 */
export function getNextMoonChange(date = new Date(), timeZone = FIXED_LOCATION.tz) {
  const d = toDate(date);
  const t = d.getTime();
  const jd = dateToJulianDay(d);
  let quarterIdx = Math.floor(((jd - 2451550.09766) / SYNODIC_MONTH_DAYS) * 4);

  let candidate = computeMeeusMoonPhase(quarterIdx / 4);
  while (candidate.getTime() <= t) {
    quarterIdx += 1;
    candidate = computeMeeusMoonPhase(quarterIdx / 4);
  }

  const phaseIndex = ((quarterIdx % 4) + 4) % 4;
  const phaseKey = PHASE_KEYS[phaseIndex];
  const namePt = MAIN_PHASE_NAMES[phaseKey];
  const datePt = formatDatePtInTimeZone(candidate, timeZone);
  const timePt = formatTimePtInTimeZone(candidate, timeZone);
  const daysUntil = Math.max(0, calendarDaysBetween(d, candidate, timeZone));

  let relativePt;
  if (daysUntil === 0) relativePt = 'Hoje';
  else if (daysUntil === 1) relativePt = 'Amanhã';
  else relativePt = `Em ${daysUntil} dias`;

  return {
    phaseKey,
    namePt,
    instant: candidate,
    datePt,
    timePt,
    daysUntil,
    relativePt,
  };
}

/**
 * Parametros solares da NOAA para um Dia Juliano.
 * @param {number} jd
 */
function calcNoaaSolarParams(jd) {
  const t = (jd - 2451545.0) / 36525.0;
  const L0 = (((280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360) + 360) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const C =
    sinDeg(M) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sinDeg(2 * M) * (0.019993 - 0.000101 * t) +
    sinDeg(3 * M) * 0.000289;

  const trueLon = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLon - 0.00569 - 0.00478 * sinDeg(omega);

  const meanObliq =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * cosDeg(omega);

  const sinDecl = sinDeg(obliqCorr) * sinDeg(lambda);
  const declRad = Math.asin(Math.max(-1, Math.min(1, sinDecl)));

  const y = Math.pow(Math.tan((obliqCorr / 2) * DEG_TO_RAD), 2);
  const eqTime =
    4 *
    RAD_TO_DEG *
    (y * sinDeg(2 * L0) -
      2 * e * sinDeg(M) +
      4 * e * y * sinDeg(M) * cosDeg(2 * L0) -
      0.5 * y * y * sinDeg(4 * L0) -
      1.25 * e * e * sinDeg(2 * M));

  return { declRad, eqTime };
}

function calcSunEventUtcMinutes(jdDayStart, lat, lng, isSunrise) {
  const cosZenith = cosDeg(90.833);
  const latRad = lat * DEG_TO_RAD;

  const computeMinutes = (jdGuess) => {
    const { declRad, eqTime } = calcNoaaSolarParams(jdGuess);
    const cosHA = cosZenith / (Math.cos(latRad) * Math.cos(declRad)) - Math.tan(latRad) * Math.tan(declRad);
    if (cosHA < -1 || cosHA > 1) return null;
    const haDeg = Math.acos(cosHA) * RAD_TO_DEG;
    return isSunrise ? 720 - 4 * (lng + haDeg) - eqTime : 720 - 4 * (lng - haDeg) - eqTime;
  };

  const firstPass = computeMinutes(jdDayStart + 0.5 - lng / 360);
  if (firstPass === null) return null;
  const secondPass = computeMinutes(jdDayStart + firstPass / 1440);
  return secondPass !== null ? secondPass : firstPass;
}

function formatDaylightDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${String(mins).padStart(2, '0')}min`;
}

/**
 * Calculo solar offline NOAA para nascer do sol, por do sol e duracao do dia.
 * @param {{ lat: number, lng: number, tz: string }} city
 * @param {Date} date
 * @returns {{ sunrisePt: string, sunsetPt: string, daylightPt: string }}
 */
export function calculateNoaaSun(city, date = new Date()) {
  const d = toDate(date);
  const { year, month, day } = getDatePartsInTimeZone(d, city.tz);
  const utcDayStartMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const jdDayStart = utcDayStartMs / MS_PER_DAY + 2440587.5;

  const sunriseMin = calcSunEventUtcMinutes(jdDayStart, city.lat, city.lng, true);
  const sunsetMin = calcSunEventUtcMinutes(jdDayStart, city.lat, city.lng, false);

  if (sunriseMin === null || sunsetMin === null) {
    return { sunrisePt: '--h--', sunsetPt: '--h--', daylightPt: '--' };
  }

  const sunriseDate = new Date(utcDayStartMs + sunriseMin * 60000);
  const sunsetDate = new Date(utcDayStartMs + sunsetMin * 60000);
  const durationSeconds = (sunsetMin - sunriseMin) * 60;

  return {
    sunrisePt: formatTimePtInTimeZone(sunriseDate, city.tz),
    sunsetPt: formatTimePtInTimeZone(sunsetDate, city.tz),
    daylightPt: formatDaylightDuration(durationSeconds),
  };
}

/**
 * Converte string no formato "2026-11-25T05:11:38 AM -0300" para "05h11" sem usar new Date().
 * @param {string} raw
 * @returns {string | null}
 */
function parseApiAmPmTime(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^\d{4}-\d{2}-\d{2}T(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)\b/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();

  if (Number.isNaN(hour) || hour < 1 || hour > 12) return null;
  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}h${minute}`;
}

function createAbortError() {
  const err = new Error('Operacao cancelada');
  err.name = 'AbortError';
  return err;
}

async function fetchTimesApi(city, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const url = `${TIMES_API_BASE}?lat=${encodeURIComponent(city.lat)}&lng=${encodeURIComponent(city.lng)}&include=moon_details`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Carrega dados de Lua e Sol para São Joaquim da Barra, SP, usando a API ao vivo (com cache diario)
 * e caindo perfeitamente para o calculo local NOAA + Jean Meeus quando offline ou em datas especificas.
 *
 * @param {Date | number | string} [date]
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function loadMoonAndSun(date = new Date(), { signal } = {}) {
  if (signal?.aborted) throw createAbortError();

  const d = toDate(date);
  const location = FIXED_LOCATION;
  const targetDateISO = formatDateISOInTimeZone(d, location.tz);
  const todayInLocationISO = formatDateISOInTimeZone(new Date(), location.tz);
  const isToday = targetDateISO === todayInLocationISO;

  const moon = getCurrentMoonPhase(d);
  const nextMoonChange = getNextMoonChange(d, location.tz);
  const calculatedSun = calculateNoaaSun(location, d);

  if (isToday) {
    const cached = getCachedAstro(location.id, targetDateISO);
    if (cached && cached.sun?.sunrisePt && cached.sun?.sunsetPt) {
      const mergedMoon =
        typeof cached.illuminationPct === 'number'
          ? { ...moon, illuminationPct: cached.illuminationPct }
          : moon;
      return {
        location,
        moon: mergedMoon,
        nextMoonChange,
        sun: { sunrisePt: cached.sun.sunrisePt, sunsetPt: cached.sun.sunsetPt },
        source: 'live',
      };
    }

    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (isOnline) {
      try {
        const apiData = await fetchTimesApi(location, signal);
        if (apiData && apiData.date === targetDateISO) {
          const sunrisePt = parseApiAmPmTime(apiData?.sun?.events?.sunrise);
          const sunsetPt = parseApiAmPmTime(apiData?.sun?.events?.sunset);

          if (sunrisePt && sunsetPt) {
            const liveIllumRaw = apiData?.moon?.details?.illumination_pct;
            const liveIllum =
              typeof liveIllumRaw === 'number' && Number.isFinite(liveIllumRaw)
                ? Math.round(liveIllumRaw)
                : moon.illuminationPct;

            const sun = { sunrisePt, sunsetPt };
            saveCachedAstro(location.id, targetDateISO, {
              sun,
              illuminationPct: liveIllum,
            });

            return {
              location,
              moon: { ...moon, illuminationPct: liveIllum },
              nextMoonChange,
              sun,
              source: 'live',
            };
          }
        }
      } catch (err) {
        if (signal?.aborted) throw createAbortError();
      }
    }
  }

  return {
    location,
    moon,
    nextMoonChange,
    sun: { sunrisePt: calculatedSun.sunrisePt, sunsetPt: calculatedSun.sunsetPt },
    source: 'calculated',
  };
}
