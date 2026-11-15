/* NEBULA UI part 3 — Neuron Core, Orbital Lab, Science Lab */
const sci = (x, d) => { if (!x) return '0'; const e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e); return fmt(m, d === undefined ? 3 : d) + '×10' + String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹⁻'['0123456789-'.indexOf(c)]).join(''); };
const MUS = N.MU, RAD = N.RAD;

/* ======================= NEURON CORE ======================= */
const NC_N = 1200, NC_EP = 120;
function ncKey(mid) { return 'nebula.nc.v2.' + mid; }
function histSamples(mid) { return S.hist.filter(h => h.mid === mid && h.x).map(h => ({ x: h.x, y: [h.status === 'success' ? 1 : h.status === 'partial' ? 0.5 : 0, h.score / 100, h.status === 'failed' ? 1 : 0] })); }
function ncModel(mid) { const c = S.ncCache[mid]; if (c) return c; try { const j = JSON.parse(localStorage.getItem(ncKey(mid)) || 'null'); if (j) { S.ncCache[mid] = { net: N.MLP.fromJSON(j.net), meta: j.meta }; return S.ncCache[mid]; } } catch (e) { } return null; }
function trainModel(mid, onProg, done) {
  const M = N.MISSION_BY_ID[mid], rnd = N.mulberry(1234 + S.hist.length), samples = []; let tries = 0;
  const extra = histSamples(mid);
  const gen = () => {
    const t0 = performance.now();
    while (samples.length < NC_N && tries < 60000 && performance.now() - t0 < 25) { tries++; const s = N.makeSample(M, rnd); if (s) samples.push(s); }
    onProg(0.6 * samples.length / NC_N, L('Generando configuraciones con el simulador…', 'Generating configurations with the simulator…'));
    if (samples.length < NC_N && tries < 60000) setTimeout(gen, 0); else prep();
  };
  let net, tr, te, X, Y, ep = 0, loss = [];
  const prep = () => {
    const all = samples.concat(extra, extra, extra); // user's own missions weigh 3x
    const idx = all.map((_, i) => i).sort(() => rnd() - 0.5), nTr = Math.floor(idx.length * 0.8); tr = idx.slice(0, nTr); te = idx.slice(nTr).filter(i => i < samples.length || true);
    X = all.map(s => s.x); Y = all.map(s => s.y); net = new N.MLP([7, 14, 8, 3], rnd); train();
  };
  const train = () => {
    const t0 = performance.now();
    while (ep < NC_EP && performance.now() - t0 < 25) { const sh = tr.slice().sort(() => rnd() - 0.5); let l = 0, nb = 0; for (let b = 0; b < sh.length; b += 64) { l += net.trainBatch(X, Y, sh.slice(b, b + 64), 0.01); nb++; } loss.push(l / nb); ep++; }
    onProg(0.6 + 0.4 * ep / NC_EP, L('Entrenando la red neuronal…', 'Training the neural network…'));
    if (ep < NC_EP) setTimeout(train, 0); else fin();
  };
  const fin = () => {
    const mean = [0, 1, 2].map(j => tr.reduce((a, i) => a + Y[i][j], 0) / tr.length), meanX = X[0].map((_, j) => tr.reduce((a, i) => a + X[i][j], 0) / tr.length);
    const mae = [0, 0, 0], base = [0, 0, 0]; te.forEach(i => { const o = net.forward(X[i]); for (let j = 0; j < 3; j++) { mae[j] += Math.abs(o[j] - Y[i][j]); base[j] += Math.abs(mean[j] - Y[i][j]); } });
    const meta = { n: samples.length, extra: extra.length, nTr: tr.length, nTe: te.length, mae: mae.map(v => v / te.length), base: base.map(v => v / te.length), loss, meanX, ep: NC_EP };
    S.ncCache[mid] = { net, meta }; try { localStorage.setItem(ncKey(mid), JSON.stringify({ net: net.toJSON(), meta })); } catch (e) { } done();
  };
  gen();
}
function viewNC() {
  const M = M_();
  $('#main').innerHTML = `<div class="pagehead"><h2>NEURON CORE <small>${M.name}</small></h2><p class="mut">${L('El cerebro de la misión, en tres niveles: <b>reglas de ingeniería</b> comprobadas, una <b>red neuronal</b> entrenada con miles de simulaciones y <b>aprendizaje</b> con tus propias misiones.', 'The mission brain, in three levels: verified <b>engineering rules</b>, a <b>neural network</b> trained on thousands of simulations and <b>learning</b> from your own missions.')} ${S.twin ? `<span class="seg inl">${['A', 'B'].map(k => `<button class="${S.cur === k ? 'on' : ''}" data-act="slotNC" data-k="${k}">${L('Nave', 'Ship')} ${k}</button>`).join('')}</span>` : ''}</p></div>
<div class="grid2"><section class="panel"><div class="ph"><h3>${L('Nivel 1 · Motor de reglas', 'Level 1 · Rules engine')}</h3>${badge(L('PROGRAMACIÓN DETERMINISTA', 'DETERMINISTIC'), '#5ee7ff')}</div><div id="rules"></div></section>
<section class="panel"><div class="ph"><h3>${L('Nivel 2 · Red neuronal', 'Level 2 · Neural network')}</h3>${badge(L('PREDICCIÓN IA', 'AI PREDICTION'), '#ff5fa8')}</div><canvas id="brain" height="190"></canvas><div id="ml"></div></section></div>
<div class="grid2"><section class="panel"><div class="ph"><h3>${L('Recomendaciones y optimización', 'Recommendations & optimization')}</h3>${badge(L('TÚ DECIDES', 'YOU DECIDE'), '#3ddc97')}</div><div id="opt"></div></section>
<section class="panel"><div class="ph"><h3>${L('Nivel 3 · Aprendizaje con tus misiones', 'Level 3 · Learning from your missions')}</h3>${badge(L('DATOS REGISTRADOS', 'RECORDED DATA'), '#ffb454')}</div><div id="learn"></div></section></div>`;
  updateNC();
  startLoop((t) => { const cv = $('#brain'); if (!cv) return; drawBrain(cv, t); });
}
ACT.slotNC = (t) => { S.cur = t.dataset.k; S.opt = null; viewNC(); };
let brainState = null;
function drawBrain(cv, t) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const m = ncModel(S.mid), e = evalCur(), layers = [7, 14, 8, 3]; let acts = null;
  if (m && e.valid) acts = m.net.forward(e.features, true);
  const xs = layers.map((_, i) => 60 + (w - 120) * i / 3), pos = layers.map((n, i) => Array.from({ length: n }, (_, j) => [xs[i], h / 2 + (j - (n - 1) / 2) * Math.min(22, (h - 30) / n)]));
  for (let l = 0; l < 3; l++) for (let i = 0; i < layers[l]; i++) for (let j = 0; j < layers[l + 1]; j++) {
    const wgt = m ? m.net.W[l][i * layers[l + 1] + j] : 0.3, a = acts ? Math.abs(acts[l][i]) : 0.3;
    c.strokeStyle = wgt > 0 ? `rgba(94,231,255,${0.04 + 0.16 * Math.min(1, Math.abs(wgt)) * (0.3 + a)})` : `rgba(255,95,168,${0.04 + 0.16 * Math.min(1, Math.abs(wgt)) * (0.3 + a)})`; c.lineWidth = 0.6; c.beginPath(); c.moveTo(pos[l][i][0], pos[l][i][1]); c.lineTo(pos[l + 1][j][0], pos[l + 1][j][1]); c.stroke();
  }
  const pulse = (t * 0.7) % 1; c.fillStyle = 'rgba(255,255,255,.7)';
  for (let k = 0; k < 6; k++) { const l = k % 3, i = (k * 3) % layers[l], j = (k * 5) % layers[l + 1], p = (pulse + k / 6) % 1; c.beginPath(); c.arc(pos[l][i][0] + (pos[l + 1][j][0] - pos[l][i][0]) * p, pos[l][i][1] + (pos[l + 1][j][1] - pos[l][i][1]) * p, 1.8, 0, 6.3); c.fill(); }
  const names = [FEAT_SHORT(), null, null, [L('Éxito', 'Success'), L('Puntaje', 'Score'), L('Riesgo', 'Risk')]];
  for (let l = 0; l < 4; l++) for (let i = 0; i < layers[l]; i++) {
    const v = acts ? clamp(Math.abs(acts[l][i]), 0, 1) : 0.15, col = l === 3 ? '255,95,168' : l === 0 ? '94,231,255' : '139,123,255';
    c.beginPath(); c.arc(pos[l][i][0], pos[l][i][1], 5, 0, 6.3); c.fillStyle = `rgba(${col},${0.2 + 0.8 * v})`; c.shadowColor = `rgb(${col})`; c.shadowBlur = 4 + 10 * v; c.fill(); c.shadowBlur = 0;
    if (names[l]) { c.fillStyle = 'rgba(200,215,245,.8)'; c.font = '10px ui-monospace,Consolas,monospace'; c.textAlign = l === 0 ? 'right' : 'left'; c.fillText(names[l][i], pos[l][i][0] + (l === 0 ? -9 : 9), pos[l][i][1] + 3); }
  }
}
const FEAT_SHORT = () => [L('masa', 'mass'), L('energía', 'power'), L('presup.', 'budget'), 'Δv', L('enlace', 'link'), L('ciencia', 'science'), L('térmico', 'thermal')];
function updateNC() {
  const M = M_(), d = design(), e = N.evaluate(d, M);
  $('#rules').innerHTML = e.diag.length ? e.diag.map(x => `<details class="dg" style="--c:${SEVC[x.sev]}" ${x.sev === 'critical' ? 'open' : ''}><summary><i></i><span>${T(x.msg)}</span><em>${T({ es: SEVL[x.sev][0], en: SEVL[x.sev][1] })}</em></summary><div class="dgb"><div>${badge(L('REGLA COMPROBADA', 'VERIFIED RULE'), '#5ee7ff')} <code>${x.code}</code></div><p><b>${L('Por qué', 'Why')}:</b> ${T(x.why)}</p><p class="ok"><b>${L('Recomendación', 'Recommendation')}:</b> ${T(x.fix)}</p></div></details>`).join('') : `<div class="okv verdict">✓ ${L('Todas las reglas se cumplen. Ningún problema detectado.', 'All rules pass. No issues detected.')}</div>`;
  const rulesBox = `<div class="mut sm">${L('Fuente: reglas de ingeniería programadas explícitamente (no son IA). La masa, el presupuesto, la energía, el Δv, el enlace y el tiempo se verifican con las ecuaciones del Physics Engine.', 'Source: explicitly programmed engineering rules (not AI). Mass, budget, power, Δv, link and time are verified with the Physics Engine equations.')}</div>`;
  $('#rules').innerHTML += rulesBox;
  // ML
  const m = ncModel(S.mid);
  if (!m) { const tr = S.nc.training; $('#ml').innerHTML = `<div class="trainbox">${tr ? `<div class="mut sm" id="tmsg">${tr.msg}</div><div class="bar big"><i id="tbar" style="width:${tr.p * 100}%;background:linear-gradient(90deg,#8b7bff,#ff5fa8)"></i></div>` : `<p>${L('La red aún no está entrenada para esta misión. Se entrena en tu navegador con ~1.200 diseños simulados (≈3 s).', 'The network is not trained for this mission yet. It trains in your browser on ~1,200 simulated designs (≈3 s).')}</p><button class="btn pri" data-act="train">🧠 ${L('Entrenar Neuron Core', 'Train Neuron Core')}</button>`}</div>`; if (!tr && !S.nc.auto) { S.nc.auto = true; ACT.train(); } }
  else {
    const mt = m.meta, x = e.features, out = e.valid ? m.net.forward(x) : null;
    let html = '';
    if (!out) html += `<div class="verdict badv">${L('La IA solo evalúa diseños que pasan las reglas críticas. Resuelve el Nivel 1 primero.', 'The AI only evaluates designs that pass the critical rules. Resolve Level 1 first.')}</div>`;
    else {
      const ex = N.explain(m.net, x, mt.meanX).slice(0, 4);
      html += `<div class="preds"><div class="pr"><span>${L('Probabilidad de éxito', 'Success probability')}</span><b style="color:${out[0] > 0.8 ? '#3ddc97' : out[0] > 0.5 ? '#ffb454' : '#ff5d73'}">${fmt(out[0] * 100)}%</b></div><div class="pr"><span>${L('Puntuación esperada', 'Expected score')}</span><b>${fmt(out[1] * 100)}</b></div><div class="pr"><span>${L('Riesgo de fallo', 'Failure risk')}</span><b style="color:${out[2] > 0.2 ? '#ff5d73' : '#3ddc97'}">${fmt(out[2] * 100)}%</b></div></div>
<h4>${L('¿Qué variables influyeron? (explicación)', 'Which variables mattered? (explanation)')}</h4>${ex.map(z => `<div class="ex"><span>${T(N.FEATURE_NAMES[z.j])}</span><div class="exb"><i class="${z.delta >= 0 ? 'pos' : 'neg'}" style="width:${clamp(Math.abs(z.delta) * 200, 3, 100)}%"></i></div><b class="${z.delta >= 0 ? 'ok' : 'bad'}">${z.delta >= 0 ? '+' : ''}${fmt(z.delta * 100, 1)} pp</b></div>`).join('')}<div class="mut sm">${L('Método: se reemplaza cada variable por el promedio del entrenamiento y se mide cuánto cambia la probabilidad de éxito.', 'Method: each variable is replaced by its training average and the change in success probability is measured.')}</div>`;
    }
    html += `<details class="dg" style="--c:#8b7bff"><summary><i></i><span>${L('Calidad del modelo (datos que no vio al entrenar)', 'Model quality (held-out data)')}</span></summary><div class="dgb"><table class="tb sm"><thead><tr><th></th><th>${L('Error del modelo', 'Model error')}</th><th>${L('Línea base', 'Baseline')}</th></tr></thead><tbody>${[[L('Éxito', 'Success'), 0], [L('Puntaje', 'Score'), 1], [L('Riesgo', 'Risk'), 2]].map(([n, j]) => `<tr><td>${n}</td><td class="n ${mt.mae[j] < mt.base[j] ? 'ok' : ''}">${fmt(mt.mae[j] * 100, 1)} pp</td><td class="n">${fmt(mt.base[j] * 100, 1)} pp</td></tr>`).join('')}</tbody></table><canvas id="loss" height="90"></canvas><p class="mut sm">${mt.n} ${L('simulaciones propias de la misión', 'mission simulations')}${mt.extra ? ` + ${mt.extra} ${L('de tus misiones (×3)', 'of your missions (×3)')}` : ''} · ${mt.nTr} ${L('entrenamiento', 'train')} / ${mt.nTe} ${L('prueba', 'test')}. ${L('Línea base = predecir siempre el promedio. Un modelo solo es útil si la supera.', 'Baseline = always predict the mean. A model is only useful if it beats that.')}</p></div></details>`;
    $('#ml').innerHTML = html;
    const lc = $('#loss'); if (lc) { setTimeout(() => lineChart(lc, { series: [{ pts: mt.loss.map((v, i) => [i + 1, v]), col: '#ff5fa8', fill: 1 }], xlabel: L('época', 'epoch'), ylabel: 'MSE', yfmt: v => v.toFixed(3) }), 30); lc.closest('details').addEventListener('toggle', () => setTimeout(() => lineChart(lc, { series: [{ pts: mt.loss.map((v, i) => [i + 1, v]), col: '#ff5fa8', fill: 1 }], xlabel: L('época', 'epoch'), ylabel: 'MSE', yfmt: v => v.toFixed(3) }), 30)); }
  }
  // optimizer
  const o = S.opt, curStats = e.valid ? N.avgSim(d, M, [1, 2, 3, 4, 5, 6, 7, 8]) : null;
  let oh = `<p class="mut">${L('NEURON CORE busca configuraciones mejores con el simulador (recocido simulado sobre 900 candidatos). <b>Nunca modifica tu nave sin permiso.</b>', 'NEURON CORE searches better configurations with the simulator (simulated annealing over 900 candidates). <b>It never changes your ship without permission.</b>')}</p><div class="cta"><button class="btn pri" data-act="optimize">⚙ ${L('Pedir optimización', 'Request optimization')}</button></div>`;
  if (S.nc.busy) oh += `<div class="mut">${L('Optimizando…', 'Optimizing…')}</div>`;
  if (o) {
    const diffs = N.diffDesign(d, o.design, M).map(x => { if (x.launcher) return `<li>${L('Lanzador', 'Launcher')}: ${M.launchers.find(l => l.id === x.launcher[0]).name} → <b>${M.launchers.find(l => l.id === x.launcher[1]).name}</b></li>`; if (x.prop) return `<li>${L('Propelente', 'Propellant')}: ${x.prop[0]} → <b>${x.prop[1]} kg</b></li>`; return `<li>${T(N.CAT_BY_ID[x.id])}: ${x.from} → <b>${x.to}</b></li>`; });
    const mine = curStats;
    oh += `<div class="optres"><div class="cmp"><div><span>${L('Tu nave', 'Your ship')}</span><b>${mine ? fmt(mine.score, 1) : '—'}</b><small>${mine ? fmt(mine.success * 100) + '% ' + L('éxito', 'success') : L('no lanzable', 'not launchable')}</small></div><div class="arr">→</div><div><span>${L('Recomendación IA', 'AI recommendation')}</span><b class="ok">${fmt(o.stats.score, 1)}</b><small>${fmt(o.stats.success * 100)}% ${L('éxito', 'success')}</small></div></div><p class="mut sm">${L('Promedio de 8 simulaciones con semillas distintas.', 'Average over 8 simulations with different seeds.')}</p><h4>${L('Cambios propuestos', 'Proposed changes')}</h4><ul class="objs">${diffs.join('') || `<li>${L('Tu diseño ya es óptimo para este modelo.', 'Your design is already optimal for this model.')}</li>`}</ul><div class="cta"><button class="btn pri" data-act="applyOpt">${L('Aplicar recomendación', 'Apply recommendation')}</button></div>
<div class="challenge">${mine ? (mine.score >= o.stats.score - 0.3 ? `🏆 <b>${L('¡Reto neuronal superado!', 'Neural Challenge beaten!')}</b> ${L('Igualaste o superaste a la IA.', 'You matched or beat the AI.')}` : `🎯 <b>${L('Reto neuronal', 'Neural Challenge')}:</b> ${L('te faltan', 'you are')} ${fmt(o.stats.score - mine.score, 1)} ${L('puntos para superar a la IA. ¿Puedes lograrlo?', 'points short of the AI. Can you beat it?')}`) : ''}</div></div>`;
  }
  $('#opt').innerHTML = oh;
  // learning
  const mh = S.hist.filter(h => h.mid === S.mid);
  const codes = {}; mh.forEach(h => (h.codes || []).forEach(c => codes[c] = (codes[c] || 0) + 1));
  const top = Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  $('#learn').innerHTML = `<p class="mut">${L('Cada misión que ejecutas se guarda con su configuración, eventos y resultado. Con esos datos se puede reentrenar el modelo: <b>no aprende de cada clic</b>, sino de datos registrados, un entrenamiento y una evaluación.', 'Every mission you fly is recorded with its configuration, events and outcome. Those data can retrain the model: <b>it does not learn from every click</b>, but from recorded data, a training run and an evaluation.')}</p>
<div class="kv"><div><span>${L('Misiones registradas', 'Recorded missions')}</span><b>${mh.length}</b></div><div><span>${L('Mejor puntuación', 'Best score')}</span><b>${mh.length ? fmt(Math.max(...mh.map(h => h.score)), 1) : '—'}</b></div></div>
${top.length ? `<h4>${L('Tus patrones de error', 'Your error patterns')}</h4><ul class="objs">${top.map(([c, n]) => `<li><code>${c}</code> — ${n} ${L('vez/veces', 'time(s)')}</li>`).join('')}</ul>` : `<p class="mut sm">${L('Aún no hay patrones: lanza al menos una misión.', 'No patterns yet: launch at least one mission.')}</p>`}
<div class="cta"><button class="btn" data-act="retrain" ${S.nc.training ? 'disabled' : ''}>🔁 ${L('Reentrenar con mis misiones', 'Retrain with my missions')}</button></div>
${m ? `<p class="mut sm">${L('Versión del modelo', 'Model version')}: v${1 + (m.meta.extra ? 1 : 0)} · ${m.meta.n + m.meta.extra} ${L('muestras', 'samples')}</p>` : ''}`;
}
ACT.train = () => {
  S.nc.training = { p: 0, msg: L('Preparando…', 'Preparing…') }; if (S.view === 'nc') updateNC();
  trainModel(S.mid, (p, msg) => { S.nc.training = { p, msg }; const b = $('#tbar'); if (b) b.style.width = p * 100 + '%'; const m = $('#tmsg'); if (m) m.textContent = msg; }, () => { S.nc.training = null; if (S.view === 'nc') updateNC(); toast(L('Neuron Core entrenado', 'Neuron Core trained')); });
};
ACT.retrain = () => { S.ncCache[S.mid] = null; try { localStorage.removeItem(ncKey(S.mid)); } catch (e) { } ACT.train(); };
ACT.optimize = () => { S.nc.busy = true; updateNC(); setTimeout(() => { S.opt = N.optimize(design(), M_(), { iters: 900, seed: S.seed }); S.nc.busy = false; updateNC(); }, 30); };
ACT.applyOpt = () => { if (!S.opt) return; setDesign(JSON.parse(JSON.stringify(S.opt.design))); S.opt = null; toast(L('Recomendación aplicada a tu nave', 'Recommendation applied to your ship')); updateNC(); };

