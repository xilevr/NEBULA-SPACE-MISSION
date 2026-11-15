/* NEBULA UI part 4 — Mission Simulator, Mission Analytics, init */
const PHL = { launch: ['Lanzamiento', 'Launch'], commission: ['Puesta en marcha', 'Commissioning'], cruise: ['Crucero', 'Cruise'], insertion: ['Inserción orbital', 'Orbit insertion'], science: ['Operaciones científicas', 'Science operations'] };
const STL = { success: ['ÉXITO', 'SUCCESS', '#3ddc97'], partial: ['PARCIAL', 'PARTIAL', '#ffb454'], failed: ['FALLIDA', 'FAILED', '#ff5d73'], aborted: ['ABORTADA', 'ABORTED', '#ff5d73'], running: ['EN CURSO', 'RUNNING', '#5ee7ff'] };
const stBadge = (s) => { const x = STL[s] || STL.running; return badge(L(x[0], x[1]), x[2]); };
const DPS = [1.5, 5, 15, 60];

function newSims() {
  const M = M_();
  S.sim = new N.Sim(design('A'), M, S.seed, { interactive: !S.twin });
  S.simB = S.twin ? new N.Sim(design('B'), M, S.seed, { interactive: false }) : null;
  S.ms = { stage: 'count', t: 0, acc: 0, si: M.duration > 200 ? 2 : 1, paused: false, flash: 0, nev: 0, follow: 0, asked: 0, lastTele: 0 };
  S.auto = false; S.saved = false; S.report = null;
}

/* ======================= MISSION SIMULATOR ======================= */
function viewMS() {
  const M = M_();
  if (!S.sim) { const bad = (S.twin ? ['A', 'B'] : ['A']).some(k => !N.evaluate(design(k), M).valid); if (bad) { $('#main').innerHTML = `<div class="pagehead"><h2>MISSION SIMULATOR</h2></div><section class="panel empty"><div class="bigic">🚀</div><p>${L('Tu nave aún no supera las validaciones obligatorias. Corrígelas en el Ship Designer antes de lanzar.', 'Your ship does not yet pass the mandatory validations. Fix them in the Ship Designer before launch.')}</p><div class="cta"><button class="btn pri" data-act="go" data-v="sd">🔧 Ship Designer</button></div></section>`; return; } newSims(); }
  $('#main').innerHTML = `<div class="pagehead"><h2>MISSION SIMULATOR</h2><p class="mut">${S.twin ? L('Twin Mission: tus dos naves viven los <b>mismos eventos</b> (semilla ' + S.seed + ') con piloto automático. Gana la mejor ingeniería.', 'Twin Mission: both ships face the <b>same events</b> (seed ' + S.seed + ') on autopilot. Best engineering wins.') : L('Tu nave vuela día a día. Cuando ocurra una emergencia la simulación se detiene y <b>tú decides</b>. Misma semilla = mismos eventos.', 'Your ship flies day by day. When an emergency happens the simulation pauses and <b>you decide</b>. Same seed = same events.')}</p></div>
<div class="ms"><section class="panel scene"><canvas id="scn"></canvas><div class="ctrlbar" id="ctrl"></div></section><section class="panel tele" id="tele"></section></div>
<div class="grid2"><section class="panel"><div class="ph"><h3>${L('Telemetría', 'Telemetry')}</h3><span class="mut sm">${M.name}</span></div><canvas class="chart" id="mch"></canvas></section><section class="panel"><div class="ph"><h3>${L('Bitácora de misión', 'Mission log')}</h3></div><div id="mlog" class="log"></div></section></div>`;
  drawCtrl();
  S.ms.lt = 0; S.ms.lastTele = 0; S.ms.nlog = -1;
  startLoop((t) => msTick(t));
}
function drawCtrl() {
  const o = S.ms, el = $('#ctrl'); if (!el) return; const done = S.sim.over && (!S.simB || S.simB.over);
  el.innerHTML = done ? `<button class="btn pri" data-act="goMA">📊 ${L('Ver análisis de la misión', 'View mission analysis')}</button><button class="btn" data-act="replay">↺ ${L('Repetir con otra semilla', 'Replay with another seed')}</button><button class="btn" data-act="go" data-v="sd">🔧 ${L('Rediseñar', 'Redesign')}</button>`
    : `<button class="btn" data-act="pause">${o.paused ? '▶ ' + L('Continuar', 'Resume') : '⏸ ' + L('Pausa', 'Pause')}</button><div class="seg sm">${['×1', '×3', '×10', '×40'].map((x, i) => `<button class="${o.si === i ? 'on' : ''}" data-act="spd" data-i="${i}">${x}</button>`).join('')}</div>${S.twin ? '' : `<button class="btn ${S.auto ? 'pri' : ''}" data-act="auto">🤖 ${L('Piloto automático', 'Autopilot')} ${S.auto ? 'ON' : 'OFF'}</button>`}<button class="btn" data-act="ffwd">⏭ ${L('Terminar ya', 'Finish now')}</button><button class="btn danger" data-act="abort">✕ ${L('Abortar', 'Abort')}</button>`;
}
ACT.pause = () => { S.ms.paused = !S.ms.paused; drawCtrl(); };
ACT.spd = (t) => { S.ms.si = +t.dataset.i; drawCtrl(); };
ACT.auto = () => { S.auto = !S.auto; drawCtrl(); };
ACT.ffwd = () => { S.auto = true; S.ms.paused = false; let g = 0; while (!(S.sim.over && (!S.simB || S.simB.over)) && g++ < 3000) { if (S.sim.pending) S.sim.resolve(); stepAll(); } if (S.ms.stage === 'count') S.ms.stage = 'run'; finalize(); };
ACT.abort = () => { S.sim.abort(); if (S.simB) S.simB.abort(); finalize(); };
ACT.replay = () => { S.seed = Math.floor(Math.random() * 90000) + 1000; save(); newSims(); go('ms'); };
ACT.goMA = () => { ACT.closeModal(); go('ma'); };
function stepAll() { S.sim.step(); if (S.simB && !S.simB.over) S.simB.step(); }
function allOver() { return S.sim.over && (!S.simB || S.simB.over); }

