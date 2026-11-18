// The Summary page (Phase 5b): where things stand now, this week, the last 28 days, this year and last year,
// for rides and gym; the FTP prompt as a banner.  Figures are picked out of load_daily.json,
// periods.json, power_curve.json, tests.json and ftp_rule.json; the last 28 days are the sum of the days shown
// (as the Fitness page adds up its 7 and 28 days).
(function (root) {
  'use strict';
  const U = root.U, C = root.Plot.COL;
  const GYM = '#0b6e75';
  const h1 = s => (s == null ? null : Math.round(s / 360) / 10);           // seconds as hours, one decimal

  function tile(label, value, sub, colour) {
    return '<div class="tile"><span>' + label + '</span><b' + (colour ? ' style="color:' + colour + '"' : '') + '>' + U.dash(value) + '</b><em>' + (sub || '') + '</em></div>';
  }

  // The figures of one period: from a periods.json line, or from the days of load_daily.json.
  function fromPeriod(p) {
    if (!p) return { rides: 0, ride_s: 0, gym_s: 0, gym_sessions: 0, load: 0, distance_km: 0, energy_kcal: 0 };
    return { rides: p.rides, ride_s: p.ride_s, gym_s: p.gym_s, gym_sessions: p.gym_sessions, load: p.load, distance_km: p.distance_km, energy_kcal: p.energy_kcal };
  }
  function fromDays(L, a, b) {
    const out = { rides: 0, ride_s: 0, gym_s: 0, load: 0, distance_km: 0, energy_kcal: 0 };
    for (let i = Math.max(0, a); i <= Math.min(b, L.days - 1); i++) {
      out.rides += L.rides[i]; out.ride_s += L.ride_s[i]; out.gym_s += L.gym_s[i];
      out.load += L.bike_load[i] + L.gym_load[i]; out.distance_km += L.distance_km[i]; out.energy_kcal += L.energy_kcal[i];
    }
    out.load = Math.round(out.load * 10) / 10; out.distance_km = Math.round(out.distance_km * 10) / 10; out.energy_kcal = Math.round(out.energy_kcal * 10) / 10;
    return out;
  }
  function block(title, f) {
    return '<div class="card sum"><h3>' + title + '</h3><div class="tiles six">' +
      tile('Rides', U.num(f.rides)) + tile('Ride time', U.num(h1(f.ride_s), 1) + ' h') + tile('Gym time', U.num(h1(f.gym_s), 1) + ' h', '', GYM) +
      tile('Load', U.num(f.load), 'rides and gym') + tile('Distance', U.num(f.distance_km) + ' km') + tile('Energy', U.num(f.energy_kcal) + ' kcal', 'above resting') + '</div></div>';
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
      week: Object.assign({ from: U.monday(today) }, fromPeriod(per('weeks', U.monday(today)))),
      days28: L ? Object.assign({ from: U.addDays(today, -27), to: today }, fromDays(L, t - 27, t)) : null,
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
      '<p class="note">Energy is what the rides burned above resting.  Load is fitness load: TSS for a ride with power, heart-rate load without, and the gym formula for a session.</p>';
    Summary.shown = v;
  }

  const Summary = { show, view, shown: null };
  root.Summary = Summary;
})(window);
