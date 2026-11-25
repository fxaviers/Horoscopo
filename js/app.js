import {
  SIGNS,
  getSignById,
  getSignByBirthDate,
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
  getSavedCityId,
  saveCityId,
  getColorSchemeOverride,
  saveColorSchemeOverride,
} from './storage.js';
import {
  getLocalDateISO,
  fetchHoroscope,
  prefetchAllPeriods,
} from './api.js';
import {
  BRAZIL_CITIES,
  getCityById,
  loadMoonAndSun,
} from './astronomy.js';
import {
  renderMoonSvg,
  renderZodiacSvg,
  renderPhaseBadgeSvg,
} from './moon-svg.js';

const FONT_SCALES = [1, 1.12, 1.26, 1.4];
const PERIODS = ['daily', 'weekly', 'monthly'];
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

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
  birthDay: document.getElementById('birth-day'),
  birthMonth: document.getElementById('birth-month'),
  birthResult: document.getElementById('birth-result'),
  birthResultIcon: document.getElementById('birth-result-icon'),
  birthResultText: document.getElementById('birth-result-text'),
  btnConfirmBirthSign: document.getElementById('btn-confirm-birth-sign'),

  viewMain: document.getElementById('view-main'),
  activeSignIcon: document.getElementById('active-sign-icon'),
  activeSignName: document.getElementById('active-sign-name'),
  activeSignRange: document.getElementById('active-sign-range'),
  btnChangeSign: document.getElementById('btn-change-sign'),

  tabsBar: document.querySelector('.tabs-bar'),
  tabButtons: Array.from(document.querySelectorAll('[role="tab"]')),
  tabPanels: Array.from(document.querySelectorAll('[role="tabpanel"]')),

  extraColorSwatch: document.getElementById('extra-color-swatch'),
  extraColorName: document.getElementById('extra-color-name'),
  extraNumber: document.getElementById('extra-number'),
  extraEnergy: document.getElementById('extra-energy'),

  astroCityLabel: document.getElementById('astro-city-label'),
  btnChangeCity: document.getElementById('btn-change-city'),
  moonSvgSlot: document.getElementById('moon-svg-slot'),
  moonDetail: document.getElementById('moon-detail'),
  moonPhaseName: document.getElementById('moon-phase-name'),
  moonIllumination: document.getElementById('moon-illumination'),
  nextMoonBadge: document.getElementById('next-moon-badge'),
  nextMoonName: document.getElementById('next-moon-name'),
  nextMoonDatetime: document.getElementById('next-moon-datetime'),
  nextMoonRelative: document.getElementById('next-moon-relative'),
  sunSunrise: document.getElementById('sun-sunrise'),
  sunSunset: document.getElementById('sun-sunset'),
  sunDaylight: document.getElementById('sun-daylight'),

  cityDialog: document.getElementById('city-dialog'),
  btnCloseCity: document.getElementById('btn-close-city'),
  cityList: document.getElementById('city-list'),
};

const state = {
  signId: null,
  period: 'daily',
  fontLevel: 1,
  cityId: 'sao-paulo',
  lastDateISO: getLocalDateISO(),
  deferredInstallPrompt: null,
  horoscopeAbort: null,
  astroAbort: null,
  prefetchedSignId: null,
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

function populateBirthHelperSelects() {
  const dayFrag = document.createDocumentFragment();
  for (let d = 1; d <= 31; d += 1) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = String(d);
    dayFrag.append(opt);
  }
  el.birthDay.append(dayFrag);

  const monthFrag = document.createDocumentFragment();
  MONTH_NAMES.forEach((monthName, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx + 1);
    opt.textContent = monthName;
    monthFrag.append(opt);
  });
  el.birthMonth.append(monthFrag);
}

function updateBirthResult() {
  const day = Number(el.birthDay.value);
  const month = Number(el.birthMonth.value);

  if (!day || !month) {
    el.birthResult.hidden = true;
    el.btnConfirmBirthSign.hidden = true;
    el.btnConfirmBirthSign.removeAttribute('data-sign-id');
    return;
  }

  const sign = getSignByBirthDate(day, month);
  el.birthResult.hidden = false;

  if (!sign) {
    el.birthResultIcon.innerHTML = '';
    el.birthResultText.textContent = 'Essa data não existe no calendário. Escolha outro dia.';
    el.btnConfirmBirthSign.hidden = true;
    el.btnConfirmBirthSign.removeAttribute('data-sign-id');
    return;
  }

  el.birthResultIcon.innerHTML = renderZodiacSvg(sign.id);
  el.birthResultText.textContent = `Seu signo é ${sign.name} (${sign.range}).`;
  el.btnConfirmBirthSign.dataset.signId = sign.id;
  el.btnConfirmBirthSign.hidden = false;
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

  if (reload && state.signId) {
    loadActiveHoroscope(state.signId, safePeriod);
  }
}