function msTick(t) {
  const o = S.ms, cv = $('#scn'); if (!cv) return; const dt = Math.min(0.1, o.lt ? t - o.lt : 0.016); o.lt = t;
  if (o.stage === 'count') { o.t += dt; if (o.t >= 4.4) { o.stage = 'run'; } }
  else if (o.stage === 'run' && !o.paused) {
    if (S.sim.pending) { if (S.auto) { const p = S.sim.pending; p.ev.rec = p.def.auto(S.sim, p.ev); S.sim.resolve(p.ev.rec); } else if (!$('#modal').classList.contains('on')) showEvent(); }
    else { o.acc += dt * DPS[o.si]; let g = 0; while (o.acc >= 1 && g++ < 40 && !allOver()) { o.acc -= 1; stepAll(); if (S.sim.pending) break; } }
    if (S.sim.events.length !== o.nev) { const ev = S.sim.events[S.sim.events.length - 1]; if (S.sim.events.length > o.nev && ev) { o.flash = t; if (!EVDEF(ev).choices) toast(EVDEF(ev).ic + ' ' + T(ev.name), 'warn'); } o.nev = S.sim.events.length; }
    if (allOver()) finalize();
  }
  drawScene(cv, S.sim, o.stage === 'count' ? o.t : null, t);
  if (t - o.lastTele > 0.15) { o.lastTele = t; updateTele(); }
}
const EVDEF = (ev) => N.EV[ev.type];
function updateTele() {
  const el = $('#tele'); if (!el) return;
  el.innerHTML = S.twin ? `<div class="twint">${teleBlock(S.sim, 'A')}${teleBlock(S.simB, 'B')}</div>` : teleBlock(S.sim, '');
  const ch = $('#mch'); if (ch) { const M = M_(), sims = [S.sim].concat(S.simB ? [S.simB] : []), series = []; const cols = ['#3ddc97', '#ffb454', '#ff5fa8'];
    sims.forEach((s, i) => { const tg = s.objs.reduce((a, o) => a + o.target, 0) || 1, nm = S.twin ? ' ' + 'AB'[i] : ''; series.push({ name: L('Batería %', 'Battery %') + nm, col: i ? '#7de3c0' : cols[0], pts: [[0, 90]].concat(s.hist.map(h => [h.d, h.soc * 100])), w: 1.6 }); series.push({ name: L('Propelente %', 'Propellant %') + nm, col: i ? '#ffd28a' : cols[1], pts: [[0, 100]].concat(s.hist.map(h => [h.d, h.prop / (s.ev.prop || 1) * 100])), w: 1.6 }); series.push({ name: L('Datos %', 'Data %') + nm, col: i ? '#ff9ccc' : cols[2], pts: [[0, 0]].concat(s.hist.map(h => [h.d, h.del / tg * 100])), w: 1.6 }); });
    lineChart(ch, { series, xmin: 0, xmax: M.duration, ymin: 0, ymax: 105, legend: 1, xlabel: L('día', 'day') }); }
  const lg = $('#mlog'); if (lg && S.sim.log.length !== S.ms.nlog) { S.ms.nlog = S.sim.log.length; lg.innerHTML = S.sim.log.slice(-60).reverse().map(x => `<div class="ll ${x.kind}"><b>D${x.day}</b> ${S.lang === 'es' ? x.es : x.en}</div>`).join(''); }
}
function teleBlock(s, tag) {
  const e = s.ev, M = s.M, tg = s.objs.reduce((a, o) => a + o.target, 0) || 1, del = Object.values(s.deliv).reduce((a, b) => a + b, 0), st = s.over ? s.status : 'running';
  const dvl = s.phase === 'insertion' ? Math.max(0, s.dvTarget - s.dvDone) : null;
  return `<div class="tb1">${tag ? `<h4>${L('Nave', 'Ship')} ${tag} ${stBadge(st)}</h4>` : `<div class="ph"><h3>${L('Estado', 'Status')}</h3>${stBadge(st)}</div>`}
<div class="phase">${['launch', 'commission', 'cruise', 'insertion', 'science'].map(p => `<i class="${s.phase === p ? 'on' : ''}">${T({ es: PHL[p][0], en: PHL[p][1] }).split(' ')[0]}</i>`).join('')}</div>
<div class="kv sm"><div><span>${L('Día', 'Day')}</span><b>${s.day} / ${M.duration}</b></div><div><span>${L('Fase', 'Phase')}</span><b>${L(PHL[s.phase][0], PHL[s.phase][1])}</b></div></div>
<div class="gl"><label>🔋 ${L('Batería', 'Battery')} <b>${fmt(s.soc / s.socCap * 100)} %</b></label>${bar(s.soc / s.socCap, s.soc / s.socCap < 0.2 ? '#ff5d73' : '#3ddc97')}</div>
<div class="gl"><label>⛽ ${L('Propelente', 'Propellant')} <b>${fmt(s.prop, 1)} kg</b></label>${bar(s.prop / (e.prop || 1), '#ffb454')}</div>
<div class="gl"><label>☀ ${L('Eficiencia de paneles', 'Array health')} <b>${fmt(s.health * 100)} %</b></label>${bar(s.health, '#5ee7ff')}</div>
<div class="gl"><label>📡 ${L('Datos entregados', 'Data delivered')} <b>${fmt(del)} / ${fmt(tg)} MB</b></label>${bar(del / tg, '#ff5fa8')}</div>
<div class="kv sm"><div><span>Δv ${dvl !== null ? L('por quemar', 'to burn') : L('restante', 'left')}</span><b>${fmt(dvl !== null ? dvl : s.dvRemaining())} m/s</b></div><div><span>${L('Apagones', 'Blackouts')}</span><b class="${s.blackout ? 'bad' : ''}">${s.blackout}</b></div></div>
<div class="objm">${s.objs.map(o => `<div><span>${T(M.objectives.find(x => x.id === o.id))}</span>${bar(s.deliv[o.inst] / o.target, s.deliv[o.inst] >= o.target ? '#3ddc97' : '#5ee7ff')}</div>`).join('')}</div></div>`;
}

