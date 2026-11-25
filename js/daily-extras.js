/**
 * Destaques deterministicos diarios (cor, numero da sorte e energia do dia).
 * Usa hash FNV-1a sobre `${signId}|${dateISO}` para manter o mesmo resultado durante todo o dia.
 */

const PALETTE = [
  { name: 'Dourado suave', hex: '#E5A93C', borderHex: '#8F6112' },
  { name: 'Terracota', hex: '#C9643B', borderHex: '#7E3619' },
  { name: 'Azul-sereno', hex: '#4B83B8', borderHex: '#274F75' },
  { name: 'Verde-sálvia', hex: '#5C916E', borderHex: '#32583F' },
  { name: 'Lavanda', hex: '#8D77B8', borderHex: '#53417A' },
  { name: 'Rosa-antigo', hex: '#C8707E', borderHex: '#7F3B47' },
  { name: 'Âmbar', hex: '#D8892B', borderHex: '#874F0F' },
  { name: 'Turquesa', hex: '#3B9490', borderHex: '#1D5B58' },
  { name: 'Lilás', hex: '#A17AC2', borderHex: '#603E7E' },
  { name: 'Ocre', hex: '#C9963B', borderHex: '#7D5919' },
  { name: 'Verde-oliva', hex: '#768E48', borderHex: '#465824' },
  { name: 'Coral suave', hex: '#D8735B', borderHex: '#873E2D' },
  { name: 'Azul-celeste', hex: '#5B9AC4', borderHex: '#2F5E7E' },
  { name: 'Ameixa', hex: '#8E5174', borderHex: '#542942' },
  { name: 'Bege-mel', hex: '#CFA56E', borderHex: '#7F5E33' },
  { name: 'Verde-menta', hex: '#4D9E83', borderHex: '#27614E' },
];

const ENERGIES = [
  'Serenidade',
  'Gratidão',
  'Acolhimento',
  'Clareza',
  'Esperança',
  'Paciência',
  'Alegria tranquila',
  'Confiança',
  'Harmonia',
  'Ternura',
  'Equilíbrio',
  'Leveza',
  'Coragem serena',
  'Inspiração',
  'Sabedoria',
  'Bem-estar',
];

/**
 * Hash FNV-1a de 32 bits deterministico sobre UTF-8/UTF-16 de entrada.
 * @param {string} input
 * @returns {number} inteiro unsigned de 32 bits
 */
function fnv1a32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mistura avalanche de 32 bits (Murmur3 finalizer) para descorrelacionar campos derivados.
 * @param {number} value
 * @returns {number}
 */
function mix32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/**
 * Retorna os destaques deterministicos do dia para um signo e data local.
 * @param {string} signId
 * @param {string} dateISO formato YYYY-MM-DD
 * @returns {{ cor: { name: string, hex: string, borderHex: string }, numero: number, energia: string }}
 */
export function getDailyExtras(signId, dateISO) {
  const seedKey = `${String(signId || '').trim().toLowerCase()}|${String(dateISO || '').trim()}`;
  const baseHash = fnv1a32(seedKey);

  const colorHash = mix32(baseHash ^ fnv1a32(`${seedKey}|cor`));
  const numberHash = mix32(baseHash ^ fnv1a32(`${seedKey}|numero`));
  const energyHash = mix32(baseHash ^ fnv1a32(`${seedKey}|energia`));

  const cor = PALETTE[colorHash % PALETTE.length];
  const numero = (numberHash % 99) + 1;
  const energia = ENERGIES[energyHash % ENERGIES.length];

  return {
    cor: { name: cor.name, hex: cor.hex, borderHex: cor.borderHex },
    numero,
    energia,
  };
}
