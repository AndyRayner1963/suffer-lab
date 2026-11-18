// The Weeks page: TSS and IF, ride and gym time, and time in power and heart-rate zones, by week.
// Everything comes from periods.json (one line per week); a zone's share of a week is the only arithmetic.
(function (root) {
  'use strict';
  const U = root.U, Plot = root.Plot, C = Plot.COL;
  const SPANS = [[12, '12 weeks'], [26, '26 weeks'], [52, '1 year'], [0, 'All']];
  const M = { l: 44, r: 40, t: 10, b: 22 };
  const hours = s => s / 3600;

  function chart(id, rows, parts, o) {
    // parts(row) -> the stacked values of one bar; o: { colours, fmt, right: dots on a 0..1 scale, share, tip }
    const n = rows.length, stacks = rows.map(parts), tops = stacks.map(s => s.reduce((a, b) => a + b, 0));
    Weeks.shown[id] = { keys: rows.map(r => r.key), stacks: stacks, dots: o.right ? rows.map(r => r.if) : null };   // read by the page test
    const peak = o.share ? 100 : Math.max.apply(null, tops.concat(o.min || 1));
    const pair = o.right ? U.pairedScales(peak, 0, 1, 4) : null, sc = pair ? pair.left : U.scale(0, peak, 4);
    const P = Plot.make(document.getElementById(id), 240, o.right ? M : { l: M.l, r: 14, t: M.t, b: M.b });
    Plot.yAxis(P, sc, 'l', o.right ? C.tss : null, o.fmt);
    if (pair) Plot.yAxis(P, pair.right, 'r', C.iff, x => U.num(x, 2), false);
    const X = i => P.x(i, -0.6, n - 0.4), bw = Math.max(1, P.pw / n * 0.62);
    stacks.forEach((s, i) => {
      let y = 0;
      const whole = o.share ? tops[i] : 0;
      s.forEach((part, k) => {
        const val = o.share ? (whole ? part / whole * 100 : 0) : part;
        if (val) Plot.rect(P, X(i) - bw / 2, P.y(y, sc), bw, P.y(y + val, sc) - P.y(y, sc), o.colours[k]);
        y += val;
      });
    });
    if (pair) rows.forEach((r, i) => {
      if (r.if == null) return;
      P.g.beginPath(); P.g.arc(X(i), P.y(r.if, pair.right), n > 60 ? 1.8 : 3.5, 0, 7); P.g.fillStyle = C.iff; P.g.fill();
      if (n <= 60) { P.g.strokeStyle = '#fff'; P.g.lineWidth = 1; P.g.stroke(); }
    });
    const every = Math.max(1, Math.ceil(n / 8)), labels = [];
    rows.forEach((r, i) => { if ((n - 1 - i) % every === 0) labels.push([X(i), U.dayMonth(r.from, n > 60)]); });
    Plot.xLabels(P, labels);
    const pick = x => Math.max(0, Math.min(n - 1, Math.round(-0.6 + (x - P.l) / P.pw * n)));
    Plot.hover(P, x => { const r = rows[pick(x)]; return '<b>Week of ' + U.dayMonth(r.from, true) + '</b>' + o.tip(r); },
      x => { location.hash = '#/month/' + rows[pick(x)].to.slice(0, 7); });
  }

  function zoneTip(key, n) {
    return r => {
      const z = r[key];
      if (!z) return '<span>none</span>';
      const all = z.reduce((a, b) => a + b, 0);
      return z.slice(0, n).map((s, i) => (s ? '<span style="color:' + (i ? Plot.ZONE[i] : C.mute) + '">Z' + (i + 1) + ' ' + U.hm(s) + ' (' + U.share(s, all) + '%)</span>' : '')).join('');
    };
  }

  function show(App, main) {
    const T = App.periods, st = App.state.weeks;
    if (!T || !T.weeks.length) { main.innerHTML = '<div class="msg">No periods.json yet: the pipeline writes it on its next run.</div>'; return; }
    const rows = st.span ? T.weeks.slice(-st.span) : T.weeks;
    const btn = (on, name, attr) => '<button class="btn' + (on ? ' on' : '') + '" ' + attr + '>' + name + '</button>';
    const tss = U.sum(rows, 'tss'), ride = U.sum(rows, 'ride_s'), gym = U.sum(rows, 'gym_s');
    main.innerHTML = '<div class="bar"><h2 class="free">Weeks</h2><span class="lbl gap">Period</span>' +
      SPANS.map(s => btn(st.span === s[0], s[1], 'data-wspan="' + s[0] + '"')).join('') + '<span class="lbl gap">Zones as</span>' +
      btn(!st.share, 'Hours', 'data-wshare="0"') + btn(st.share, 'Share', 'data-wshare="1"') +
      '<span class="tot">' + U.dayMonth(rows[0].from, true) + ' to ' + U.dayMonth(rows[rows.length - 1].to, true) + '</span></div>' +
      '<div class="cols two">' +
      '<div class="card"><h3>TSS and IF by Week</h3><div id="wk1"></div>' + Plot.legend([['TSS (bars)', C.tss], ['IF (dots, right scale)', C.iff]]) +
      '<p class="note">Average <b data-wk="avg_tss">' + U.num(tss / rows.length) + '</b> TSS a week over the ' + rows.length +
      ' weeks shown.  A week\'s IF is the IF that gives its TSS in its riding time.  Rides scored from heart rate have no TSS.</p></div>' +
      '<div class="card"><h3>Ride and Gym Time by Week</h3><div id="wk2"></div>' + Plot.legend([['Ride', C.ctl], ['Gym', C.gym]]) +
      '<p class="note">Average <b data-wk="avg_ride">' + U.hm(ride / rows.length) + '</b> riding and <b data-wk="avg_gym">' + U.hm(gym / rows.length) + '</b> in the gym a week.</p></div>' +
      '<div class="card"><h3>Time in Power Zones by Week</h3><div id="wk3"></div>' + Plot.legend(Plot.ZONE.map((c, i) => ['Z' + (i + 1), c])) + '</div>' +
      '<div class="card"><h3>Time in Heart-Rate Zones by Week</h3><div id="wk4"></div>' + Plot.legend(Plot.ZONE.slice(0, 5).map((c, i) => ['Z' + (i + 1), c])) +
      '<p class="note">Rides without a sound heart-rate recording are left out, so a week can be shorter here than in power zones.</p></div></div>';
    main.querySelectorAll('[data-wspan]').forEach(el => { el.onclick = () => { st.span = +el.dataset.wspan; show(App, main); }; });
    main.querySelectorAll('[data-wshare]').forEach(el => { el.onclick = () => { st.share = el.dataset.wshare === '1'; show(App, main); }; });
    const h = x => U.num(x, x % 1 ? 1 : 0) + ' h', pct = x => x + '%';
    App.redraw = () => {
      chart('wk1', rows, r => [r.tss], { colours: [C.tss], right: true, min: 50,
        tip: r => '<span style="color:' + C.tss + '">TSS ' + U.num(r.tss) + '</span><span style="color:' + C.iff + '">IF ' + U.dash(U.num(r.if, 2)) + '</span><span>' + r.rides + (r.rides === 1 ? ' ride' : ' rides') + '</span>' });
      chart('wk2', rows, r => [hours(r.ride_s), hours(r.gym_s)], { colours: [C.ctl, C.gym], fmt: h, min: 2,
        tip: r => '<span style="color:' + C.ctl + '">Ride ' + U.hm(r.ride_s) + '</span><span style="color:' + C.gym + '">Gym ' + U.hm(r.gym_s) + '</span>' });
      chart('wk3', rows, r => (r.power_zone_s || []).map(hours), { colours: Plot.ZONE, fmt: st.share ? pct : h, share: st.share, min: 2, tip: zoneTip('power_zone_s', 7) });
      chart('wk4', rows, r => (r.hr_zone_s || []).map(hours), { colours: Plot.ZONE, fmt: st.share ? pct : h, share: st.share, min: 2, tip: zoneTip('hr_zone_s', 5) });
    };
    App.redraw();
  }

  const Weeks = { show, shown: {} };
  root.Weeks = Weeks;
})(window);
