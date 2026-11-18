// Histograms with a slider for the bucket: time at each power, heart rate or cadence.
// The pipeline writes the seconds in fine steps (5 W, 1 bpm, 1 rpm); a wider bucket is the sum of its
// steps, so nothing is calculated here.  Used by the Fitness page, the ride page and the gym page.
(function (root) {
  'use strict';
  const U = root.U, Plot = root.Plot;
  const KINDS = {
    power: { unit: 'W', title: 'Time at Each Power', sizes: [5, 10, 15, 20, 25, 30, 40, 50], colour: '#9670CC' },
    hr: { unit: 'bpm', title: 'Time at Each Heart Rate', sizes: [1, 2, 3, 4, 5, 6, 8, 10], colour: '#C8471B' },
    cadence: { unit: 'rpm', title: 'Time at Each Cadence', sizes: [1, 2, 3, 4, 5, 6, 8, 10], colour: '#0b6e75' }
  };
  const shown = {};                 // what each histogram on the page shows; read by the page tests

  // Seconds at each fine step, added over a list of { first, step, s } (a null entry adds nothing).
  function gather(list) {
    const fine = {};
    list.forEach(h => { if (h && h.s) h.s.forEach((v, i) => { if (v) { const lo = h.first + i * h.step; fine[lo] = (fine[lo] || 0) + v; } }); });
    return fine;
  }
  // The bars for a bucket size.  The top 0.2% of the time is a long thin tail: it is gathered into the last bar.
  function bars(fine, size) {
    const keys = Object.keys(fine).map(Number).sort((x, y) => x - y), out = [];
    let total = 0;
    keys.forEach(k => { total += fine[k]; });
    if (!keys.length) return { total: 0, bars: [] };
    let run = 0, cut = keys[keys.length - 1];
    for (const k of keys) { run += fine[k]; if (run >= total * 0.998) { cut = k; break; } }
    const lo0 = Math.floor(keys[0] / size) * size, last = Math.floor(cut / size) * size;
    for (let lo = lo0; lo <= last; lo += size) out.push({ lo: lo, hi: lo + size - 1, s: 0, open: false });
    keys.forEach(k => { const i = Math.min(out.length - 1, Math.floor((k - lo0) / size)); out[i].s += fine[k]; if (k > out[i].hi) out[i].open = true; });
    return { total: total, bars: out };
  }
  // A colour for a value from zone limits (a value on a limit belongs to the lower zone).
  const zoneColour = uppers => v => { let z = 0; while (z < uppers.length && v > uppers[z]) z++; return Plot.ZONE[z]; };

  function card(kind, id, size, title) {
    const k = KINDS[kind];
    return '<div class="card"><div class="ctl"><h3 class="in">' + (title || k.title) + '</h3><span class="lbl gap">Bucket</span>' +
      '<input type="range" min="0" max="' + (k.sizes.length - 1) + '" step="1" value="' + Math.max(0, k.sizes.indexOf(size)) + '" data-hist="' + kind + '">' +
      '<b class="hsz" data-hsz="' + kind + '">' + size + ' ' + k.unit + '</b></div><div id="' + id + '"></div></div>';
  }
  function draw(id, kind, fine, size, colourOf, empty) {
    const host = document.getElementById(id), k = KINDS[kind], B = bars(fine, size);
    shown[kind] = { size: size, total: B.total, bars: B.bars.map(b => [b.lo, b.s]) };
    if (!host) return;
    if (!B.bars.length) { host.innerHTML = '<p class="note">' + (empty || 'Nothing recorded.') + '</p>'; return; }
    const n = B.bars.length, peak = Math.max.apply(null, B.bars.map(b => b.s)), mins = peak < 7200;
    const sc = U.scale(0, peak / (mins ? 60 : 3600), 4);
    const P = Plot.make(host, 220, { l: 50, r: 12, t: 8, b: 22 });
    Plot.yAxis(P, sc, 'l', null, x => U.num(x, sc.step % 1 ? 1 : 0) + (mins ? ' min' : ' h'));
    const X = i => P.x(i, 0, n), bw = P.pw / n, unit = mins ? 60 : 3600;
    B.bars.forEach((b, i) => Plot.rect(P, X(i) + 0.5, P.y(0, sc), Math.max(1, bw - 1), P.y(b.s / unit, sc) - P.y(0, sc),
      colourOf ? colourOf(b.lo + size / 2) : k.colour));
    const every = Math.max(1, Math.ceil(n / 10)), labels = [];
    B.bars.forEach((b, i) => { if (i % every === 0) labels.push([X(i) + bw / 2, String(b.lo)]); });
    Plot.xLabels(P, labels);
    Plot.hover(P, x => {
      const b = B.bars[Math.max(0, Math.min(n - 1, Math.floor((x - P.l) / bw)))];
      return '<b>' + b.lo + (b.open ? '+' : size === 1 ? '' : '–' + b.hi) + ' ' + k.unit + '</b><span>' + U.hms(b.s) + '</span><span>' + U.share(b.s, B.total) + '%</span>';
    });
  }
  // The sliders inside `box`: a move stores the size in `sizes` and redraws that histogram.
  function wire(box, sizes, redraw) {
    box.querySelectorAll('[data-hist]').forEach(el => {
      el.oninput = () => {
        const kind = el.dataset.hist;
        sizes[kind] = KINDS[kind].sizes[+el.value];
        box.querySelector('[data-hsz="' + kind + '"]').textContent = sizes[kind] + ' ' + KINDS[kind].unit;
        redraw(kind);
      };
    });
  }

  root.Hist = { KINDS, gather, bars, zoneColour, card, draw, wire, shown };
})(window);
