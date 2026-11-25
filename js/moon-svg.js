/**
 * SVG illustrations for Moon phases (Southern Hemisphere / Brazil orientation),
 * main phase badges, and the 12 zodiac signs.
 */

function escapeXmlAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatNum(n) {
  return Number(n.toFixed(2));
}

/**
 * Renders a crisp Moon phase illustration in SVG oriented for the Southern Hemisphere:
 * - Waxing (phaseFraction < 0.5): illuminated portion on the LEFT side.
 * - Waning (phaseFraction > 0.5): illuminated portion on the RIGHT side.
 *
 * @param {number} phaseFraction Normalized lunar cycle fraction in [0, 1)
 * @param {number} illuminationPct Illuminated percentage 0..100
 * @param {string} namePt Portuguese phase name for accessible description
 * @returns {string} SVG markup string
 */
export function renderMoonSvg(phaseFraction, illuminationPct, namePt) {
  const rawFraction = Number.isFinite(phaseFraction) ? phaseFraction : 0;
  const f = ((rawFraction % 1) + 1) % 1;
  const pct = Math.max(0, Math.min(100, Math.round(Number(illuminationPct) || 0)));
  const labelText = namePt ? String(namePt).trim() : 'Fase da Lua';

  let sideHint = '';
  if (f > 0.03 && f < 0.47) {
    sideHint = ', lado esquerdo iluminado no Brasil';
  } else if (f > 0.53 && f < 0.97) {
    sideHint = ', lado direito iluminado no Brasil';
  }

  const ariaLabel = escapeXmlAttr(`Ilustração da Lua: ${labelText}, ${pct}% iluminada${sideHint}`);

  const cx = 50;
  const cy = 50;
  const r = 40;
  const topY = cy - r;
  const bottomY = cy + r;

  const theta = 2 * Math.PI * f;
  const cosTheta = Math.cos(theta);
  const rx = Math.abs(r * cosTheta);

  let litElement = '';

  if (f <= 0.015 || f >= 0.985 || pct <= 1) {
    // New Moon: dark disc with a delicate warm rim
    litElement = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#8A93AA" stroke-width="1.5" stroke-opacity="0.7" />`;
  } else if (Math.abs(f - 0.5) <= 0.015 || pct >= 99) {
    // Full Moon: fully illuminated warm ivory-gold disc
    litElement = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#F6D28B" />`;
  } else {
    const isWaxing = f < 0.5;
    // Southern Hemisphere:
    // Waxing -> LEFT limb lit (top to bottom via left = sweep 0).
    // Waning -> RIGHT limb lit (top to bottom via right = sweep 1).
    const outerSweep = isWaxing ? 0 : 1;

    let pathD;
    if (rx < 0.35) {
      // Exact quarter: vertical terminator line
      pathD = `M ${cx} ${topY} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${bottomY} L ${cx} ${topY} Z`;
    } else {
      // Terminator path from bottom (50, 90) back to top (50, 10):
      // sweep 1 bows LEFT; sweep 0 bows RIGHT.
      let termSweep;
      if (isWaxing) {
        termSweep = cosTheta >= 0 ? 1 : 0;
      } else {
        termSweep = cosTheta < 0 ? 1 : 0;
      }
      pathD = `M ${cx} ${topY} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${bottomY} A ${formatNum(rx)} ${r} 0 0 ${termSweep} ${cx} ${topY} Z`;
    }

    litElement = `<path d="${pathD}" fill="#F6D28B" />`;
  }

  // Subtle surface craters over the dark and lit sides (masked softly by opacity)
  const craters = [
    `<circle cx="38" cy="34" r="5.5" fill="#181F30" fill-opacity="0.14" />`,
    `<circle cx="63" cy="42" r="7" fill="#181F30" fill-opacity="0.12" />`,
    `<circle cx="46" cy="63" r="4.5" fill="#181F30" fill-opacity="0.13" />`,
    `<circle cx="60" cy="68" r="3.2" fill="#181F30" fill-opacity="0.11" />`,
  ].join('');

  return `<svg class="moon-svg" viewBox="0 0 100 100" role="img" aria-label="${ariaLabel}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#22293D" />
  ${litElement}
  ${craters}
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#505B7A" stroke-width="2" />
</svg>`;
}

/**
 * Renders a small monochrome phase badge SVG for the 4 principal lunar phases
 * using Southern Hemisphere orientation.
 *
 * @param {'new'|'first-quarter'|'full'|'last-quarter'} phaseKey
 * @returns {string} SVG markup string (aria-hidden)
 */
