// The analysis of one ride, from its summary file (every figure) and its streams file (the chart).
// A figure the ride lacks is a dash.  Each figure carries data-f so the tests can read it back.
(function (root) {
  'use strict';
  const U = root.U;
  const PZ = ['Z1 Active recovery', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO2max', 'Z6 Anaerobic', 'Z7 Neuromuscular'];
  const HZ = ['Z1 Recovery', 'Z2 Aerobic', 'Z3 Tempo', 'Z4 Threshold', 'Z5 Above threshold'];
  const PEAK = { 5: '5 s', 30: '30 s', 60: '1 min', 300: '5 min', 600: '10 min', 1200: '20 min', 3600: '60 min' };

  const f = (key, text) => '<var data-f="' + key + '">' + U.dash(text) + '</var>';
  function tile(label, key, text, unit, sub) {
    return '<div class="tile' + (text === '' ? ' blank' : '') + '"><span>' + label + '</span><b>' + f(key, text) + '</b> <small>' +
      (text === '' ? '' : unit || '') + '</small><em>' + (sub || '') + '</em></div>';
  }

  // The eight boxes at the top: the whole ride (summary file) or a selection (from the server).
  function tiles(g) {
    const load = g.load || { value: null, method: 'none' };
    return [
      tile('Duration', 'moving_s', U.hms(g.moving_s), '', 'elapsed ' + f('elapsed_s', U.hms(g.elapsed_s))),
      tile('Normalised power', 'np_w', U.num(g.np_w), 'W', g.variability_index == null ? '' : 'VI ' + f('variability_index', U.num(g.variability_index, 2))),
      tile('Intensity factor', 'if', U.num(g.if, 2), '', ''),
      tile(load.method === 'heart rate' ? 'Load' : 'TSS', 'load', U.num(load.value, 1), '',
        load.method === 'power' ? 'from power' : load.method === 'heart rate' ? 'from heart rate' : ''),
      tile('Distance', 'distance_km', U.dist(g.distance_km), U.DIST.unit,
        (g.avg_speed_kmh == null ? '' : f('avg_speed_kmh', U.dist(g.avg_speed_kmh)) + ' ' + U.DIST.speed) +
        (g.elevation_gain_m == null ? '' : ' · ' + f('elevation_gain_m', U.num(g.elevation_gain_m)) + ' m up')),
      tile('Average heart rate', 'avg_hr_bpm', U.num(g.avg_hr_bpm), 'bpm', g.max_hr_bpm == null ? '' : 'max ' + f('max_hr_bpm', U.num(g.max_hr_bpm)) + ' bpm'),
      tile('Average cadence', 'avg_cadence_rpm', U.num(g.avg_cadence_rpm), 'rpm', g.coasting_s == null ? '' : 'coasting ' + f('coasting_s', U.hms(g.coasting_s))),
      tile(g.energy_total_kcal == null || g.energy_total_kcal === g.energy_kcal ? 'Energy' : 'Energy above rest', 'energy_kcal', U.num(g.energy_kcal), 'kcal',
        g.energy_total_kcal == null || g.energy_total_kcal === g.energy_kcal ? '' : 'total ' + f('energy_total_kcal', U.num(g.energy_total_kcal)) + ' kcal')
    ].join('');
  }

  function bars(prefix, names, ranges, secs, total, colour) {
    if (!secs) return '<p class="note">No data in this ride.</p>';
    return names.map((nm, i) => '<div class="z"><span>' + nm + (ranges ? '<br><small>' + ranges[i] + '</small>' : '') + '</span>' +
      '<div><i style="width:' + (total ? 100 * secs[i] / total : 0) + '%;background:' + colour + '"></i></div>' +
      '<span class="zt">' + f(prefix + i, U.hms(secs[i])) + '</span><small class="zp">' + U.share(secs[i], total) + '%</small></div>').join('');
  }

  function html(App, entry, s) {
    const g = s.figures, I = s.inputs, src = s.source, dt = s.start_local, rules = App.settings.ride;
    const idx = App.rides.indexOf(entry), prev = App.rides[idx - 1], next = App.rides[idx + 1];
    const day = +dt.slice(8, 10) + ' ' + U.MONTHS[+dt.slice(5, 7) - 1] + ' ' + dt.slice(0, 4) + ', ' + dt.slice(11, 16);
    const go = (r, label) => '<button class="btn" ' + (r ? 'data-go="#/ride/' + r.ride_id + '"' : 'disabled') + '>' + label + '</button>';
    const tags = U.recordTags(App.records, s.ride_id);
    const reasons = ((App.warn[s.ride_id] || {}).reasons || g.hr_warning || []).map(r => 'heart rate ' + r)
      .concat((g.power_warning || []).map(r => 'power: ' + r));

    let h = '<div class="bar"><button class="btn" data-go="#/month/' + s.date.slice(0, 7) + '">◀ Calendar</button>' +
      '<h2 class="free">' + day + '</h2><span class="tot">' + U.esc(src.source || src.type) + ' · ' + U.esc(src.file) + '</span>' +
      go(prev, '◀ Earlier ride') + go(next, 'Later ride ▶') + '</div>';
    if (reasons.length) h += '<div class="warnb" id="flag">⚠ Flagged: ' + U.esc(reasons.join('; ')) +
      '.  The figures are shown as calculated; a flagged ride is left out of the records it would distort.</div>';
    if (!g.hr_valid) h += '<div class="warnb" id="nohr">No valid heart rate in this ride.  Heart-rate figures are blank.</div>';
    if (g.np_w == null) h += '<div class="warnb" id="nopower">No power in this ride.  Power figures are blank' +
      (g.load.method === 'heart rate' ? '; the load comes from heart rate' : '') + '.</div>';

    h += '<div class="card" id="tc"><div class="tiles" id="tiles">' + tiles(g) + '</div></div>';
    h += '<div class="card"><div class="ctl"><span class="lbl">Smoothing</span>' +
      [1, 5, 10, 30, 60].map(v => '<button class="btn sm' + (App.state.smooth === v ? ' on' : '') + '" data-v="' + v + '">' + v + ' s</button>').join('') +
      '<span class="lbl gap">Zones</span>' +
      [[0, 'Off'], [1, 'Pale'], [2, 'Graded']].map(z => '<button class="btn zn' + (App.state.zones === z[0] ? ' on' : '') + '" data-v="' + z[0] + '">' + z[1] + '</button>').join('') +
      '<span class="lbl gap">Show</span>' +
      [['elevation', 'Elevation'], ['hr', 'Heart rate'], ['cadence', 'Cadence'], ['hrZones', 'HR zones']].map(s => '<button class="btn sh' + (App.state.show[s[0]] ? ' on' : '') + '" data-k="' + s[0] + '">' + s[1] + '</button>').join('') +
      '<span class="lbl" id="selb"></span></div><div id="ch"><p class="note">Loading the chart…</p></div></div>';

    // one low row: the heading at the left, each peak as label, watts and any record it holds
    h += '<div class="card pkc"><h3>Peak Powers</h3><div class="pk">' + rules.peak_durations_s.map(d => {
      const text = U.num((g.peak_power_w || {})[d]), rec = (tags['power_' + d] || []).map(U.scopeLabel).join(' · ');
      return '<div class="tile' + (text === '' ? ' blank' : '') + '"' + (rec ? ' title="' + U.esc(rec) + '"' : '') + '><span>' + (PEAK[d] || d + ' s') + (rec ? ' ★' : '') + '</span><b>' +
        f('peak_' + d, text) + '</b><small>' + (text === '' ? '' : 'W') + '</small></div>';
    }).join('') + '</div></div>';

    const lowers = rules.cadence_band_lower_rpm;
    const bands = ['Under ' + lowers[0]].concat(lowers.map((lo, i) => i < lowers.length - 1 ? lo + '–' + (lowers[i + 1] - 1) : lo + '+'));
    h += '<div class="cols"><div class="card"><h3>Time in Power Zones</h3>' +
      bars('pz_', PZ, U.zoneRanges(rules.power_zone_upper_pct, I.ftp, 'W'), g.power_zone_s, g.moving_s, 'var(--pw)') + '</div>' +
      '<div class="card"><h3>Time in Heart-Rate Zones</h3>' +
      bars('hz_', HZ, U.zoneRanges(rules.hr_zone_upper_pct, I.threshold_hr, 'bpm'), g.hr_valid ? g.hr_zone_s : null, g.moving_s, 'var(--hr)') + '</div>' +
      '<div class="card"><h3>Time in Cadence Bands</h3>' +
      bars('cb_', bands.concat('Coasting (0 rpm)'), null, g.cadence_band_s && g.cadence_band_s.concat(g.coasting_s), g.moving_s, 'var(--cad)') + '</div></div>';

    // histograms of the whole ride, each with a slider for the bucket (the summary holds the fine steps)
    h += '<div class="cols" id="rh">' + ['power', 'hr', 'cadence'].map(kind => root.Hist.card(kind, 'rh-' + kind, App.state.hist[kind])).join('') + '</div>';

    const row = (a, b) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>';
    h += '<div class="cols"><div class="card"><h3>Efficiency</h3><table>' +
      row('Efficiency factor', '<b>' + f('efficiency_factor', U.num(g.efficiency_factor, 2)) + '</b> &nbsp;<small>NP ÷ average heart rate</small>') +
      row('Decoupling', '<b>' + f('decoupling_pct', U.num(g.decoupling_pct, 1)) + (g.decoupling_pct == null ? '' : '%') + '</b> &nbsp;<small>fall in power per beat, second half against first</small>') +
      row('Variability index', '<b>' + U.dash(U.num(g.variability_index, 2)) + '</b> &nbsp;<small>NP ÷ average power</small>') +
      row('Peak 5 s heart rate', '<b>' + f('peak_hr_5s_bpm', U.num(g.peak_hr_5s_bpm)) + '</b>' + (tags.hr_peak_5s ? ' &nbsp;<small>' + tags.hr_peak_5s.map(U.scopeLabel).join(' · ') + '</small>' : '')) +
      row('Best 20 min heart rate', '<b>' + f('best_hr_20min_bpm', U.num(g.best_hr_20min_bpm)) + '</b>' + (tags.hr_best_20min ? ' &nbsp;<small>' + tags.hr_best_20min.map(U.scopeLabel).join(' · ') + '</small>' : '')) +
      '</table></div><div class="card wide"><h3>Inputs Used</h3><table>' +
      row('FTP', '<b>' + f('ftp', I.ftp) + ' W</b>, in force from ' + f('ftp_from', I.ftp_from) + (I.ftp_backfilled ? ' (backfilled: the ride is earlier than the first row)' : '')) +
      row('Heart rate', 'maximum <b>' + f('max_hr', I.max_hr) + '</b>, threshold <b>' + f('threshold_hr', I.threshold_hr) + '</b>, resting <b>' +
        f('resting_hr', I.resting_hr) + '</b>, in force from ' + f('hr_from', I.hr_from) + (I.hr_backfilled ? ' (backfilled)' : '')) +
      row('Heart-rate coverage', (g.hr_coverage == null ? '—' : f('hr_coverage', Math.round(g.hr_coverage * 100)) + '% of moving time') + (g.hr_valid ? '' : ' · not valid')) +
      (g.load.method === 'heart rate' ? row('Load from heart rate', 'TRIMP <b>' + f('trimp', U.num(g.load.trimp, 1)) + '</b> × factor <b>' + f('hr_load_factor', g.load.factor) + '</b> for the ride’s year') : '') +
      row('Calculation', 'version ' + I.calc_version + ' · settings ' + U.esc(I.settings)) +
      row('Duplicate files dropped', U.esc((I.duplicates || []).join(', ')) || 'none') + '</table></div></div>';
    return h;
  }

  // Shows a ride.  `get` fetches a JSON file; `App.state` holds smoothing, zones and the selection.
  async function show(App, entry, main, get) {
    const s = await get('data/' + entry.summary);
    if (App.state.rideId !== entry.ride_id) return;
    main.innerHTML = html(App, entry, s);
    const box = main.querySelector('#ch'), tilesEl = main.querySelector('#tiles'), tc = main.querySelector('#tc'), selb = main.querySelector('#selb');
    let ride = null, token = 0;

    async function select(sel) {
      App.state.sel = sel;
      const mine = ++token;
      if (!sel) { tilesEl.innerHTML = tiles(s.figures); tc.className = 'card'; selb.textContent = ''; return; }
      selb.textContent = 'Selection ' + U.hms(sel[0]) + ' to ' + U.hms(sel[1]) + ' · click to clear';
      try {
        const r = await get('segment?ride=' + encodeURIComponent(entry.ride_id) + '&from=' + sel[0] + '&to=' + sel[1]);
        if (mine !== token) return;                 // a later selection has replaced this one
        tilesEl.innerHTML = tiles(r.figures); tc.className = 'card selc';
      } catch (e) {
        if (mine === token) selb.textContent = 'Selection could not be calculated: ' + e.message;
      }
    }
    function redraw() {
      if (!ride) return;
      root.Chart.draw(box, ride, { smooth: App.state.smooth, zones: App.state.zones, show: App.state.show, sel: App.state.sel, onSelect: select });
    }
    main.querySelectorAll('.sm').forEach(b => b.onclick = () => {
      App.state.smooth = +b.dataset.v; main.querySelectorAll('.sm').forEach(x => x.classList.toggle('on', x === b)); redraw();
    });
    main.querySelectorAll('.zn').forEach(b => b.onclick = () => {
      App.state.zones = +b.dataset.v; main.querySelectorAll('.zn').forEach(x => x.classList.toggle('on', x === b)); redraw();
    });
    main.querySelectorAll('.sh').forEach(b => b.onclick = () => {
      App.state.show[b.dataset.k] = !App.state.show[b.dataset.k]; b.classList.toggle('on', App.state.show[b.dataset.k]); redraw();
    });
    // histograms: power and heart rate in the colours of this ride's own zones
    const g = s.figures, I = s.inputs, R = App.settings.ride, Hist = root.Hist;
    const hist = kind => Hist.draw('rh-' + kind, kind, Hist.gather([g[kind + '_hist']]), App.state.hist[kind],
      kind === 'power' ? Hist.zoneColour(R.power_zone_upper_pct.map(p => I.ftp * p / 100)) :
        kind === 'hr' ? Hist.zoneColour(R.hr_zone_upper_pct.map(p => I.threshold_hr * p / 100)) : null,
      kind === 'power' ? 'No power in this ride.' : kind === 'hr' ? 'No valid heart rate in this ride.' : 'No cadence in this ride.');
    Hist.wire(main.querySelector('#rh'), App.state.hist, hist);
    const hists = () => ['power', 'hr', 'cadence'].forEach(hist);
    hists();
    App.redraw = () => { redraw(); hists(); };

    const st = await get('data/' + entry.streams);
    if (App.state.rideId !== entry.ride_id) return;
    ride = { streams: st.streams, seconds: st.seconds, channels: (st.source || {}).channels || null, inputs: s.inputs,
      zonePct: App.settings.ride.power_zone_upper_pct, hrZonePct: App.settings.ride.hr_zone_upper_pct };
    redraw();
  }

  root.Ride = { show, tiles, html, bars, HZ };
})(window);
