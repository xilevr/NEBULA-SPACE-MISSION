/* NEBULA UI part 2 — shell, Mission Control, Ship Designer, Resource Manager */
const VIEWS = [['mc', '01', 'MISSION CONTROL'], ['sd', '02', 'SHIP DESIGNER'], ['rm', '03', 'RESOURCE MANAGER'], ['nc', '04', 'NEURON CORE'], ['ol', '05', 'ORBITAL LAB'], ['sl', '06', 'SCIENCE LAB'], ['ms', '07', 'MISSION SIMULATOR'], ['ma', '08', 'MISSION ANALYTICS']];
const ACT = {};
const dots = (n) => Array.from({ length: 5 }, (_, i) => `<i class="dt ${i < n ? 'on' : ''}"></i>`).join('');
function go(v) { ACT.closeModal(); stopLoops(); S.view = v; renderNav(); render(); window.scrollTo(0, 0); }
function render() { const f = { mc: viewMC, sd: viewSD, rm: viewRM, nc: viewNC, ol: viewOL, sl: viewSL, ms: viewMS, ma: viewMA }[S.view]; $('#main').innerHTML = ''; f(); }
function renderNav() {
  $('#nav').innerHTML = VIEWS.map(([k, n, t]) => `<button class="nb ${S.view === k ? 'on' : ''}" data-act="go" data-v="${k}"><b>${n}</b><span>${t}</span></button>`).join('');
  $('#lang').textContent = S.lang === 'es' ? 'EN' : 'ES';
}
document.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (t && ACT[t.dataset.act]) { e.preventDefault(); ACT[t.dataset.act](t, e); } });
ACT.go = (t) => go(t.dataset.v);
ACT.lang = () => { S.lang = S.lang === 'es' ? 'en' : 'es'; save(); renderNav(); const keep = S.view; if (keep === 'ms' && S.sim && !S.sim.over) { render(); } else render(); };
ACT.about = () => showModal(`<h2>${L('Honestidad científica', 'Scientific honesty')}</h2>
<p>${L('NEBULA es un <b>simulador educativo</b>, no un sistema de navegación real. Lo que sí es real:', 'NEBULA is an <b>educational simulator</b>, not an operational navigation system. What <i>is</i> real:')}</p>
<ul><li>${L('Velocidad orbital circular v = √(μ/r), vis-viva, transferencias de Hohmann y ecuación del cohete de Tsiolkovski.', 'Circular orbital speed v = √(μ/r), vis-viva, Hohmann transfers and the Tsiolkovsky rocket equation.')}</li><li>${L('Enlace de radio con la ecuación de Friis (potencia, ganancia de antenas, distancia, ruido) y latencia t = d/c.', 'Radio link with the Friis equation (power, antenna gain, distance, noise) and latency t = d/c.')}</li><li>${L('Balance de energía E = P·t con eclipses, baterías y distancia al Sol (ley del inverso del cuadrado).', 'Energy balance E = P·t with eclipses, batteries and distance from the Sun (inverse-square law).')}</li></ul>
<p>${L('Lo simplificado: órbitas de dos cuerpos, impulsos instantáneos para motores químicos, sin perturbaciones ni ventanas de lanzamiento. Los valores de masa y costo son didácticos. <b>El Neuron Core</b> aprende de simulaciones registradas y se evalúa con datos de prueba; las reglas deterministas se marcan aparte de las predicciones.', 'Simplified: two-body orbits, instantaneous burns for chemical engines, no perturbations or launch windows. Mass and cost values are didactic. <b>The Neuron Core</b> learns from recorded simulations and is evaluated on held-out data; deterministic rules are labelled separately from predictions.')}</p>`);
function showModal(html, cls) { const m = $('#modal'); m.innerHTML = `<div class="mbox ${cls || ''}"><button class="mx" data-act="closeModal">✕</button>${html}</div>`; m.classList.add('on'); }
ACT.closeModal = () => { $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; };

