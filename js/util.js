// Formatting and display arithmetic only: no ride figure is calculated here (design.md, section 8).
// Plain functions, usable in the browser (window.U) and in the tests (node).
(function (root) {
  'use strict';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

  // Seconds as h:mm (whole minutes, rounded down) and h:mm:ss.  A blank stays blank.
  function hm(s) {
    if (s == null) return '';
    s = Math.round(s);
    return Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60));
  }
  function hms(s) {
    if (s == null) return '';
    s = Math.round(s);
    return Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  }
  // A number to d decimal places with thousands commas.  null is blank, never 0.
  function num(v, d) {
    if (v == null) return '';
    d = d || 0;
    return Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const dash = s => (s === '' || s == null ? '—' : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Distance is held and shown in kilometres (Andy's decision, 18 November 2026).
  // For miles: { unit: 'mi', speed: 'mph', perKm: 0.621371 }.
  const DIST = { unit: 'km', speed: 'km/h', perKm: 1 };
  const dist = (km, d) => (km == null ? '' : num(km * DIST.perKm, d == null ? 1 : d));

  // Sum of what is shown.  A missing value adds nothing; the count of rides is given separately.
  // Distance and energy are null when no ride in the set carries them, so they show as blank, not 0.
  const sum = (rides, key) => rides.reduce((a, r) => a + (r[key] == null ? 0 : r[key]), 0);
  const sumOrNull = (rides, key) => (rides.some(r => r[key] != null) ? sum(rides, key) : null);
  function totals(rides) {
    return { rides: rides.length, moving_s: sum(rides, 'moving_s'), load: sum(rides, 'load'),
      distance_km: sumOrNull(rides, 'distance_km'), energy_kcal: sumOrNull(rides, 'energy_kcal') };
  }

  // The value below which a given share of the numbers fall (for a chart scale that ignores a few dips).
  function percentile(values, share) {
    const v = values.filter(x => x != null).sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(share * v.length))] : null;
  }

  // The day weeks start on, as JavaScript counts (Sunday 0): Monday unless settings.json says otherwise
  // (load.week_start; Saturday from 19 November 2026, to match Andy's weekly health check-in).
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let WS = 1;
  function setWeekStart(name) { const i = WEEKDAYS.indexOf(String(name || 'monday').toLowerCase()); WS = i < 0 ? 1 : i; }
  const weekStartIndex = () => WS;
  // The seven short day names in week order.
  const dayNames = () => [0, 1, 2, 3, 4, 5, 6].map(k => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(WS + k) % 7]);

  // The weeks (from the start day, seven days each) that cover a month.  m is 0 to 11.
  function monthGrid(y, m) {
    const off = (new Date(y, m, 1).getDay() - WS + 7) % 7, dim = new Date(y, m + 1, 0).getDate(), weeks = [];
    for (let w = 0; w * 7 - off < dim; w++) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const dt = new Date(y, m, 1 + w * 7 + i - off);
        days.push({ key: iso(dt.getFullYear(), dt.getMonth(), dt.getDate()), day: dt.getDate(), inMonth: dt.getMonth() === m });
      }
      weeks.push(days);
    }
    return weeks;
  }
  function byDate(rides) {
    const map = {};
    rides.forEach(r => (map[r.date] = map[r.date] || []).push(r));
    return map;
  }

  // Zone limits as text.  The pipeline puts a value on a boundary in the lower zone, so a zone
  // runs from one above the last limit up to and including its own.
  function zoneRanges(upperPct, base, unit) {
    const out = [];
    let lo = 0;
    upperPct.forEach(p => {
      const hi = Math.floor(base * p / 100 + 1e-9);
      out.push(lo + '–' + hi + ' ' + unit);
      lo = hi + 1;
    });
    out.push(lo + '+ ' + unit);
    return out;
  }
  const share = (part, whole) => (whole ? Math.round(100 * part / whole) : 0);

  // Centred rolling mean for display.  A missing second stays missing and is not counted.
  function smooth(a, w) {
    if (!a || w <= 1) return a;
    const n = a.length, ps = new Float64Array(n + 1), pc = new Int32Array(n + 1), h = Math.floor(w / 2), out = new Array(n);
    for (let i = 0; i < n; i++) { ps[i + 1] = ps[i] + (a[i] == null ? 0 : a[i]); pc[i + 1] = pc[i] + (a[i] == null ? 0 : 1); }
    for (let i = 0; i < n; i++) {
      if (a[i] == null) { out[i] = null; continue; }
      const lo = Math.max(0, i - h), hi = Math.min(n, i + h + 1);
      out[i] = (ps[hi] - ps[lo]) / (pc[hi] - pc[lo]);
    }
    return out;
  }

  // Which records (records.json) a ride holds: { power_5: ['all', '2026'], ... }.
  function recordTags(records, rideId) {
    const out = {};
    const scopes = (records && records.scopes) || {};
    Object.keys(scopes).forEach(scope => Object.keys(scopes[scope] || {}).forEach(key => {
      const e = scopes[scope][key];
      if (e && e.ride_id === rideId) (out[key] = out[key] || []).push(scope);
    }));
    return out;
  }
  function scopeLabel(scope) {
    if (scope === 'all') return 'All-time best';
    if (scope === 'last_90_days') return 'Best of last 90 days';
    return 'Best of ' + scope;
  }

  // The address after the #: month/2026-11, year/2026, ride/<ride ID>, gym/<session>, fitness, weeks.
  function parseHash(hash) {
    const p = String(hash || '').replace(/^#\/?/, '').split('/');
    if (['fitness', 'weeks', 'summary', 'power', 'records'].includes(p[0])) return { view: p[0] };
    if (p[0] === 'gym' && p[1]) return { view: 'gym', id: p[1] };
    if (p[0] === 'ride' && p[1]) return { view: 'ride', id: p[1] };
    if (p[0] === 'year' && /^\d{4}$/.test(p[1] || '')) return { view: 'year', y: +p[1] };
    const m = /^(\d{4})-(\d{2})$/.exec(p[1] || '');
    if (p[0] === 'month' && m && +m[2] >= 1 && +m[2] <= 12) return { view: 'month', y: +m[1], m: +m[2] - 1 };
    return null;
  }

  // Line points for a chart narrower than the ride is long: per pixel column, the lowest and the
  // highest value in time order, so short spikes stay visible.  Returns [x, value] pairs; a null
  // value breaks the line.
  function columns(values, n, width) {
    const pts = [];
    if (n <= width * 2) {
      for (let i = 0; i < n; i++) pts.push([i, values[i] == null ? null : values[i]]);
      return pts;
    }
    const per = n / width;
    for (let c = 0; c < width; c++) {
      const a = Math.floor(c * per), b = Math.min(n, Math.floor((c + 1) * per));
      let lo = null, hi = null, li = -1, hiI = -1, gap = false;
      for (let i = a; i < b; i++) {
        const v = values[i];
        if (v == null) { gap = true; continue; }
        if (lo == null || v < lo) { lo = v; li = i; }
        if (hi == null || v > hi) { hi = v; hiI = i; }
      }
      if (lo == null) { pts.push([a, null]); continue; }
      if (li <= hiI) { pts.push([li, lo]); if (hiI !== li) pts.push([hiI, hi]); }
      else { pts.push([hiI, hi]); pts.push([li, lo]); }
      if (gap && b - a > 2 && values[b - 1] == null) pts.push([b - 1, null]);
    }
    return pts;
  }

  // ---- Phase 5: dates and chart scales (display only)

  // Days from one ISO date to another, and the ISO date n days on.
  const DAY = 86400000;
  const utc = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const dayIndex = (first, day) => Math.round((utc(day) - utc(first)) / DAY);
  function addDays(day, n) {
    const d = new Date(utc(day) + n * DAY);
    return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const SHORT = MONTHS.map(m => m.slice(0, 3));
  const dayMonth = (day, year) => +day.slice(8, 10) + ' ' + SHORT[+day.slice(5, 7) - 1] + (year ? ' ' + day.slice(0, 4) : '');

  // A scale with round numbers: { lo, hi, step, ticks } covering lo..hi in about n steps.
  const STEPS = [1, 2, 2.5, 5, 10];
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    return STEPS.find(s => s * p >= raw - 1e-12) * p;
  }
  function ticksOf(lo, step, count) {
    const out = [];
    for (let i = 0; i <= count; i++) out.push(+(lo + i * step).toFixed(6));
    return out;
  }
  function scale(lo, hi, n) {
    if (!(hi > lo)) hi = lo + 1;
    const step = niceStep((hi - lo) / (n || 4)), a = Math.floor(lo / step + 1e-9) * step;
    const count = Math.max(1, Math.ceil((hi - a) / step - 1e-9));
    return { lo: a, hi: a + count * step, step, ticks: ticksOf(a, step, count) };
  }
  // Two scales whose gridlines coincide: the left from 0 to leftMax, the right covering rLo..rHi
  // in the same number of steps.
  function pairedScales(leftMax, rLo, rHi, n) {
    if (!(rHi > rLo)) rHi = rLo + 1;
    if (!(leftMax > 0)) leftMax = 1;
    const fit = k => {
      const left = scale(0, leftMax, k), count = left.ticks.length - 1;
      let step = niceStep((rHi - rLo) / count);
      for (;;) {
        const a = Math.floor(rLo / step + 1e-9) * step;
        if (a + count * step >= rHi - 1e-9) return { left, right: { lo: a, hi: a + count * step, step, ticks: ticksOf(a, step, count) } };
        step = niceStep(step * 1.01);
      }
    };
    if (n) return fit(n);
    // no count asked for: the pair, of three to six steps, that leaves least of the chart empty
    let best = null, least = Infinity;
    [4, 5, 3, 6].forEach(k => {
      const p = fit(k), empty = (p.left.hi / leftMax) * ((p.right.hi - p.right.lo) / (rHi - rLo));
      if (empty < least - 1e-9) { least = empty; best = p; }
    });
    return best;
  }
  // Labels for a date axis: about `want` month (or year) starts between two ISO dates.  [[day, text]].
  function dateTicks(from, to, want) {
    const out = [], months = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7)) + 1;
    const every = [1, 2, 3, 6, 12, 24, 60].find(k => months / k <= (want || 10)) || 120;
    let y = +from.slice(0, 4), m = +from.slice(5, 7) - 1;
    for (let i = 0; i < months + 1; i++) {
      const day = iso(y, m, 1);
      if (day >= from && day <= to && (y * 12 + m) % every === 0) {
        out.push([day, every >= 12 ? String(y) : (m === 0 || every < 3 && out.length === 0 ? SHORT[m] + ' ' + y : SHORT[m])]);
      }
      if (++m > 11) { m = 0; y++; }
    }
    return out;
  }

  // A duration in seconds as the power curve labels it: 5 s, 1 min, 1 min 30 s, 20 min, 1 h, 2 h 15 min.
  function durLabel(s) {
    if (s < 60) return s + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');
    return Math.floor(s / 3600) + ' h' + (s % 3600 ? ' ' + Math.round(s % 3600 / 60) + ' min' : '');
  }
  // The first day of the week holding an ISO date (a Monday unless the week starts on another day).
  function monday(day) {
    const wd = (new Date(utc(day)).getUTCDay() - WS + 7) % 7;
    return addDays(day, -wd);
  }

  const U = { setWeekStart, weekStartIndex, dayNames, weekStart: monday, durLabel, monday, dayIndex, addDays, dayMonth, scale, pairedScales, dateTicks, MONTHS, pad, iso, hm, hms, num, dash, esc, DIST, dist, percentile, sum, totals, monthGrid, byDate, zoneRanges, share,
    smooth, recordTags, scopeLabel, parseHash, columns };
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
  else root.U = U;
})(typeof window !== 'undefined' ? window : this);