/* ======================= ORBITAL LAB ======================= */
function viewOL() {
  const o = S.ol;
  $('#main').innerHTML = `<div class="pagehead"><h2>ORBITAL LAB</h2><p class="mut">${L('Experimenta con gravedad, velocidad y trayectorias. Todo lo que ves está calculado con las ecuaciones de la mecánica orbital.', 'Experiment with gravity, speed and trajectories. Everything you see is computed with orbital mechanics equations.')}</p></div>
<div class="seg wide">${[['circ', L('Órbita circular', 'Circular orbit')], ['ell', L('Órbita elíptica (vis-viva)', 'Elliptical orbit (vis-viva)')], ['hoh', L('Transferencia de Hohmann', 'Hohmann transfer')]].map(([k, t]) => `<button class="${o.tab === k ? 'on' : ''}" data-act="oltab" data-t="${k}">${t}</button>`).join('')}</div>
<div class="ol"><section class="panel"><canvas id="olc"></canvas></section><section class="panel" id="olp"></section></div>`;
  olControls(); olRead();
  const t0 = performance.now(); startLoop((t) => olDraw($('#olc'), t));
}
ACT.oltab = (t) => { S.ol.tab = t.dataset.t; viewOL(); };
function olBody() { const b = S.ol.body; return { mu: MUS[b], R: RAD[b] }; }
function olControls() {
  const o = S.ol, p = $('#olp'); const rng = (k, lab, min, max, step, unit) => `<div class="ctl"><label>${lab} <b id="v_${k}">${fmt(o[k])} ${unit}</b></label><input type="range" min="${min}" max="${max}" step="${step}" value="${o[k]}" data-ol="${k}"></div>`;
  const maxA = { earth: 40000, moon: 5000, mars: 20000 }[o.body];
  let h = '';
  if (o.tab !== 'hoh') h += `<div class="ctl"><label>${L('Cuerpo central', 'Central body')}</label><div class="seg">${[['earth', L('Tierra', 'Earth')], ['moon', L('Luna', 'Moon')], ['mars', 'Marte']].map(([k, t]) => `<button class="${o.body === k ? 'on' : ''}" data-act="olbody" data-b="${k}">${t}</button>`).join('')}</div></div>`;
  if (o.tab === 'circ') h += rng('alt', L('Altura h', 'Altitude h'), 100, maxA, 50, 'km');
  if (o.tab === 'ell') { h += rng('rp', L('Altura del perigeo', 'Perigee altitude'), 100, maxA, 50, 'km') + rng('ra', L('Altura del apogeo', 'Apogee altitude'), 100, maxA, 50, 'km'); }
  if (o.tab === 'hoh') h += `<div class="ctl"><label>${L('Transferencia', 'Transfer')}</label><div class="seg col">${[['leo', 'LEO 400 km → GEO'], ['moon', L('LEO → Órbita de la Luna', 'LEO → Moon\'s orbit')], ['mars', L('Tierra → Marte (heliocéntrica)', 'Earth → Mars (heliocentric)')], ['cus', L('Personalizada (Tierra)', 'Custom (Earth)')]].map(([k, t]) => `<button class="${o.h === k ? 'on' : ''}" data-act="olh" data-h="${k}">${t}</button>`).join('')}</div></div>` + (o.h === 'cus' ? rng('r1', L('Altura inicial', 'Start altitude'), 200, 40000, 100, 'km') + rng('r2', L('Altura final', 'End altitude'), 200, 400000, 100, 'km') : '');
  p.innerHTML = h + `<div id="olr"></div>`;
  $$('[data-ol]', p).forEach(i => i.addEventListener('input', (e) => { o[e.target.dataset.ol] = +e.target.value; if (o.tab === 'ell' && o.ra < o.rp) { if (e.target.dataset.ol === 'rp') o.ra = o.rp; else o.rp = o.ra; olControls(); } $('#v_' + e.target.dataset.ol).textContent = fmt(o[e.target.dataset.ol]) + ' km'; olRead(); }));
}
S.ol.h = 'leo';
ACT.olbody = (t) => { S.ol.body = t.dataset.b; const m = { earth: [400, 400, 12000], moon: [100, 100, 2000], mars: [300, 300, 20000] }[S.ol.body]; S.ol.alt = m[0]; S.ol.rp = m[1]; S.ol.ra = m[2]; olControls(); olRead(); };
ACT.olh = (t) => { S.ol.h = t.dataset.h; olControls(); olRead(); };
function hohData() {
  const o = S.ol; let mu, r1, r2, body = 'earth', l1, l2;
  if (o.h === 'leo') { mu = MUS.earth; r1 = RAD.earth + 4e5; r2 = 4.2164e7; l1 = 'LEO 400 km'; l2 = 'GEO'; }
  else if (o.h === 'moon') { mu = MUS.earth; r1 = RAD.earth + 4e5; r2 = 3.844e8; l1 = 'LEO'; l2 = L('Órbita lunar', 'Lunar orbit'); }
  else if (o.h === 'mars') { mu = MUS.sun; r1 = N.AU; r2 = 1.5237 * N.AU; body = 'sun'; l1 = L('Tierra', 'Earth'); l2 = 'Marte'; }
  else { mu = MUS.earth; r1 = RAD.earth + o.r1 * 1e3; r2 = RAD.earth + o.r2 * 1e3; l1 = fmt(o.r1) + ' km'; l2 = fmt(o.r2) + ' km'; }
  return { mu, r1, r2, body, l1, l2, h: N.P.hohmann(mu, r1, r2) };
}
function olRead() {
  const o = S.ol, b = olBody(), el = $('#olr'); if (!el) return; const kms = (v) => fmt(v / 1000, 3) + ' km/s';
  if (o.tab === 'circ') {
    const r = b.R + o.alt * 1e3, v = N.P.circVel(b.mu, r), T_ = N.P.period(b.mu, r), ve = N.P.escVel(b.mu, r);
    el.innerHTML = `<div class="eq">v = √(μ / r)</div><div class="eq sm">r = R + h = ${sci(r, 3)} m</div><div class="eq big">v = √(${sci(b.mu, 3)} / ${sci(r, 3)}) = <b>${kms(v)}</b></div><div class="kv"><div><span>${L('Periodo', 'Period')}</span><b>${fmt(T_ / 60, 1)} min</b></div><div><span>${L('Vel. de escape', 'Escape speed')}</span><b>${kms(ve)}</b></div><div><span>v_esc / v</span><b>√2 = ${fmt(ve / v, 3)}</b></div></div>${o.body === 'earth' && o.alt === 400 ? `<div class="verdict okv">✓ ${L('Valor de referencia: 7,67 km/s a 400 km (ISS)', 'Reference value: 7.67 km/s at 400 km (ISS)')}</div>` : ''}<p class="mut sm">${L('A mayor altura la nave va más lenta, pero tarda más en dar la vuelta. Reduce h y observa cómo aumenta la velocidad.', 'Higher up the craft moves slower but takes longer per lap. Lower h and watch the speed rise.')}</p>`;
  } else if (o.tab === 'ell') {
    const rp = b.R + o.rp * 1e3, ra = b.R + Math.max(o.ra, o.rp) * 1e3, E = N.P.ellipse(b.mu, rp, ra);
    el.innerHTML = `<div class="eq">v = √( μ (2/r − 1/a) )</div><div class="eq sm">a = (r<sub>p</sub> + r<sub>a</sub>)/2 = ${sci(E.a, 3)} m · e = ${fmt(E.e, 3)}</div><div class="kv"><div><span>v ${L('perigeo', 'perigee')}</span><b>${kms(E.vp)}</b></div><div><span>v ${L('apogeo', 'apogee')}</span><b>${kms(E.va)}</b></div><div><span>${L('Periodo', 'Period')}</span><b>${fmt(E.T / 60, 1)} min</b></div><div><span>v<sub>p</sub>/v<sub>a</sub></span><b>${fmt(E.vp / E.va, 2)}</b></div></div><p class="mut sm">${L('Segunda ley de Kepler: la nave se acelera al acercarse y frena al alejarse. Observa la velocidad del punto.', 'Kepler\'s second law: the craft speeds up when close and slows when far. Watch the dot\'s speed.')}</p>`;
  } else {
    const H = hohData(), h = H.h, tdays = h.t / 86400;
    el.innerHTML = `<div class="eq">Δv₁ = |v<sub>t1</sub> − v<sub>1</sub>| · Δv₂ = |v<sub>2</sub> − v<sub>t2</sub>|</div><div class="kv"><div><span>Δv₁ (${H.l1})</span><b>${kms(h.dv1)}</b></div><div><span>Δv₂ (${H.l2})</span><b>${kms(h.dv2)}</b></div><div><span>Δv ${L('total', 'total')}</span><b>${kms(h.dv)}</b></div><div><span>${L('Tiempo de vuelo', 'Flight time')}</span><b>${tdays > 2 ? fmt(tdays, 1) + ' ' + L('días', 'days') : fmt(h.t / 3600, 2) + ' h'}</b></div></div><div class="bars2"><div><span>Δv₁</span>${bar(h.dv1 / h.dv, '#ff7a5c')}</div><div><span>Δv₂</span>${bar(h.dv2 / h.dv, '#5ee7ff')}</div></div><p class="mut sm">${o.h === 'mars' ? L('En el sistema Tierra–Marte esta ecuación usa el Sol como cuerpo central y da v∞ de salida y llegada.', 'For Earth–Mars the Sun is the central body; this gives departure and arrival v∞.') : L('Dos impulsos: uno para entrar a la elipse de transferencia y otro para circularizar. Es la transferencia que menos Δv necesita entre dos órbitas circulares coplanares.', 'Two burns: one to enter the transfer ellipse and one to circularize. It is the lowest-Δv transfer between two coplanar circular orbits.')}</p>`;
  }
}
function olDraw(cv, t) {
  if (!cv) return; const { c, w, h } = fit(cv), o = S.ol, b = olBody(); c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, base = Math.min(w, h) * 0.5 - 14;
  if (o.tab === 'hoh') {
    const H = hohData(), r1 = H.r1, r2 = H.r2, Rv = base * 0.13;
    const v1 = Math.max(Rv * 1.4, base * 0.38 * Math.pow(r1 / Math.max(r1, r2), 0.35)), v2 = base * 0.94, a = (v1 + v2) / 2, e = (v2 - v1) / (v2 + v1);
    const col = H.body === 'sun' ? ['#ffd166', '#c4560f'] : BODYC.earth; if (H.body === 'sun') { const g = c.createRadialGradient(cx, cy, 0, cx, cy, Rv * 2); g.addColorStop(0, '#fff2a8'); g.addColorStop(1, 'rgba(255,170,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, Rv * 2, 0, 6.3); c.fill(); c.fillStyle = '#ffd166'; c.beginPath(); c.arc(cx, cy, Rv, 0, 6.3); c.fill(); } else planet(c, cx, cy, Rv, 'earth', 0);
    c.strokeStyle = 'rgba(94,231,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, v1, 0, 6.3); c.stroke(); c.strokeStyle = 'rgba(139,123,255,.5)'; c.beginPath(); c.arc(cx, cy, v2, 0, 6.3); c.stroke();
    // transfer ellipse with the focus at the center: periapsis at right, apoapsis at left
    c.lineWidth = 2;
    c.beginPath(); c.setLineDash([6, 4]); c.strokeStyle = 'rgba(255,184,84,.85)'; c.ellipse(cx - a * e, cy, a, a * Math.sqrt(1 - e * e), 0, 0, 6.3); c.stroke(); c.setLineDash([]);
    const ph = ((t * 0.12) % 1.5); let nu, rr, burn = 0;
    if (ph < 0.25) { const ang = ph / 0.25 * 6.28; nu = ang; rr = v1; burn = ph > 0.2 ? 1 : 0; c.fillStyle = '#5ee7ff'; c.beginPath(); c.arc(cx + rr * Math.cos(ang), cy - rr * Math.sin(ang), 5, 0, 6.3); c.fill(); }
    else if (ph < 1.25) { const f2 = (ph - 0.25), th = keplerNu(e, f2), rr2 = a * (1 - e * e) / (1 + e * Math.cos(th)); c.fillStyle = '#ffb454'; c.beginPath(); c.arc(cx + rr2 * Math.cos(th), cy - rr2 * Math.sin(th), 5, 0, 6.3); c.fill(); }
    else { const ang = 3.1416 + (ph - 1.25) / 0.25 * 6.28; c.fillStyle = '#8b7bff'; c.beginPath(); c.arc(cx + v2 * Math.cos(ang), cy - v2 * Math.sin(ang), 5, 0, 6.3); c.fill(); }
    c.fillStyle = 'rgba(220,235,255,.9)'; c.font = '12px ui-monospace,Consolas,monospace'; c.textAlign = 'left'; c.fillText(H.l1, cx + v1 + 6, cy - 6); c.textAlign = 'right'; c.fillText(H.l2, cx - v2 - 6, cy - 6);
    c.fillStyle = '#ff7a5c'; c.beginPath(); c.arc(cx + v1, cy, 4, 0, 6.3); c.fill(); c.fillText('Δv₁', cx + v1 + 30, cy + 16); c.beginPath(); c.arc(cx - v2, cy, 4, 0, 6.3); c.fill(); c.fillText('Δv₂', cx - v2 - 8, cy + 16);
    return;
  }
  const Rv = base * 0.22, mp = (r) => Rv * Math.pow(r / b.R, 0.62);
  planet(c, cx, cy, Rv, o.body, t * 0.3);
  if (o.tab === 'circ') {
    const r = b.R + o.alt * 1e3, rv = Math.min(base, mp(r)), v = N.P.circVel(b.mu, r), T_ = N.P.period(b.mu, r), th = t * 6.28 / 7;
    c.strokeStyle = 'rgba(94,231,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, rv, 0, 6.3); c.stroke();
    const x = cx + rv * Math.cos(th), y = cy - rv * Math.sin(th); c.fillStyle = '#fff'; c.shadowColor = '#5ee7ff'; c.shadowBlur = 12; c.beginPath(); c.arc(x, y, 5, 0, 6.3); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = '#5ee7ff'; c.lineWidth = 2; const tx = -Math.sin(th), ty = -Math.cos(th); c.beginPath(); c.moveTo(x, y); c.lineTo(x + tx * 36, y + ty * 36); c.stroke();
    c.fillStyle = '#9fe9ff'; c.font = '12px ui-monospace,Consolas,monospace'; c.textAlign = 'left'; c.fillText('v = ' + fmt(v / 1000, 2) + ' km/s', x + 10, y - 8); c.fillStyle = 'rgba(190,205,240,.8)'; c.fillText(L('1 vuelta = ', '1 lap = ') + fmt(T_ / 60, 0) + ' min  →  7 s', 14, h - 14);
  } else {
    const rp = b.R + o.rp * 1e3, ra = b.R + Math.max(o.ra, o.rp) * 1e3, E = N.P.ellipse(b.mu, rp, ra), rpv = mp(rp), rav = Math.min(base, mp(ra) * 1.0), a = (rpv + rav) / 2, e = (rav - rpv) / (rav + rpv);
    c.strokeStyle = 'rgba(94,231,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(cx - a * e, cy, a, a * Math.sqrt(1 - e * e), 0, 0, 6.3); c.stroke();
    const Mn = (t * 6.28 / 9) % 6.2832; let En = Mn; for (let i = 0; i < 20; i++) En = En - (En - E.e * Math.sin(En) - Mn) / (1 - E.e * Math.cos(En));
    const nu = 2 * Math.atan2(Math.sqrt(1 + E.e) * Math.sin(En / 2), Math.sqrt(1 - E.e) * Math.cos(En / 2)), rr = a * (1 - e * e) / (1 + e * Math.cos(nu)), rreal = E.a * (1 - E.e * E.e) / (1 + E.e * Math.cos(nu));
    const x = cx + rr * Math.cos(nu), y = cy - rr * Math.sin(nu), vv = N.P.visViva(b.mu, rreal, E.a);
    c.fillStyle = 'rgba(94,231,255,.1)'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();
    c.fillStyle = '#fff'; c.shadowColor = '#5ee7ff'; c.shadowBlur = 12; c.beginPath(); c.arc(x, y, 5, 0, 6.3); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#9fe9ff'; c.font = '12px ui-monospace,Consolas,monospace'; c.textAlign = 'left'; c.fillText('v = ' + fmt(vv / 1000, 2) + ' km/s', x + 10, y - 8); c.fillStyle = '#ffb454'; c.fillText('v_p ' + fmt(E.vp / 1000, 2), cx + rpv + 8, cy + 14); c.textAlign = 'right'; c.fillText('v_a ' + fmt(E.va / 1000, 2), cx - rav - 8, cy + 14);
  }
}
