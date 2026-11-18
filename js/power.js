// The Power page (Phase 5b): the power curve, heart rate against power and the FTP review prompt.
// Every figure comes from power_curve.json, hr_power.json and ftp_rule.json, or, for any two dates,
// from the local server's /curve address (the pipeline's own code).  The page draws; it does not calculate.
(function (root) {
  'use strict';
  const U = root.U, Plot = root.Plot, C = Plot.COL;
  const LINE = { a: '#4B2C6B', y: '#0b6e75', b: '#B9A6D9' };
  const TICKS = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 18000];
  const M = { l: 46, r: 16, t: 10, b: 22 };

  // ---- the power curve
  async function scopeOf(App, key, get) {
    const PC = App.power;
    if (PC.scopes[key]) return PC.scopes[key];
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (!m) return null;
    const out = await get('curve?from=' + m[1] + '&to=' + m[2]);
    PC.scopes[key] = out;              // kept for the rest of the visit
    return out;
  }
  function label(App, key) {
    if (key === 'last_42_days') return 'Last 42 days';
    if (key === 'last_90_days') return 'Last 90 days';
    if (key === 'all') return 'All time (' + App.years[0] + '–' + App.years[App.years.length - 1] + ')';
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (m) return U.dayMonth(m[1], true) + ' to ' + U.dayMonth(m[2], true);
    return key;
  }
  function lines(App, st) {
    const thisYear = App.today.slice(0, 4), lastYear = String(+thisYear - 1);
    const out = [['a', st.period]];
    if (st.period === 'last_42_days' || st.period === 'last_90_days') out.push(['y', thisYear]);
    if (st.against === 'all' && st.period !== 'all') out.push(['b', 'all']);
    if (st.against === 'last_year' && st.period !== lastYear) out.push(['b', lastYear]);
    return out;
  }
  function drawCurve(App, series) {
    const D = App.power.durations_s, lx = s => Math.log(s);
    const P = Plot.make(document.getElementById('pcur'), 380, M);
    let top = 1;
    series.forEach(s => s.data && s.data.w.forEach(v => { if (v != null && v > top) top = v; }));
    const ys = U.scale(0, top * 1.04, 6);
    Plot.yAxis(P, ys, 'l', null, v => v + ' W');
    const X = s => P.x(lx(s), lx(D[0]), lx(D[D.length - 1]));
    TICKS.forEach(s => { P.g.strokeStyle = C.line; P.g.beginPath(); P.g.moveTo(Math.round(X(s)) + 0.5, P.t); P.g.lineTo(Math.round(X(s)) + 0.5, P.h - P.b); P.g.stroke(); });
    Plot.xLabels(P, TICKS.map(s => [X(s), U.durLabel(s)]));
    series.slice().reverse().forEach(s => {
      if (!s.data) return;
      Plot.line(P, D.map((d, i) => [X(d), s.data.w[i] == null ? null : P.y(s.data.w[i], ys)]), { colour: LINE[s.slot], width: s.slot === 'a' ? 2.4 : 1.8 });
    });
    const near = x => {
      let best = 0;
      D.forEach((d, i) => { if (Math.abs(X(d) - x) < Math.abs(X(D[best]) - x)) best = i; });
      return best;
    };
    const rideDate = id => { const r = App.rides.find(z => z.ride_id === id); return r ? U.dayMonth(r.date, true) : ''; };
    Plot.hover(P, x => {
      const i = near(x);
      return '<b>' + U.durLabel(D[i]) + '</b>' + series.filter(s => s.data).map(s =>
        '<span style="color:' + LINE[s.slot] + '">' + U.esc(s.name) + ' ' + U.dash(U.num(s.data.w[i])) + (s.data.w[i] != null ? ' W · ' + rideDate(s.data.ride[i]) : '') + '</span>').join('');
    }, x => {
      const s = series[0];
      const id = s.data && s.data.ride[near(x)];
      if (id) location.hash = '#/ride/' + id;
    });
    Power.shownCurve = series.map(s => ({ slot: s.slot, key: s.key, name: s.name, w: s.data ? s.data.w : null, ride: s.data ? s.data.ride : null }));
  }

  // ---- heart rate against power
  function hrLabel(App, key, sc) {
    if (!sc) return key;
    const span = sc.first_ride && sc.last_ride && (sc.first_ride.slice(5, 7) !== '01' || sc.last_ride.slice(5, 7) !== '12') && /^\d{4}$/.test(key)
      ? ' (' + U.MONTHS[+sc.first_ride.slice(5, 7) - 1].slice(0, 3) + '–' + U.MONTHS[+sc.last_ride.slice(5, 7) - 1].slice(0, 3) + ')' : '';
    const name = key === 'last_90_days' ? 'Last 90 days' : key.replace('-Q', ' Q');
    return name + span + ' (' + sc.rides + ' ride' + (sc.rides === 1 ? '' : 's') + ')';
  }
  function drawHrPower(App, st) {
    const H = App.hrPower, keys = [['y', st.hrA], ['a', st.hrB]];
    const P = Plot.make(document.getElementById('phr'), 260, { l: 40, r: 26, t: 10, b: 22 });
    let lo = Infinity, hi = -Infinity, wlo = Infinity, whi = -Infinity;
    keys.forEach(k => ((H.scopes[k[1]] || {}).bands || []).forEach(b => {
      lo = Math.min(lo, b[2]); hi = Math.max(hi, b[2]); wlo = Math.min(wlo, b[0]); whi = Math.max(whi, b[0] + H.band_w);
    }));
    if (!isFinite(lo)) { P.g.fillStyle = C.mute; P.g.fillText('No bands of ten minutes or more in these periods.', P.l + 10, P.t + 20); Power.shownHr = []; return; }
    const ys = U.scale(Math.floor(lo - 3), hi + 3, 5), xs = U.scale(wlo, whi, 8);
    Plot.yAxis(P, ys, 'l');
    Plot.xLabels(P, xs.ticks.map(w => [P.x(w, xs.lo, xs.hi), w + ' W']));
    const mid = b => b[0] + H.band_w / 2;
    keys.forEach(k => {
      const bands = (H.scopes[k[1]] || {}).bands || [];
      Plot.line(P, bands.map(b => [P.x(mid(b), xs.lo, xs.hi), P.y(b[2], ys)]), { colour: LINE[k[0]], width: 2 });
      bands.forEach(b => { P.g.fillStyle = LINE[k[0]]; P.g.beginPath(); P.g.arc(P.x(mid(b), xs.lo, xs.hi), P.y(b[2], ys), 2.5, 0, 7); P.g.fill(); });
    });
    Plot.hover(P, x => {
      const w = xs.lo + (x - P.l) / P.pw * (xs.hi - xs.lo), band = Math.floor(w / H.band_w) * H.band_w;
      return '<b>' + band + '–' + (band + H.band_w - 1) + ' W</b>' + keys.map(k => {
        const b = ((H.scopes[k[1]] || {}).bands || []).find(z => z[0] === band);
        return '<span style="color:' + LINE[k[0]] + '">' + (b ? U.num(b[2], 1) + ' bpm · ' + U.hm(b[1]) : '—') + '</span>';
      }).join('');
    });
    Power.shownHr = keys.map(k => ({ key: k[1], bands: ((H.scopes[k[1]] || {}).bands || []) }));
  }

  // ---- the FTP review prompt
  function drawRule(App) {
    const F = App.ftpRule, from = U.addDays(App.today, -364);
    const rows = F.rides.filter(r => r.date >= from);
    const P = Plot.make(document.getElementById('pftp'), 230, { l: 40, r: 12, t: 10, b: 22 });
    if (!rows.length) { Power.shownRule = []; return; }
    let lo = Infinity, hi = -Infinity;
    rows.forEach(r => { lo = Math.min(lo, r.index); hi = Math.max(hi, r.index); });
    const base = F.status.baseline;
    if (base) { lo = Math.min(lo, base * 0.9); hi = Math.max(hi, base * 1.1); }
    const ys = U.scale(lo - 0.05, hi + 0.05, 5), x = d => P.x(U.dayIndex(from, d), 0, 364);
    Plot.yAxis(P, ys, 'l', null, v => v.toFixed(2));
    Plot.xLabels(P, U.dateTicks(from, App.today, 8).map(t => [x(t[0]), t[1]]));
    if (base) {
      const k = F.rules.flag_pct / 100, y1 = P.y(base * (1 + k), ys), y0 = P.y(base * (1 - k), ys);
      Plot.rect(P, P.l, y1, P.pw, y0 - y1, 'rgba(75,44,107,.08)');
      Plot.line(P, [[P.l, P.y(base, ys)], [P.w - P.r, P.y(base, ys)]], { colour: C.mute, width: 1, dash: [4, 3] });
    }
    rows.forEach(r => { P.g.fillStyle = '#9670CC'; P.g.beginPath(); P.g.arc(x(r.date), P.y(r.index, ys), 2.6, 0, 7); P.g.fill(); });
    Plot.line(P, rows.map(r => [x(r.date), r.median == null ? null : P.y(r.median, ys)]), { colour: LINE.a, width: 2 });
    (F.resets || []).filter(r => r.date >= from).forEach(r => Plot.vline(P, x(r.date), C.mute, [2, 3]));
    Plot.hover(P, px => {
      let best = rows[0];
      rows.forEach(r => { if (Math.abs(x(r.date) - px) < Math.abs(x(best.date) - px)) best = r; });
      return '<b>' + U.dayMonth(best.date, true) + '</b><span>Index ' + best.index.toFixed(3) + '</span><span>NP ' + U.num(best.np_w) + ' W · HR ' + U.num(best.avg_hr_bpm) +
        ' − ' + best.resting_hr + '</span>' + (best.median != null ? '<span style="color:' + LINE.a + '">Median ' + best.median.toFixed(3) + '</span>' : '');
    }, px => {
      let best = rows[0];
      rows.forEach(r => { if (Math.abs(x(r.date) - px) < Math.abs(x(best.date) - px)) best = r; });
      location.hash = '#/ride/' + best.ride_id;
    });
    Power.shownRule = rows;
  }
  function ruleBox(F) {
    const s = F.status;
    if (s.state === 'review') return '<div class="warnb bad"><b>Review FTP.</b>  On ' + U.dayMonth(s.flag.date, true) + ' the median index stood ' + (s.flag.diff_pct > 0 ? '+' : '−') +
      U.num(Math.abs(s.flag.diff_pct), 1) + '% from its baseline (' + s.flag.current.toFixed(3) + ' against ' + s.flag.baseline.toFixed(3) + ').  A test would settle it; FTP is never changed for you.</div>';
    if (s.state === 'within') return '<div class="warnb"><b>Within the band.</b>  Baseline ' + s.baseline.toFixed(3) + ' from ' + U.dayMonth(s.baseline_from, true) +
      (s.diff_pct != null ? '; the median now ' + (s.diff_pct >= 0 ? '+' : '−') + U.num(Math.abs(s.diff_pct), 1) + '%' : '') + ' (flag at ±' + F.rules.flag_pct + '%).</div>';
    if (s.state === 'collecting') return '<div class="warnb"><b>' + U.esc(s.message) + '.</b>  The baseline is the median of the first ' + F.rules.baseline_rides + ' qualifying rides.</div>';
    return '<div class="warnb"><b>No baseline yet.</b>  The first baseline is the median of the first ' + F.rules.baseline_rides + ' qualifying rides from ' +
      U.dayMonth(F.rules.first_baseline_from, true) + '.  Until then the index is shown and nothing is flagged.</div>';
  }

  async function show(App, main, get) {
    const st = App.state.power;
    if (!App.power || !App.hrPower || !App.ftpRule) {
      main.innerHTML = '<div class="msg">No power_curve.json, hr_power.json or ftp_rule.json yet: the pipeline writes them on its next run.</div>';
      return;
    }
    const years = Object.keys(App.power.scopes).filter(k => /^\d{4}$/.test(k)).sort().reverse();
    const hrKeys = Object.keys(App.hrPower.scopes).sort().reverse();
    if (!st.hrA) {
      const ly = String(+App.today.slice(0, 4) - 1);
      st.hrA = App.hrPower.scopes[ly] ? ly : hrKeys.find(k => /^\d{4}$/.test(k));
      st.hrB = 'last_90_days';
    }
    const btn = (on, name, attr) => '<button class="btn' + (on ? ' on' : '') + '" ' + attr + '>' + name + '</button>';
    const yearOn = /^\d{4}$/.test(st.period) && st.period !== App.today.slice(0, 4);
    const custom = /_/.test(st.period);
    const opt = (k, sel) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + U.esc(hrLabel(App, k, App.hrPower.scopes[k])) + '</option>';
    main.innerHTML = '<div class="bar pw"><h2 class="free">Power</h2><span class="lbl gap">Period</span>' +
      btn(st.period === 'last_42_days', '42 days', 'data-pp="last_42_days"') + btn(st.period === 'last_90_days', '90 days', 'data-pp="last_90_days"') +
      btn(st.period === App.today.slice(0, 4), 'This year', 'data-pp="' + App.today.slice(0, 4) + '"') +
      '<select id="pyear" class="btn' + (yearOn ? ' on' : '') + '"><option value="">A year…</option>' + years.map(y => '<option' + (y === st.period ? ' selected' : '') + '>' + y + '</option>').join('') + '</select>' +
      '<span class="lbl gap">From</span><input type="date" id="pfrom" value="' + (custom ? st.period.slice(0, 10) : '') + '"><span class="lbl">to</span><input type="date" id="pto" value="' + (custom ? st.period.slice(11) : '') + '">' +
      btn(custom, 'Show', 'id="pgo"') +
      '<span class="lbl gap">Against</span>' + btn(st.against === 'all', 'All time', 'data-pa="all"') + btn(st.against === 'last_year', 'Last year', 'data-pa="last_year"') +
      btn(st.against === 'none', 'None', 'data-pa="none"') + '</div>' +
      '<div class="card"><h3>Power Curve: Best Power at Every Duration</h3><div id="pcur"></div><div class="legend" id="pleg"></div>' +
      '<p class="note" id="pnote"></p></div>' +
      '<div class="cols two"><div class="card"><h3>Heart Rate Against Power</h3><div class="ctl"><select id="hra">' + hrKeys.map(k => opt(k, st.hrA)).join('') +
      '</select><span class="lbl">against</span><select id="hrb">' + hrKeys.map(k => opt(k, st.hrB)).join('') + '</select></div><div id="phr"></div>' +
      '<div class="legend"><span><i style="background:' + LINE.y + '"></i>' + U.esc(hrLabel(App, st.hrA, App.hrPower.scopes[st.hrA])) + '</span><span><i style="background:' + LINE.a + '"></i>' +
      U.esc(hrLabel(App, st.hrB, App.hrPower.scopes[st.hrB])) + '</span></div><p class="note">' + U.esc(hrNote(App.hrPower)) + '</p></div>' +
      '<div class="card"><h3>FTP Review Prompt (Decision 16)</h3>' + ruleBox(App.ftpRule) + '<div id="pftp"></div>' +
      '<div class="legend"><span><i style="background:#9670CC"></i>Index = NP ÷ (average HR − resting HR), one dot a ride</span><span><i style="background:' + LINE.a + '"></i>Median of the last ' +
      App.ftpRule.rules.current_rides + ' within ' + App.ftpRule.rules.current_days + ' days</span></div><p class="note">The last 12 months: ' + U.num(App.ftpRule.rides.filter(r => r.date >= U.addDays(App.today, -364)).length) +
      ' rides of 30 minutes or more with sound heart rate.  A dotted line marks a reset (FTP, resting heart rate or a drug change).  When a baseline exists, the band is ±' + App.ftpRule.rules.flag_pct +
      '% around it, and Summary shows "Review FTP" when the median leaves it.  FTP is never changed for you.</p></div></div>';
    const set = (k, v) => { st[k] = v; show(App, main, get); };
    main.querySelectorAll('[data-pp]').forEach(el => { el.onclick = () => set('period', el.dataset.pp); });
    main.querySelectorAll('[data-pa]').forEach(el => { el.onclick = () => set('against', el.dataset.pa); });
    document.getElementById('pyear').onchange = e => { if (e.target.value) set('period', e.target.value); };
    document.getElementById('pgo').onclick = () => {
      const a = document.getElementById('pfrom').value, b = document.getElementById('pto').value;
      if (a && b && a <= b) set('period', a + '_' + b);
    };
    document.getElementById('hra').onchange = e => set('hrA', e.target.value);
    document.getElementById('hrb').onchange = e => set('hrB', e.target.value);
    const wanted = lines(App, st);
    const series = [];
    for (const [slot, key] of wanted) {
      let data = null;
      try { data = await scopeOf(App, key, get); } catch (e) { data = null; }
      series.push({ slot, key, name: label(App, key), data });
    }
    document.getElementById('pleg').innerHTML = series.map(s => '<span><i style="background:' + LINE[s.slot] + '"></i>' + U.esc(s.name) +
      (s.data ? ' (' + U.num(s.data.rides) + ' rides)' : ' (could not be read)') + '</span>').join('');
    const at20 = App.power.durations_s.indexOf(1200);
    document.getElementById('pnote').textContent = 'At 20 minutes: ' + series.filter(s => s.data).map(s => U.dash(U.num(s.data.w[at20])) + ' W ' + s.name.toLowerCase().replace(/ \(.*/, '')).join(', ') +
      '.  A label follows the pointer and names the ride behind each point; a click opens the ride behind the first line.  Pauses count as 0 W, as in the peak powers; rides with a power warning are left out.';
    App.redraw = () => { drawCurve(App, series); drawHrPower(App, st); drawRule(App); };
    App.redraw();
    Power.shown = { period: st.period, against: st.against, hrA: st.hrA, hrB: st.hrB };
  }
  function hrNote(H) {
    return 'Mean heart rate in each ' + H.band_w + ' W band of 30-second power, after the first five minutes, for bands holding ten minutes or more.  A lower line means less heart rate for the same power.';
  }

  const Power = { show, lines, shown: null, shownCurve: null, shownHr: null, shownRule: null };
  root.Power = Power;
})(window);
