// Suffer Lab on the phone: start-up, the address after the #, the bar of pages and Settings.
// The pages themselves are the Mac dashboard's own (summary.js, ride.js, gym.js, fitness.js, weeks.js,
// power.js, records.js), given the data through GitHub (gh.js) in place of the Mac's local server.
// The calendar is a list (list.js).  Nothing here calculates a figure.
(function (root) {
  'use strict';
  const U = root.U, GH = root.GH, main = document.getElementById('main');
  const FORMAT = 1;
  // the tables every page starts from; histograms.json is left out (no histograms on the phone)
  const TABLES = ['index.json', 'hr_warnings.json', 'records.json', 'settings.json', 'load_daily.json', 'periods.json', 'gym.json',
    'power_curve.json', 'hr_power.json', 'tests.json', 'ftp_rule.json'];
  const App = { phone: true, rides: [], byDate: {}, warn: {}, records: null, settings: null, years: [], today: '',
    load: null, periods: null, hist: null, gym: [], gymByDate: {}, power: null, hrPower: null, tests: null, ftpRule: null,
    state: { y: 0, m: 0, smooth: 5, zones: 1, show: { elevation: true, hr: true, cadence: true, hrZones: true }, sel: null, rideId: null, lastRide: null, gymId: null,
      fit: { sel: 'all', period: 90 }, hist: { power: 10, hr: 5, cadence: 5 }, weeks: { span: 26, share: false },
      power: { period: 'last_90_days', against: 'all', hrA: null, hrB: null }, records: { show: 'ach', part: '', order: 'part' } },
    redraw: null, ready: false, loadMs: null };
  root.App = App;

  // What the Mac pages call to read a file.  'data/<path>' is a file of cycling-data; anything else
  // (the Mac server's selection and curve addresses) does not exist on the phone.
  async function get(path) {
    if (!/^data\//.test(path)) throw new Error('That needs the Mac.');
    const body = await GH.file(path.slice(5));
    if (body && typeof body.format === 'number' && body.format > FORMAT) {
      throw new Error(path.slice(5) + ' is in format ' + body.format + '; this page reads format ' + FORMAT + '.  Publish the phone page again.');
    }
    return body;
  }
  // On a narrow screen, leave out an axis label that would overlap the one before it.
  const xLabels0 = root.Plot.xLabels;
  root.Plot.xLabels = (P, items) => {
    let right = -Infinity;
    const kept = items.filter(it => {
      const w = P.g.measureText(it[1]).width;
      if (it[0] - w / 2 < right + 6) return false;
      right = it[0] + w / 2;
      return true;
    });
    xLabels0(P, kept);
  };
  // No selection on the ride chart: its figures come from the Mac's server.
  const draw0 = root.Chart.draw;
  root.Chart.draw = (box, ride, o) => draw0(box, ride, Object.assign({}, o, { sel: null, onSelect: () => {} }));

  function fail(e) {
    const setup = e && (e.kind === 'setup' || e.kind === 'auth' || e.kind === 'notfound');
    main.innerHTML = '<div class="msg"><b>The data could not be read.</b><br>' + U.esc(e && e.message) +
      (setup ? '<br><a href="#/settings">Open Settings</a>' : '') + '</div>';
  }

  const TABS = [['summary', 'Summary'], ['month', 'Calendar'], ['fitness', 'Fitness'], ['weeks', 'Weeks'], ['power', 'Power'], ['records', 'Records']];
  function tabs(view) {
    const on = view === 'ride' || view === 'gym' || view === 'year' ? 'month' : view;
    document.getElementById('tabs').innerHTML = TABS.map(t => '<button data-tab="' + t[0] + '" class="' + (t[0] === on ? 'on' : '') + '">' + t[1] + '</button>').join('');
  }

  function route() {
    const h = location.hash;
    if (/^#\/settings/.test(h)) { tabs('settings'); App.redraw = null; settingsPage(); root.scrollTo(0, 0); return; }
    if (!App.ready) return;
    const now = U.parseHash(h) || { view: 'summary' };
    if (now.view === 'year') { now.view = 'month'; now.m = now.y === +App.today.slice(0, 4) ? +App.today.slice(5, 7) - 1 : 0; }
    tabs(now.view);
    App.redraw = null;
    App.state.gymId = null;
    const PAGES = { fitness: 'Fitness', weeks: 'Weeks', summary: 'Summary', power: 'Power', records: 'Records' };
    if (PAGES[now.view]) {
      App.state.rideId = null;
      const done = root[PAGES[now.view]].show(App, main, get);
      if (done && done.catch) done.catch(fail);
    } else if (now.view === 'gym') {
      const g = App.gym.find(x => x.id === now.id);
      if (!g) { main.innerHTML = '<div class="msg">No gym session ' + U.esc(now.id) + ' in gym.json.</div>'; return; }
      App.state.rideId = null; App.state.gymId = g.id;
      main.innerHTML = '<p class="note">Loading…</p>';
      root.Gym.show(App, g, main, get).catch(fail);
    } else if (now.view === 'ride') {
      const entry = App.rides.find(r => r.ride_id === now.id);
      if (!entry) { main.innerHTML = '<div class="msg">No ride ' + U.esc(now.id) + ' in index.json.</div>'; return; }
      App.state.sel = null;
      App.state.rideId = App.state.lastRide = entry.ride_id;
      main.innerHTML = '<p class="note">Loading…</p>';
      root.Ride.show(App, entry, main, get).catch(fail);
    } else {
      App.state.rideId = null;
      App.state.y = now.view === 'month' ? now.y : +App.today.slice(0, 4);
      App.state.m = now.view === 'month' ? now.m : +App.today.slice(5, 7) - 1;
      main.innerHTML = root.List.month(App, App.state.y, App.state.m);
    }
    root.scrollTo(0, 0);
  }

  // ---- Settings: the token, the repository, what was read and how long it took
  async function settingsPage() {
    const s = await GH.settings();
    const st = GH.stats;
    main.innerHTML = '<div class="bar"><h2 class="free">Settings</h2></div>' +
      '<div class="card"><h3>GitHub Token</h3>' + (s.token ?
        '<p>Token saved, ending <b class="mono">' + U.esc(s.token.slice(-4)) + '</b>.</p><div class="btnrow"><button class="btn" id="rep">Replace token</button><button class="btn" id="rem">Remove token</button></div>' :
        '<p>Paste the read-only token for <b>' + U.esc(s.repo) + '</b>.</p>') +
      '<div id="tokin"' + (s.token ? ' hidden' : '') + '><input class="field mono" id="tok" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="github_pat_…">' +
      '<div class="btnrow"><button class="btn on" id="savet">Save token</button></div></div>' +
      '<p class="note">The token stays on this phone and is sent only to api.github.com.</p></div>' +
      '<div class="card"><h3>Data Repository</h3><label class="lab">Owner</label><input class="field" id="own" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + U.esc(s.owner) + '">' +
      '<label class="lab">Name</label><input class="field" id="rpo" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + U.esc(s.repo) + '">' +
      '<div class="btnrow"><button class="btn" id="saver">Save repository</button></div></div>' +
      '<div class="card"><h3>This Phone</h3>' +
      (App.loadMs != null ? '<p>Last opening: <b data-s="ms">' + U.num(App.loadMs) + '</b> ms to the first page; ' + st.requests + ' requests to GitHub (' + U.num(st.kb) + ' KB), ' +
        st.phone + ' files from this phone' + (GH.offline ? '; <b>no connection</b>, so the copy on this phone was shown' : '') + '.</p>' : '<p>Nothing read yet.</p>') +
      (GH.commit ? '<p class="note">Data at commit ' + U.esc(GH.commit.slice(0, 7)) + (App.rides.length ? ' · ' + App.rides.length + ' rides, latest ' + App.rides[App.rides.length - 1].date : '') + '.</p>' : '') +
      '<div class="btnrow"><button class="btn" id="reload">Read the data again</button><button class="btn" id="forget">Forget the copy on this phone</button></div>' +
      '<p class="note">Version ' + U.esc(root.SUFFERLAB_VERSION || '') + '.</p></div>';
    const $ = id => document.getElementById(id);
    if ($('rep')) $('rep').onclick = () => { $('tokin').hidden = false; $('tok').focus(); };
    if ($('rem')) $('rem').onclick = async () => { await GH.saveSettings({ token: '' }); settingsPage(); };
    $('savet').onclick = async () => {
      const t = $('tok').value.trim();
      if (!t) return;
      await GH.saveSettings({ token: t });
      start(true);
    };
    $('saver').onclick = async () => { await GH.saveSettings({ owner: $('own').value.trim(), repo: $('rpo').value.trim() }); start(true); };
    $('reload').onclick = () => start(true);
    $('forget').onclick = async () => { await GH.clear(); start(true); };
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      const v = t.dataset.tab;
      location.hash = v === 'month' ? '#/month/' + App.today.slice(0, 7) : '#/' + v;
      return;
    }
    const el = e.target.closest('[data-go]');
    if (el) location.hash = el.dataset.go;
  });
  root.addEventListener('hashchange', route);
  let timer = null;
  root.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (App.redraw) App.redraw(); }, 150); });

  async function start(goSummary) {
    const t0 = performance.now();
    GH.stats.requests = 0; GH.stats.phone = 0; GH.stats.kb = 0; GH.root = null;
    App.ready = false;
    const s = await GH.settings();
    if (!s.token) { location.hash = '#/settings'; route(); return; }
    main.innerHTML = '<p class="note">Loading…</p>';
    try {
      await GH.open();
      const maybe = p => get('data/' + p).catch(e => { if (e.kind === 'notfound') return null; throw e; });
      const [index, warnings, records, settings, load, periods, gym, pc, hrp, tests, rule] = await Promise.all(TABLES.map(maybe));
      if (!index) throw new GH.GHError('notfound', 'index.json is not in ' + s.repo + '.');
      App.load = load; App.periods = periods; App.hist = null;
      App.power = pc; App.hrPower = hrp; App.tests = tests; App.ftpRule = rule;
      App.gym = ((gym && gym.sessions) || []).filter(g => g.id);
      App.gymByDate = U.byDate(App.gym);
      App.rides = index.rides.slice().sort((a, b) => (a.ride_id < b.ride_id ? -1 : a.ride_id > b.ride_id ? 1 : 0));
      App.byDate = U.byDate(App.rides);
      App.warn = {};
      ((warnings && warnings.rides) || []).forEach(w => { App.warn[w.ride_id] = w; });
      App.records = records; App.settings = settings;
      App.years = Array.from(new Set(App.rides.map(r => +r.date.slice(0, 4)))).sort();
      const d = new Date();
      App.today = U.iso(d.getFullYear(), d.getMonth(), d.getDate());
      const last = App.rides[App.rides.length - 1];
      document.getElementById('asof').textContent = (GH.offline ? 'Offline · ' : '') + (last ? 'latest ride ' + U.dayMonth(last.date) : '');
      App.ready = true;
      if (goSummary === true || /^#\/settings/.test(location.hash)) location.hash = '#/summary';
      route();
      App.loadMs = Math.round(performance.now() - t0);      // read by the load-time test and shown in Settings
    } catch (e) {
      fail(e);
    }
  }

  // A new version of the page has been fetched in the background: offer it.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const offer = () => {
        const b = document.getElementById('upd');
        b.hidden = false;
        b.onclick = () => { if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); };
      };
      if (reg.waiting) offer();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(); });
      });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }

  start();
})(window);