/* ---------- scene ---------- */
function ship2d(c, x, y, ang, k, col) { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col || '#e8d9a8'; c.fillRect(-4 * k, -3 * k, 8 * k, 6 * k); c.fillStyle = '#2f6bff'; c.fillRect(-4 * k, -9 * k, 3 * k, 5 * k); c.fillRect(1 * k, -9 * k, 3 * k, 5 * k); c.fillRect(-4 * k, 4 * k, 3 * k, 5 * k); c.fillRect(1 * k, 4 * k, 3 * k, 5 * k); c.fillStyle = '#5ee7ff'; c.fillRect(4 * k, -1 * k, 2 * k, 2 * k); c.restore(); }
function drawScene(cv, s, cnt, t) {
  const { c, w, h } = fit(cv), M = s.M, o = S.ms; c.clearRect(0, 0, w, h);
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgba(4,8,20,.55)'); bg.addColorStop(1, 'rgba(10,20,48,.55)'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  if (cnt !== null) { // launch sequence
    const gy = h * 0.82, rx = w / 2; c.fillStyle = '#0b3a7a'; c.beginPath(); c.ellipse(w / 2, gy + h * 1.6, w * 1.6, h * 1.6, 0, Math.PI, 0); c.fill(); const g = c.createLinearGradient(0, gy - 30, 0, gy + 40); g.addColorStop(0, 'rgba(94,231,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, gy - 30, w, 70);
    const lift = cnt > 3 ? Math.pow(cnt - 3, 2) * h * 0.55 : 0, ry = gy - 10 - lift;
    if (cnt > 2.4) { const f = Math.min(1, (cnt - 2.4) * 2) * (0.7 + 0.3 * Math.sin(t * 40)); c.fillStyle = `rgba(255,${150 + 80 * f | 0},60,${0.9 * f})`; c.beginPath(); c.moveTo(rx - 9, ry + 2); c.lineTo(rx, ry + 30 + 60 * f + lift * 0.05); c.lineTo(rx + 9, ry + 2); c.fill(); if (cnt < 3.4) { c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(rx + (i - 3.5) * 22, gy + 4, 18 + 10 * Math.sin(t * 8 + i), 0, 6.3); c.fill(); } } }
    c.fillStyle = '#e8edf5'; c.fillRect(rx - 9, ry - 62, 18, 64); c.fillStyle = '#ff5d73'; c.beginPath(); c.moveTo(rx - 9, ry - 62); c.lineTo(rx, ry - 84); c.lineTo(rx + 9, ry - 62); c.fill(); c.fillStyle = '#5ee7ff'; c.beginPath(); c.arc(rx, ry - 44, 4, 0, 6.3); c.fill();
    c.textAlign = 'center'; c.fillStyle = '#eaf1ff'; c.font = '700 64px ui-monospace,Consolas,monospace'; const n = Math.ceil(3 - cnt); c.fillText(cnt < 3 ? (n > 0 ? String(n) : '0') : (cnt < 3.4 ? L('¡IGNICIÓN!', 'LIFTOFF!') : 'T+' + fmt(cnt - 3, 1) + ' s'), w / 2, h * 0.24); c.font = '13px ui-monospace,Consolas,monospace'; c.fillStyle = 'rgba(180,195,230,.8)'; c.fillText(M.name + ' · ' + (M.launchers.find(l => l.id === design('A').launcher) || {}).name, w / 2, h * 0.24 + 26); return;
  }
  const ph = s.phase, tg = M.body, day = s.day, ang0 = t * (ph === 'science' ? 0.5 : 0.3), flash = Math.max(0, 1 - (t - o.flash) / 1.2);
  const flashRing = (x, y) => { if (flash > 0) { c.strokeStyle = `rgba(255,93,115,${flash})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 14 + (1 - flash) * 40, 0, 6.3); c.stroke(); } };
  const downlink = (x, y, px, py) => { if (s.over || !(ph === 'science' && day > s.commDownUntil)) return; c.strokeStyle = 'rgba(255,95,168,.55)'; c.setLineDash([3, 5]); c.lineDashOffset = -t * 20; c.beginPath(); c.moveTo(x, y); c.lineTo(px, py); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; };
  const label = (txt, x, y, col) => { c.font = '11px ui-monospace,Consolas,monospace'; c.fillStyle = col || 'rgba(190,205,240,.8)'; c.textAlign = 'center'; c.fillText(txt, x, y); };
  const inOrbit = M.id === 'aurora' || ph === 'insertion' || ph === 'science';
  if (inOrbit) {
    const cx = w / 2, cy = h / 2, R = h * (M.id === 'aurora' ? 0.2 : 0.17), r1 = R * 1.5, r2 = R * 2.05; planet(c, cx, cy, R, tg, t * 0.1);
    if (M.id === 'aurora') { c.strokeStyle = 'rgba(255,255,255,.18)'; c.setLineDash([4, 4]); c.beginPath(); c.arc(cx, cy, r1, 0, 6.3); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(94,231,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, r2, 0, 6.3); c.stroke(); label('400 km', cx + r1 + 4, cy - 6); label('700 km', cx + r2 + 8, cy - 6, '#5ee7ff'); }
    else { c.strokeStyle = 'rgba(94,231,255,.7)'; c.lineWidth = 1.5; const e = 0.0; c.beginPath(); c.arc(cx, cy, r2, 0, 6.3); c.stroke(); label(T(M.target), cx, cy + r2 + 22, '#5ee7ff'); }
    let rr = r2, e = 0;
    if (M.id === 'aurora') { const f = s.dvTarget ? clamp(s.dvDone / s.dvTarget, 0, 1) : 0; rr = ph === 'science' || s.orbit ? r2 : (ph === 'insertion' ? r1 + (r2 - r1) * f : r1); }
    else { const f = s.dvTarget ? clamp(s.dvDone / s.dvTarget, 0, 1) : 0; rr = ph === 'insertion' ? r2 * (1.9 - 0.9 * f) : r2; e = ph === 'insertion' ? 0.5 * (1 - f) : 0; }
    // elliptical visuals for insertion in moon/mars
    const a = ang0 * (1.2), px = cx + Math.cos(a) * rr * (1 + e * 0.5), py = cy + Math.sin(a) * rr * (1 - e * 0.35);
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.ellipse(cx, cy, rr * (1 + e * 0.5), rr * (1 - e * 0.35), 0, 0, 6.3); c.stroke();
    // eclipse shadow
    c.fillStyle = 'rgba(0,0,10,.35)'; c.beginPath(); c.rect(cx - r2 * 1.5, cy - R * 1.02 - 0, r2 * 1.5, 0); c.fill();
    ship2d(c, px, py, a + Math.PI / 2, 1.1); flashRing(px, py); downlink(px, py, cx + Math.cos(t * 0.3 + 1) * R * 0.95, cy + Math.sin(t * 0.3 + 1) * R * 0.95);
    if (ph === 'insertion' && !s.over) { c.fillStyle = `rgba(94,231,255,${0.4 + 0.4 * Math.sin(t * 14)})`; c.beginPath(); c.arc(px - Math.cos(a + Math.PI / 2) * 8, py - Math.sin(a + Math.PI / 2) * 8, 3, 0, 6.3); c.fill(); }
  } else {
    const ex = w * 0.12, ey = h * 0.62, tx = w * 0.84, ty = h * 0.4, er = h * 0.1, tr = M.id === 'ares' ? h * 0.12 : h * 0.07; planet(c, ex, ey, er, 'earth', t * 0.1); planet(c, tx, ty, tr, tg, 0);
    label(L('Tierra', 'Earth'), ex, ey + er + 16); label(M.id === 'ares' ? 'Marte' : L('Luna', 'Moon'), tx, ty + tr + 16);
    const cxp = (w * 0.5), cyp = h * 0.14; c.strokeStyle = 'rgba(255,255,255,.2)'; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(ex + er, ey - 6); c.quadraticCurveTo(cxp, cyp, tx - tr - 4, ty); c.stroke(); c.setLineDash([]);
    const f = ph === 'launch' || ph === 'commission' ? clamp(day / Math.max(M.transit, 1), 0, 1) * 1 : clamp(day / Math.max(M.transit, 1), 0, 1); const u = Math.max(0.02, f), sx = (1 - u) * (1 - u) * (ex + er) + 2 * (1 - u) * u * cxp + u * u * (tx - tr - 4), sy = (1 - u) * (1 - u) * (ey - 6) + 2 * (1 - u) * u * cyp + u * u * ty;
    const dx = 2 * (1 - u) * (cxp - ex - er) + 2 * u * (tx - tr - 4 - cxp), dy = 2 * (1 - u) * (cyp - ey + 6) + 2 * u * (ty - cyp);
    ship2d(c, sx, sy, Math.atan2(dy, dx), 1.2); flashRing(sx, sy); label(L('Tránsito: día ', 'Transit: day ') + day + ' / ' + fmt(M.transit), w / 2, h - 18, '#5ee7ff');
    if (M.id === 'ares') { c.fillStyle = '#ffd166'; c.beginPath(); c.arc(w * 0.5, h * 0.9, 10, 0, 6.3); c.fill(); label('☀', w * 0.5 + 22, h * 0.9 + 4, '#ffd166'); }
  }
  c.textAlign = 'left'; c.font = '700 12px ui-monospace,Consolas,monospace'; c.fillStyle = '#eaf1ff'; c.fillText(L(PHL[ph][0], PHL[ph][1]).toUpperCase() + ' · ' + L('DÍA', 'DAY') + ' ' + day, 14, 22);
  if (s.pending) { c.fillStyle = 'rgba(255,93,115,.9)'; c.fillText('⚠ ' + L('EMERGENCIA: se requiere tu decisión', 'EMERGENCY: your decision is needed'), 14, 40); }
  if (s.over) { c.textAlign = 'center'; c.font = '700 26px ui-monospace,Consolas,monospace'; const st = STL[s.status]; c.fillStyle = st[2]; c.fillText(L(st[0], st[1]), w / 2, h * 0.14); }
}

/* ---------- events ---------- */
function showEvent() {
  const p = S.sim.pending; if (!p) return; const { ev, def } = p, rec = def.auto(S.sim, ev); ev.rec = rec; S.ms.asked++;
  showModal(`<div class="evh"><span class="evi">${def.ic}</span><div><div class="kick">${L('EMERGENCIA', 'EMERGENCY')} · ${L('día', 'day')} ${ev.day} · ${L(PHL[ev.phase][0], PHL[ev.phase][1])}</div><h2>${T(def.name)}</h2></div></div><p class="evt">${T(ev.text)}</p>
<div class="evc">${def.choices.map(c => `<button class="evb ${c.id === rec ? 'rec' : ''}" data-act="evch" data-c="${c.id}"><b>${T(c)}</b><small>${T(c.hint)}</small>${c.id === rec ? `<em>🧠 ${L('NEURON CORE recomienda', 'NEURON CORE recommends')} · ${L('REGLA', 'RULE')}</em>` : ''}</button>`).join('')}</div>
<p class="mut sm">${L('La recomendación es una regla determinista basada en el estado actual de tu nave (energía, combustible, computadora). Tú tienes la última palabra.', 'The recommendation is a deterministic rule based on your ship’s current state (power, propellant, computer). You have the final say.')}</p>`, 'ev');
}
ACT.evch = (t) => { const p = S.sim.pending; if (!p) return; if (t.dataset.c === p.ev.rec) S.ms.follow++; ACT.closeModal(); S.sim.resolve(t.dataset.c); };

/* ---------- finish / history ---------- */
function finalize() {
  if (S.saved) { drawCtrl(); return; } S.saved = true; S.ms.stage = 'done'; ACT.closeModal();
  [S.sim, S.simB].filter(Boolean).forEach((s) => { if (!s.over) s.finish(); S.hist.push({ mid: S.mid, x: s.ev.features, status: s.status, score: s.result.S, codes: (s.ev.diag || []).filter(d => d.sev !== 'info').map(d => d.code), seed: S.seed, t: Date.now() }); });
  S.hist = S.hist.slice(-60); S.report = S.sim; S.ncCache[S.mid] = S.ncCache[S.mid]; save(); drawCtrl();
  const r = S.sim.result, st = STL[S.sim.status];
  showModal(`<div class="done"><div class="kick">${L('FIN DE LA MISIÓN', 'MISSION COMPLETE')}</div><h2 style="color:${st[2]}">${L(st[0], st[1])}</h2><div class="big">${fmt(r.S, 1)}<small>/100</small></div>${S.sim.reason ? `<p class="mut">${T(S.sim.reason)}</p>` : ''}<p>${L('Objetivos cumplidos', 'Objectives met')}: <b>${r.done}/${r.nobj}</b></p><div class="cta"><button class="btn pri" data-act="goMA">📊 ${L('Ver análisis', 'View analysis')}</button><button class="btn" data-act="closeModal">${L('Cerrar', 'Close')}</button></div></div>`);
}

/* ======================= MISSION ANALYTICS ======================= */
const WT = [['C', 0.30, 'Cumplimiento de objetivos', 'Objectives completed'], ['R', 0.20, 'Reservas y recursos', 'Resource reserves'], ['B', 0.15, 'Presupuesto sobrante', 'Budget margin'], ['E', 0.15, 'Eficiencia energética', 'Energy efficiency'], ['D', 0.10, 'Calidad del diseño', 'Design quality'], ['A', 0.10, 'Decisiones en misión', 'In-mission decisions']];
function viewMA() {
  const s = S.report || (S.sim && S.sim.over ? S.sim : null);
  if (!s) { $('#main').innerHTML = `<div class="pagehead"><h2>MISSION ANALYTICS</h2></div><section class="panel empty"><div class="bigic">📊</div><p>${L('Todavía no hay una misión terminada. Diseña tu nave, lánzala y vuelve aquí para ver qué decisiones determinaron el resultado.', 'No finished mission yet. Design your ship, launch it, and come back to see which decisions shaped the outcome.')}</p><div class="cta"><button class="btn pri" data-act="go" data-v="sd">🔧 ${L('Ir al Ship Designer', 'Go to Ship Designer')}</button></div></section>${histPanel()}`; return; }
  const M = s.M, r = s.result, e = s.ev, st = STL[s.status], days = Math.max(1, s.day);
  const sc = WT.map(([k, w, es, en]) => ({ k, w, v: r[k], n: L(es, en), loss: w * (100 - r[k]) })), worst = sc.slice().sort((a, b) => b.loss - a.loss).slice(0, 3);
  const objRows = s.objs.map(o => { const pct = s.deliv[o.inst] / o.target; return `<tr><td>${T(M.objectives.find(x => x.id === o.id))}</td><td class="n">${fmt(s.deliv[o.inst])} / ${fmt(o.target)} MB</td><td style="width:34%">${bar(pct, pct >= 1 ? '#3ddc97' : '#ffb454')}</td><td>${pct >= 1 ? '<span class="ok">✓</span>' : '<span class="bad">✕ ' + fmt(pct * 100) + ' %</span>'}</td></tr>`; }).join('') + M.objectives.filter(o => !s.objs.find(x => x.id === o.id)).map(o => `<tr><td>${T(o)}</td><td colspan="2" class="mut">${L('Sin instrumento a bordo', 'No instrument on board')}</td><td><span class="bad">✕ 0 %</span></td></tr>`).join('');
  const genAct = s.genTot / (24 * days), planned = [
    [L('Δv de la misión', 'Mission Δv'), fmt(e.dvReq) + ' m/s ' + L('requeridos', 'required'), fmt(s.dvDone + s.dvUsedTcm) + ' m/s ' + L('ejecutados', 'executed') + (s.dvTarget > e.dvCritEff + 1 ? ` (+${fmt(s.dvTarget - e.dvCritEff)} ${L('por correcciones', 'from corrections')})` : '')],
    [L('Potencia media generada', 'Mean power generated'), fmt(e.genAvg) + ' W', fmt(genAct) + ' W (' + fmt(genAct / (e.genAvg || 1) * 100) + ' %)'],
    [L('Propelente', 'Propellant'), fmt(e.prop, 1) + ' kg ' + L('cargados', 'loaded'), fmt(s.prop, 1) + ' kg ' + L('sobrantes', 'left')],
    [L('Días de ciencia', 'Science days'), fmt(s.sciDays + 0) + ' ' + L('en órbita', 'in orbit'), fmt(s.sciDays - s.sciLost) + ' ' + L('útiles', 'effective') + ` (${s.sciLost} ${L('perdidos', 'lost')})`],
    [L('Presupuesto', 'Budget'), cr(M.budget), cr(e.cost) + ' ' + L('gastados', 'spent') + ' · ' + cr(M.budget - e.cost) + ' ' + L('libres', 'free')],
    [L('Datos perdidos por saturación', 'Data lost to saturation'), '0 MB', fmt(s.lost) + ' MB'],
  ];
  const good = [], bad = [];
  if (e.cp && e.cp.red) good.push(L('Computadora redundante: mejor recuperación de fallas.', 'Redundant computer: better fault recovery.')); else bad.push(L('Computadora sin redundancia: un reinicio puede costar días de ciencia.', 'Non-redundant computer: a reset can cost science days.'));
  if (e.sh) good.push(L('Blindaje contra radiación presente.', 'Radiation shielding fitted.'));
  if (e.supportMargin >= 1.25) good.push(L('Buen margen estructural de lanzamiento (' + fmt(e.supportMargin, 2) + '×).', 'Good launch structural margin (' + fmt(e.supportMargin, 2) + '×).')); else bad.push(L('Margen estructural bajo (' + fmt(e.supportMargin, 2) + '×): riesgo de vibración.', 'Low structural margin (' + fmt(e.supportMargin, 2) + '×): vibration risk.'));
  if (e.dvAvail >= e.dvReq * 1.1) good.push(L('Δv con holgura del ' + fmt((e.dvAvail / e.dvReq - 1) * 100) + ' %.', 'Δv with ' + fmt((e.dvAvail / e.dvReq - 1) * 100) + '% headroom.')); else bad.push(L('Δv muy ajustado: una corrección imprevista puede dejarte sin órbita.', 'Very tight Δv: an unplanned correction can cost you the orbit.'));
  if (s.blackout === 0) good.push(L('Sin apagones: el balance de energía fue sólido.', 'No blackouts: the power balance held.')); else bad.push(L(s.blackout + ' día(s) con apagón: batería o paneles insuficientes.', s.blackout + ' blackout day(s): battery or arrays too small.'));
  if (r.avgDuty < 0.8) bad.push(L('Los instrumentos funcionaron al ' + fmt(r.avgDuty * 100) + ' % de su ciclo: la energía limitó la ciencia.', 'Instruments ran at ' + fmt(r.avgDuty * 100) + '% duty: power limited the science.'));
  if (s.lost > 0) bad.push(L('Se perdieron ' + fmt(s.lost) + ' MB por almacenamiento/enlace insuficientes.', fmt(s.lost) + ' MB lost to insufficient storage/link capacity.'));
  (e.diag || []).filter(d => d.sev === 'critical' || d.sev === 'high' || d.sev === 'medium').slice(0, 4).forEach(d => bad.push(T(d.msg) + ' <code>' + d.code + '</code>'));
  const evRows = s.events.length ? s.events.map(ev => { const d = N.EV[ev.type], ch = d.choices ? d.choices.find(c => c.id === ev.choice) : null; return `<tr><td class="n">D${ev.day}</td><td>${d.ic} ${T(d.name)}</td><td>${ch ? T(ch) : '<span class="mut">' + L('automático', 'automatic') + '</span>'}</td><td>${ev.rec && ev.rec === ev.choice ? '🧠 ✓' : (ev.rec ? '—' : '')}</td><td style="width:20%">${bar(ev.q, ev.q >= 0.7 ? '#3ddc97' : ev.q < 0.4 ? '#ff5d73' : '#ffb454')}</td><td class="mut sm">${T(ev.res)}</td></tr>`; }).join('') : `<tr><td colspan="6" class="mut">${L('No hubo eventos en esta semilla.', 'No events occurred with this seed.')}</td></tr>`;
  let twin = '';
  if (S.twin && S.simB) { const b = S.simB, rb = b.result, rows = [[L('Estado', 'Status'), STL[s.status][0 + (S.lang === 'es' ? 0 : 1)], STL[b.status][S.lang === 'es' ? 0 : 1], null], [L('Puntuación', 'Score'), r.S, rb.S, 1], [L('Objetivos', 'Objectives'), r.done, rb.done, 1], [L('Presupuesto libre (M)', 'Budget left (M)'), M.budget - e.cost, M.budget - b.ev.cost, 1], [L('Propelente sobrante (kg)', 'Propellant left (kg)'), s.prop, b.prop, 1], [L('Apagones', 'Blackouts'), r.blackout, rb.blackout, -1], [L('Ciclo útil medio (%)', 'Mean duty (%)'), r.avgDuty * 100, rb.avgDuty * 100, 1]];
    const win = r.S > rb.S + 0.05 ? 'A' : rb.S > r.S + 0.05 ? 'B' : null;
    twin = `<section class="panel"><div class="ph"><h3>👯 Twin Mission</h3>${win ? badge(L('Gana la nave ', 'Ship wins: ') + win, '#3ddc97') : badge(L('Empate', 'Tie'), '#ffb454')}</div><table class="tb"><thead><tr><th></th><th>${L('Nave A', 'Ship A')}</th><th>${L('Nave B', 'Ship B')}</th></tr></thead><tbody>${rows.map(([n, a, bb, dir]) => { const f = (v) => typeof v === 'number' ? fmt(v, 1) : v; const aw = dir && (dir > 0 ? a > bb + 1e-6 : a < bb - 1e-6), bw = dir && (dir > 0 ? bb > a + 1e-6 : bb < a - 1e-6); return `<tr><td>${n}</td><td class="n ${aw ? 'ok' : ''}">${f(a)}${aw ? ' ★' : ''}</td><td class="n ${bw ? 'ok' : ''}">${f(bb)}${bw ? ' ★' : ''}</td></tr>`; }).join('')}</tbody></table><p class="mut sm">${L('Ambas naves vivieron exactamente los mismos eventos: la diferencia viene solo de la ingeniería.', 'Both ships lived exactly the same events: any difference comes from engineering alone.')}</p></section>`; }
  $('#main').innerHTML = `<div class="pagehead"><h2>MISSION ANALYTICS</h2><p class="mut">${M.name} · ${L('semilla', 'seed')} ${S.seed} · ${days} ${L('días simulados', 'simulated days')}</p></div>
<section class="panel hero2" style="--c:${st[2]}"><div class="verd"><div class="kick">${L('Resultado', 'Outcome')}</div><h2>${L(st[0], st[1])}</h2>${s.reason ? `<p>${T(s.reason)}</p>` : `<p>${r.done}/${r.nobj} ${L('objetivos cumplidos', 'objectives met')} · ${L('mínimo', 'minimum')} ${M.minObj}</p>`}</div>${ring(r.S / 100, st[2], L('PUNTUACIÓN', 'SCORE'), fmt(r.S, 1), '/100')}</section>
<div class="grid2"><section class="panel"><div class="ph"><h3>${L('Desglose de la puntuación', 'Score breakdown')}</h3></div><div class="eq sm">S = 0,30·C + 0,20·R + 0,15·B + 0,15·E + 0,10·D + 0,10·A</div>${sc.map(x => `<div class="gl"><label><b>${x.k}</b> · ${x.n} <em class="mut">(${fmt(x.w * 100)} %)</em> <b>${fmt(x.v)}</b></label>${bar(x.v / 100, x.v >= 75 ? '#3ddc97' : x.v >= 45 ? '#ffb454' : '#ff5d73')}</div>`).join('')}
${s.status !== 'success' ? `<p class="mut sm">${L('La puntuación está limitada a', 'Score is capped at')} ${s.status === 'partial' ? 79 : s.status === 'failed' ? 30 : 25} ${L('por el estado de la misión.', 'by mission status.')}</p>` : ''}<h4>${L('Lo que más puntos te costó', 'What cost you the most points')}</h4><ol class="objs">${worst.map(x => `<li><b>${x.n}</b> — ${fmt(x.loss, 1)} ${L('pts perdidos', 'pts lost')}</li>`).join('')}</ol></section>
<section class="panel"><div class="ph"><h3>${L('Objetivos científicos', 'Science objectives')}</h3></div><table class="tb"><tbody>${objRows}</tbody></table><h4>${L('Telemetría', 'Telemetry')}</h4><canvas class="chart" id="ach"></canvas></section></div>
<section class="panel"><div class="ph"><h3>${L('Planificado vs ejecutado', 'Planned vs executed')}</h3></div><table class="tb"><thead><tr><th></th><th>${L('Planificado', 'Planned')}</th><th>${L('Ejecutado', 'Executed')}</th></tr></thead><tbody>${planned.map(p => `<tr><td>${p[0]}</td><td class="n">${p[1]}</td><td class="n">${p[2]}</td></tr>`).join('')}</tbody></table></section>
<div class="grid2"><section class="panel"><div class="ph"><h3>✓ ${L('Buenas decisiones', 'Good decisions')}</h3></div><ul class="gd">${good.length ? good.map(x => `<li class="ok">${x}</li>`).join('') : `<li class="mut">${L('Ninguna destacada: ¡hay mucho margen de mejora!', 'None stand out: lots of room to improve!')}</li>`}</ul></section><section class="panel"><div class="ph"><h3>✕ ${L('Errores y riesgos de diseño', 'Design errors & risks')}</h3></div><ul class="gd">${bad.length ? bad.map(x => `<li class="bad">${x}</li>`).join('') : `<li class="ok">${L('Sin errores relevantes.', 'No relevant errors.')}</li>`}</ul></section></div>
<section class="panel"><div class="ph"><h3>${L('Eventos y tus decisiones', 'Events & your decisions')}</h3>${S.ms && S.ms.asked ? badge(L('Seguiste la recomendación ', 'Followed advice ') + S.ms.follow + '/' + S.ms.asked, '#5ee7ff') : ''}</div><table class="tb"><thead><tr><th></th><th>${L('Evento', 'Event')}</th><th>${L('Decisión', 'Decision')}</th><th>🧠</th><th>${L('Calidad', 'Quality')}</th><th>${L('Resultado', 'Result')}</th></tr></thead><tbody>${evRows}</tbody></table></section>
${twin}${histPanel()}
<section class="panel"><div class="ph"><h3>${L('Bitácora completa', 'Full log')}</h3></div><div class="log tall">${s.log.map(x => `<div class="ll ${x.kind}"><b>D${x.day}</b> ${S.lang === 'es' ? x.es : x.en}</div>`).join('')}</div></section>
<div class="cta"><button class="btn pri" data-act="go" data-v="sd">🔧 ${L('Rediseñar y mejorar', 'Redesign & improve')}</button><button class="btn" data-act="go" data-v="nc">🧠 ${L('Entrenar Neuron Core con mis misiones', 'Train Neuron Core on my missions')}</button><button class="btn" data-act="replay">↺ ${L('Repetir con otra semilla', 'Replay with another seed')}</button><button class="btn" data-act="exportJ">⬇ JSON</button><button class="btn" data-act="printR">🖨 ${L('Imprimir / PDF', 'Print / PDF')}</button></div>`;
  const ch = $('#ach'); if (ch) lineChart(ch, { series: [{ name: L('Batería %', 'Battery %'), col: '#3ddc97', pts: [[0, 90]].concat(s.hist.map(h => [h.d, h.soc * 100])) }, { name: L('Propelente %', 'Propellant %'), col: '#ffb454', pts: [[0, 100]].concat(s.hist.map(h => [h.d, h.prop / (e.prop || 1) * 100])) }, { name: L('Generación W', 'Generation W') + '/10', col: '#5ee7ff', pts: s.hist.map(h => [h.d, Math.min(100, h.gen / 10)]) }], xmin: 0, xmax: M.duration, ymin: 0, ymax: 105, legend: 1, xlabel: L('día', 'day') });
}
function histPanel() {
  const mh = S.hist.filter(h => h.mid === S.mid).slice(-10); if (!mh.length) return '';
  return `<section class="panel"><div class="ph"><h3>${L('Tu historial en esta misión', 'Your history on this mission')}</h3><span class="mut sm">${S.hist.filter(h => h.mid === S.mid).length} ${L('registradas', 'recorded')}</span></div><div class="hist">${mh.map(h => { const st = STL[h.status] || STL.running; return `<div class="hb" title="${fmt(h.score, 1)}"><i style="height:${clamp(h.score, 3, 100)}%;background:${st[2]}"></i><span>${fmt(h.score)}</span></div>`; }).join('')}</div><p class="mut sm">${L('Cada barra es una misión (verde = éxito, ámbar = parcial, rojo = fallida). Estos datos alimentan el Nivel 3 del Neuron Core.', 'Each bar is a mission (green = success, amber = partial, red = failed). This data feeds Neuron Core Level 3.')}</p></section>`;
}
ACT.exportJ = () => { const s = S.report; if (!s) return; const o = { app: 'NEBULA', mission: s.M.id, seed: S.seed, design: design('A'), status: s.status, score: s.result, events: s.events.map(e => ({ day: e.day, type: e.type, choice: e.choice, quality: e.q })), log: s.log }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' })); a.download = 'nebula-' + s.M.id + '-seed' + S.seed + '.json'; document.body.appendChild(a); a.click(); a.remove(); };
ACT.printR = () => window.print();

/* ======================= INIT ======================= */
window.addEventListener('DOMContentLoaded', () => {
  load(); renderNav(); requestAnimationFrame(bgLoop);
  window.addEventListener('resize', () => { if (S.view === 'ma') viewMA(); });
  render();
});