function renderAstroData(data) {
  el.astroCityLabel.textContent = `${data.city.name}, ${data.city.state}`;

  el.moonSvgSlot.innerHTML = renderMoonSvg(
    data.moon.phaseFraction,
    data.moon.illuminationPct,
    data.moon.namePt
  );
  el.moonDetail.textContent = data.moon.detailPt;

  if (
    data.moon.namePt &&
    data.moon.namePt.toLowerCase() !== data.moon.detailPt.toLowerCase()
  ) {
    el.moonPhaseName.textContent = data.moon.namePt;
    el.moonPhaseName.hidden = false;
  } else if (Number.isFinite(data.moon.ageDays)) {
    el.moonPhaseName.textContent = `Dia ${Math.round(data.moon.ageDays)} do ciclo lunar`;
    el.moonPhaseName.hidden = false;
  } else {
    el.moonPhaseName.textContent = '';
    el.moonPhaseName.hidden = true;
  }

  el.moonIllumination.textContent = `${Math.round(data.moon.illuminationPct)}% iluminada`;

  el.nextMoonBadge.innerHTML = renderPhaseBadgeSvg(data.nextMoonChange.phaseKey);
  el.nextMoonName.textContent = data.nextMoonChange.namePt;
  el.nextMoonDatetime.textContent = `${data.nextMoonChange.datePt} · às ${data.nextMoonChange.timePt}`;
  el.nextMoonRelative.textContent = data.nextMoonChange.relativePt;

  el.sunSunrise.textContent = data.sun.sunrisePt;
  el.sunSunset.textContent = data.sun.sunsetPt;
  el.sunDaylight.textContent = data.sun.daylightPt;
}

async function loadAstroSection(cityId) {
  if (state.astroAbort) {
    state.astroAbort.abort();
  }
  const controller = new AbortController();
  state.astroAbort = controller;

  const fallbackCity = getCityById(cityId);
  el.astroCityLabel.textContent = `${fallbackCity.name}, ${fallbackCity.state}`;

  try {
    const data = await loadMoonAndSun(fallbackCity.id, new Date(), {
      signal: controller.signal,
    });
    if (controller.signal.aborted || state.cityId !== fallbackCity.id) {
      return;
    }
    renderAstroData(data);
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      return;
    }
  }
}

function populateCityDialog() {
  const fragment = document.createDocumentFragment();

  for (const city of BRAZIL_CITIES) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-option';
    button.dataset.cityId = city.id;
    button.setAttribute('aria-pressed', city.id === state.cityId ? 'true' : 'false');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${city.name}, ${city.state}`;

    const checkSpan = document.createElement('span');
    checkSpan.className = 'city-check';
    checkSpan.setAttribute('aria-hidden', 'true');
    checkSpan.textContent = city.id === state.cityId ? '✓' : '';

    button.append(nameSpan, checkSpan);
    li.append(button);
    fragment.append(li);
  }

  el.cityList.replaceChildren(fragment);
}

function syncCityDialogSelection() {
  const buttons = el.cityList.querySelectorAll('.city-option');
  for (const btn of buttons) {
    const isCurrent = btn.dataset.cityId === state.cityId;
    btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    const check = btn.querySelector('.city-check');
    if (check) {
      check.textContent = isCurrent ? '✓' : '';
    }
  }
}

function openCityDialog() {
  syncCityDialogSelection();
  el.cityDialog.showModal();
  const activeBtn = el.cityList.querySelector('.city-option[aria-pressed="true"]');
  if (activeBtn) {
    activeBtn.scrollIntoView({ block: 'nearest' });
  }
}

function showPickerView({ moveFocus = false } = {}) {
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
  loadAstroSection(state.cityId);

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

  systemDarkQuery.addEventListener('change', () => {
    syncColorSchemeUi();
  });

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
    const card = event.target.closest('.sign-card');
    if (!card) return;
    const signId = card.dataset.signId;
    if (signId) {
      showMainView(signId, { moveFocus: true });
    }
  });

  el.birthDay.addEventListener('change', updateBirthResult);
  el.birthMonth.addEventListener('change', updateBirthResult);

  el.btnConfirmBirthSign.addEventListener('click', () => {
    const signId = el.btnConfirmBirthSign.dataset.signId;
    if (signId) {
      showMainView(signId, { moveFocus: true });
    }
  });

  el.btnChangeSign.addEventListener('click', () => {
    showPickerView({ moveFocus: true });
  });

  el.tabsBar.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
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

  el.btnChangeCity.addEventListener('click', openCityDialog);

  el.btnCloseCity.addEventListener('click', () => {
    el.cityDialog.close();
  });

  el.cityList.addEventListener('click', (event) => {
    const option = event.target.closest('.city-option');
    if (!option) return;
    const nextCityId = getCityById(option.dataset.cityId).id;
    state.cityId = nextCityId;
    saveCityId(nextCityId);
    el.cityDialog.close();
    loadAstroSection(nextCityId);
  });

  el.cityDialog.addEventListener('close', () => {
    el.cityDialog.returnValue = '';
  });

  // Coordinate-based backdrop click fallback only when native closedBy is unsupported
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    let pointerDownOutside = false;

    const isPointOutsideDialog = (event) => {
      const rect = el.cityDialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    el.cityDialog.addEventListener('pointerdown', (event) => {
      pointerDownOutside = event.target === el.cityDialog && isPointOutsideDialog(event);
    });

    el.cityDialog.addEventListener('pointerup', (event) => {
      if (pointerDownOutside && event.target === el.cityDialog && isPointOutsideDialog(event)) {
        el.cityDialog.close();
      }
      pointerDownOutside = false;
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
        loadAstroSection(state.cityId);
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
  state.cityId = getCityById(getSavedCityId()).id;
  const savedSign = getSignById(getSavedSign());
  state.signId = savedSign ? savedSign.id : null;

  applyFontLevel(state.fontLevel, { persist: false });
  syncColorSchemeUi();
  renderHeaderDate();
  populateSignGrid();
  populateBirthHelperSelects();
  populateCityDialog();
  bindEvents();
  registerServiceWorker();

  if (state.signId) {
    showMainView(state.signId, { moveFocus: false });
  } else {
    showPickerView({ moveFocus: false });
  }
}

init();