/* ======================= MISSION CONTROL ======================= */
function viewMC() {
  const M = M_(), cat = N.CAT_BY_ID;
  const cards = N.MISSIONS.map(m => `<div class="mcard ${m.id === S.mid ? 'sel' : ''}" data-act="pickM" data-id="${m.id}"><div class="pl ${m.body}"><i></i></div><div class="mt">${m.name}</div><div class="msub">${T(m.target)}</div><div class="dif">${dots(m.diff)}<em>${T(m.tag)}</em></div><div class="mk"><span>💰 ${cr(m.budget)}</span><span>⚖ ≤${m.launchers[2].cap} kg</span><span>⏱ ${m.duration} ${L('días', 'days')}</span></div></div>`).join('');
  const mans = M.maneuvers.map(x => `<tr><td>${T(x)}</td><td class="n">${fmt(x.dv, 1)} m/s</td></tr>`).join('');
  const reqChem = M.dvCrit * 1.05 + M.dvReserve, reqIon = M.dvCrit * M.lowThrust * 1.05 + M.dvReserve;
  const objs = M.objectives.map(o => `<li><b>${T(o)}</b> <span class="mut">→ ${T(cat[o.inst])}</span></li>`).join('');
  const lau = M.launchers.map(l => `<span class="chip">${l.name} · ${l.cap} kg · ${cr(l.cost)}</span>`).join('');
  $('#main').innerHTML = `<div class="hero"><div><div class="kick">${L('Reto Space Mission Design Game · NASA Space Apps', 'Space Mission Design Game · NASA Space Apps')}</div><h1>NEBULA</h1><div class="tag">${L('Diseña. Calcula. Experimenta. Simula. Optimiza.', 'Design. Calculate. Experiment. Simulate. Optimize.')}</div><p class="lead">${L('Cada decisión de ingeniería cambia el destino de la misión: <b>masa, energía, presupuesto, comunicaciones y órbita</b> están conectados por física real, y una neurona artificial explica por qué tu diseño funcionará… o no.', 'Every engineering decision changes the fate of the mission: <b>mass, power, budget, communications and orbit</b> are linked by real physics, and an artificial neuron explains why your design will work… or won\'t.')}</p>
<div class="loop">${[['🛰', L('Elige misión', 'Pick mission')], ['🔧', L('Diseña la nave', 'Build ship')], ['🧠', L('Valida con IA', 'Validate with AI')], ['🧮', L('Calcula y experimenta', 'Calculate & test')], ['🚀', L('Lanza y decide', 'Launch & decide')], ['📊', L('Analiza', 'Analyze')]].map((x, i) => `<div class="ls"><span>${x[0]}</span>${x[1]}</div>`).join('<i class="la">›</i>')}</div></div>
<div class="heroart"><div class="orb"></div><div class="ring1"></div><div class="ring2"></div><div class="sat"></div></div></div>
<h3 class="sec">${L('1 · Elige tu misión', '1 · Choose your mission')}</h3><div class="mcards">${cards}</div>
<div class="grid2"><section class="panel"><div class="ph"><h3>${M.name}</h3>${badge(T(M.tag), '#ffb454')}</div><p>${T(M.brief)}</p>
<div class="kv"><div><span>${L('Presupuesto', 'Budget')}</span><b>${cr(M.budget)} ${L('créd.', 'cr.')}</b></div><div><span>${L('Masa máxima', 'Max mass')}</span><b>${M.launchers[2].cap} kg</b></div><div><span>${L('Duración', 'Duration')}</span><b>${M.duration} ${L('días', 'days')}</b></div><div><span>${L('Inyección', 'Injection')}</span><b>${T(M.injection)}</b></div><div><span>${L('Tránsito', 'Transit')}</span><b>${M.transit ? fmt(M.transit, 1) + ' ' + L('días', 'days') : L('sin tránsito', 'none')}</b></div><div><span>${L('Comunicación', 'Comms')}</span><b>${L('obligatoria', 'mandatory')}</b></div></div>
<h4>${L('Objetivos científicos', 'Science objectives')} <small>(${L('necesitas ≥', 'need ≥')}${M.minObj})</small></h4><ul class="objs">${objs}</ul>
<h4>${L('Lanzadores disponibles', 'Available launchers')}</h4><div>${lau}</div></section>
<section class="panel"><div class="ph"><h3>${L('Δv de la misión (calculado)', 'Mission Δv (computed)')}</h3>${badge(L('FÍSICA REAL', 'REAL PHYSICS'), '#3ddc97')}</div>
<table class="tb"><tbody>${mans}<tr><td>${L('Reserva (mantenimiento)', 'Reserve (station-keeping)')}</td><td class="n">${fmt(M.dvReserve)} m/s</td></tr><tr class="tot"><td>${L('Requerido · motor químico (+5 %)', 'Required · chemical (+5%)')}</td><td class="n">${fmt(reqChem)} m/s</td></tr><tr class="tot"><td>${L('Requerido · propulsor iónico (espiral ×', 'Required · ion thruster (spiral ×')}${M.lowThrust})</td><td class="n">${fmt(reqIon)} m/s</td></tr></tbody></table>
<p class="mut sm">${T(M.physics.note)} ${M.physics.vinf ? L('Velocidad de llegada v∞ = ', 'Arrival speed v∞ = ') + fmt(M.physics.vinf, 0) + ' m/s.' : ''}</p>
<h4>${L('Modo de juego', 'Game mode')}</h4><div class="seg"><button class="${!S.twin ? 'on' : ''}" data-act="mode" data-m="0">${L('Solo', 'Solo')}</button><button class="${S.twin ? 'on' : ''}" data-act="mode" data-m="1">👯 Twin Mission</button></div>
<p class="mut sm">${S.twin ? L('Dos naves (A y B), misma misión, mismo presupuesto y <b>mismos eventos</b>. El simulador las ejecuta bajo las mismas condiciones y compara.', 'Two ships (A and B), same mission, same budget and <b>same events</b>. The simulator runs both under identical conditions and compares.') : L('Diseñas una nave y tú decides en cada emergencia durante el viaje.', 'You design one ship and make the call in every in-flight emergency.')}</p>
<h4>${L('Semilla de eventos', 'Event seed')}</h4><div class="row"><input id="seed" class="inp" type="number" value="${S.seed}"><button class="btn sm" data-act="dice">🎲</button><span class="mut sm">${L('Misma semilla = mismos eventos aleatorios (reproducible).', 'Same seed = same random events (reproducible).')}</span></div>
<div class="cta"><button class="btn pri" data-act="go" data-v="sd">${L('Comenzar el diseño →', 'Start designing →')}</button><button class="btn" data-act="reset">${L('Restablecer nave inicial', 'Reset starter ship')}</button></div></section></div>
<div class="foot"><button class="lnk" data-act="about">ⓘ ${L('Honestidad científica y límites del modelo', 'Scientific honesty & model limits')}</button></div>`;
  $('#seed').addEventListener('change', (e) => { S.seed = parseInt(e.target.value) || 1; save(); });
}
ACT.pickM = (t) => { S.mid = t.dataset.id; S.opt = null; S.sim = null; S.report = null; save(); viewMC(); };
ACT.mode = (t) => { S.twin = t.dataset.m === '1'; S.cur = 'A'; save(); viewMC(); };
ACT.dice = () => { S.seed = Math.floor(Math.random() * 90000) + 1000; $('#seed').value = S.seed; save(); };
ACT.reset = () => { S.designs[S.mid] = {}; S.opt = null; save(); toast(L('Nave inicial restablecida', 'Starter ship reset')); };

