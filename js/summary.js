// The Summary page (Phase 5b): where things stand now, this week, the last 28 days, this year and last year,
// for rides and gym; the FTP prompt as a banner.  Figures are picked out of load_daily.json,
// periods.json, power_curve.json, tests.json and ftp_rule.json; the last 28 days are the sum of the days shown
// (as the Fitness page adds up its 7 and 28 days).
(function (root) {
  'use strict';
  const U = root.U, C = root.Plot.COL;
  const GYM = '#0b6e75', BIKE = '#9670CC', TOTAL = '#4B2C6B';      // bike always purple, gym always teal, a total in the darker purple
  const h1 = s => (s == null ? null : Math.round(s / 360) / 10);           // seconds as hours, one decimal

  function tile(label, value, sub, colour) {
    return '<div class="tile"><span>' + label + '</span><b' + (colour ? ' style="color:' + colour + '"' : '') + '>' + U.dash(value) + '</b><em>' + (sub || '') + '</em></div>';
  }

  // A box of three equal columns, the same in every box so the figures line up: bike at the left, gym in the
  // middle, the total (or the distance) at the right; each figure in its own colour with a word beneath.
  // A null part leaves its column empty.  data-sv names each figure for the page tests.
  function multi(label, parts) {
    return '<div class="tile mv"><span>' + label + '</span><div class="mvs">' + parts.map(p => !p ? '<div></div>' : '<div><b data-sv="' + p[0] + '" style="color:' + p[2] + '">' +
      U.dash(p[1]) + '</b><em>' + p[3] + '</em></div>').join('') + '</div></div>';
  }

  // The figures of one period: from a periods.json line, or from the days of load_daily.json (gym sessions counted in gym.json).
  function fromPeriod(p) {
    if (!p) return { rides: 0, ride_s: 0, gym_s: 0, gym_sessions: 0, load_bike: 0, load_gym: 0, load: 0, distance_km: 0, energy_kcal: 0, gym_energy_kcal: 0 };
    return { rides: p.rides, ride_s: p.ride_s, gym_s: p.gym_s, gym_sessions: p.gym_sessions, load_bike: p.load_bike, load_gym: p.load_gym, load: p.load,
      distance_km: p.distance_km, energy_kcal: p.energy_kcal, gym_energy_kcal: p.gym_energy_kcal == null ? null : p.gym_energy_kcal };
  }
  function fromDays(App, L, a, b) {
    const out = { rides: 0, ride_s: 0, gym_s: 0, gym_sessions: 0, load_bike: 0, load_gym: 0, load: 0, distance_km: 0, energy_kcal: 0, gym_energy_kcal: L.gym_energy_kcal ? 0 : null };
    for (let i = Math.max(0, a); i <= Math.min(b, L.days - 1); i++) {
      out.rides += L.rides[i]; out.ride_s += L.ride_s[i]; out.gym_s += L.gym_s[i];
      out.load_bike += L.bike_load[i]; out.load_gym += L.gym_load[i]; out.distance_km += L.distance_km[i]; out.energy_kcal += L.energy_kcal[i];
      if (L.gym_energy_kcal) out.gym_energy_kcal += L.gym_energy_kcal[i];
    }
    const from = U.addDays(L.first, Math.max(0, a)), to = U.addDays(L.first, Math.min(b, L.days - 1));
    out.gym_sessions = (App.gym || []).filter(g => g.date >= from && g.date <= to).length;
    const r1 = x => Math.round(x * 10) / 10;
    out.load = r1(out.load_bike + out.load_gym); out.load_bike = r1(out.load_bike); out.load_gym = r1(out.load_gym);
    out.distance_km = r1(out.distance_km); out.energy_kcal = r1(out.energy_kcal);
    if (out.gym_energy_kcal != null) out.gym_energy_kcal = r1(out.gym_energy_kcal);
    return out;
  }
  function block(title, f) {
    const gymE = f.gym_energy_kcal, totE = gymE == null ? null : Math.round((f.energy_kcal + gymE) * 10) / 10;
    return '<div class="card sum"><h3>' + title + '</h3><div class="tiles four">' +
      multi('Sessions', [['rides', U.num(f.rides), BIKE, 'bike'], ['gym_sessions', U.num(f.gym_sessions), GYM, 'gym'], ['distance_km', U.num(f.distance_km) + '<small> km</small>', BIKE, 'distance']]) +
      multi('Time (hr)', [['ride_s', U.num(h1(f.ride_s), 1), BIKE, 'bike'], ['gym_s', U.num(h1(f.gym_s), 1), GYM, 'gym'], null]) +
      multi('Load', [['load_bike', U.num(f.load_bike), BIKE, 'bike'], ['load_gym', U.num(f.load_gym), GYM, 'gym'], ['load', U.num(f.load), TOTAL, 'total']]) +
      multi('Energy (kcal)', [['energy_kcal', U.num(f.energy_kcal), BIKE, 'bike'], ['gym_energy_kcal', U.num(gymE), GYM, 'gym'], ['energy_total', U.num(totE), TOTAL, 'total']]) + '</div></div>';
  }

  function view(App) {
    const L = App.load, today = App.today, year = today.slice(0, 4), last = String(+year - 1);
    const t = L ? Math.max(0, Math.min(L.days - 1, U.dayIndex(L.first, today))) : null;
    const per = (kind, key) => App.periods && App.periods[kind].find(p => p.key === key);
    const ftp = App.ftpRule && App.ftpRule.ftp;      // the FTP in force, written by the pipeline
    const p90 = App.power && App.power.scopes.last_90_days, at20 = App.power ? App.power.durations_s.indexOf(1200) : -1;
    return {
      now: { ftp: ftp && ftp.watts, ftp_from: ftp && ftp.from, ctl: L ? L.all.ctl[t] : null, tsb: L ? L.all.tsb[t] : null,
        best20: p90 && at20 >= 0 ? p90.w[at20] : null, best20_ride: p90 && at20 >= 0 ? p90.ride[at20] : null,
        vo2: App.tests && App.tests.latest_vo2max, rule: App.ftpRule && App.ftpRule.status },
      week: Object.assign({ from: U.weekStart(today) }, fromPeriod(per('weeks', U.weekStart(today)))),
      days28: L ? Object.assign({ from: U.addDays(today, -27), to: today }, fromDays(App, L, t - 27, t)) : null,
      year: fromPeriod(per('years', year)), last: fromPeriod(per('years', last)), yearKey: year, lastKey: last };
  }

  function show(App, main) {
    const v = view(App), n = v.now, r = n.rule;
    const banner = r && r.review ? '<div class="warnb bad banner"><b>Review FTP.</b>  The FTP-change index has moved ' + (r.flag.diff_pct > 0 ? '+' : '−') + U.num(Math.abs(r.flag.diff_pct), 1) +
      '% from its baseline (' + U.dayMonth(r.flag.date, true) + ').  A test would settle it: see Power.  FTP is never changed for you.</div>' : '';
    const ruleText = !r ? null : r.state === 'review' ? 'Review' : r.state === 'within' ? 'Within band' : r.state === 'collecting' ? 'Collecting' : 'Not yet';
    const ruleSub = !r ? '' : r.state === 'within' && r.diff_pct != null ? (r.diff_pct >= 0 ? '+' : '−') + U.num(Math.abs(r.diff_pct), 1) + '% from baseline' :
      r.state === 'collecting' ? U.esc(r.message) : r.state === 'review' ? 'see Power' : 'baseline from ' + U.dayMonth(App.ftpRule.rules.first_baseline_from).replace(/^1 /, '') + ' ' + App.ftpRule.rules.first_baseline_from.slice(0, 4);
    const signed = x => (x == null ? '' : (x > 0 ? '+' : x < 0 ? '−' : '') + U.num(Math.abs(x), 1));
    main.innerHTML = banner + '<div class="bar"><h2 class="free">Summary</h2></div>' +
      '<div class="card sum"><h3>Now</h3><div class="tiles six">' +
      tile('FTP in force', n.ftp ? n.ftp + ' W' : null, n.ftp_from ? 'since ' + U.dayMonth(n.ftp_from, true) : '') +
      tile('Fitness (CTL)', U.num(n.ctl, 1), 'combined', C.ctl) + tile('Form (TSB)', signed(n.tsb), 'combined', C.form) +
      '<div class="tile go" data-go="' + (n.best20_ride ? '#/ride/' + n.best20_ride : '#/power') + '"><span>Best 20 min, 90 days</span><b>' + U.dash(n.best20 != null ? U.num(n.best20) + ' W' : null) + '</b><em>power curve</em></div>' +
      tile('VO2max', n.vo2 ? U.num(n.vo2.storer, 1) : null, n.vo2 ? 'Storer, ' + U.dayMonth(n.vo2.date, true) : 'needs a confirmed test') +
      tile('FTP review', ruleText, ruleSub) + '</div></div>' +
      block('This Week (from ' + U.dayMonth(v.week.from) + ')', v.week) +
      (v.days28 ? block('Last 28 Days', v.days28) : '') +
      block(v.yearKey + ' to Date', v.year) + block(v.lastKey, v.last) +
      '<p class="note">Energy is what each ride or gym session burned above resting; a gym session\'s comes from the calories the watch recorded, so a session without a watch recording adds none.  ' +
      'Load is fitness load: TSS for a ride with power, heart-rate load without, and the gym formula for a session.</p>';
    Summary.shown = v;
  }

  const Summary = { show, view, shown: null };
  root.Summary = Summary;
})(window);
