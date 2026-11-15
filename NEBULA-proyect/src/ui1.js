/* NEBULA UI part 1 — state, i18n, helpers, canvas renderers (stars, 3D ship, charts, gauges) */
const N = window.NEB;
const $ = (s, el) => (el || document).querySelector(s), $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const S = { lang: 'es', view: 'mc', mid: 'lunaris', designs: {}, cur: 'A', seed: 2026, twin: false, tab: 'structure', sim: null, simB: null, report: null, reportB: null, nc: {}, ol: { tab: 'circ', body: 'earth', alt: 400, rp: 400, ra: 12000, r1: 400, r2: 35786 }, sl: { tab: 0, mode: 1, v: {} }, hist: [], opt: null, loops: [], ncCache: {}, speed: 1, auto: false, playing: false };
const L = (es, en) => S.lang === 'es' ? es : en;
const T = (o) => (o ? o[S.lang] : '');
const fmt = (x, d) => { d = d || 0; if (!isFinite(x)) return '∞'; return Number(x).toLocaleString(S.lang === 'es' ? 'es-CO' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); };
const cr = (x) => fmt(x, 2) + ' M';
const M_ = () => N.MISSION_BY_ID[S.mid];
const clamp = N.clamp;
const SEVC = { critical: '#ff5d73', high: '#ffb454', medium: '#f5d76e', info: '#5ee7ff' };
const SEVL = { critical: ['CRÍTICO', 'CRITICAL'], high: ['ALTO', 'HIGH'], medium: ['MEDIO', 'MEDIUM'], info: ['INFO', 'INFO'] };
const BODYC = { earth: ['#4aa3ff', '#0b3a7a'], moon: ['#d8d8dc', '#6e6e76'], mars: ['#ff8a5c', '#7a2c14'] };

/* ---------- persistence ---------- */
function save() { try { localStorage.setItem('nebula.v1', JSON.stringify({ lang: S.lang, seed: S.seed, mid: S.mid, hist: S.hist.slice(-40), designs: S.designs, twin: S.twin })); } catch (e) { } }
function load() { try { const j = JSON.parse(localStorage.getItem('nebula.v1') || 'null'); if (j) { S.lang = j.lang || S.lang; S.seed = j.seed || S.seed; S.hist = j.hist || []; S.designs = j.designs || {}; S.twin = !!j.twin; if (j.mid && N.MISSION_BY_ID[j.mid]) S.mid = j.mid; } } catch (e) { } }
function toast(msg, kind) { const t = $('#toast'); const d = document.createElement('div'); d.className = 'tt ' + (kind || ''); d.textContent = msg; t.appendChild(d); setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3100); }

/* ---------- starter designs (deliberately imperfect, so Neuron Core has something to teach) ---------- */
const STARTERS = {
  aurora: { launcher: 'c_m', items: { s_light: 1, c_basic: 1, p_mono: 1, a_mga: 1, t_pass: 1, i_cam: 1, i_spec: 1, i_env: 1, b_li: 1, pn_s: 2 }, prop: 34 },
  lunaris: { launcher: 'k_m', items: { s_std: 1, c_basic: 1, p_bi: 1, a_mga: 1, t_pass: 1, i_cam: 1, i_spec: 1, i_env: 1, b_li: 1, pn_s: 2 }, prop: 300 },
  ares: { launcher: 't_m', items: { s_std: 1, c_basic: 1, p_bi: 1, a_dsa: 1, t_pass: 1, i_cam: 1, i_spec: 1, i_env: 1, b_li: 1, pn_s: 4 }, prop: 330 },
};
function design(slot) {
  const k = S.mid; S.designs[k] = S.designs[k] || {};
  slot = slot || S.cur;
  if (!S.designs[k][slot]) S.designs[k][slot] = JSON.parse(JSON.stringify(STARTERS[k]));
  return S.designs[k][slot];
}
function setDesign(d, slot) { S.designs[S.mid][slot || S.cur] = d; save(); }
function evalCur(slot) { return N.evaluate(design(slot), M_()); }

/* ---------- canvas helpers ---------- */
function fit(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, w, h };
}
function startLoop(fn) { const o = { on: true }; const f = (t) => { if (!o.on) return; try { fn(t / 1000); } catch (e) { console.error(e); } o.id = requestAnimationFrame(f); }; o.id = requestAnimationFrame(f); S.loops.push(o); return o; }
function stopLoops() { S.loops.forEach(o => { o.on = false; cancelAnimationFrame(o.id); }); S.loops = []; }

