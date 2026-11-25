import {
  SIGNS,
  getSignById,
  formatHoroscopeParagraphs,
} from './zodiac.js';
import { getDailyExtras } from './daily-extras.js';
import {
  getSavedSign,
  saveSign,
  getSavedPeriod,
  savePeriod,
  getFontLevel,
  saveFontLevel,
  getColorSchemeOverride,
  saveColorSchemeOverride,
  getSeenPeriods,
  saveSeenPeriod,
} from './storage.js';
import {
  getLocalDateISO,
  fetchHoroscope,
  prefetchAllPeriods,
} from './api.js';
import { loadMoonAndSun } from './astronomy.js';
import {
  renderMoonSvg,
  renderZodiacSvg,
  renderPhaseBadgeSvg,
} from './moon-svg.js';

const FONT_SCALES = [1, 1.12, 1.26, 1.4];
const PERIODS = ['daily', 'weekly', 'monthly'];

const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const el = {
  greetingText: document.getElementById('greeting-text'),
  todayDate: document.getElementById('today-date'),
  btnFontDown: document.getElementById('btn-font-down'),
  btnFontUp: document.getElementById('btn-font-up'),
  btnTheme: document.getElementById('btn-theme'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  themeIconSun: document.getElementById('theme-icon-sun'),
  themeLabel: document.getElementById('theme-label'),
  btnInstall: document.getElementById('btn-install'),

  viewPicker: document.getElementById('view-picker'),
  signGrid: document.getElementById('sign-grid'),

  viewMain: document.getElementById('view-main'),
  activeSignIcon: document.getElementById('active-sign-icon'),
  activeSignName: document.getElementById('active-sign-name'),
  activeSignRange: document.getElementById('active-sign-range'),
  btnChangeSign: document.getElementById('btn-change-sign'),

  tabsBar: document.querySelector('.tabs-bar'),
  tabButtons: Array.from(document.querySelectorAll('[role="tab"]')),
  tabPanels: Array.from(document.querySelectorAll('[role="tabpanel"]')),
  tabBadges: {
    weekly: document.querySelector('[data-tab-badge="weekly"]'),
    monthly: document.querySelector('[data-tab-badge="monthly"]'),
  },

  extraColorSwatch: document.getElementById('extra-color-swatch'),
  extraColorName: document.getElementById('extra-color-name'),
  extraNumber: document.getElementById('extra-number'),
  extraEnergy: document.getElementById('extra-energy'),

  moonSvgSlot: document.getElementById('moon-svg-slot'),
  moonPhaseName: document.getElementById('moon-phase-name'),
  moonIllumination: document.getElementById('moon-illumination'),
  nextMoonBadge: document.getElementById('next-moon-badge'),
  nextMoonName: document.getElementById('next-moon-name'),
  nextMoonRelative: document.getElementById('next-moon-relative'),
  sunSunrise: document.getElementById('sun-sunrise'),
  sunSunset: document.getElementById('sun-sunset'),

  updateToast: document.getElementById('update-toast'),
  updateToastMessage: document.getElementById('update-toast-message'),
  btnToastWeekly: document.getElementById('btn-toast-weekly'),
  btnToastMonthly: document.getElementById('btn-toast-monthly'),
  btnToastClose: document.getElementById('btn-toast-close'),
  toastLiveAnnouncer: document.getElementById('toast-live-announcer'),
};

const state = {
  signId: null,
  period: 'daily',
  fontLevel: 1,
  lastDateISO: getLocalDateISO(),
  deferredInstallPrompt: null,
  horoscopeAbort: null,
  astroAbort: null,
  prefetchedSignId: null,
  unreadPeriods: new Set(),
  pendingSignatures: { weekly: null, monthly: null },
  activeToastKey: null,
  dismissedToastKey: null,
  priorFocusEl: null,
  pendingCloseOpts: null,
  updateCheckSeq: 0,
};

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia!';
  if (hour >= 12 && hour < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

function formatDatePtBr(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function renderHeaderDate(date = new Date()) {
  el.greetingText.textContent = getGreeting(date);
  el.todayDate.textContent = formatDatePtBr(date);
}

function getEffectiveScheme(override = getColorSchemeOverride()) {
  if (override === 'dark' || override === 'light') {
    return override;
  }
  return systemDarkQuery.matches ? 'dark' : 'light';
}

function syncColorSchemeUi() {
  const override = getColorSchemeOverride();
  if (colorSchemeMeta) {
    colorSchemeMeta.content = override ?? 'light dark';
  }
  if (override === 'dark' || override === 'light') {
    document.documentElement.dataset.theme = override;
  } else {
    delete document.documentElement.dataset.theme;
  }

  const isDark = getEffectiveScheme(override) === 'dark';
  el.themeLabel.textContent = isDark ? 'Claro' : 'Escuro';
  el.themeIconSun.toggleAttribute('hidden', !isDark);
  el.themeIconMoon.toggleAttribute('hidden', isDark);

  const actionText = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
  el.btnTheme.setAttribute('aria-label', actionText);
  el.btnTheme.title = actionText;

  if (themeColorMeta) {
    themeColorMeta.content = isDark ? '#121622' : '#FAF6EE';
  }
}

function toggleColorScheme() {
  const currentRendered = getEffectiveScheme();
  const nextScheme = currentRendered === 'dark' ? 'light' : 'dark';
  const systemScheme = systemDarkQuery.matches ? 'dark' : 'light';

  if (nextScheme === systemScheme) {
    saveColorSchemeOverride(null);
  } else {
    saveColorSchemeOverride(nextScheme);
  }

  syncColorSchemeUi();
}

function applyFontLevel(level, { persist = true } = {}) {
  const clamped = Math.max(0, Math.min(FONT_SCALES.length - 1, Math.round(Number(level) || 0)));
  state.fontLevel = clamped;
  document.documentElement.style.setProperty('--font-scale', String(FONT_SCALES[clamped]));

  el.btnFontDown.disabled = clamped === 0;
  el.btnFontUp.disabled = clamped === FONT_SCALES.length - 1;

  if (persist) {
    saveFontLevel(clamped);
  }
}

function populateSignGrid() {
  const fragment = document.createDocumentFragment();

  for (const sign of SIGNS) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sign-card';
    button.dataset.signId = sign.id;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'sign-card-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = renderZodiacSvg(sign.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'sign-card-name';
    nameSpan.textContent = sign.name;

    const rangeSpan = document.createElement('span');
    rangeSpan.className = 'sign-card-range';
    rangeSpan.textContent = sign.range;

    button.append(iconWrap, nameSpan, rangeSpan);
    item.append(button);
    fragment.append(item);
  }

  el.signGrid.replaceChildren(fragment);
}

function renderDailyExtras(signId, dateISO) {
  const extras = getDailyExtras(signId, dateISO);
  el.extraColorSwatch.style.setProperty('--swatch-bg', extras.cor.hex);
  el.extraColorSwatch.style.setProperty('--swatch-border', extras.cor.borderHex);
  el.extraColorName.textContent = extras.cor.name;
  el.extraNumber.textContent = String(extras.numero);
  el.extraEnergy.textContent = extras.energia;
}

function getPanelParts(period) {
  return {
    body: document.querySelector(`[data-panel-body="${period}"]`),
    notice: document.querySelector(`[data-panel-notice="${period}"]`),
  };
}

function setPanelLoading(period) {
  const { body, notice } = getPanelParts(period);
  if (!body || !notice) return;

  const loadingP = document.createElement('p');
  loadingP.className = 'loading-text';
  loadingP.textContent = 'Carregando previsão...';
  body.replaceChildren(loadingP);

  notice.hidden = true;
  notice.textContent = '';
}

function renderHoroscopeResult(period, result) {
  const { body, notice } = getPanelParts(period);
  if (!body || !notice) return;

  const paragraphs = formatHoroscopeParagraphs(result.text);
  const nodes = (paragraphs.length ? paragraphs : [result.text]).map((paragraphText) => {
    const p = document.createElement('p');
    p.textContent = paragraphText;
    return p;
  });
  body.replaceChildren(...nodes);

  if (result.status === 'cached' && result.notice) {
    notice.textContent = result.notice;
    notice.hidden = false;
  } else {
    notice.textContent = '';
    notice.hidden = true;
  }
}

async function loadActiveHoroscope(signId, period) {
  if (state.horoscopeAbort) {
    state.horoscopeAbort.abort();
  }
  const controller = new AbortController();
  state.horoscopeAbort = controller;

  setPanelLoading(period);

  try {
    const result = await fetchHoroscope(signId, period, { signal: controller.signal });
    if (controller.signal.aborted || state.signId !== signId || state.period !== period) {
      return;
    }

    renderHoroscopeResult(period, result);

    if (state.prefetchedSignId !== signId) {
      state.prefetchedSignId = signId;
      prefetchAllPeriods(signId).catch(() => {});
    }
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      return;
    }
    renderHoroscopeResult(period, {
      text: 'No momento não foi possível carregar a previsão. Tente novamente em instantes.',
      status: 'cached',
      notice: 'Não foi possível atualizar a previsão agora.',
    });
  }
}

function computeTextSignature(date, text) {
  const input = `${String(date || '').trim()}|${String(text || '').trim()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isValidForecastResult(result) {
  return Boolean(
    result &&
      typeof result.text === 'string' &&
      result.text.trim() &&
      !result.text.startsWith('No momento não foi possível')
  );
}

function syncTabBadges() {
  for (const period of ['weekly', 'monthly']) {
    const badge = el.tabBadges[period];
    if (badge) {
      badge.hidden = !state.unreadPeriods.has(period);
    }
  }
}

function announceToast(message, hasActions) {
  const announcement = hasActions ? `${message} Ações disponíveis.` : message;
  if (typeof document.ariaNotify === 'function') {
    try {
      document.ariaNotify(announcement);
      return;
    } catch {
      // Fallback para live region abaixo
    }
  }
  if (el.toastLiveAnnouncer) {
    el.toastLiveAnnouncer.textContent = '';
    window.requestAnimationFrame(() => {
      if (el.toastLiveAnnouncer) {
        el.toastLiveAnnouncer.textContent = announcement;
      }
    });
  }
}

function finalizeToastClose({ markDismissed = false, restoreFocus = false } = {}) {
  if (markDismissed && state.activeToastKey) {
    state.dismissedToastKey = state.activeToastKey;
  }
  el.updateToast.classList.remove('is-open');
  el.updateToast.hidden = true;

  if (restoreFocus) {
    const target =
      state.priorFocusEl && state.priorFocusEl.isConnected
        ? state.priorFocusEl
        : document.getElementById('main-content');
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
  }
  state.priorFocusEl = null;
}

function hideUpdateToast({ markDismissed = false, restoreFocus = false } = {}) {
  if (!el.updateToast) return;
  const hasNativePopover = 'showPopover' in el.updateToast;
  if (hasNativePopover && el.updateToast.matches(':popover-open')) {
    state.pendingCloseOpts = { markDismissed, restoreFocus };
    try {
      el.updateToast.hidePopover();
      return;
    } catch {
      state.pendingCloseOpts = null;
    }
  }
  finalizeToastClose({ markDismissed, restoreFocus });
}

function showUpdateToast({ message, showWeekly, showMonthly, key }) {
  if (!el.updateToast || state.dismissedToastKey === key) return;

  if (
    document.activeElement instanceof HTMLElement &&
    !el.updateToast.contains(document.activeElement)
  ) {
    state.priorFocusEl = document.activeElement;
  }

  el.updateToastMessage.textContent = message;
  el.btnToastWeekly.hidden = !showWeekly;
  el.btnToastMonthly.hidden = !showMonthly;
  state.activeToastKey = key;

  el.updateToast.hidden = false;
  el.updateToast.classList.add('is-open');
  if ('showPopover' in el.updateToast) {
    try {
      if (!el.updateToast.matches(':popover-open')) {
        el.updateToast.showPopover();
      }
    } catch {
      // Usa classe .is-open como fallback
    }
  }

  announceToast(message, showWeekly || showMonthly);
}

function markPeriodSeen(period) {
  if ((period !== 'weekly' && period !== 'monthly') || !state.signId) return;
  if (state.pendingSignatures[period]) {
    saveSeenPeriod(state.signId, period, state.pendingSignatures[period]);
    state.pendingSignatures[period] = null;
  }
  state.unreadPeriods.delete(period);
  syncTabBadges();

  if (el.updateToast && !el.updateToast.hidden) {
    if (period === 'weekly') el.btnToastWeekly.hidden = true;
    if (period === 'monthly') el.btnToastMonthly.hidden = true;
    if (state.unreadPeriods.size === 0) {
      hideUpdateToast({ markDismissed: true, restoreFocus: false });
    }
  }
}

async function checkWeeklyMonthlyUpdates(signId) {
  const seq = ++state.updateCheckSeq;
  state.unreadPeriods.clear();
  state.pendingSignatures.weekly = null;
  state.pendingSignatures.monthly = null;
  syncTabBadges();

  const [weeklyRes, monthlyRes] = await Promise.all([
    fetchHoroscope(signId, 'weekly').catch(() => null),
    fetchHoroscope(signId, 'monthly').catch(() => null),
  ]);

  if (seq !== state.updateCheckSeq || state.signId !== signId || el.viewMain.hidden) {
    return;
  }

  const seen = getSeenPeriods(signId);
  const results = { weekly: weeklyRes, monthly: monthlyRes };
  const updated = [];
  const keyParts = [];

  for (const period of ['weekly', 'monthly']) {
    const res = results[period];
    if (!isValidForecastResult(res)) continue;
    const sig = computeTextSignature(res.date, res.text);
    if (!seen[period]) {
      saveSeenPeriod(signId, period, sig);
    } else if (seen[period] !== sig) {
      updated.push(period);
      keyParts.push(`${period}:${sig}`);
      if (state.period === period) {
        saveSeenPeriod(signId, period, sig);
      } else {
        state.unreadPeriods.add(period);
        state.pendingSignatures[period] = sig;
      }
    }
  }

  syncTabBadges();

  if (updated.length > 0) {
    let message = 'Nova previsão disponível!';
    if (updated.includes('weekly') && updated.includes('monthly')) {
      message = 'Novas previsões para a semana e para o mês!';
    } else if (updated.includes('weekly')) {
      message = 'Nova previsão para a semana!';
    } else if (updated.includes('monthly')) {
      message = 'Nova previsão para o mês!';
    }

    showUpdateToast({
      message,
      showWeekly: state.unreadPeriods.has('weekly'),
      showMonthly: state.unreadPeriods.has('monthly'),
      key: `${signId}|${keyParts.join('|')}`,
    });
  }
}

function activateTab(period, { moveFocus = false, persist = true, reload = true } = {}) {
  const safePeriod = PERIODS.includes(period) ? period : 'daily';
  state.period = safePeriod;

  if (persist) {
    savePeriod(safePeriod);
  }

  for (const tab of el.tabButtons) {
    const isSelected = tab.dataset.period === safePeriod;
    tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    tab.tabIndex = isSelected ? 0 : -1;
    if (moveFocus && isSelected) {
      tab.focus();
    }
  }

  for (const panel of el.tabPanels) {
    const isMatch = panel.id === `panel-${safePeriod}`;
    panel.hidden = !isMatch;
  }

  markPeriodSeen(safePeriod);

  if (reload && state.signId) {
    loadActiveHoroscope(state.signId, safePeriod);
  }
}

function renderAstroData(data) {
  el.moonSvgSlot.innerHTML = renderMoonSvg(
    data.moon.phaseFraction,
    data.moon.illuminationPct,
    data.moon.namePt
  );
  el.moonPhaseName.textContent = data.moon.namePt;
  el.moonIllumination.textContent = `${Math.round(data.moon.illuminationPct)}% iluminada`;

  el.nextMoonBadge.innerHTML = renderPhaseBadgeSvg(data.nextMoonChange.phaseKey);
  el.nextMoonName.textContent = data.nextMoonChange.namePt;
  el.nextMoonRelative.textContent = data.nextMoonChange.relativePt;

  el.sunSunrise.textContent = data.sun.sunrisePt;
  el.sunSunset.textContent = data.sun.sunsetPt;
}

async function loadAstroSection() {
  if (state.astroAbort) {
    state.astroAbort.abort();
  }
  const controller = new AbortController();
  state.astroAbort = controller;

  try {
    const data = await loadMoonAndSun(new Date(), {
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      return;
    }
    renderAstroData(data);
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      return;
    }
  }
}

function showPickerView({ moveFocus = false } = {}) {
  hideUpdateToast({ markDismissed: false, restoreFocus: false });
  el.viewMain.hidden = true;
  el.viewPicker.hidden = false;
  if (moveFocus) {
    const pickerHeading = document.getElementById('picker-title');
    if (pickerHeading) {
      pickerHeading.setAttribute('tabindex', '-1');
      pickerHeading.focus();
    }
  }
}

function showMainView(signId, { moveFocus = false } = {}) {
  const sign = getSignById(signId);
  if (!sign) {
    showPickerView({ moveFocus });
    return;
  }

  state.signId = sign.id;
  state.lastDateISO = getLocalDateISO();
  saveSign(sign.id);

  el.activeSignIcon.innerHTML = renderZodiacSvg(sign.id);
  el.activeSignName.textContent = sign.name;
  el.activeSignRange.textContent = `${sign.range} · ${sign.element}`;

  el.viewPicker.hidden = true;
  el.viewMain.hidden = false;

  renderDailyExtras(sign.id, state.lastDateISO);
  activateTab(state.period, { moveFocus: false, persist: false, reload: true });
  loadAstroSection();
  checkWeeklyMonthlyUpdates(sign.id);

  if (moveFocus) {
    el.activeSignName.focus();
  }
}

function bindEvents() {
  el.btnFontDown.addEventListener('click', () => {
    applyFontLevel(state.fontLevel - 1);
  });

  el.btnFontUp.addEventListener('click', () => {
    applyFontLevel(state.fontLevel + 1);
  });

  el.btnTheme.addEventListener('click', toggleColorScheme);

  const onSystemSchemeChange = () => {
    syncColorSchemeUi();
  };
  if (typeof systemDarkQuery.addEventListener === 'function') {
    systemDarkQuery.addEventListener('change', onSystemSchemeChange);
  } else if (typeof systemDarkQuery.addListener === 'function') {
    systemDarkQuery.addListener(onSystemSchemeChange);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === 'horoscopo_v1_color_scheme') {
      syncColorSchemeUi();
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    el.btnInstall.hidden = false;
  });

  el.btnInstall.addEventListener('click', async () => {
    const promptEvent = state.deferredInstallPrompt;
    if (!promptEvent) return;
    state.deferredInstallPrompt = null;
    el.btnInstall.hidden = true;
    try {
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // Prompt dismissed or unavailable
    }
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    el.btnInstall.hidden = true;
  });

  el.signGrid.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const card = target ? target.closest('.sign-card') : null;
    if (!card) return;
    const signId = card.dataset.signId;
    if (signId) {
      showMainView(signId, { moveFocus: true });
    }
  });

  el.btnChangeSign.addEventListener('click', () => {
    showPickerView({ moveFocus: true });
  });

  el.tabsBar.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const tab = target ? target.closest('[role="tab"]') : null;
    if (!tab) return;
    const period = tab.dataset.period;
    if (period && period !== state.period) {
      activateTab(period, { moveFocus: false, persist: true, reload: true });
    }
  });

  el.tabsBar.addEventListener('keydown', (event) => {
    const currentIndex = el.tabButtons.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % el.tabButtons.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + el.tabButtons.length) % el.tabButtons.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = el.tabButtons.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextPeriod = el.tabButtons[nextIndex].dataset.period;
      activateTab(nextPeriod, { moveFocus: true, persist: true, reload: true });
    }
  });

  el.btnToastWeekly.addEventListener('click', () => {
    hideUpdateToast({ markDismissed: false, restoreFocus: false });
    activateTab('weekly', { moveFocus: true, persist: true, reload: true });
  });

  el.btnToastMonthly.addEventListener('click', () => {
    hideUpdateToast({ markDismissed: false, restoreFocus: false });
    activateTab('monthly', { moveFocus: true, persist: true, reload: true });
  });

  if (el.updateToast && 'showPopover' in el.updateToast) {
    el.updateToast.addEventListener('toggle', (event) => {
      if (event.newState === 'closed') {
        const opts = state.pendingCloseOpts || {
          markDismissed: true,
          restoreFocus:
            document.activeElement instanceof Node &&
            el.updateToast.contains(document.activeElement),
        };
        state.pendingCloseOpts = null;
        finalizeToastClose(opts);
      }
    });
  } else if (el.btnToastClose) {
    el.btnToastClose.addEventListener('click', () => {
      hideUpdateToast({ markDismissed: true, restoreFocus: true });
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    renderHeaderDate();
    const todayISO = getLocalDateISO();
    if (todayISO !== state.lastDateISO) {
      state.lastDateISO = todayISO;
      state.prefetchedSignId = null;
      if (state.signId && !el.viewMain.hidden) {
        renderDailyExtras(state.signId, todayISO);
        loadActiveHoroscope(state.signId, state.period);
        loadAstroSection();
        checkWeeklyMonthlyUpdates(state.signId);
      }
    }
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      renderHeaderDate();
    }
  }, 60000);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

function init() {
  state.fontLevel = getFontLevel();
  state.period = getSavedPeriod();
  const savedSign = getSignById(getSavedSign());
  state.signId = savedSign ? savedSign.id : null;

  applyFontLevel(state.fontLevel, { persist: false });
  syncColorSchemeUi();
  renderHeaderDate();
  populateSignGrid();
  bindEvents();
  registerServiceWorker();

  if (state.signId) {
    showMainView(state.signId, { moveFocus: false });
  } else {
    showPickerView({ moveFocus: false });
  }
}

init();
