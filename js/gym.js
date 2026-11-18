// A gym session's page: its figures, heart rate over the session, time in heart-rate zones, a
// heart-rate histogram, and the body parts trained.  Everything comes from gym.json (one line per
// session) and, for the heart-rate line, the session's file under gym_streams/.
(function (root) {
  'use strict';
  const U = root.U, Plot = root.Plot, Hist = root.Hist;
  const TEAL = '#0b6e75', HR = '#C8471B';
  const part = name => String(name).replace(/^Legs - /, '');      // "Legs - Quad" reads as "Quad" where space is short

  function tile(label, id, text, unit, sub) {
    return '<div class="tile' + (text === '' ? ' blank' : '') + '"><span>' + label + '</span><b data-gym="' + id + '">' + U.dash(text) + '</b> <small>' +
      (text === '' ? '' : unit || '') + '</small><em>' + (sub || '') + '</em></div>';
  }
  function when(g) {
    const d = g.start_local;
    return +d.slice(8, 10) + ' ' + U.MONTHS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) + ', ' + d.slice(11, 16);
  }

  function html(App, g) {
    const all = App.gym, i = all.indexOf(g), prev = all[i - 1], next = all[i + 1];
    const go = (r, label) => '<button class="btn" ' + (r ? 'data-go="#/gym/' + r.id + '"' : 'disabled') + '>' + label + '</button>';
    const swole = g.source === 'swole';
    let h = '<div class="bar"><button class="btn" data-go="#/month/' + g.date.slice(0, 7) + '">◀ Calendar</button>' +
      '<h2 class="free">Gym, ' + when(g) + '</h2><span class="tot"' + (swole ? '' : ' title="' + U.esc(g.file) + '"') + '>' + (swole ? 'Swole' + (g.workout ? ' · ' + U.esc(g.workout) : '') : 'Garmin') + '</span>' +
      go(prev, '◀ Earlier session') + go(next, 'Later session ▶') + '</div>';
    if (!swole) h += '<div class="warnb">Recorded on the Garmin only, so there are no sets: the load assumes RIR ' + U.num(g.mean_rir, 0) +
      ' and a group factor of ' + U.num(g.group_factor, 1) + (g.recorded_minutes ? '; the recording ran ' + U.num(g.recorded_minutes) + ' minutes and counts as ' + U.num(g.minutes) : '') + '.</div>';
    h += '<div class="card" id="tc"><div class="tiles">' +
      tile('Duration', 'minutes', U.hm(g.minutes * 60), '', U.num(g.minutes, 1) + ' minutes') +
      tile('Load', 'load', U.num(g.load, 1), '', '0.75 × min × (10 − RIR) ÷ 10 × factor') +
      tile('Mean RIR', 'mean_rir', U.num(g.mean_rir, 2), '', g.rir_assumed ? 'assumed' : 'over ' + g.rir_sets + ' of ' + g.sets + ' sets') +
      tile('Group factor', 'group_factor', U.num(g.group_factor, 2), '', swole ? 'mean over the sets' : 'no set data') +
      tile('Sets', 'sets', g.sets == null ? '' : U.num(g.sets), '', '') +
      tile('Weight lifted', 'weight_kg', g.weight_kg == null ? '' : U.num(g.weight_kg), 'kg', 'weight × reps') +
      tile('Average heart rate', 'avg_hr_bpm', U.num(g.avg_hr_bpm), 'bpm', g.max_hr_bpm == null ? '' : 'max <var data-gym="max_hr_bpm">' + U.num(g.max_hr_bpm) + '</var> bpm') +
      tile('Heart rate from', 'hr_from', g.hr_hist ? 'Garmin' : '', '', g.hr_hist ? '' : 'no recording') + '</div></div>';
    h += '<div class="card"><h3>Heart Rate</h3><div id="gch">' + (g.hr_stream ? '<p class="note">Loading…</p>' :
      '<p class="note">No heart-rate recording for this session' + (swole ? ': none on the Garmin overlaps it.  Record the session on the watch as well and the next capture attaches it.' : '.') + '</p>') + '</div></div>';
    const R = App.settings.ride, total = g.hr_zone_s ? g.hr_zone_s.reduce((a, b) => a + b, 0) : 0;
    h += '<div class="cols" id="gh"><div class="card"><h3>Time in Heart-Rate Zones</h3>' +
      root.Ride.bars('ghz_', root.Ride.HZ, g.threshold_hr ? U.zoneRanges(R.hr_zone_upper_pct, g.threshold_hr, 'bpm') : null, g.hr_zone_s, total, 'var(--hr)').replace('No data in this ride.', 'No heart rate for this session.') + '</div>' +
      Hist.card('hr', 'gh-hr', App.state.hist.hr) + '<div class="card"><h3>Body Parts Trained</h3>';
    if (g.groups) {
      h += '<table class="parts"><tr><th>Body part</th><th>Sets</th><th>Weight lifted</th><th>Load</th></tr>' +
        g.groups.map((p, k) => '<tr><td>' + U.esc(p.group) + '</td><td data-gp="' + k + '_sets">' + p.sets + '</td><td data-gp="' + k + '_weight_kg">' + U.num(p.weight_kg) +
          ' kg</td><td data-gp="' + k + '_load">' + U.num(p.load, 1) + '</td></tr>').join('') +
        '<tr class="sum"><td>Session</td><td>' + g.sets + '</td><td>' + U.num(g.weight_kg) + ' kg</td><td>' + U.num(g.load, 1) + '</td></tr></table>' +
        '<p class="note">Weight lifted is weight × reps, to the nearest 10 kg.  A body part\'s load is the session\'s load shared by its sets × its factor.</p>';
    } else h += '<p class="note">No set data: this session was not logged in Swole.</p>';
    return h + '</div></div>';
  }

  function chart(App, g, st) {
    const host = document.getElementById('gch');
    if (!host) return;
    const hr = U.smooth(st.hr, 5), n = st.seconds, vals = hr.filter(v => v != null);
    if (!vals.length) { host.innerHTML = '<p class="note">The recording holds no heart rate.</p>'; return; }
    const sc = U.scale(Math.min.apply(null, vals) - 3, Math.max.apply(null, vals) + 3, 5);
    const P = Plot.make(host, 260, { l: 46, r: 16, t: 10, b: 22 }), X = i => P.x(i, 0, Math.max(1, n - 1));
    if (g.threshold_hr) {                      // pale bands for the heart-rate zones, as on the ride chart
      const ups = App.settings.ride.hr_zone_upper_pct.map(p => g.threshold_hr * p / 100);
      let lo = sc.lo;
      ups.concat(sc.hi).forEach((up, z) => {
        const a = Math.max(lo, sc.lo), b = Math.min(up, sc.hi);
        if (z > 0 && b > a) { P.g.globalAlpha = 0.13; Plot.rect(P, P.l, P.y(a, sc), P.pw, P.y(b, sc) - P.y(a, sc), Plot.ZONE[z]); P.g.globalAlpha = 1; }
        lo = up;
      });
    }
    Plot.yAxis(P, sc, 'l', HR);
    Plot.line(P, U.columns(hr, n, Math.round(P.pw)).map(p => [X(p[0]), p[1] == null ? null : P.y(p[1], sc)]), { colour: HR, width: 1.4 });
    const every = [300, 600, 900, 1800].find(s => n / s <= 12) || 3600, labels = [];
    for (let s = 0; s < n; s += every) labels.push([X(s), U.hm(s)]);
    Plot.xLabels(P, labels);
    Plot.hover(P, x => {
      const i = Math.max(0, Math.min(n - 1, Math.round((x - P.l) / P.pw * (n - 1))));
      return '<b>' + U.hms(i) + '</b><span style="color:' + HR + '">' + (st.hr[i] == null ? '—' : st.hr[i] + ' bpm') + '</span>';
    });
  }

  async function show(App, g, main, get) {
    main.innerHTML = html(App, g);
    const R = App.settings.ride;
    const hist = () => Hist.draw('gh-hr', 'hr', Hist.gather([g.hr_hist]), App.state.hist.hr,
      g.threshold_hr ? Hist.zoneColour(R.hr_zone_upper_pct.map(p => g.threshold_hr * p / 100)) : null, 'No heart rate for this session.');
    Hist.wire(main.querySelector('#gh'), App.state.hist, hist);
    hist();
    let stream = null;
    App.redraw = () => { hist(); if (stream) chart(App, g, stream); };
    if (g.hr_stream) {
      stream = await get('data/' + g.hr_stream);
      if (App.state.gymId !== g.id) return;
      chart(App, g, stream);
    }
  }

  root.Gym = { show, part, TEAL };
})(window);