/* ======================= SHIP DESIGNER ======================= */
const shipView = { yaw: 0.6, pit: 0.28, drag: false, last: 0, auto: true };
function viewSD() {
  const M = M_();
  $('#main').innerHTML = `<div class="sd"><section class="panel cat"><div class="tabs" id="cattabs"></div><div id="catalog"></div></section>
<section class="panel mid"><div class="midtop"><div id="slots"></div><div class="row"><span class="mut sm">${L('Lanzador', 'Launcher')}</span><div id="launch" class="pills"></div></div></div>
<div class="shipwrap"><canvas id="ship"></canvas><div id="chips" class="chips"></div><div class="hint">${L('Arrastra para girar la nave', 'Drag to rotate the ship')}</div></div>
<div class="propw"><label>${L('Propelente', 'Propellant')} <b id="pv"></b></label><input id="prop" type="range" min="0" max="1000" step="5"><div class="mut sm" id="pnote"></div></div><div id="aistrip" class="aistrip"></div></section>
<section class="panel stats"><div id="stats"></div></section></div>`;
  const cv = $('#ship');
  cv.addEventListener('pointerdown', (e) => { shipView.drag = true; shipView.auto = false; shipView.last = e.clientX; shipView.ly = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!shipView.drag) return; shipView.yaw += (e.clientX - shipView.last) * 0.012; shipView.pit = clamp(shipView.pit + (e.clientY - shipView.ly) * 0.008, -1.2, 1.2); shipView.last = e.clientX; shipView.ly = e.clientY; });
  cv.addEventListener('pointerup', () => { shipView.drag = false; setTimeout(() => { if (!shipView.drag) shipView.auto = true; }, 2500); });
  $('#prop').addEventListener('input', (e) => { design().prop = +e.target.value; save(); updatePropLabel(); updateStats(); });
  startLoop((t) => { if (shipView.auto) shipView.yaw += 0.006; drawShip(cv, design(), M_(), shipView.yaw, shipView.pit, t); });
  updateSD();
}
function updatePropLabel() { const e = evalCur(); $('#pv').textContent = fmt(design().prop) + ' kg'; $('#pnote').textContent = L('Tanque ', 'Tank ') + fmt(e.tank, 1) + ' kg · ' + L('costo ', 'cost ') + cr(e.byCat.prop) + (e.en ? ' · Δv ' + fmt(e.dvAvail) + ' / ' + fmt(e.dvReq) + ' m/s' : ''); }
function updateSD() {
  const M = M_(), d = design(), e = N.evaluate(d, M);
  $('#slots').innerHTML = S.twin ? `<div class="seg">${['A', 'B'].map(k => `<button class="${S.cur === k ? 'on' : ''}" data-act="slot" data-k="${k}">${L('Nave', 'Ship')} ${k}</button>`).join('')}<button data-act="copyAB" title="${L('Copiar a la otra nave', 'Copy to the other ship')}">⇄</button></div>` : `<div class="pt">${M.name}</div>`;
  $('#launch').innerHTML = M.launchers.map(l => `<button class="pill ${d.launcher === l.id ? 'on' : ''}" data-act="launcher" data-id="${l.id}">${l.name}<small>${l.cap} kg · ${cr(l.cost)}</small></button>`).join('');
  $('#prop').max = Math.max(300, e.L.cap); $('#prop').value = d.prop;
  // catalog
  $('#cattabs').innerHTML = N.CATS.map(c => { const n = N.CATALOG.filter(x => x.cat === c.id).reduce((a, x) => a + N.qtyOf(d, x.id), 0); return `<button class="ct ${S.tab === c.id ? 'on' : ''}" data-act="tab" data-t="${c.id}" title="${T(c)}"><span>${c.ic}</span><small>${T(c)}</small>${n ? `<i>${n}</i>` : ''}</button>`; }).join('');
  const cat = N.CATS.find(c => c.id === S.tab);
  $('#catalog').innerHTML = `<div class="chd">${cat.ic} ${T(cat)} ${cat.single ? `<small>${cat.optional ? L('opcional', 'optional') : L('elige uno', 'pick one')}</small>` : ''}</div>` + N.CATALOG.filter(x => x.cat === S.tab).map(c => {
    const q = N.qtyOf(d, c.id), on = q > 0, obj = c.obj ? M.objectives.find(o => o.inst === c.id) : null;
    const ctl = cat.single ? `<button class="btn sm ${on ? 'pri' : ''}" data-act="pick" data-id="${c.id}">${on ? (cat.optional ? L('Quitar', 'Remove') : '✓ ' + L('Elegido', 'Selected')) : L('Elegir', 'Select')}</button>` : `<div class="qty"><button data-act="qty" data-id="${c.id}" data-d="-1">−</button><b>${q}</b><button data-act="qty" data-id="${c.id}" data-d="1">+</button></div>`;
    return `<div class="item ${on ? 'on' : ''}"><div class="in"><b>${T(c)}</b><div class="mut sm">${T(c.d)}</div>${c.obj ? `<div class="sm ${obj ? 'ok' : 'mut'}">${obj ? '◎ ' + L('Cubre: ', 'Covers: ') + T(obj) : L('No requerido en esta misión', 'Not required in this mission')}</div>` : ''}<div class="stt"><span>⚖ ${fmt(c.mass)} kg</span><span>💰 ${fmt(c.cost, 2)} M</span>${c.pw ? `<span>⚡ −${fmt(c.pw)} W</span>` : ''}${c.gen ? `<span class="ok">☀ +${fmt(c.gen)} W</span>` : ''}</div></div>${ctl}</div>`;
  }).join('');
  $('#chips').innerHTML = `<span class="chip ${e.m0 > e.L.cap ? 'bad' : ''}">⚖ ${fmt(e.m0)} kg</span><span class="chip ${e.cost > M.budget ? 'bad' : ''}">💰 ${cr(e.cost)}</span><span class="chip ${e.genAvg < e.loadSci ? 'warn' : ''}">⚡ ${fmt(e.genAvg)}/${fmt(e.loadSci)} W</span><span class="chip ${e.dvAvail < e.dvReq ? 'bad' : ''}">Δv ${fmt(e.dvAvail)} m/s</span>`;
  updatePropLabel(); updateStats();
}
function ratioRow(label, val, pct, col, note) { return `<div class="sr"><div class="srt"><span>${label}</span><b>${val}</b></div>${bar(pct, col)}<div class="mut sm">${note || ''}</div></div>`; }
function updateStats() {
  const M = M_(), e = evalCur(), nc = e.diag.filter(x => x.sev === 'critical').length, nh = e.diag.filter(x => x.sev === 'high').length;
  const gp = e.loadSci > 0 ? e.genAvg / e.loadSci : 0;
  $('#stats').innerHTML = `<h3>${L('Ingeniería en vivo', 'Live engineering')}</h3>` +
    ratioRow(L('Masa de lanzamiento', 'Launch mass'), `${fmt(e.m0)} / ${e.L.cap} kg`, e.m0 / e.L.cap, e.m0 > e.L.cap ? '#ff5d73' : '#5ee7ff', `${L('masa seca', 'dry mass')} ${fmt(e.dry)} kg · ${L('margen', 'margin')} ${fmt(e.massMargin)} kg`) +
    ratioRow(L('Presupuesto', 'Budget'), `${cr(e.cost)} / ${cr(M.budget)}`, e.cost / M.budget, e.cost > M.budget ? '#ff5d73' : '#8b7bff', `${L('disponible', 'left')} ${cr(e.budgetLeft)}`) +
    ratioRow(L('Energía (generada / consumida)', 'Power (generated / drawn)'), `${fmt(e.genAvg)} / ${fmt(e.loadSci)} W`, gp / 1.5, gp < 1 ? '#ffb454' : '#3ddc97', `${gp < 1 ? L('déficit', 'deficit') : L('superávit', 'surplus')} ${fmt(Math.abs(e.genAvg - e.loadSci))} W · ${L('eclipse', 'eclipse')} ${fmt(M.ecl * 100)}%`) +
    ratioRow('Δv', `${fmt(e.dvAvail)} / ${fmt(e.dvReq)} m/s`, e.dvReq ? e.dvAvail / e.dvReq / 1.5 : 0, e.dvAvail < e.dvReq ? '#ff5d73' : '#3ddc97', `v<sub>e</sub> = ${fmt(e.ve)} m/s`) +
    ratioRow(L('Margen estructural', 'Structural margin'), `${fmt(e.supportMargin, 2)}×`, e.supportMargin / 2, e.supportMargin < 1 ? '#ff5d73' : e.supportMargin < 1.15 ? '#ffb454' : '#3ddc97', '') +
    ratioRow(L('Margen térmico', 'Thermal margin'), `${fmt(e.thermalRatio, 2)}×`, e.thermalRatio / 2, e.thermalRatio < 1 ? '#ffb454' : '#3ddc97', '') +
    ratioRow(L('Enlace de datos', 'Data link'), `${fmt(e.capMB)} MB/${L('día', 'day')}`, clamp(e.dataRatio / 2, 0, 1), e.dataRatio < 1 ? '#ffb454' : '#3ddc97', `${L('necesario', 'needed')} ≈ ${fmt(e.targetTotal / M.targetDays)} MB/${L('día', 'day')}`) +
    ratioRow(L('Tiempo de ciencia', 'Science time'), `${Number.isFinite(e.scienceDays) ? fmt(Math.max(0, e.scienceDays)) : 0} ${L('días', 'days')}`, clamp(e.scienceDays / M.duration, 0, 1), e.scienceDays < 20 ? '#ffb454' : '#3ddc97', `${L('inserción', 'insertion')}: ${Number.isFinite(e.insDays) ? fmt(e.insDays, 1) : '∞'} ${L('d', 'd')}`) +
    `<div class="verdict ${e.valid ? 'okv' : 'badv'}">${e.valid ? '✓ ' + L('Listo para lanzamiento', 'Ready for launch') : '✕ ' + nc + ' ' + L('restricción(es) crítica(s)', 'critical constraint(s)')}${nh ? ` · ${nh} ${L('alerta(s) alta(s)', 'high alert(s)')}` : ''}</div>` +
    `<div class="diag">${e.diag.slice(0, 7).map(x => `<details class="dg" style="--c:${SEVC[x.sev]}"><summary><i></i><span>${T(x.msg)}</span></summary><div class="dgb"><div>${badge(L('REGLA COMPROBADA', 'VERIFIED RULE'), '#5ee7ff')} <code>${x.code}</code></div><p>${T(x.why)}</p><p class="ok">➜ ${T(x.fix)}</p></div></details>`).join('') || `<div class="mut sm">${L('Sin alertas. Neuron Core no detecta problemas.', 'No alerts. Neuron Core finds no issues.')}</div>`}</div>` +
    `<div class="cta col"><button class="btn" data-act="go" data-v="nc">🧠 ${L('Validar con NEURON CORE', 'Validate with NEURON CORE')}</button><button class="btn" data-act="go" data-v="rm">📊 ${L('Resource Manager', 'Resource Manager')}</button><button class="btn pri" data-act="launchNow" ${S.twin || e.valid ? '' : 'disabled'}>${S.twin ? L('Ir a Twin Mission →', 'Go to Twin Mission →') : '🚀 ' + L('Lanzar misión', 'Launch mission')}</button></div>`;
}
ACT.slot = (t) => { S.cur = t.dataset.k; updateSD(); };
ACT.copyAB = () => { const o = S.cur === 'A' ? 'B' : 'A'; setDesign(JSON.parse(JSON.stringify(design(S.cur))), o); toast(L('Diseño copiado a la nave ', 'Design copied to ship ') + o); };
ACT.tab = (t) => { S.tab = t.dataset.t; updateSD(); };
ACT.launcher = (t) => { design().launcher = t.dataset.id; save(); updateSD(); };
ACT.pick = (t) => { const id = t.dataset.id, c = N.CAT_BY_ID[id], cat = N.CATS.find(x => x.id === c.cat), on = N.qtyOf(design(), id) > 0; setDesign(N.setItem(design(), id, cat.optional && on ? 0 : 1)); updateSD(); };
ACT.qty = (t) => { const id = t.dataset.id; setDesign(N.setItem(design(), id, N.qtyOf(design(), id) + (+t.dataset.d))); updateSD(); };
ACT.launchNow = () => {
  const e = evalCur();
  if (S.twin) { const a = N.evaluate(design('A'), M_()), b = N.evaluate(design('B'), M_()); if (!a.valid || !b.valid) { toast(L('Ambas naves deben superar las validaciones obligatorias', 'Both ships must pass the mandatory validations'), 'bad'); return; } }
  else if (!e.valid) { toast(L('Resuelve las restricciones críticas primero', 'Resolve critical constraints first'), 'bad'); return; }
  S.sim = null; S.simB = null; S.report = null; go('ms');
};

