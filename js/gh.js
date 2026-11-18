// The phone's way to the data: the private cycling-data repository on GitHub, read with a token that
// can only read it.  The token is kept on this phone (IndexedDB) and sent only to API, a constant.
// Files are fetched by their git object (blob), whose name is the hash of its content, so a copy on the
// phone is either exactly right or not used: nothing goes stale and nothing is recalculated here.
(function (root) {
  'use strict';
  const API = 'https://api.github.com';
  const DB = 'sufferlab', VER = 1, TIMEOUT_MS = 20000;

  // ---- IndexedDB: kv (settings, the last commit, folder listings by path) and blobs (file text by hash)
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((ok, no) => {
      const r = root.indexedDB.open(DB, VER);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('blobs'); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => { dbp = null; no(r.error); };
    });
    return dbp;
  }
  async function op(store, mode, fn) {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction(store, mode), s = t.objectStore(store);
      const req = fn(s);
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => no(t.error);
    });
  }
  const kvGet = k => op('kv', 'readonly', s => s.get(k));
  const kvPut = (k, v) => op('kv', 'readwrite', s => s.put(v, k));
  const blobGet = k => op('blobs', 'readonly', s => s.get(k));
  const blobPut = (k, v) => op('blobs', 'readwrite', s => s.put(v, k));
  const blobDel = k => op('blobs', 'readwrite', s => s.delete(k));

  class GHError extends Error {
    constructor(kind, message) { super(message); this.kind = kind; }      // kind: auth | notfound | offline | http | setup
  }

  const GH = { cfg: null, commit: null, offline: false, stats: { requests: 0, phone: 0, kb: 0 }, GHError };

  async function settings() {
    const s = (await kvGet('settings')) || {};
    const host = root.location ? root.location.hostname : '';
    if (s.owner === undefined) s.owner = host.endsWith('.github.io') ? host.split('.')[0] : '';
    if (s.repo === undefined) s.repo = 'cycling-data';
    if (s.token === undefined) s.token = '';
    GH.cfg = s;
    return s;
  }
  async function saveSettings(patch) {
    const s = Object.assign({}, GH.cfg || (await settings()), patch);
    await kvPut('settings', s);
    GH.cfg = s;
    return s;
  }

  async function call(path, accept) {
    const c = GH.cfg;
    if (!c || !c.token) throw new GHError('setup', 'No token saved on this phone.');
    if (!c.owner || !c.repo) throw new GHError('setup', 'The data repository is not set.');
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(API + '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + path, {
        headers: { Authorization: 'Bearer ' + c.token, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
        cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal });
    } catch (e) {
      throw new GHError('offline', 'No connection to GitHub.');
    } finally { clearTimeout(timer); }
    GH.stats.requests++;
    if (res.status === 401) throw new GHError('auth', 'GitHub refused the token.  Replace it in Settings.');
    if (res.status === 403) throw new GHError('auth', 'GitHub refused the request (403): the token may lack read access to ' + c.repo + ', or the hourly limit is used up.');
    if (res.status === 404) throw new GHError('notfound', 'GitHub cannot find ' + c.owner + '/' + c.repo + ' (or the token cannot see it).');
    if (!res.ok) throw new GHError('http', 'GitHub answered ' + res.status + '.');
    const text = await res.text();
    GH.stats.kb += text.length / 1024;
    return text;
  }

  // The newest commit of the default branch, or the last one seen when there is no connection.
  async function open() {
    await settings();
    try {
      GH.commit = (await call('/commits/HEAD', 'application/vnd.github.sha')).trim();
      GH.offline = false;
      await kvPut('commit', GH.commit);
    } catch (e) {
      if (e.kind !== 'offline') throw e;
      GH.commit = await kvGet('commit');
      GH.offline = true;
      if (!GH.commit) throw new GHError('offline', 'No connection, and nothing has been read onto this phone yet.');
    }
    return GH.commit;
  }

  // A folder listing (git tree) by its hash; kept, since a hash never changes its content.
  const inflight = {};
  function tree(sha) {            // one request per folder, however many files ask for it at once
    if (!inflight[sha]) inflight[sha] = treeOf(sha).finally(() => { delete inflight[sha]; });
    return inflight[sha];
  }
  async function treeOf(sha) {
    const k = 'tree:' + sha, have = await kvGet(k);
    if (have) { GH.stats.phone++; return have; }
    if (GH.offline) return null;
    const t = JSON.parse(await call('/git/trees/' + sha, 'application/vnd.github+json'));
    const map = {};
    (t.tree || []).forEach(e => { map[e.path] = e.sha; });
    await kvPut(k, map);
    return map;
  }
  async function rootTree() {
    if (GH.offline) return (await kvGet('rootTree')) || null;
    let top = await kvGet('ctree:' + GH.commit);            // a commit's folder never changes either
    if (!top) {
      top = JSON.parse(await call('/git/commits/' + GH.commit, 'application/vnd.github+json')).tree.sha;
      await kvPut('ctree:' + GH.commit, top);
    }
    const t = await tree(top);
    await kvPut('rootTree', t);
    return t;
  }
  // The hash of the file at a path in the commit opened, walking down the folders.
  async function shaOf(path) {
    if (!GH.root) GH.root = rootTree().catch(e => { GH.root = null; throw e; });
    let t = await GH.root;
    const parts = path.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      if (!t || !t[parts[i]]) return null;
      t = await tree(t[parts[i]]);
    }
    return t ? t[parts[parts.length - 1]] || null : null;
  }

  // A JSON file of cycling-data by its path (index.json, rides/2026/....json).  Throws if it is absent.
  async function file(path) {
    const sha = await shaOf(path);
    if (!sha) throw new GHError(GH.offline ? 'offline' : 'notfound', path + (GH.offline ? ' is not on this phone yet and there is no connection.' : ' is not in ' + GH.cfg.repo + '.'));
    let text = await blobGet(sha);
    if (text != null) GH.stats.phone++;
    else {
      if (GH.offline) throw new GHError('offline', path + ' is not on this phone yet and there is no connection.');
      text = await call('/git/blobs/' + sha, 'application/vnd.github.raw+json');
      await blobPut(sha, text);
      // the copy of the same path from an older commit is no longer needed
      const was = await kvGet('path:' + path);
      if (was && was !== sha) await blobDel(was);
      await kvPut('path:' + path, sha);
    }
    return JSON.parse(text);
  }

  // Forget everything read (the token and settings stay).
  async function clear() {
    const d = await db();
    await new Promise((ok, no) => {
      const t = d.transaction(['kv', 'blobs'], 'readwrite');
      t.objectStore('blobs').clear();
      const kv = t.objectStore('kv'), r = kv.openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) return; if (c.key !== 'settings') c.delete(); c.continue(); };
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    GH.root = null;
  }

  Object.assign(GH, { settings, saveSettings, open, file, clear, API });
  root.GH = GH;
})(window);
