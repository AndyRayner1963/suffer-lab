// The ride chart: power (with zone strips and elevation behind it) above heart rate and cadence,
// on one elapsed-time axis.  Heart rate reads on the left scale, cadence on the right, each scaled
// to its own range.  Drawing only; the selection's figures come from the server.
(function (root) {
  'use strict';
  const U = root.U;
  const COL = { power: '#4B2C6B', hr: '#C8471B', cadence: '#0b6e75', ink: '#222', mute: '#595959', sel: '#4B2C6B' };
  const ZONE_COL = ['', '#2F7FD6', '#3A9E46', '#F08A1C', '#E0452E', '#C2261F', '#8E1616'];
  const ZONE_GRADED = [0, .10, .17, .25, .34, .43, .52];
  const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const L = 46, R = 44;   // room for the left scale and the right scale (elevation, cadence)

  function has(streams, channels, k) {
    return (!channels || channels.indexOf(k) >= 0) && streams[k] && streams[k].some(v => v != null);
  }
  function step(span, most, list) { return list.find(x => span / x <= most) || list[list.length - 1]; }

  // The range a line is drawn on.  Power starts at 0 and includes FTP.  Heart rate runs from its
  // lowest to its highest value.  Cadence starts just below the 5th percentile of the pedalling
  // seconds, so coasting dips run off the bottom and the pedalling shows its variation.
  function scale(l) {
    let mx = -Infinity, mn = Infinity;
    l.v.forEach(v => { if (v != null) { if (v > mx) mx = v; if (v < mn) mn = v; } });
    if (l.k === 'power') { mn = 0; if (l.ref) mx = Math.max(mx, l.ref); }
    if (l.k === 'cadence') {
      const low = U.percentile(l.v.filter(v => v > 0), .05);
      if (low != null && mx > low) mn = Math.max(0, low - (mx - low) * .15);
    }
    if (mx <= mn) mx = mn + 1;
    const stp = step(mx - mn, 5, STEPS);
    return { mn: Math.floor(mn / stp) * stp, mx: Math.ceil(mx / stp) * stp, stp };
  }

  // opts: { smooth, zones (0 off, 1 pale, 2 graded), show { hr, cadence, hrZones },
  //         sel ([from, to] or null), onSelect(sel or null) }
  function draw(box, ride, opts) {
    const st = ride.streams, ch = ride.channels, I = ride.inputs, show = opts.show || { hr: true, cadence: true, hrZones: true };
    box.innerHTML = '';
    const line = (k, unit, ref) => ({ k, unit, c: COL[k], ref, v: U.smooth(st[k], opts.smooth) });
    const panels = [];
    if (has(st, ch, 'power')) panels.push({ h: 300, lines: [line('power', 'W', I.ftp)] });
    const lower = [];
    if (show.hr && has(st, ch, 'hr')) lower.push(line('hr', 'bpm', I.threshold_hr));
    if (show.cadence && has(st, ch, 'cadence')) lower.push(line('cadence', 'rpm', null));
    if (lower.length) panels.push({ h: 232, lines: lower });
    if (!panels.length) { box.innerHTML = '<p class="note">Nothing to draw: this ride has no power, and heart rate and cadence are absent or switched off.</p>'; return; }
    const alt = show.elevation !== false && has(st, ch, 'altitude') ? st.altitude : null;
    const all = panels.reduce((a, p) => a.concat(p.lines), []);
    const N = ride.seconds, W = box.clientWidth, PW = W - L - R, dpr = root.devicePixelRatio || 1;
    const X = i => L + (N > 1 ? i / (N - 1) : 0) * PW;
    const cols = Math.max(1, Math.floor(PW));
    let top = 0;

    panels.forEach((p, pi) => {
      const last = pi === panels.length - 1, cv = document.createElement('canvas');
      cv.width = Math.round(W * dpr); cv.height = Math.round(p.h * dpr); cv.style.height = p.h + 'px';
      box.appendChild(cv);
      const g = cv.getContext('2d'); g.scale(dpr, dpr); g.font = '11px -apple-system, Arial';
      const H = p.h - (last ? 18 : 8);
      p.top = top; p.H = H; top += p.h;
      p.lines.forEach((l, li) => {
        l.s = scale(l);
        l.Y = v => 6 + (l.s.mx - v) / (l.s.mx - l.s.mn) * (H - 6);
        l.right = li > 0;                                 // the second line of a panel reads on the right
      });
      const first = p.lines[0];

      // Zone strips: power zones 2 to 7 behind power, heart-rate zones 2 to 5 behind heart rate.
      const strips = (l, uppers, on) => {
        if (!on) return;
        let lo = l.s.mn;
        const n = uppers.length + 1;
        for (let z = 0; z < n; z++) {
          const hi = z < n - 1 ? Math.min(uppers[z], l.s.mx) : l.s.mx;
          if (z > 0 && hi > lo) {
            g.globalAlpha = opts.zones === 2 ? ZONE_GRADED[z] : .14;
            g.fillStyle = ZONE_COL[z]; g.fillRect(L, l.Y(hi), PW, l.Y(lo) - l.Y(hi));
            if (l.Y(lo) - l.Y(hi) >= 13) { g.globalAlpha = .9; g.textAlign = 'left'; g.fillText('Z' + (z + 1), L + 4, l.Y(lo) - 3); }
          }
          lo = Math.max(lo, hi);
        }
        g.globalAlpha = 1;
      };
      let striped = false;
      if (first.k === 'power' && opts.zones) { strips(first, ride.zonePct.map(q => I.ftp * q / 100), true); striped = true; }
      if (first.k === 'hr' && show.hrZones) { strips(first, ride.hrZonePct.map(q => I.threshold_hr * q / 100), true); striped = true; }

      if (alt && pi === 0) {                              // elevation: solid grey behind the first panel
        let a0 = Infinity, a1 = -Infinity;
        alt.forEach(v => { if (v != null) { if (v < a0) a0 = v; if (v > a1) a1 = v; } });
        if (a1 - a0 < 20) a1 = a0 + 20;
        const YA = v => 6 + (a1 - v) / (a1 - a0) * (H - 6) * .92 + (H - 6) * .08;
        g.fillStyle = striped ? 'rgba(120,128,124,.38)' : '#D3D8D5';
        g.beginPath(); g.moveTo(X(0), H);
        let lx = X(0);
        U.columns(alt, N, cols).forEach(pt => { if (pt[1] != null) { lx = X(pt[0]); g.lineTo(lx, YA(pt[1])); } });
        g.lineTo(lx, H); g.closePath(); g.fill();
        if (p.lines.length < 2) {                         // the right scale is free for the elevation
          g.fillStyle = '#8a918d'; g.textAlign = 'left';
          [a0, (a0 + a1) / 2, a1].forEach(v => g.fillText(Math.round(v) + ' m', W - R + 5, YA(v) + 4));
        }
      }

      // Grid lines and the left scale from the first line; the second line's scale on the right.
      g.strokeStyle = 'rgba(120,130,125,.25)'; g.lineWidth = 1;
      for (let v = first.s.mn; v <= first.s.mx + 1e-9; v += first.s.stp) {
        g.beginPath(); g.moveTo(L, Math.round(first.Y(v)) + .5); g.lineTo(W - R, Math.round(first.Y(v)) + .5); g.stroke();
        g.fillStyle = p.lines.length > 1 ? first.c : COL.mute; g.textAlign = 'right'; g.fillText(v, L - 6, first.Y(v) + 4);
      }
      p.lines.forEach(l => {
        if (l.right) {
          g.fillStyle = l.c; g.textAlign = 'left';
          for (let v = l.s.mn; v <= l.s.mx + 1e-9; v += l.s.stp) g.fillText(v, W - R + 6, l.Y(v) + 4);
        }
        g.save(); g.translate(l.right ? W - 6 : 11, H / 2); g.rotate(-Math.PI / 2);
        g.textAlign = 'center'; g.fillStyle = l.c; g.fillText(l.unit, 0, 0); g.restore();
      });
      if (last) {
        g.textAlign = 'center'; g.fillStyle = COL.mute;
        const ts = step(N, 12, [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400]);
        for (let t = 0; t < N; t += ts) g.fillText(U.hm(t), X(t), p.h - 4);
      }
      g.save(); g.beginPath(); g.rect(L, 0, PW, H); g.clip();      // a line never leaves its panel
      p.lines.forEach(l => {
        if (l.ref && l.ref >= l.s.mn && l.ref <= l.s.mx) {
          g.setLineDash([3, 3]); g.strokeStyle = l.c; g.globalAlpha = .6;
          g.beginPath(); g.moveTo(L, l.Y(l.ref)); g.lineTo(W - R, l.Y(l.ref)); g.stroke();
          g.setLineDash([]); g.globalAlpha = 1;
        }
        g.strokeStyle = l.c; g.lineWidth = 1.2; g.lineJoin = 'round'; g.beginPath();
        let pen = false;
        U.columns(l.v, N, cols).forEach(pt => {
          if (pt[1] == null) { pen = false; return; }
          if (pen) g.lineTo(X(pt[0]), l.Y(pt[1])); else g.moveTo(X(pt[0]), l.Y(pt[1]));
          pen = true;
        });
        g.stroke();
      });
      g.restore();
    });

    // One layer above the panels for the selection and the pointer line.
    const over = document.createElement('canvas');
    over.className = 'over'; over.width = Math.round(W * dpr); over.height = Math.round(top * dpr); over.style.height = top + 'px';
    box.appendChild(over);
    const og = over.getContext('2d'); og.scale(dpr, dpr);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; box.appendChild(tip);
    let sel = opts.sel, tmp = null, down = null;

    function overlay(cur) {
      og.clearRect(0, 0, W, top);
      const s = tmp || sel;
      panels.forEach(p => {
        if (s) {
          og.fillStyle = 'rgba(150,112,204,.22)'; og.fillRect(X(s[0]), p.top, X(s[1]) - X(s[0]), p.H);
          og.strokeStyle = COL.sel; og.lineWidth = 1; og.strokeRect(X(s[0]) + .5, p.top + .5, X(s[1]) - X(s[0]), p.H - 1);
        }
        if (cur != null) { og.strokeStyle = COL.ink; og.lineWidth = 1; og.beginPath(); og.moveTo(X(cur) + .5, p.top); og.lineTo(X(cur) + .5, p.top + p.H); og.stroke(); }
      });
    }
    const at = e => {
      const b = box.getBoundingClientRect();
      return Math.max(0, Math.min(N - 1, Math.round((e.clientX - b.left - L) / PW * (N - 1))));
    };
    function finish() {
      if (down == null) return;
      const had = sel; sel = tmp; tmp = null; down = null;
      if (sel || had) opts.onSelect(sel);      // a single click (no drag) returns to the whole ride
    }
    box.onmousedown = e => { if (e.button === 0) { down = at(e); e.preventDefault(); } };
    box.onmousemove = e => {
      const i = at(e);
      if (down != null && Math.abs(i - down) > 2) tmp = [Math.min(down, i), Math.max(down, i)];
      overlay(i);
      tip.innerHTML = '<b>' + U.hms(i) + '</b>' + all.map(l => '<span style="color:' + l.c + '">' +
        (l.v[i] == null ? '—' : Math.round(l.v[i])) + ' ' + l.unit + '</span>').join('') +
        (alt && alt[i] != null ? '<span>' + Math.round(alt[i]) + ' m</span>' : '');
      tip.hidden = false;
      const x = X(i);
      if (x > W - 280) { tip.style.left = ''; tip.style.right = (W - x + 8) + 'px'; }
      else { tip.style.right = ''; tip.style.left = (x + 8) + 'px'; }
    };
    box.onmouseup = e => { finish(); overlay(at(e)); };
    box.onmouseleave = () => { finish(); tip.hidden = true; overlay(null); };
    overlay(null);
  }

  root.Chart = { draw };
})(window);
