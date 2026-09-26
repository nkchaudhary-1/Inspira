// Hero building blocks shared by all modes. Time-based text uses `data-bind`
// attributes that the app ticker updates every second — no re-render needed.

import * as store from '../core/store.js';
import { todayKey, clockParts, formatLong, formatFull, greeting } from '../core/dates.js';
import { quoteFor, CATEGORIES } from '../data/quotes.js';
import { describe, convert, searchCity, locateMe, setLocation } from '../services/weather.js';
import { h, icon, reactive } from './dom.js';
import { openPopover, closeOverlay, toast } from './overlay.js';

// Bound text is filled at creation so re-rendered regions never flash empty.
export function clock(variant = 'hero') {
  const p = store.prefs();
  const now = new Date();
  // The display face (Boldonse) has proportional digits — "0" is more than twice
  // as wide as "1" — so ticking seconds inline would shove AM/PM around every
  // second. There, seconds sit small under AM/PM instead; HH:MM stays put.
  if (variant === 'display' && p.showSeconds) {
    const { time, meridiem } = clockParts(now, p.clock24, false);
    return h(
      'div',
      { class: 'clock clock--display has-seconds', role: 'timer', 'aria-live': 'off' },
      h('span', { class: 'clock__time', dataset: { bind: 'time-hm' } }, time),
      h(
        'span',
        { class: 'clock__side' },
        meridiem && h('span', { class: 'clock__meridiem', dataset: { bind: 'meridiem' } }, meridiem),
        h('span', { class: 'clock__seconds', dataset: { bind: 'seconds' } }, String(now.getSeconds()).padStart(2, '0')),
      ),
    );
  }
  const { time, meridiem } = clockParts(now, p.clock24, p.showSeconds);
  return h(
    'div',
    { class: `clock clock--${variant}`, role: 'timer', 'aria-live': 'off' },
    h('span', { class: 'clock__time', dataset: { bind: 'time' } }, time),
    h('span', { class: 'clock__meridiem', dataset: { bind: 'meridiem' } }, meridiem),
  );
}

export const dateLine = (className = 'hero-date') => h('div', { class: className, dataset: { bind: 'date' } }, formatLong(todayKey()));

/** "Saturday, 02 September 2026" — the Clock face's date. */
export const fullDateLine = (className = 'clockface__date') => h('div', { class: className, dataset: { bind: 'date-full' } }, formatFull(todayKey()));

/** Figma footer on Quote and Focus: date, then "10:45 PM  24° Delhi". */
export function metaFooter() {
  return h('footer', { class: 'meta-foot' }, fullDateLine('meta-foot__date'), h('div', { class: 'meta-foot__line' }, clock('meta'), weather('meta')));
}

export function greetingLine() {
  const name = store.prefs().name;
  return h('div', { class: 'eyebrow', dataset: { bind: 'greeting' } }, `${greeting(new Date().getHours())}${name ? `, ${name}` : ''}`);
}

// ---------- weather ----------

export function weather(variant = 'full') {
  return reactive(
    h('div', { class: `weather weather--${variant}` }),
    () => {
      const { location, weather: w } = store.getDevice();
      if (!location) {
        return h('button', { type: 'button', class: 'weather__add', onClick: (e) => openLocation(e.currentTarget) }, icon('location', 14), 'Add weather');
      }
      if (!w) return h('span', { class: 'weather__place' }, location.name);
      const { label } = describe(w.code);
      const unit = '°';
      const btn = h(
        'button',
        { type: 'button', class: 'weather__btn', title: 'Change location', onClick: (e) => openLocation(e.currentTarget) },
        h('span', { class: 'weather__temp' }, `${convert(w.temp)}${unit}`),
        h('span', { class: 'weather__place' }, location.name),
      );
      if (variant === 'inline') return [btn, h('span', { class: 'weather__label' }, label)];
      if (variant === 'meta') return btn;
      if (variant === 'display') {
        return [btn, h('div', { class: 'weather__detail' }, `${label} H ${convert(w.high)}° / L ${convert(w.low)}°`)];
      }
      return [
        btn,
        h(
          'div',
          { class: 'weather__detail' },
          h('span', null, label),
          h('span', { class: 'weather__range' }, `H ${convert(w.high)}°  /  L ${convert(w.low)}°`),
        ),
      ];
    },
    () => [store.getDevice().location, store.getDevice().weather, store.prefs().units],
  );
}

