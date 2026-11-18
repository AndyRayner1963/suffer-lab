// Drawing for the trend pages (Phase 5): a canvas with margins, scales, lines, bars and a label that
// follows the pointer.  Display only: every figure drawn comes from a table the pipeline wrote.
(function (root) {
  'use strict';
  const COL = { ctl: '#4B2C6B', atl: '#C2409A', form: '#E07B1A', bike: '#9670CC', gym: '#0b6e75', tss: '#9E1B1B',
    iff: '#2F7FD6', mute: '#595959', line: '#DDE2DF', ink: '#222' };
  const ZONE = ['#D3D8D5', '#2F7FD6', '#3A9E46', '#F08A1C', '#E0452E', '#C2261F', '#8E1616'];
  const FONT = '11px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

  // A canvas of the host's width and the given height.  m: margins { l, r, t, b }.
  function make(host, height, m) {
    host.innerHTML = '';
    host.className = 'plot';
    const cv = document.createElement('canvas'), tip = document.createElement('div');
    tip.className = 'tip'; tip.hidden = true;
    host.appendChild(cv); host.appendChild(tip);
    const w = host.clientWidth || 1100, dpr = root.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(height * dpr);
    cv.style.height = height + 'px';
    const g = cv.getContext('2d');
    g.scale(dpr, dpr); g.font = FONT; g.textBaseline = 'middle';
    const P = { g, cv, tip, host, w, h: height, l: m.l, r: m.r, t: m.t, b: m.b, pw: w - m.l - m.r, ph: height - m.t - m.b };
    P.x = (v, x0, x1) => P.l + (x1 === x0 ? 0 : (v - x0) / (x1 - x0)) * P.pw;
    P.y = (v, s) => P.h - P.b - (v - s.lo) / (s.hi - s.lo) * P.ph;
    return P;
  }

  // Horizontal gridlines and their labels.  side 'l' or 'r'; lines false draws the labels only.
  function yAxis(P, s, side, colour, fmt, lines) {
    const g = P.g;
    s.ticks.forEach(v => {
      const y = Math.round(P.y(v, s)) + 0.5;
      if (lines !== false) { g.strokeStyle = COL.line; g.lineWidth = 1; g.setLineDash([]); g.beginPath(); g.moveTo(P.l, y); g.lineTo(P.w - P.r, y); g.stroke(); }
      g.fillStyle = colour || COL.mute; g.textAlign = side === 'r' ? 'left' : 'right';
      g.fillText(fmt ? fmt(v) : String(v), side === 'r' ? P.w - P.r + 6 : P.l - 6, y);
    });
  }
  function xLabels(P, items) {         // items: [[x in pixels, text]]
    const g = P.g; g.fillStyle = COL.mute; g.textAlign = 'center';
    items.forEach(it => g.fillText(it[1], it[0], P.h - P.b + 12));
  }
  // A line through [x, y] pixel pairs; a null y breaks it.  o: { colour, width, dash, fill, base }.
  function line(P, pts, o) {
    const g = P.g;
    if (o.fill) {
      g.fillStyle = o.fill; g.beginPath(); let open = false, first = 0, last = 0;
      pts.forEach(p => {
        if (p[1] == null) { if (open) { g.lineTo(last, o.base); g.lineTo(first, o.base); g.closePath(); g.fill(); g.beginPath(); open = false; } return; }
        if (!open) { g.moveTo(p[0], p[1]); first = p[0]; open = true; } else g.lineTo(p[0], p[1]);
        last = p[0];
      });
      if (open) { g.lineTo(last, o.base); g.lineTo(first, o.base); g.closePath(); g.fill(); }
    }
    g.strokeStyle = o.colour; g.lineWidth = o.width || 1.6; g.setLineDash(o.dash || []); g.lineJoin = 'round';
    g.beginPath(); let pen = false;
    pts.forEach(p => { if (p[1] == null) { pen = false; return; } if (pen) g.lineTo(p[0], p[1]); else { g.moveTo(p[0], p[1]); pen = true; } });
    g.stroke(); g.setLineDash([]);
  }
  function rect(P, x, y, w, h, colour) { P.g.fillStyle = colour; P.g.fillRect(x, Math.min(y, y + h), w, Math.abs(h)); }
  function vline(P, x, colour, dash, text) {
    const g = P.g; g.strokeStyle = colour; g.lineWidth = 1; g.setLineDash(dash || []);
    g.beginPath(); g.moveTo(Math.round(x) + 0.5, P.t); g.lineTo(Math.round(x) + 0.5, P.h - P.b); g.stroke(); g.setLineDash([]);
    if (text) { g.fillStyle = colour; g.textAlign = 'left'; g.fillText(text, x + 4, P.t + 6); }
  }
  // The label that follows the pointer.  at(xPixel) returns html or null.
  function hover(P, at, click) {
    P.cv.onmousemove = e => {
      const box = P.cv.getBoundingClientRect(), x = e.clientX - box.left;
      const html = x < P.l || x > P.w - P.r ? null : at(x);
      if (!html) { P.tip.hidden = true; return; }
      P.tip.innerHTML = html; P.tip.hidden = false;
      const tw = P.tip.offsetWidth;
      P.tip.style.left = Math.max(P.l, Math.min(P.w - P.r - tw, x + 12 + tw > P.w - P.r ? x - tw - 12 : x + 12)) + 'px';
    };
    P.cv.onmouseleave = () => { P.tip.hidden = true; };
    if (click) { P.cv.style.cursor = 'pointer'; P.cv.onclick = e => click(e.clientX - P.cv.getBoundingClientRect().left); }
  }
  const legend = items => '<div class="legend">' + items.map(i => '<span><i style="background:' + i[1] + '"></i>' + i[0] + '</span>').join('') + '</div>';

  root.Plot = { COL, ZONE, make, yAxis, xLabels, line, rect, vline, hover, legend };
})(window);