/* ---------- animated starfield ---------- */
const stars = Array.from({ length: 240 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: Math.random(), p: Math.random() * 6.28 }));
function bgLoop(t) {
  const cv = $('#bg'); if (!cv) return; const { c, w, h } = fit(cv);
  c.fillStyle = '#04060c'; c.fillRect(0, 0, w, h);
  const g1 = c.createRadialGradient(w * 0.15, h * 0.1, 0, w * 0.15, h * 0.1, w * 0.6); g1.addColorStop(0, 'rgba(120,70,255,.16)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g1; c.fillRect(0, 0, w, h);
  const g2 = c.createRadialGradient(w * 0.9, h * 0.85, 0, w * 0.9, h * 0.85, w * 0.55); g2.addColorStop(0, 'rgba(255,70,160,.10)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, w, h);
  const ts = t / 1000;
  for (const s of stars) { const a = 0.25 + 0.55 * s.z * (0.6 + 0.4 * Math.sin(ts * (0.6 + s.z) + s.p)); const x = ((s.x * w - ts * 3 * s.z) % w + w) % w; c.fillStyle = `rgba(200,220,255,${a})`; c.fillRect(x, s.y * h, s.z * 1.6 + 0.4, s.z * 1.6 + 0.4); }
  requestAnimationFrame(bgLoop);
}

/* ---------- mini 3D engine for the spacecraft ---------- */
const V = { rot(p, yaw, pit) { let [x, y, z] = p; let c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [x * c + z * s, -x * s + z * c]; c = Math.cos(pit); s = Math.sin(pit); [y, z] = [y * c - z * s, y * s + z * c]; return [x, y, z]; } };
function boxP(cx, cy, cz, sx, sy, sz, col, o) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  return F.map((f, i) => Object.assign({ v: f.map(k => v[k]), col }, o && o.grid && (i === 4 || i === 5 || i === 0 || i === 1) ? { grid: o.grid } : {}, o && o.glow ? { glow: o.glow } : {}));
}
function cylP(cx, cy, cz, r1, r2, h, col, ax, n) {
  n = n || 14; const P = [], ring = (r, off) => Array.from({ length: n }, (_, i) => { const a = i / n * 6.2832, u = Math.cos(a) * r, w = Math.sin(a) * r; return ax === 'z' ? [cx + u, cy + w, cz + off] : [cx + u, cy + off, cz + w]; });
  const a = ring(r1, -h / 2), b = ring(r2, h / 2);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; P.push({ v: [a[i], a[j], b[j], b[i]], col }); }
  P.push({ v: b, col }); P.push({ v: a.slice().reverse(), col }); return P;
}
function shipPolys(d, M) {
  const e = N.evaluate(d, M), P = [], add = (a) => a.forEach(p => P.push(p));
  const id = (x) => e.items ? 0 : 0; void id;
  const q = (k) => N.qtyOf(d, k);
  const bw = e.st ? (e.st.id === 's_light' ? 0.8 : e.st.id === 's_std' ? 0.95 : 1.15) : 0.9, bcol = e.st ? (e.st.id === 's_light' ? '#d7c47e' : e.st.id === 's_std' ? '#c9a24a' : '#8e99ad') : '#555';
  if (e.st) add(boxP(0, 0, 0, bw, 1.0, bw, bcol));
  if (e.cp) add(boxP(0, 0.12, bw / 2 + 0.02, 0.5, 0.3, 0.05, '#1c2333', { glow: '#5ee7ff' }));
  // tank + engine
  let yb = -0.5;
  if (e.prop > 0) { const f = clamp(e.prop / 700, 0, 1.4), r = 0.2 + 0.32 * Math.sqrt(f), h = 0.28 + 0.55 * f; add(cylP(0, yb - h / 2, 0, r, r, h, '#a9b4c4', 'y', 18)); yb -= h; }
  if (e.en) { if (e.ion) { add(cylP(0, yb - 0.07, 0, 0.26, 0.26, 0.14, '#3a4254', 'y', 16)); add(cylP(0, yb - 0.16, 0, 0.22, 0.22, 0.04, '#4cc9ff', 'y', 16)); } else { add(cylP(0, yb - 0.25, 0, 0.1, 0.24, 0.5, '#4b5563', 'y', 14)); add(cylP(0, yb - 0.05, 0, 0.08, 0.08, 0.1, '#222', 'y', 10)); } }
  // panels
  const ps = q('pn_s'), pl = q('pn_l'), list = []; for (let i = 0; i < pl; i++) list.push(0.95); for (let i = 0; i < ps; i++) list.push(0.55);
  let xr = bw / 2 + 0.1, xl = -bw / 2 - 0.1;
  if (list.length) { add(boxP(bw / 2 + 0.05, 0, 0, 0.1, 0.05, 0.05, '#777')); add(boxP(-bw / 2 - 0.05, 0, 0, 0.1, 0.05, 0.05, '#777')); }
  list.forEach((w, i) => { const col = '#1f4fd8'; if (i % 2 === 0) { add(boxP(xr + w / 2, 0, 0, w, 0.95, 0.03, col, { grid: [Math.max(2, Math.round(w * 5)), 6] })); xr += w + 0.04; } else { add(boxP(xl - w / 2, 0, 0, w, 0.95, 0.03, col, { grid: [Math.max(2, Math.round(w * 5)), 6] })); xl -= w + 0.04; } });
  // antenna
  if (e.an) { const rr = { a_lga: 0.07, a_mga: 0.24, a_hga: 0.4, a_dsa: 0.58 }[e.an.id]; add(boxP(0, 0.7, 0, 0.04, 0.4, 0.04, '#9aa')); const ay = 0.9 + rr * 0.2; if (rr < 0.1) add(cylP(0, 0.95, 0, 0.02, 0.02, 0.3, '#ddd', 'y', 6)); else { add(cylP(0, ay, 0.05, 0.03, rr, 0.16, '#e8edf5', 'z', 20)); add(cylP(0, ay, 0.26, 0.015, 0.015, 0.2, '#999', 'z', 6)); } }
  // instruments
  if (q('i_cam')) { add(cylP(-0.25, -0.12, bw / 2 + 0.12, 0.1, 0.1, 0.24, '#272d3b', 'z', 14)); add(cylP(-0.25, -0.12, bw / 2 + 0.25, 0.07, 0.07, 0.02, '#38bdf8', 'z', 14)); }
  if (q('i_spec')) add(boxP(0.26, -0.14, bw / 2 + 0.12, 0.34, 0.3, 0.24, '#6b7280'));
  if (q('i_env')) { add(boxP(-bw / 2 - 0.02, 0.38, 0, 0.04, 0.04, 0.04, '#9aa')); add(boxP(-bw / 2 - 0.05, 0.38, 0, 0.1, 0.03, 0.03, '#bbb')); add(boxP(-bw / 2 - 0.45, 0.38, 0, 0.12, 0.12, 0.12, '#f59e0b')); }
  if (q('i_radar')) { add(boxP(0, -0.28, -bw / 2 - 0.12, 1.7, 0.05, 0.24, '#9ca3af')); add(boxP(0, -0.28, -bw / 2 - 0.02, 0.1, 0.1, 0.1, '#555')); }
  // thermal
  if (e.th) { if (e.th.id === 't_act') { add(boxP(0, 0, -bw / 2 - 0.03, bw * 0.95, 0.95, 0.03, '#e5e7eb')); add(boxP(0, 0.5 + 0.02, -0.15, bw * 0.9, 0.04, 0.7, '#e5e7eb')); } else add(boxP(0, 0, -bw / 2 - 0.02, bw * 0.9, 0.9, 0.02, '#d4a63a')); }
  if (e.sh) add(boxP(0, 0.5 + 0.045, 0, bw * 1.05, 0.08, bw * 1.05, '#374151'));
  return P;
}
function drawShip(cv, d, M, yaw, pit, tm) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const P = shipPolys(d, M); if (!P.length) return;
  let R = 1; P.forEach(p => p.v.forEach(v => { R = Math.max(R, Math.hypot(v[0], v[1] * 0.9, v[2])); }));
  const sc = Math.min(w, h * 1.05) * 0.42 / R, cx = w / 2, cy = h / 2 + 4, f = R * 5;
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5); g.addColorStop(0, 'rgba(94,231,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const Ldir = (() => { const l = [-0.45, 0.75, -0.55]; const m = Math.hypot(...l); return l.map(x => x / m); })();
  const out = P.map(p => {
    const r = p.v.map(v => V.rot(v, yaw, pit)); const z = r.reduce((a, v) => a + v[2], 0) / r.length;
    const a = [r[1][0] - r[0][0], r[1][1] - r[0][1], r[1][2] - r[0][2]], b = [r[2][0] - r[1][0], r[2][1] - r[1][1], r[2][2] - r[1][2]];
    let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const m = Math.hypot(...n) || 1; n = n.map(x => x / m);
    const facing = n[2] > 0 ? -1 : 1; // camera looks toward +z? we keep painter ordering and double-sided shading
    const lam = Math.abs(n[0] * Ldir[0] + n[1] * Ldir[1] + n[2] * Ldir[2]);
    const pts = r.map(v => { const s = f / (f + v[2]); return [cx + v[0] * sc * s, cy - v[1] * sc * s]; });
    return { pts, z, lam, col: p.col, grid: p.grid, glow: p.glow, r, facing };
  }).sort((a, b) => b.z - a.z);
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  for (const p of out) {
    const [r, gg, b] = hex(p.col), k = 0.38 + 0.72 * p.lam;
    c.beginPath(); p.pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath();
    c.fillStyle = `rgb(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, b * k) | 0})`; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 0.8; c.stroke();
    if (p.grid && p.pts.length === 4) {
      c.strokeStyle = 'rgba(160,200,255,.35)'; c.lineWidth = 0.6; const [a, bb, cc, dd] = p.pts;
      for (let i = 1; i < p.grid[0]; i++) { const t = i / p.grid[0]; c.beginPath(); c.moveTo(a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t); c.lineTo(dd[0] + (cc[0] - dd[0]) * t, dd[1] + (cc[1] - dd[1]) * t); c.stroke(); }
      for (let i = 1; i < p.grid[1]; i++) { const t = i / p.grid[1]; c.beginPath(); c.moveTo(a[0] + (dd[0] - a[0]) * t, a[1] + (dd[1] - a[1]) * t); c.lineTo(bb[0] + (cc[0] - bb[0]) * t, bb[1] + (cc[1] - bb[1]) * t); c.stroke(); }
    }
    if (p.glow) { const m = p.pts.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]); c.fillStyle = p.glow; c.globalAlpha = 0.5 + 0.5 * Math.sin(tm * 3); c.fillRect(m[0] - 2, m[1] - 2, 4, 4); c.globalAlpha = 1; }
  }
}