export function openLocation(anchor) {
  const input = h('input', { class: 'field__input', placeholder: 'Search a city', 'aria-label': 'Search a city', autofocus: true });
  const results = h('ul', { class: 'loc-results', role: 'listbox' });
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) return results.replaceChildren();
    timer = setTimeout(async () => {
      try {
        const list = await searchCity(q);
        results.replaceChildren(
          ...(list.length
            ? list.map((r) =>
                h(
                  'li',
                  null,
                  h(
                    'button',
                    { type: 'button', class: 'loc-result', onClick: () => choose(r) },
                    h('span', null, r.name),
                    h('span', { class: 'loc-result__detail' }, r.detail),
                  ),
                ),
              )
            : [h('li', { class: 'empty' }, 'No matches')]),
        );
      } catch {
        results.replaceChildren(h('li', { class: 'empty' }, 'Search is offline right now'));
      }
    }, 280);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') results.querySelector('button')?.click();
  });
  const choose = (loc) => {
    closeOverlay();
    setLocation({ lat: loc.lat, lon: loc.lon, name: loc.name });
  };
  const locate = h(
    'button',
    {
      type: 'button',
      class: 'text-btn',
      onClick: async (e) => {
        e.currentTarget.textContent = 'Locating…';
        try {
          choose(await locateMe());
        } catch {
          closeOverlay();
          toast('Couldn’t get your location — try searching instead');
        }
      },
    },
    'Use my current location',
  );
  const remove = store.getDevice().location
    ? h(
        'button',
        { type: 'button', class: 'text-btn text-btn--danger', onClick: () => (closeOverlay(), store.setDevice({ location: null, weather: null })) },
        'Hide weather',
      )
    : null;
  openPopover(
    anchor,
    h('div', { class: 'loc' }, h('div', { class: 'field__label' }, 'Weather location'), input, results, h('div', { class: 'loc__foot' }, locate, remove)),
    { align: 'center' },
  );
}

// ---------- quote ----------

function currentQuote() {
  const today = todayKey();
  const shift = store.getDevice().quoteShift;
  const n = shift?.date === today ? shift.n : 0;
  return quoteFor(today, store.prefs().quoteCategory, n);
}

export function nextQuote() {
  const today = todayKey();
  const shift = store.getDevice().quoteShift;
  const n = shift?.date === today ? shift.n + 1 : 1;
  store.setDevice({ quoteShift: { date: today, n } });
}

export function quote(variant = 'hero') {
  let lastText = null;
  return reactive(
    h('figure', { class: `quote quote--${variant}` }),
    () => {
      const q = currentQuote();
      // Fade only when the line changes in place ("Another one"), not on first render.
      const fresh = lastText !== null && q.text !== lastText;
      lastText = q.text;
      // Clock and Quote faces show the line plainly (Figma); others keep quotation marks.
      const plain = variant === 'line' || variant === 'display';
      const body = variant === 'display' ? q.text.replace(/\.$/, '') : q.text;
      const long = body.length > 90;
      // Laws of UX carry a name: prefix it on the Clock line, headline it on the Quote face.
      const text = h(
        'blockquote',
        { class: ['quote__text', fresh && 'is-entering', long && 'is-long'] },
        variant === 'line' && q.title && h('strong', { class: 'quote__law' }, `${q.title} · `),
        plain ? body : `“${body}”`,
      );
      if (variant === 'display') {
        return [
          q.title && h('div', { class: 'quote__title' }, q.title),
          text,
          h(
            'div',
            { class: 'quote__tools' },
            h('button', { type: 'button', class: 'text-btn', onClick: (e) => openCategories(e.currentTarget) }, categoryLabel()),
            h('span', { class: 'sep' }, '·'),
            h('button', { type: 'button', class: 'text-btn', onClick: nextQuote, title: 'Another one (Q)' }, 'Another one'),
            h('span', { class: 'sep' }, '·'),
            h('button', { type: 'button', class: 'text-btn', onClick: () => copyQuote(q.title ? `${q.title} — ${q.text}` : q.text) }, 'Copy'),
            q.url && [h('span', { class: 'sep' }, '·'), h('a', { class: 'text-btn', href: q.url, target: '_blank', rel: 'noopener' }, `Read on ${q.author} ↗`)],
          ),
        ];
      }
      if (variant !== 'feature') return text;
      return [
        text,
        h('figcaption', { class: 'quote__by' }, `— ${q.author}`),
        h(
          'div',
          { class: 'quote__tools' },
          h('button', { type: 'button', class: 'text-btn', onClick: (e) => openCategories(e.currentTarget) }, categoryLabel()),
          h('span', { class: 'sep' }, '·'),
          h('button', { type: 'button', class: 'text-btn', onClick: nextQuote, title: 'Another one (Q)' }, 'Another one'),
        ),
      ];
    },
    () => [todayKey(), store.prefs().quoteCategory, store.getDevice().quoteShift],
  );
}

function copyQuote(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast('Copied'),
    () => toast('Couldn’t copy — select the text instead'),
  );
}

const categoryLabel = () => CATEGORIES.find((c) => c.id === store.prefs().quoteCategory)?.label || 'Motivation';

export function openCategories(anchor) {
  const current = store.prefs().quoteCategory;
  openPopover(
    anchor,
    h(
      'div',
      { class: 'menu', role: 'menu' },
      CATEGORIES.map((c) =>
        h(
          'button',
          {
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': String(c.id === current),
            class: ['menu__item', c.id === current && 'is-active'],
            onClick: () => {
              closeOverlay();
              store.setPrefs({ quoteCategory: c.id });
              store.setDevice({ quoteShift: { date: null, n: 0 } });
            },
          },
          c.label,
          c.id === current ? icon('check', 14) : null,
        ),
      ),
    ),
    { align: 'center' },
  );
}
