// The Fitness page (the Performance Manager, handover decision 12): fitness, fatigue and form on one
// chart, daily load beneath.  Three buttons choose combined, gym or bike and every figure follows.
// Everything comes from load_daily.json; the page picks days out of it and adds up what it shows.
(function (root) {
  'use strict';
  const U = root.U, Plot = root.Plot, Hist = root.Hist, C = Plot.COL;
  const SEL = [['all', 'Combined'], ['gym', 'Gym'], ['bike', 'Bike']];
  const PERIODS = [[28, '28 days'], [90, '90 days'], [182, '6 months'], [365, '1 year'], [0, 'All']];
  const AHEAD = 28;                    // days of projection drawn after today
  const M = { l: 46, r: 46, t: 10, b: 22 };
  const signed = (v, d) => (v == null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '') + U.num(Math.abs(v), d == null ? 1 : d));

  function tile(label, id, text, sub, colour) {
    return '<div class="tile"><span>' + label + '</span><b data-fit="' + id + '"' + (colour ? ' style="color:' + colour + '"' : '') + '>' + U.dash(text) + '</b><em>' + (sub || '') + '</em></div>';
  }
  const UP = '#5F7F1A', DOWN = '#C8471B';      // the house colours for a rise and a fall

  // ---- Histograms: time at each power, heart rate and cadence over the days shown (histograms.json)
  const HKINDS = ['power', 'hr', 'cadence'];
  function fineOf(H, L, kind, v) {
    const a = U.addDays(L.first, v.from), b = U.addDays(L.first, v.t);
    return Hist.gather(H.days.filter(d => d.date >= a && d.date <= b).map(d =>
      kind === 'power' ? { first: 0, step: 5, s: d.power } : { first: d[kind + '_first'], step: 1, s: d[kind] }));
  }
  function drawHist(H, L, v, kind, size) {
    const Z = H.zones_now, uppers = Z && kind !== 'cadence' ? (kind === 'power' ? Z.power_upper_w : Z.hr_upper_bpm) : null;
    Hist.draw('fith-' + kind, kind, fineOf(H, L, kind, v), size, uppers ? Hist.zoneColour(uppers) : null,
      'No ' + (kind === 'power' ? 'power' : kind === 'hr' ? 'sound heart-rate' : 'cadence') + ' recording in the days shown.');
    Fitness.shownHist[kind] = Object.assign({ from: U.addDays(L.first, v.from), to: U.addDays(L.first, v.t) }, Hist.shown[kind]);
  }
  const sumOf = (a, from, to) => { let s = 0; for (let i = Math.max(0, from); i <= to; i++) s += a[i] || 0; return s; };

  // What the page shows for a selection and a period: the days, and the six figures in the boxes.
  // period: a number of days back from today (0: all), or { from, to } as two dates (Andy, 18 November 2026).
  // The six boxes always describe today; the chart and the histograms follow the days shown.
  function view(L, today, sel, period) {
    const last = L.days - 1, now = Math.max(0, Math.min(last, U.dayIndex(L.first, today)));
    let t = now, from, to;
    if (period && typeof period === 'object') {
      from = Math.max(0, Math.min(last, U.dayIndex(L.first, period.from)));
      to = Math.max(from, Math.min(last, U.dayIndex(L.first, period.to)));
      t = Math.min(now, to);
      if (to > now) to = Math.min(to, now + AHEAD);
    } else {
      from = period ? Math.max(0, t - period) : 0; to = Math.min(last, t + AHEAD);
    }
    const S = L[sel], load = i => (sel !== 'gym' ? L.bike_load[i] : 0) + (sel !== 'bike' ? L.gym_load[i] : 0);
    const loads = []; for (let i = 0; i <= last; i++) loads.push(load(i));
    return { t, from, to, S, loads,
      boxes: { ctl: S.ctl[now], atl: S.atl[now], tsb: S.tsb[now], change: S.ctl_change_7d[now],
        load7: Math.round(sumOf(loads, now - 6, now) * 10) / 10, load28: Math.round(sumOf(loads, now - 27, now) * 10) / 10 } };
  }

  function draw(App, L, v, sel, onRange) {
    const day = i => U.addDays(L.first, i), X = (P, i) => P.x(i, v.from, v.to);
    const ticks = P => U.dateTicks(day(v.from), day(v.to), 11).map(d => [X(P, U.dayIndex(L.first, d[0])), d[1]]);
    const span = (a, f) => { let m = f(a[v.from], a[v.from]); for (let i = v.from; i <= v.to; i++) m = f(m, a[i]); return m; };
    // one tall chart: fitness and fatigue on the left scale, form on the right, gridlines shared
    const top = Math.max(span(v.S.ctl, Math.max), span(v.S.atl, Math.max), 1);
    const sc = U.pairedScales(top * 1.02, Math.min(span(v.S.tsb, Math.min), 0), Math.max(span(v.S.tsb, Math.max), 0));
    const P = Plot.make(document.getElementById('fitc'), 400, M);
    Plot.yAxis(P, sc.left, 'l', C.ctl);
    Plot.yAxis(P, sc.right, 'r', C.form, x => signed(x, 0) || '0', false);
    const zero = P.y(0, sc.right);
    P.g.strokeStyle = C.form; P.g.setLineDash([1, 3]); P.g.beginPath(); P.g.moveTo(P.l, zero); P.g.lineTo(P.w - P.r, zero); P.g.stroke(); P.g.setLineDash([]);
    const pts = (a, s, lo, hi) => { const o = []; for (let i = lo; i <= hi; i++) o.push([X(P, i), P.y(a[i], s)]); return o; };
    const both = (a, s, style, fill) => {
      Plot.line(P, pts(a, s, v.from, v.t), Object.assign({}, style, fill ? { fill: fill, base: P.y(0, s) } : {}));
      if (v.to > v.t) Plot.line(P, pts(a, s, v.t, v.to), Object.assign({}, style, { dash: [5, 4], width: (style.width || 1.6) - 0.2 }));
    };
    both(v.S.ctl, sc.left, { colour: C.ctl, width: 2.2 }, 'rgba(75,44,107,.14)');
    both(v.S.atl, sc.left, { colour: C.atl, width: 1.6 });
    both(v.S.tsb, sc.right, { colour: C.form, width: 1.8 });
    Plot.vline(P, X(P, v.t), C.mute, [2, 3], 'today');
    Plot.xLabels(P, ticks(P));
    // daily load, on the same time scale
    // On the phone (Andy, 18 November 2026): the bars run to today across the whole width, on a scale
    // whose top sits just above the highest bar.  On the Mac they keep the chart's time scale above.
    const phone = !!App.phone, qTo = phone ? v.t : v.to, XQ = (Pl, i) => Pl.x(i, v.from, qTo);
    let peak = 1;
    for (let i = v.from; i <= v.t; i++) peak = Math.max(peak, v.loads[i]);
    const ls = phone ? U.scale(0, peak, 5) : U.scale(0, Math.max(span(v.loads, Math.max), 1), 2);
    const Q = Plot.make(document.getElementById('fitl'), 100, phone ? { l: 34, r: 8, t: 6, b: 22 } : { l: M.l, r: M.r, t: 6, b: 22 });
    Plot.yAxis(Q, ls, 'l');
    const bw = Math.max(1, Q.pw / (qTo - v.from + 1) * 0.7);
    for (let i = v.from; i <= v.t; i++) {
      const b = sel !== 'gym' ? L.bike_load[i] : 0, g = sel !== 'bike' ? L.gym_load[i] : 0, x = XQ(Q, i) - bw / 2;
      if (b) Plot.rect(Q, x, Q.y(0, ls), bw, Q.y(b, ls) - Q.y(0, ls), C.bike);
      if (g) Plot.rect(Q, x, Q.y(b, ls), bw, Q.y(b + g, ls) - Q.y(b, ls), C.gym);
    }
    Plot.xLabels(Q, phone ? U.dateTicks(day(v.from), day(qTo), 11).map(d => [XQ(Q, U.dayIndex(L.first, d[0])), d[1]]) : ticks(Q));
    const at = (Pl, end) => x => {
      end = end == null ? v.to : end;
      const i = Math.max(v.from, Math.min(end, Math.round(v.from + (x - Pl.l) / Pl.pw * (end - v.from))));
      const d = day(i), wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00').getDay()];
      return '<b>' + wd + ' ' + U.dayMonth(d, true) + '</b>' + (i > v.t ? ' <span>projected</span>' : '') +
        '<span style="color:' + C.ctl + '">Fitness ' + U.num(v.S.ctl[i], 1) + '</span><span style="color:' + C.atl + '">Fatigue ' + U.num(v.S.atl[i], 1) +
        '</span><span style="color:' + C.form + '">Form ' + signed(v.S.tsb[i]) + '</span>' + (i > v.t ? '' : '<span>Load ' + U.num(v.loads[i], 1) + '</span>');
    };
    Plot.hover(P, at(P)); Plot.hover(Q, at(Q, qTo));
    // drag across the chart and release: those days become the period shown (Andy, 18 November 2026)
    if (onRange) {
      const idx = x => Math.max(v.from, Math.min(v.to, Math.round(v.from + (x - P.l) / P.pw * (v.to - v.from))));
      let x0 = null, band = null;
      const xOf = e => Math.max(P.l, Math.min(P.w - P.r, e.clientX - P.cv.getBoundingClientRect().left));
      P.cv.style.cursor = 'crosshair';
      P.cv.addEventListener('mousedown', e => {
        e.preventDefault();
        x0 = xOf(e);
        band = document.createElement('div'); band.className = 'zoomsel';
        band.style.top = P.t + 'px'; band.style.height = P.ph + 'px'; band.style.left = x0 + 'px'; band.style.width = '0px';
        P.host.appendChild(band);
        const move = ev => { const x = xOf(ev); band.style.left = Math.min(x, x0) + 'px'; band.style.width = Math.abs(x - x0) + 'px'; };
        const up = ev => {
          root.removeEventListener('mousemove', move); root.removeEventListener('mouseup', up);
          const x1 = xOf(ev), a = idx(Math.min(x0, x1)), b = idx(Math.max(x0, x1));
          band.remove(); band = null;
          if (Math.abs(x1 - x0) > 6 && b > a) onRange(day(a), day(b));
        };
        root.addEventListener('mousemove', move); root.addEventListener('mouseup', up);
      });
    }
  }

  function show(App, main) {
    const L = App.load, st = App.state.fit, sizes = App.state.hist;
    if (!L) { main.innerHTML = '<div class="msg">No load_daily.json yet: the pipeline writes it on its next run.</div>'; return; }
    const range = !!st.period && typeof st.period === 'object';
    const v = view(L, App.today, st.sel, st.period), b = v.boxes;
    const btn = (on, name, attr) => '<button class="btn' + (on ? ' on' : '') + '" ' + attr + '>' + name + '</button>';
    main.innerHTML = '<div class="bar"><h2 class="free">Fitness</h2><span class="lbl gap">Show</span>' +
      SEL.map(s => btn(st.sel === s[0], s[1], 'data-fsel="' + s[0] + '"')).join('') + '<span class="lbl gap">Period</span>' +
      PERIODS.map(p => btn(st.period === p[0], p[1], 'data-fper="' + p[0] + '"')).join('') +
      '<span class="lbl gap">From</span><input type="date" id="ffrom" min="' + L.first + '" value="' + (range ? st.period.from : '') + '"><span class="lbl">to</span>' +
      '<input type="date" id="fto" min="' + L.first + '" value="' + (range ? st.period.to : '') + '">' + btn(range, 'Show', 'id="fgo"') + '</div>' +
      '<div class="card"><div class="tiles six">' +
      tile('Fitness (CTL)', 'ctl', U.num(b.ctl, 1), '42-day', C.ctl) + tile('Fatigue (ATL)', 'atl', U.num(b.atl, 1), '7-day', C.atl) +
      tile('Form (TSB)', 'tsb', signed(b.tsb), 'today, before any activity', C.form) +
      tile('Fitness change', 'change', signed(b.change), 'in 7 days', b.change > 0 ? UP : b.change < 0 ? DOWN : null) +
      tile('Load, 7 days', 'load7', U.num(b.load7), '') + tile('Load, 28 days', 'load28', U.num(b.load28), '') + '</div></div>' +
      '<div class="card"><h3>Fitness, Fatigue and Form <span class="h3n">Drag across the chart to show those days</span></h3><div id="fitc"></div>' + Plot.legend([['Fitness (CTL, 42-day), left scale', C.ctl],
        ['Fatigue (ATL, 7-day), left scale', C.atl], ['Form (yesterday\'s fitness less yesterday\'s fatigue), right scale', C.form],
        ['Dashed: projected with no activity', C.mute]]) + '</div>' +
      (App.hist ? '<div class="cols">' + HKINDS.map(kind => Hist.card(kind, 'fith-' + kind, sizes[kind])).join('') + '</div>' : '') +
      '<div class="card"><h3>Daily Load</h3><div id="fitl"></div><div class="legend">' +
      (st.sel !== 'gym' ? '<span><i style="background:' + C.bike + '"></i>Bike</span>' : '') + (st.sel !== 'bike' ? '<span><i style="background:' + C.gym + '"></i>Gym</span>' : '') +
      '<span class="push">Last activity ' + U.dayMonth(L.last_activity, true) + '.  A gym session scores 0.75 × minutes × (10 − mean RIR) ÷ 10 × group factor.</span></div></div>' +
      (App.hist ? '<p class="note histn">The histograms cover rides only, over the days shown above up to today' +
      (App.hist.zones_now ? '; power and heart rate coloured by the zones of the FTP (' + App.hist.zones_now.ftp + ' W) and threshold heart rate (' + App.hist.zones_now.threshold_hr + ' bpm) now in force' : '') +
      '.  Heart rate leaves out rides without a sound recording; cadence counts pedalling seconds.  The top 0.2% of the time is gathered into the last bar.</p>' : '');
    main.querySelectorAll('[data-fsel]').forEach(el => { el.onclick = () => { st.sel = el.dataset.fsel; show(App, main); }; });
    main.querySelectorAll('[data-fper]').forEach(el => { el.onclick = () => { st.period = +el.dataset.fper; show(App, main); }; });
    document.getElementById('fgo').onclick = () => {
      const a = document.getElementById('ffrom').value, z = document.getElementById('fto').value;
      if (a && z && a <= z) { st.period = { from: a, to: z }; show(App, main); }
    };
    if (App.hist) Hist.wire(main, sizes, kind => drawHist(App.hist, L, v, kind, sizes[kind]));
    Fitness.shown = { sel: st.sel, period: st.period, today: App.today, from: U.addDays(L.first, v.from), to: U.addDays(L.first, v.to), boxes: b };   // read by the page test
    App.redraw = () => {
      draw(App, L, v, st.sel, (a, b) => { st.period = { from: a, to: b }; show(App, main); });
      if (App.hist) HKINDS.forEach(kind => drawHist(App.hist, L, v, kind, sizes[kind]));
    };
    App.redraw();
  }

  const Fitness = { show, view, shown: null, shownHist: {} };
  root.Fitness = Fitness;
})(window);