/* ---------- charts ---------- */
function lineChart(cv, o) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const pad = { l: 46, r: 12, t: 14, b: 28 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
  let xmin = o.xmin, xmax = o.xmax, ymin = o.ymin, ymax = o.ymax;
  if (xmin === undefined || ymin === undefined) { xmin = Infinity; xmax = -Infinity; ymin = Infinity; ymax = -Infinity; o.series.forEach(s => s.pts.forEach(p => { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); })); if (o.ymin !== undefined) ymin = o.ymin; if (o.ymax !== undefined) ymax = o.ymax; if (ymax === ymin) ymax = ymin + 1; ymax += (ymax - ymin) * 0.06; }
  const lx = o.logx, X = (x) => pad.l + W * (lx ? (Math.log10(x) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin)) : (x - xmin) / (xmax - xmin || 1)), Y = (y) => pad.t + H * (1 - (y - ymin) / (ymax - ymin || 1));
  c.font = '10px ui-monospace,Consolas,monospace'; c.fillStyle = 'rgba(180,195,230,.7)'; c.strokeStyle = 'rgba(120,160,255,.12)'; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pad.t + H * i / 4, v = ymax - (ymax - ymin) * i / 4; c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke(); c.textAlign = 'right'; c.fillText(o.yfmt ? o.yfmt(v) : fmt(v, v < 10 ? 1 : 0), pad.l - 6, y + 3); }
  const xt = o.xticks || (lx ? [] : Array.from({ length: 6 }, (_, i) => xmin + (xmax - xmin) * i / 5));
  c.textAlign = 'center'; xt.forEach(v => { const x = X(v); c.beginPath(); c.moveTo(x, pad.t); c.lineTo(x, h - pad.b); c.stroke(); c.fillText(o.xfmt ? o.xfmt(v) : fmt(v, v < 10 && !lx ? 1 : 0), x, h - pad.b + 13); });
  if (o.xlabel) { c.textAlign = 'right'; c.fillText(o.xlabel, w - pad.r, h - 3); }
  if (o.ylabel) { c.save(); c.translate(10, pad.t + H / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText(o.ylabel, 0, 0); c.restore(); }
  (o.bands || []).forEach(b => { c.fillStyle = b.col; c.fillRect(X(b.x0), pad.t, Math.max(1, X(b.x1) - X(b.x0)), H); });
  (o.hlines || []).forEach(l => { c.strokeStyle = l.col; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(pad.l, Y(l.y)); c.lineTo(w - pad.r, Y(l.y)); c.stroke(); c.setLineDash([]); c.fillStyle = l.col; c.textAlign = 'left'; c.fillText(l.label || '', pad.l + 4, Y(l.y) - 4); });
  o.series.forEach(s => {
    c.beginPath(); s.pts.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))); c.strokeStyle = s.col; c.lineWidth = s.w || 2; c.stroke();
    if (s.fill) { c.lineTo(X(s.pts[s.pts.length - 1][0]), Y(ymin)); c.lineTo(X(s.pts[0][0]), Y(ymin)); c.closePath(); const g = c.createLinearGradient(0, pad.t, 0, pad.t + H); g.addColorStop(0, s.col + '55'); g.addColorStop(1, s.col + '05'); c.fillStyle = g; c.fill(); }
  });
  (o.marks || []).forEach(m => { const x = X(m.x), y = m.y !== undefined ? Y(m.y) : pad.t + 6; c.strokeStyle = m.col || '#fff'; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, pad.t); c.lineTo(x, h - pad.b); c.stroke(); c.setLineDash([]); if (m.y !== undefined) { c.fillStyle = m.col || '#fff'; c.beginPath(); c.arc(x, y, 4, 0, 6.3); c.fill(); } c.fillStyle = m.col || '#fff'; c.textAlign = x > w * 0.7 ? 'right' : 'left'; c.fillText(m.label || '', x + (x > w * 0.7 ? -6 : 6), pad.t + 10 + (m.row || 0) * 12); });
  if (o.legend) { let x = pad.l + 6; c.textAlign = 'left'; o.series.forEach(s => { if (!s.name) return; c.fillStyle = s.col; c.fillRect(x, pad.t + 2, 10, 3); c.fillStyle = 'rgba(210,225,255,.85)'; c.fillText(s.name, x + 14, pad.t + 8); x += 22 + c.measureText(s.name).width + 10; }); }
}
function ring(pct, col, label, val, sub) {
  const r = 34, C = 2 * Math.PI * r, p = clamp(pct, 0, 1.2), off = C * (1 - Math.min(1, p)), bad = pct > 1.0 && col === 'cap';
  const color = bad ? '#ff5d73' : (col === 'cap' ? '#5ee7ff' : col);
  return `<div class="ring"><svg viewBox="0 0 90 90"><circle cx="45" cy="45" r="${r}" fill="none" stroke="rgba(120,160,255,.15)" stroke-width="8"/><circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 45 45)" style="filter:drop-shadow(0 0 6px ${color})"/><text x="45" y="49" text-anchor="middle" fill="#eaf1ff" font-size="15" font-weight="700" font-family="ui-monospace,Consolas,monospace">${val}</text></svg><div class="rl">${label}</div><div class="rs">${sub || ''}</div></div>`;
}
const bar = (pct, col) => `<div class="bar"><i style="width:${clamp(pct, 0, 1) * 100}%;background:${col || 'var(--cy)'}"></i></div>`;
const badge = (txt, col) => `<span class="bdg" style="--c:${col}">${txt}</span>`;
const ico = (s) => `<span class="ic">${s}</span>`;

/* ---------- Kepler helper for scene drawing ---------- */
function keplerNu(e, f) { const Mn = Math.PI * f; let E = Mn; for (let i = 0; i < 25; i++) E = E - (E - e * Math.sin(E) - Mn) / (1 - e * Math.cos(E)); return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); }
function planet(c, x, y, r, body, rot) {
  const [a, b] = BODYC[body]; const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b);
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fillStyle = g; c.shadowColor = a; c.shadowBlur = r * 0.5; c.fill(); c.shadowBlur = 0; c.clip();
  c.globalAlpha = 0.18; c.fillStyle = body === 'earth' ? '#3ddc97' : '#000'; const n = body === 'earth' ? 5 : 8;
  for (let i = 0; i < n; i++) { const a2 = (i * 1.9 + (rot || 0)) % 6.28, rr = r * (0.18 + 0.09 * ((i * 7) % 3)); c.beginPath(); c.arc(x + Math.cos(a2) * r * 0.6, y + Math.sin(a2 * 1.3) * r * 0.55, rr, 0, 6.3); c.fill(); }
  c.globalAlpha = 1; const sh = c.createLinearGradient(x - r, y, x + r, y); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,10,.62)'); c.fillStyle = sh; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
