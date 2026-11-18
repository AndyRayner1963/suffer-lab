// The phone's calendar: one month as a list of weeks, newest first, so this week is at the top.
// Each week shows its totals (periods.json), its closing fitness, fatigue and form (load_daily.json, as the
// Mac's week column shows them) and its days with activities, newest first.  A ride is one line from
// index.json; a gym session is one teal line from gym.json.  Nothing is calculated here.
(function (root) {
  'use strict';
  const U = root.U;
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SHORT = U.MONTHS.map(m => m.slice(0, 3));
  const dayName = key => WD[new Date(key + 'T00:00:00').getDay()] + ' ' + +key.slice(8, 10) + ' ' + SHORT[+key.slice(5, 7) - 1];

  // A ride: duration, distance, TSS (or load), NP, IF, in the Mac calendar's order; warning labels beneath.
  function rideRow(App, r) {
    const m = r.load_method, cls = m === 'power' ? '' : m === 'heart rate' ? ' hrl' : ' none';
    const load = m === 'power' ? 'TSS ' + U.num(r.tss) : m === 'heart rate' ? 'Load ' + U.num(r.load) : '';
    const tags = (m === 'heart rate' ? '<span class="tag">HR load</span>' : '') + (m === 'none' ? '<span class="tag">no load</span>' : '') +
      (r.avg_hr_bpm == null ? '<span class="tag">no HR</span>' : '') + (App.warn[r.ride_id] ? '<span class="tag">⚠ HR</span>' : '') +
      (r.warnings && r.warnings.power && r.warnings.power.length ? '<span class="tag">⚠ power</span>' : '');
    const c = (k, s) => '<span data-l="' + k + '">' + s + '</span>';
    return '<a class="act ride' + cls + '" href="#/ride/' + U.esc(r.ride_id) + '"><span class="t">' + U.esc(r.start_local.slice(11, 16)) + '</span>' +
      c('moving_s', '<b>' + U.hm(r.moving_s) + '</b>') + c('distance_km', r.distance_km == null ? '' : U.dist(r.distance_km) + ' ' + U.DIST.unit) +
      c('load', load) + c('np_w', r.np_w == null ? '' : 'NP ' + U.num(r.np_w) + ' W') + c('if', r.if == null ? '' : 'IF ' + U.num(r.if, 2)) +
      (tags ? '<span class="tags">' + tags + '</span>' : '') + '</a>';
  }
  // A gym session: duration, load and the three body parts with the most sets.
  function gymRow(g) {
    const parts = g.groups ? g.groups.slice(0, 3).map(p => U.esc(root.Gym.part(p.group)) + ' ' + p.sets).join(' · ') :
      'Garmin' + (g.avg_hr_bpm == null ? '' : ' · HR ' + U.num(g.avg_hr_bpm));
    return '<a class="act gym" href="#/gym/' + U.esc(g.id) + '"><span class="t">' + U.esc(g.start_local.slice(11, 16)) + '</span>' +
      '<span data-l="minutes"><b>' + U.hm(g.minutes * 60) + '</b></span><span data-l="gload">Load ' + U.num(g.load) + '</span>' +
      '<span class="parts">' + parts + '</span></a>';
  }

  // Fitness, fatigue and form at the end of the week's Sunday, as the Mac's week column shows them.
  function weekEnd(App, sunday) {
    const L = App.load;
    if (!L) return '';
    const i = U.dayIndex(L.first, sunday);
    if (i < 0 || i >= L.days) return '';
    const ctl = L.all.ctl[i], atl = L.all.atl[i], form = Math.round((ctl - atl) * 10) / 10;
    const f = (cls, label, text) => '<span class="' + cls + '">' + label + ' <b data-w="' + cls + '">' + text + '</b></span>';
    return '<div class="wfit' + (sunday > App.today ? ' proj' : '') + '">' + f('ctl', 'Fitness', U.num(ctl, 1)) + f('atl', 'Fatigue', U.num(atl, 1)) +
      f('tsb', 'Form', (form > 0 ? '+' : form < 0 ? '−' : '') + U.num(Math.abs(form), 1)) + '</div>';
  }

  // The week's totals from periods.json: ride and gym, time and load; distance and energy for the rides.
  function totals(p) {
    if (!p || !(p.rides || p.gym_sessions)) return '';
    const row = (cls, name, time, load, km, kcal) => '<tr class="' + cls + '"><td>' + name + '</td><td data-w="' + cls + '_time">' + time + '</td><td data-w="' + cls + '_load">' + load +
      '</td><td data-w="' + cls + '_km">' + km + '</td><td data-w="' + cls + '_kcal">' + kcal + '</td></tr>';
    return '<table class="wtot"><tr><th></th><th>Time</th><th>Load</th><th>' + U.DIST.unit + '</th><th>kcal</th></tr>' +
      (p.rides ? row('r', p.rides + (p.rides === 1 ? ' ride' : ' rides'), U.hm(p.ride_s), U.num(p.load_bike), U.dist(p.distance_km), U.num(p.energy_kcal)) : '') +
      (p.gym_sessions ? row('g', p.gym_sessions + ' gym', U.hm(p.gym_s), U.num(p.load_gym), '', '') : '') + '</table>';
  }

  function month(App, y, m) {
    const T = App.periods, wk = {}, mo = T && T.months.find(p => p.key === U.iso(y, m, 1).slice(0, 7));
    if (T) T.weeks.forEach(p => { wk[p.key] = p; });
    let py = y, pm = m - 1, ny = y, nm = m + 1;
    if (pm < 0) { pm = 11; py--; }
    if (nm > 11) { nm = 0; ny++; }
    const later = U.iso(ny, nm, 1) <= App.today;
    let h = '<div class="bar mnav"><button class="btn" data-go="#/month/' + U.iso(py, pm, 1).slice(0, 7) + '">◀</button><h2 class="mid">' + U.MONTHS[m] + ' ' + y + '</h2>' +
      '<button class="btn" ' + (later ? 'data-go="#/month/' + U.iso(ny, nm, 1).slice(0, 7) + '"' : 'disabled') + '>▶</button></div>';
    if (mo && (mo.rides || mo.gym_sessions)) {
      h += '<p class="mtot" data-w="month">' + (mo.rides ? '<b>' + mo.rides + '</b> ' + (mo.rides === 1 ? 'ride' : 'rides') + ' · <b>' + U.hm(mo.ride_s) + '</b> · load <b>' + U.num(mo.load_bike) + '</b>' +
        (mo.distance_km == null ? '' : ' · <b>' + U.dist(mo.distance_km) + '</b> ' + U.DIST.unit) : '') +
        (mo.gym_sessions ? (mo.rides ? '<br>' : '') + '<span class="g"><b>' + mo.gym_sessions + '</b> gym · <b>' + U.hm(mo.gym_s) + '</b> · load <b>' + U.num(mo.load_gym) + '</b></span>' : '') + '</p>';
    }
    const weeks = U.monthGrid(y, m).filter(w => w[0].key <= App.today).reverse();
    weeks.forEach(week => {
      const days = week.slice().reverse().filter(d => d.key <= App.today);
      let body = '';
      days.forEach(d => {
        const rs = App.byDate[d.key] || [], gs = App.gymByDate[d.key] || [];
        if (!rs.length && !gs.length) return;
        const both = rs.map(r => [r.start_local, rideRow(App, r)]).concat(gs.map(g => [g.start_local, gymRow(g)])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
        body += '<div class="day' + (d.key === App.today ? ' today' : '') + (d.inMonth ? '' : ' out') + '"><h4>' + dayName(d.key) + (d.key === App.today ? ' · today' : '') + '</h4>' +
          both.map(x => x[1]).join('') + '</div>';
      });
      h += '<div class="card week" data-week="' + week[0].key + '"><div class="whd"><h3>Week of ' + U.dayMonth(week[0].key) + '</h3>' + weekEnd(App, week[6].key) + '</div>' +
        // the activities, and the week's totals beside them (shown when the phone is turned on its side)
        '<div class="wbody"><div class="wdays">' + (body || '<p class="note">No activity.</p>') + '</div>' + totals(wk[week[0].key]) + '</div></div>';
    });
    if (!weeks.length) h += '<p class="note">Nothing yet this month.</p>';
    return h;
  }

  root.List = { month, rideRow, gymRow };
})(window);
