// The Records page (Phase 5b): achievements by year and all time (records.json), tests (tests.json)
// and gym bests (records.json, gym).  The page picks figures out of the tables; a click opens the ride
// or the gym session behind a figure.
(function (root) {
  'use strict';
  const U = root.U;
  const COLS = [['power_5', '5 s'], ['power_60', '1 min'], ['power_300', '5 min'], ['power_1200', '20 min'], ['power_3600', '60 min'],
    ['hr_best_20min', '20 min HR'], ['tss', 'TSS']];
  const GYM = '#0b6e75';
  const KIND = { ramp: 'Ramp', '20min': '20-minute effort' };

  function achievements(App) {
    const S = App.records.scopes, years = Object.keys(S).filter(k => /^\d{4}$/.test(k)).sort().reverse();
    const rows = [['all', '<b>All time</b>'], ['last_90_days', '<b>Last 90 days</b>']].concat(years.map(y => [y, y]));
    const shown = [];
    const head = '<tr><td></td>' + COLS.map(c => '<td class="r h">' + c[1] + '</td>').join('') + '</tr>';
    const body = rows.map(([key, name]) => '<tr><td>' + name + '</td>' + COLS.map(([k]) => {
      const e = (S[key] || {})[k], best = (S.all || {})[k];
      shown.push({ scope: key, key: k, value: e ? e.value : null });
      if (!e) return '<td class="r">–</td>';
      const top = key !== 'all' && best && best.ride_id === e.ride_id && best.value === e.value;
      return '<td class="r go' + (top ? ' best' : '') + '" data-go="#/ride/' + e.ride_id + '" title="' + U.dayMonth(e.date, true) + '">' + U.num(e.value) + '</td>';
    }).join('') + '</tr>').join('');
    Records.shown = shown;
    return '<div class="card"><h3>Achievements: Best by Year and All Time (Watts, bpm, TSS)</h3><table class="rec">' + head + body + '</table>' +
      '<p class="note">A shaded cell is the all-time best; each figure opens its ride.  ' + U.esc(App.records.note) + '</p></div>';
  }

  function tests(App) {
    const T = App.tests, rows = T.tests.slice().reverse();
    const fig = t => t.kind === 'ramp' ? 'Best minute ' + U.num(t.best_minute_w) + ' W' : 'Best 20 min ' + U.num(t.best_20min_w) + ' W';
    const res = t => {
      if (t.kind === 'ramp') return t.vo2max ? 'VO2max ' + U.num(t.vo2max.storer, 1) + ' (Storer) · ' + U.num(t.vo2max.hawley_noakes, 1) + ' (Hawley & Noakes)' :
        (t.status === 'confirmed' ? 'VO2max: needs weight on the day' : t.rising_minutes + ' minutes rising');
      return '95%: ' + U.num(t.ftp_estimate_w) + ' W · VI ' + U.num(t.vi_20min, 3);
    };
    Records.shownTests = rows;
    return '<div class="card"><h3>Tests: Proposed and Confirmed</h3><table class="rec tests"><tr><td class="h">Date</td><td class="h">Kind</td><td class="h">Effort</td>' +
      '<td class="r h">Peak HR</td><td class="h">Result</td><td class="r h">FTP then</td><td class="h">Status</td></tr>' +
      rows.map(t => '<tr class="go" data-go="#/ride/' + t.ride_id + '"><td>' + U.dayMonth(t.date, true) + '</td><td>' + KIND[t.kind] + '</td><td>' + fig(t) + '</td><td class="r">' +
        U.dash(U.num(t.peak_hr_bpm)) + '</td><td>' + res(t) + (t.weight_kg ? ' · ' + U.num(t.weight_kg, 1) + ' kg' : '') + '</td><td class="r">' + U.dash(U.num(t.ftp_in_force)) + ' W</td><td class="st ' + t.status + '">' +
        t.status.charAt(0).toUpperCase() + t.status.slice(1) + '</td></tr>').join('') + '</table>' +
      '<p class="note">The system proposes a ride as a test: a ramp (power rising in steps for twelve minutes or more to the ride\'s best minute) or a 20-minute effort (steady, within 2% of the best of the 90 days ' +
      'before it, with peak heart rate at 95% of the year\'s highest or more).  Tell Claude to confirm or reject it, with your weight on the day; the page cannot write.  ' +
      'VO2max is in ml/kg/min; both equations assume ramp protocols unlike yours, so treat them as estimates.  FTP is never changed for you.</p></div>';
  }

  function gym(App, st) {
    const G = App.records.gym;
    if (!G) return '<div class="msg">No gym bests in records.json yet: the pipeline writes them on its next run.</div>';
    const S = G.session_load, years = Object.keys(S).filter(k => /^\d{4}$/.test(k)).sort().reverse();
    const thisYear = App.today.slice(0, 4);
    const sess = [['all', '<b>All time</b>']].concat(years.map(y => [y, y])).map(([k, name]) => {
      const e = S[k];
      return '<tr><td>' + name + '</td>' + (e ? '<td class="r go g" data-go="#/gym/' + e.gym_id + '">' + U.num(e.value, 1) + '</td><td>' + U.dayMonth(e.date, true) + '</td><td>' + (e.source === 'swole' ? 'Swole' : 'Garmin') + '</td>' : '<td class="r">–</td><td></td><td></td>') + '</tr>';
    }).join('');
    const kg = w => U.num(w, Math.round(w * 100) % 10 ? 2 : Math.round(w * 10) % 10 ? 1 : 0);
    const set = e => e ? '<span class="g">' + kg(e.weight_kg) + ' kg × ' + e.reps + '</span> = ' + U.num(e.volume_kg) + ' kg' : '–';
    // filter by body part and order by body part or by the best set (Andy, 18 November 2026)
    const parts = Array.from(new Set(G.exercises.map(e => e.group))).sort();
    let list = G.exercises.filter(e => !st.part || e.group === st.part);
    if (st.order === 'volume') list = list.slice().sort((a, b) => b.all.volume_kg - a.all.volume_kg || (a.name < b.name ? -1 : 1));
    const ex = list.map(e => '<tr><td>' + U.esc(e.name) + '</td><td>' + U.esc(e.group) + '</td><td class="r go nw" data-go="#/gym/' + e.all.gym_id + '">' + set(e.all) + '</td><td class="nw">' +
      U.dayMonth(e.all.date, true) + '</td><td class="r nw">' + set(e.years[thisYear]) + '</td></tr>').join('');
    Records.shownGym = { session_load: S, exercises: list, part: st.part, order: st.order };
    const ctl = '<div class="ctl"><span class="lbl">Body part</span><select id="gpart"><option value="">All</option>' +
      parts.map(p => '<option' + (p === st.part ? ' selected' : '') + '>' + U.esc(p) + '</option>').join('') + '</select>' +
      '<span class="lbl gap">Order</span><button class="btn' + (st.order !== 'volume' ? ' on' : '') + '" data-gord="part">Body part</button>' +
      '<button class="btn' + (st.order === 'volume' ? ' on' : '') + '" data-gord="volume">Best set</button></div>';
    return '<div class="cols two gymrec"><div class="card"><h3>Gym: Highest Session Load</h3><table class="rec"><tr><td></td><td class="r h">Load</td><td class="h">Date</td><td class="h">Recorded by</td></tr>' + sess + '</table>' +
      '<p class="note">Any session, Swole or Garmin; load as on the Fitness page.  Each figure opens its session.</p></div>' +
      '<div class="card"><h3>Gym: Best Set by Exercise (Weight × Reps)</h3>' + ctl + '<table class="rec"><tr><td class="h">Exercise</td><td class="h">Body part</td><td class="r h">All time</td><td class="h">Date</td><td class="r h">' + thisYear + '</td></tr>' + ex + '</table>' +
      '<p class="note">From Swole, so from 12 November 2026: sets counted in reps with a weight, the weight as Swole records it.</p></div></div>';
  }

  function show(App, main) {
    const st = App.state.records;
    const btn = (k, name) => '<button class="btn' + (st.show === k ? ' on' : '') + '" data-rs="' + k + '">' + name + '</button>';
    main.innerHTML = '<div class="bar"><h2 class="free">Records</h2><span class="lbl gap">Show</span>' + btn('ach', 'Achievements') + btn('tests', 'Tests') + btn('gym', 'Gym') + '</div>' +
      (st.show === 'tests' ? (App.tests ? tests(App) : '<div class="msg">No tests.json yet: the pipeline writes it on its next run.</div>') : st.show === 'gym' ? gym(App, st) : achievements(App));
    main.querySelectorAll('[data-rs]').forEach(el => { el.onclick = () => { st.show = el.dataset.rs; show(App, main); }; });
    const gp = document.getElementById('gpart');
    if (gp) gp.onchange = e => { st.part = e.target.value; show(App, main); };
    main.querySelectorAll('[data-gord]').forEach(el => { el.onclick = () => { st.order = el.dataset.gord; show(App, main); }; });
  }

  const Records = { show, shown: null, shownTests: null, shownGym: null };
  root.Records = Records;
})(window);