export function renderPhaseBadgeSvg(phaseKey) {
  let inner = '';
  switch (phaseKey) {
    case 'new':
      inner = `<circle cx="14" cy="14" r="10" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2" />`;
      break;
    case 'first-quarter':
      // Southern Hemisphere: left half illuminated
      inner = `<circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M 14 4 A 10 10 0 0 0 14 24 Z" fill="currentColor" />`;
      break;
    case 'full':
      inner = `<circle cx="14" cy="14" r="10" fill="currentColor" stroke="currentColor" stroke-width="2" />`;
      break;
    case 'last-quarter':
      // Southern Hemisphere: right half illuminated
      inner = `<circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M 14 4 A 10 10 0 0 1 14 24 Z" fill="currentColor" />`;
      break;
    default:
      inner = `<circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2" />`;
      break;
  }

  return `<svg class="phase-badge-svg" viewBox="0 0 28 28" aria-hidden="true">
  ${inner}
</svg>`;
}

const ZODIAC_PATHS = {
  aries: `<path d="M16 26V14M16 14C16 8.5 11.5 6 8.5 7.5C6 8.8 6 12.2 8.5 13.5M16 14C16 8.5 20.5 6 23.5 7.5C26 8.8 26 12.2 23.5 13.5" />`,
  taurus: `<circle cx="16" cy="19" r="6.5" /><path d="M7.5 6.5C8 10.5 11.5 12.5 16 12.5C20.5 12.5 24 10.5 24.5 6.5" />`,
  gemini: `<path d="M7 7.5C12.5 9.5 19.5 9.5 25 7.5M7 24.5C12.5 22.5 19.5 22.5 25 24.5M12.5 8.8V23.2M19.5 8.8V23.2" />`,
  cancer: `<circle cx="9.5" cy="12" r="3.5" /><path d="M9.5 8.5C15.5 7 21 8.5 24.5 11.5" /><circle cx="22.5" cy="20" r="3.5" /><path d="M22.5 23.5C16.5 25 11 23.5 7.5 20.5" />`,
  leo: `<circle cx="9.5" cy="19.5" r="3.5" /><path d="M12.3 17.5C12 10.5 16 6.5 20 8C23.5 9.3 23.5 14 21 18.5C19.5 21.2 20.5 24.5 23.5 24.5C25 24.5 26 23.5 26.2 22.2" />`,
  virgo: `<path d="M7 9.5V22.5M7 13C7 9.5 12.5 9.5 12.5 13V22.5M12.5 13C12.5 9.5 18 9.5 18 13V22.5M18 13C18 9.5 23 9.5 23 14.5C23 19.5 18.5 22.5 15.5 24.5M18 19.5L25.5 25" />`,
  libra: `<path d="M6.5 23.5H25.5M6.5 18.5H11.5C11.2 14.5 13 11.5 16 11.5C19 11.5 20.8 14.5 20.5 18.5H25.5" />`,
  scorpio: `<path d="M6.5 9.5V22.5M6.5 13C6.5 9.5 12 9.5 12 13V22.5M12 13C12 9.5 17.5 9.5 17.5 13V20.5C17.5 23.5 19.5 24.5 22.5 23.5L26 20M22.5 19.5L26 20L25.5 23.5" />`,
  sagittarius: `<path d="M7.5 24.5L24.5 7.5M16 7.5H24.5V16M9.5 14.5L17.5 22.5" />`,
  capricorn: `<path d="M7 9.5L11.5 22.5L16.5 11.5C18 8.5 21 9 21 13V21.5C21 24.5 24.5 25.5 25.5 23C26.5 20.5 23.5 18.5 21 20.5" />`,
  aquarius: `<path d="M6 13L10 9.5L14 13L18 9.5L22 13L26 9.5M6 21.5L10 18L14 21.5L18 18L22 21.5L26 18" />`,
  pisces: `<path d="M8 7.5C11.5 11.5 11.5 20.5 8 24.5M24 7.5C20.5 11.5 20.5 20.5 24 24.5M7 16H25" />`,
};

/**
 * Renders a clean astronomical line-art SVG for each of the 12 zodiac signs.
 *
 * @param {string} signId Sign identifier (e.g., 'aries', 'taurus', ...)
 * @returns {string} SVG markup string (aria-hidden)
 */
export function renderZodiacSvg(signId) {
  const glyph =
    ZODIAC_PATHS[signId] ||
    `<path d="M16 5V27M5 16H27M8.5 8.5L23.5 23.5M23.5 8.5L8.5 23.5" />`;

  return `<svg class="zodiac-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  ${glyph}
</svg>`;
}