/* ======================= RESOURCE MANAGER ======================= */
function viewRM() {
  const M = M_(), e = evalCur(), gp = e.loadSci > 0 ? e.genAvg / e.loadSci : 0;
  const seg = (obj, cols, unit, tot) => { const ks = Object.keys(obj).filter(k => obj[k] > 0.0001); return `<div class="stack">${ks.map(k => `<i style="width:${obj[k] / tot * 100}%;background:${cols[k] || '#789'}" title="${k}: ${fmt(obj[k], 2)} ${unit}"></i>`).join('')}</div><div class="leg">${ks.map(k => `<span><i style="background:${cols[k] || '#789'}"></i>${labelCat(k)} <b>${fmt(obj[k], unit === 'kg' ? 0 : 2)}</b></span>`).join('')}</div>`; };
  const cols = { structure: '#c9a24a', prop: '#ff7a5c', power: '#3b82f6', battery: '#3ddc97', comm: '#8b7bff', computer: '#5ee7ff', thermal: '#f59e0b', instrument: '#ff5fa8', shield: '#94a3b8', tank: '#a9b4c4', fuel: '#ef4444', launcher: '#64748b' };
  const mass = Object.assign({}, e.massCat); const costs = Object.assign({}, e.byCat);
  const loads = [[L('Sistemas base', 'Base systems'), 25], [L('Computadora', 'Computer'), e.cp ? e.cp.pw : 0], [L('Control térmico', 'Thermal'), e.th ? e.th.pw : 0], [L('Antena (35 % de uso)', 'Antenna (35% duty)'), e.an ? e.an.pw * 0.35 : 0], [L('Instrumentos', 'Instruments'), e.loadSci - e.nonShed], [L('Motor (en espera)', 'Engine (standby)'), e.en ? (e.ion ? 10 : e.en.pw * 0.5) : 0]];
  const arr = Math.max(M.transit, M.commission), ins = Number.isFinite(e.insDays) ? e.insDays : M.duration, sci = Math.max(0, e.scienceDays);
  const tl = [[L('Comisionamiento/Tránsito', 'Commissioning/Transit'), arr, '#8b7bff'], [L('Inserción orbital', 'Orbit insertion'), ins, '#ff7a5c'], [L('Ciencia', 'Science'), sci, '#3ddc97']];
  const tt = tl.reduce((a, x) => a + x[1], 0);
  $('#main').innerHTML = `<div class="pagehead"><h2>${L('Resource Manager', 'Resource Manager')}</h2><p class="mut">${L('Los seis recursos que gobiernan la misión: masa, presupuesto, energía, combustible (Δv), tiempo y capacidad del lanzador. ', 'The six resources that govern the mission: mass, budget, power, propellant (Δv), time and launcher capacity. ')}${S.twin ? `<span class="seg inl">${['A', 'B'].map(k => `<button class="${S.cur === k ? 'on' : ''}" data-act="slotRM" data-k="${k}">${L('Nave', 'Ship')} ${k}</button>`).join('')}</span>` : ''}</p></div>
<div class="rings panel">${ring(e.m0 / e.L.cap, 'cap', L('Masa', 'Mass'), fmt(e.m0 / e.L.cap * 100) + '%', `${fmt(e.m0)} / ${e.L.cap} kg`)}${ring(e.cost / M.budget, 'cap', L('Presupuesto', 'Budget'), fmt(e.cost / M.budget * 100) + '%', `${cr(e.cost)} / ${cr(M.budget)}`)}${ring(gp / 1.5, gp < 1 ? '#ffb454' : '#3ddc97', L('Energía', 'Power'), fmt(gp * 100) + '%', `${fmt(e.genAvg)} / ${fmt(e.loadSci)} W`)}${ring(e.dvReq ? e.dvAvail / e.dvReq / 1.5 : 0, e.dvAvail < e.dvReq ? '#ff5d73' : '#3ddc97', 'Δv', fmt(e.dvReq ? e.dvAvail / e.dvReq * 100 : 0) + '%', `${fmt(e.dvAvail)} / ${fmt(e.dvReq)} m/s`)}${ring(clamp(e.scienceDays / M.duration, 0, 1), '#8b7bff', L('Tiempo', 'Time'), fmt(Math.max(0, e.scienceDays)) + 'd', L('días de ciencia', 'science days'))}${ring(e.m0 > 0 ? e.prop / e.m0 : 0, '#ff7a5c', L('Propelente', 'Propellant'), fmt(e.m0 > 0 ? e.prop / e.m0 * 100 : 0) + '%', `${fmt(e.prop)} kg`)}</div>
<div class="grid2"><section class="panel"><h3>${L('Masa por subsistema', 'Mass by subsystem')}</h3>${seg(Object.assign({}, mass), cols, 'kg', e.m0)}<h3 class="mt">${L('Costo por subsistema', 'Cost by subsystem')} (M)</h3>${seg(costs, cols, 'M', e.cost)}</section>
<section class="panel"><h3>${L('Presupuesto de potencia', 'Power budget')}</h3><table class="tb"><tbody>${loads.map(l => `<tr><td>${l[0]}</td><td class="n">${fmt(l[1])} W</td></tr>`).join('')}<tr class="tot"><td>${L('Consumo en fase científica', 'Science-phase draw')}</td><td class="n">${fmt(e.loadSci)} W</td></tr><tr><td>${L('Generación bruta', 'Gross generation')} (${fmt(M.sunAU, 2)} UA)</td><td class="n">${fmt(e.gen)} W</td></tr><tr class="tot"><td>${L('Generación media (con eclipse)', 'Mean generation (with eclipse)')}</td><td class="n ${e.genAvg < e.loadSci ? 'bad' : 'ok'}">${fmt(e.genAvg)} W</td></tr></tbody></table>
<p class="mut sm">E = P·t · ${L('eclipse', 'eclipse')}: ${fmt(e.eclHours * 60)} min/${L('órbita', 'orbit')} · ${L('batería útil', 'usable battery')} ${fmt(e.batUse)} Wh ${L('vs', 'vs')} ${fmt(e.eclNeed)} Wh</p></section></div>
<section class="panel"><h3>${L('Línea de tiempo de la misión', 'Mission timeline')} (${M.duration} ${L('días', 'days')})</h3><div class="stack tl">${tl.map(x => `<i style="width:${x[1] / Math.max(tt, M.duration) * 100}%;background:${x[2]}"><span>${x[0]}: ${fmt(x[1], 1)} d</span></i>`).join('')}</div>
<p class="mut sm">t = m·Δv/F · ${e.ion ? L('El propulsor iónico empuja con muy poca fuerza: la espiral de inserción consume calendario.', 'The ion thruster has very little thrust: the insertion spiral eats the schedule.') : L('Los motores químicos entregan el Δv en minutos.', 'Chemical engines deliver the Δv in minutes.')}</p></section>`;
}
ACT.slotRM = (t) => { S.cur = t.dataset.k; viewRM(); };
function labelCat(k) { const c = N.CATS.find(x => x.id === k); return c ? T(c) : ({ tank: L('Tanque', 'Tank'), fuel: L('Propelente', 'Propellant'), launcher: L('Lanzador', 'Launcher') }[k] || k); }
