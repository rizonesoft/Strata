/* Strata mockup runtime. It does three things so each screen file holds only that screen's content:
   draws the icons, wraps the content in the app frame, and draws the charts from data attributes.
   The icon paths and the frame's structure here are part of the design contract (design/CONTRACT.md). */
(function () {
  'use strict';

  // Every icon is a 24 px grid, stroke only, 1.75 px, round caps and joins.
  var ICONS = {
    home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
    layers: 'M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
    files: 'M3 6h6l2 2h10v11H3z',
    file: 'M6 3h8l4 4v14H6z M14 3v4h4',
    deleted: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
    timeline: 'M3 12h18 M7 8v8 M12 5v14 M17 9v6',
    activity: 'M3 12h4l3-7 4 14 3-7h4',
    history: 'M12 7v5l3 2 M4.6 9a8 8 0 1 1-.6 3 M4 4v5h5',
    compare: 'M4 5h6v14H4z M14 5h6v14h-6z',
    disk: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    bookmark: 'M6 4h12v17l-6-4-6 4z',
    audit: 'M8 4h8v3H8z M6 5H5v16h14V5h-1 M8 11h8 M8 15h8',
    exportIcon: 'M12 15V4 M8 8l4-4 4 4 M4 15v5h16v-5',
    report: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
    settings: 'M4 7h10 M18 7h2 M4 17h4 M12 17h8 M14 5h4v4h-4z M8 15h4v4H8z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16 16l5 5',
    plus: 'M12 5v14 M5 12h14',
    evidence: 'M3 9h18v10H3z M7 14h.01 M3 9l3-5h12l3 5',
    check: 'M5 12l5 5 9-10',
    close: 'M6 6l12 12 M18 6L6 18',
    warn: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
    down: 'M6 9l6 6 6-6',
    right: 'M9 6l6 6-6 6',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
    copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
    extract: 'M12 4v11 M8 11l4 4 4-4 M4 19h16',
    filter: 'M4 5h16l-6 8v6l-4-2v-4z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
    user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21c0-4 4-6 8-6s8 2 8 6',
    program: 'M3 5h18v14H3z M7 10l3 2-3 2 M12 15h5',
    registry: 'M4 5h6v4H4z M14 10h6v4h-6z M14 16h6v4h-6z M7 9v9h7 M7 12h7',
    link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
    log: 'M4 6h16 M4 12h16 M4 18h10',
    journal: 'M5 4h12v16H5z M9 4v16 M12 9h3 M12 13h3',
    stop: 'M6 6h12v12H6z',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7h.01',
    locate: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 2v3 M12 19v3 M2 12h3 M19 12h3',
    folderOpen: 'M3 19V6h6l2 2h8v3 M3 19l3-8h16l-3 8z',
    play: 'M7 5l12 7-12 7z'
  };
  function icon(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICONS[name] || ICONS.info) + '"/></svg>';
  }
  var MARK = '<svg viewBox="0 0 96 96" width="24" height="24" aria-hidden="true">' +
    '<rect x="18" y="19" width="52" height="8" rx="2" fill="#C9D3E0"/><rect x="18" y="31" width="52" height="12" rx="2" fill="#5B6B82"/>' +
    '<rect x="28" y="47" width="52" height="9" rx="2" fill="#E0A340"/><rect x="18" y="60" width="52" height="6" rx="2" fill="#5B6B82"/>' +
    '<rect x="18" y="70" width="52" height="8" rx="2" fill="#8E9BB0"/></svg>';

  var NAV = [
    ['Case'], ['overview', 'Overview', 'home'], ['layers', 'Layers', 'layers'],
    ['Examine'], ['files', 'Files', 'files'], ['deleted', 'Deleted files', 'deleted', '1,204'], ['timeline', 'Timeline', 'timeline'],
    ['activity', 'Recent activity', 'activity'], ['history', 'History', 'history'], ['compare', 'Compare', 'compare'], ['diskmap', 'Disk map', 'disk'],
    ['Record'], ['bookmarks', 'Bookmarks', 'bookmark', '7'], ['audit', 'Audit log', 'audit']
  ];
  var BANDS = [
    ['live', 'live', 'Live volume', 'as acquired, 14 Mar 11:20', '1,902,114 events'],
    ['vss2', 's1', 'Shadow copy 2', '13 Mar 18:00', '1,711,580 events'],
    ['vss1', 's2', 'Shadow copy 1', '12 Mar 18:00', '1,655,902 events'],
    ['unalloc', 'un', 'Unallocated', 'free clusters', '41,266 carved']
  ];

  function core(mode) {
    if (mode === 'off') return '';
    var out = '<aside class="core" aria-label="Layers"><div class="label">The core</div>';
    BANDS.forEach(function (b) {
      var cls = b[1], extra = '';
      if (mode === 'pair') {
        if (b[0] === 'vss1') extra = '<span class="tag accent">A</span>';
        else if (b[0] === 'live') extra = '<span class="tag accent">B</span>';
        else cls += ' off';
      } else if (mode !== 'all') {
        cls += b[0] === mode ? ' focus' : ' off';
      }
      out += '<button class="band ' + cls + '"><b>' + b[2] + '</b><small>' + b[3] + '</small>' + extra + '<span class="n">' + b[4] + '</span></button>';
    });
    var notes = { all: 'All four layers are on. Click a band to hide or show it everywhere.', pair: 'Comparing A with B. Click a band to change either side.' };
    return out + '<p class="core-note">' + (notes[mode] || 'Browsing one layer. The folder stays open when you move to another.') + '</p></aside>';
  }

  function frame() {
    var body = document.body, main = document.querySelector('main');
    if (!main) return;
    var view = body.dataset.view || '', bare = body.dataset.chrome === 'bare';
    var top = '<header class="topbar"><div class="brand">' + MARK + '<b>STRATA</b></div>';
    if (bare) {
      top += '<div class="grow"></div><button class="btn ghost icon" aria-label="Settings">' + icon('settings') + '</button></header>';
    } else {
      top += '<button class="case-switch">Case 2026-014 Harbour Freight ' + icon('down', 'sm') + '</button><div class="grow"></div>' +
        '<button class="btn">' + icon('exportIcon') + 'Export</button><button class="btn">' + icon('report') + 'Report</button>' +
        '<button class="btn ghost icon" aria-label="Settings">' + icon('settings') + '</button></header>';
    }
    var app = document.createElement('div');
    app.className = 'app';
    if (bare) {
      app.innerHTML = top + '<div class="bare-main"></div>';
      body.insertBefore(app, main);
      app.querySelector('.bare-main').appendChild(main);
      return;
    }
    var side = '<nav class="sidebar" aria-label="Views">';
    NAV.forEach(function (n) {
      if (n.length === 1) { side += '<div class="label">' + n[0] + '</div>'; return; }
      side += '<a class="nav-item" href="' + n[0] + '.html"' + (n[0] === view ? ' aria-current="page"' : '') + '>' + icon(n[2]) +
        '<span>' + n[1] + '</span>' + (n[3] ? '<span class="count">' + n[3] + '</span>' : '') + '</a>';
    });
    side += '</nav>';
    app.innerHTML = top + '<div class="frame">' + side + core(body.dataset.core || 'all') + '</div>' +
      '<footer class="statusbar"><span>harbour-ws04.E01</span><span class="ok">SHA-256 verified</span><span class="grow"></span>' +
      '<span>4 layers</span><span>2,418,906 events</span><span>UTC</span></footer>';
    body.insertBefore(app, main);
    app.querySelector('.frame').appendChild(main);
  }

  // A small seeded generator, so every chart is the same on every load.
  function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function svg(w, h, inner, label) {
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + label + '">' + inner + '</svg>';
  }
  var WAVE = [8, 12, 10, 14, 22, 30, 26, 18, 12, 9, 14, 20, 34, 40, 36, 28, 22, 16, 12, 10, 9, 8, 12, 16, 24, 32, 38, 30, 20, 14, 10, 8, 7, 9, 12, 18, 26,
    36, 40, 34, 24, 16, 12, 10, 14, 18, 22, 16, 12, 9, 8, 10, 12, 14, 10, 8, 7, 6, 8, 10];

  var CHARTS = {
    // events over time, stacked by the newest layer each event appears in
    density: function (el) {
      var h = +(el.dataset.h || 44), out = '', hot = (el.dataset.hot || '37-41').split('-').map(Number);
      WAVE.forEach(function (v, i) {
        var x = i * 10, total = v / 40 * (h - 2), un = i >= hot[0] && i <= hot[1] ? 7 : (i % 9 === 0 ? 2 : 0);
        var live = total * 0.45, snap = total * 0.55, y = h;
        y -= snap; out += '<rect x="' + x + '" y="' + y + '" width="8" height="' + snap + '" fill="var(--layer-snap-2)"/>';
        y -= live; out += '<rect x="' + x + '" y="' + y + '" width="8" height="' + live + '" fill="var(--layer-live)"/>';
        if (un) { y -= un; out += '<rect x="' + x + '" y="' + y + '" width="8" height="' + un + '" fill="var(--layer-unalloc)"/>'; }
      });
      if (el.dataset.sel) out += '<rect x="360" y="0" width="60" height="' + h + '" fill="none" stroke="var(--color-accent)" stroke-width="1.5"/>';
      return svg(600, h, out, 'Events over time, stacked by layer');
    },
    // one lane per event family, a mark per burst of events
    lanes: function (el) {
      var kinds = ['file', 'journal', 'log', 'registry', 'program', 'shortcut'], names = ['Files', 'Journal', 'Event log', 'Registry', 'Programs', 'Shortcuts'];
      var r = rng(7), out = '';
      kinds.forEach(function (k, row) {
        var y = row * 18 + 4;
        out += '<line x1="70" y1="' + (y + 6) + '" x2="900" y2="' + (y + 6) + '" stroke="var(--color-border)"/>';
        out += '<text x="0" y="' + (y + 10) + '">' + names[row] + '</text>';
        var n = [46, 38, 14, 6, 9, 7][row];
        for (var i = 0; i < n; i++) {
          var x = 70 + r() * 820, w = 2 + r() * (row < 2 ? 10 : 3);
          out += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="12" rx="1" fill="var(--kind-' + k + ')" opacity="' + (0.55 + r() * 0.45).toFixed(2) + '"/>';
        }
      });
      out += '<rect x="640" y="0" width="1.5" height="112" fill="var(--color-accent)"/>';
      return '<svg class="chart" viewBox="0 0 900 112" role="img" aria-label="Events by family over the selected time range">' + out + '</svg>';
    },
    // daily activity with the moment of each shadow copy marked
    area: function (el) {
      var r = rng(+(el.dataset.seed || 3)), pts = [], n = 45, out = '';
      for (var i = 0; i < n; i++) pts.push(14 + r() * 30 + (i > 36 ? 40 : 0) + (i % 7 > 4 ? -10 : 0));
      var step = 900 / (n - 1), d = 'M0 140';
      pts.forEach(function (p, i) { d += ' L' + (i * step).toFixed(1) + ' ' + (140 - p).toFixed(1); });
      out += '<path d="' + d + ' L900 140z" fill="var(--layer-snap-2)" opacity="0.45"/>';
      out += '<path d="' + d.replace('M0 140 L', 'M') + '" fill="none" stroke="var(--layer-live)" stroke-width="1.5"/>';
      [[41, 'Shadow copy 1'], [42, 'Shadow copy 2'], [43.6, 'Acquired']].forEach(function (m, k) {
        var x = m[0] * step;
        out += '<line x1="' + x + '" y1="' + (12 + k * 14) + '" x2="' + x + '" y2="140" stroke="var(--color-accent)" stroke-dasharray="3 3"/>';
        out += '<text x="' + (x - 6) + '" y="' + (10 + k * 14) + '" text-anchor="end">' + m[1] + '</text>';
      });
      ['1 Feb', '15 Feb', '1 Mar', '14 Mar'].forEach(function (t, k) { out += '<text x="' + [0, 290, 590, 900][k] + '" y="156"' + (k === 3 ? ' text-anchor="end"' : '') + '>' + t + '</text>'; });
      return '<svg class="chart" viewBox="0 0 900 160" role="img" aria-label="Events per day, 1 February to 14 March 2026">' + out + '</svg>';
    },
    donut: function (el) {
      var parts = el.dataset.values.split(',').map(function (p) { var s = p.split(':'); return [+s[0], s[1]]; });
      var sum = parts.reduce(function (a, p) { return a + p[0]; }, 0), at = 0, out = '', R = 40, C = 2 * Math.PI * R;
      parts.forEach(function (p) {
        var len = p[0] / sum * C;
        out += '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(' + p[1] + ')" stroke-width="16" stroke-dasharray="' + (len - 1.5).toFixed(2) + ' ' + (C - len + 1.5).toFixed(2) +
          '" stroke-dashoffset="' + (-at).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
        at += len;
      });
      return '<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="' + (el.dataset.label || 'Share by category') + '">' + out + '</svg>';
    },
    // activity by weekday and hour
    heat: function () {
      var r = rng(11), out = '', days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.forEach(function (d, y) {
        out += '<text x="0" y="' + (y * 15 + 11) + '">' + d + '</text>';
        for (var x = 0; x < 24; x++) {
          var work = y < 5 && x >= 7 && x <= 17 ? 0.45 : 0.04, v = Math.min(1, work + r() * 0.4 + (y === 5 && x === 22 ? 0.8 : 0));
          var hot = y === 5 && x >= 21;
          out += '<rect x="' + (30 + x * 15) + '" y="' + (y * 15) + '" width="13" height="13" rx="2" fill="var(' + (hot ? '--layer-unalloc' : '--layer-live') + ')" opacity="' + (0.08 + v * 0.9).toFixed(2) + '"/>';
        }
      });
      [0, 6, 12, 18, 23].forEach(function (hh) { out += '<text x="' + (30 + hh * 15) + '" y="118">' + ('0' + hh).slice(-2) + '</text>'; });
      return '<svg class="chart heat" viewBox="0 0 392 122" role="img" aria-label="Events by weekday and hour; Saturday night stands out">' + out + '</svg>';
    },
    hbars: function (el) {
      var rows = el.dataset.values.split('|').map(function (p) { return p.split(':'); }), max = Math.max.apply(null, rows.map(function (r) { return +r[1]; })), out = '';
      rows.forEach(function (r) {
        out += '<div class="hb"><span>' + r[0] + '</span><span class="meter"><i style="width: ' + Math.max(1, +r[1] / max * 100).toFixed(1) + '%; --c: var(' + (r[2] || '--layer-snap-1') + ')"></i></span><span>' + (r[3] || r[1]) + '</span></div>';
      });
      return '<div class="hbars" role="img" aria-label="' + (el.dataset.label || 'Bar chart') + '">' + out + '</div>';
    },
    // the volume as a grid of cluster groups
    clusters: function (el) {
      var r = rng(23), cols = 64, rows = +(el.dataset.rows || 22), out = '';
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var i = y * cols + x, t = r(), c = '--layer-snap-2', o = 0.9;
        if (i < 40) { c = '--kind-journal'; }
        else if (y > rows * 0.62 && t < 0.72) { c = '--layer-off'; o = 1; }
        else if (t < 0.1) { c = '--layer-off'; o = 1; }
        else if (y > 4 && y < 8 && x > 40) { c = '--kind-registry'; }
        if (c === '--layer-off' && r() < 0.07) { c = '--layer-unalloc'; }
        if (i === 913) { c = '--color-text'; }
        out += '<rect x="' + x * 12 + '" y="' + y * 12 + '" width="10" height="10" rx="1.5" fill="var(' + c + ')" opacity="' + o + '"/>';
      }
      return '<svg class="chart" viewBox="0 0 ' + cols * 12 + ' ' + rows * 12 + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the volume: allocated, free, shadow storage, MFT and carved records">' + out + '</svg>';
    }
  };

  function boot() {
    frame();
    document.querySelectorAll('[data-i]').forEach(function (el) { el.outerHTML = icon(el.dataset.i, el.className); });
    document.querySelectorAll('[data-g]').forEach(function (el) {
      var bits = el.dataset.g, names = ['live', 'shadow copy 2', 'shadow copy 1', 'unallocated'], seen = [];
      el.className = 'glyph';
      el.innerHTML = ['a', 'b', 'c', 'd'].map(function (c, i) { if (bits[i] === '1') seen.push(names[i]); return '<i' + (bits[i] === '1' ? ' class="' + c + '"' : '') + '></i>'; }).join('');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'In ' + seen.join(', '));
    });
    document.querySelectorAll('[data-chart]').forEach(function (el) { el.innerHTML = CHARTS[el.dataset.chart](el); });
    if (location.hash === '#light') document.documentElement.dataset.theme = 'light';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
