/* NEBULA engine — physics, catalog, missions, evaluation, simulation, Neuron Core (rules + MLP). Pure JS, no deps. */
(function (root) {
'use strict';
const MU = { earth: 3.986004418e14, moon: 4.9048695e12, mars: 4.282837e13, sun: 1.32712440018e20 };
const RAD = { earth: 6.371e6, moon: 1.7374e6, mars: 3.3895e6 };
const AU = 1.495978707e11, C = 299792458, G0 = 9.80665, KB = 1.380649e-23, DAY = 86400;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- Physics ---------- */
const P = {
  circVel: (mu, r) => Math.sqrt(mu / r),
  escVel: (mu, r) => Math.sqrt(2 * mu / r),
  period: (mu, r) => 2 * Math.PI * Math.sqrt(r * r * r / mu),
  visViva: (mu, r, a) => Math.sqrt(mu * (2 / r - 1 / a)),
  ellipse(mu, rp, ra) { const a = (rp + ra) / 2; return { a, e: (ra - rp) / (ra + rp), vp: P.visViva(mu, rp, a), va: P.visViva(mu, ra, a), T: 2 * Math.PI * Math.sqrt(a * a * a / mu) }; },
  hohmann(mu, r1, r2) {
    const a = (r1 + r2) / 2, v1 = P.circVel(mu, r1), v2 = P.circVel(mu, r2);
    const vt1 = P.visViva(mu, r1, a), vt2 = P.visViva(mu, r2, a);
    const dv1 = Math.abs(vt1 - v1), dv2 = Math.abs(v2 - vt2);
    return { dv1, dv2, dv: dv1 + dv2, t: Math.PI * Math.sqrt(a * a * a / mu), a, vt1, vt2, v1, v2 };
  },
  captureDv(mu, rp, vinf, ra) { const vh = Math.sqrt(vinf * vinf + 2 * mu / rp); const vt = ra ? P.visViva(mu, rp, (rp + ra) / 2) : P.circVel(mu, rp); return vh - vt; },
  tsiolkovskyDv: (ve, m0, mf) => ve * Math.log(m0 / mf),
  propellantFor: (dv, ve, mf) => mf * (Math.exp(dv / ve) - 1),
  eclipseFrac: (R, r) => Math.asin(R / r) / Math.PI,
  latency: (d) => d / C,
  linkRate({ Pt, Gt, Gr, d, T, ebn0, margin, lambda }) { const fs = Math.pow(lambda / (4 * Math.PI * d), 2); return Pt * Gt * Gr * fs / (KB * T * ebn0 * margin); },
  dishGain: (D, lambda, eta) => (eta || 0.6) * Math.pow(Math.PI * D / lambda, 2),
};
const LAMBDA = 0.0357; // X-band 8.4 GHz

/* ---------- Catalog ---------- */
const CATS = [
  { id: 'structure', single: true, es: 'Estructura', en: 'Structure', ic: '▣' },
  { id: 'prop', single: true, es: 'Propulsión', en: 'Propulsion', ic: '➤' },
  { id: 'power', es: 'Paneles solares', en: 'Solar panels', ic: '☀', max: 8 },
  { id: 'battery', es: 'Baterías', en: 'Batteries', ic: '▮', max: 6 },
  { id: 'comm', single: true, es: 'Comunicación', en: 'Communication', ic: '⌁' },
  { id: 'computer', single: true, es: 'Computadora', en: 'Computer', ic: '▤' },
  { id: 'thermal', single: true, es: 'Control térmico', en: 'Thermal control', ic: '♨' },
  { id: 'instrument', es: 'Instrumentos', en: 'Instruments', ic: '◉', max: 1 },
  { id: 'shield', single: true, optional: true, es: 'Blindaje', en: 'Shielding', ic: '⛨' },
];
// mass kg, cost M credits, pw W (consumption) , gen W @1AU
const K = (id, cat, es, en, mass, cost, x) => Object.assign({ id, cat, es, en, mass, cost, pw: 0 }, x || {});
const CATALOG = [
  K('s_light', 'structure', 'Bus ligero Al-Li', 'Light Al-Li bus', 85, 0.40, { support: 650, d: { es: 'Soporta ≤650 kg de lanzamiento', en: 'Supports ≤650 kg at launch' } }),
  K('s_std', 'structure', 'Bus estándar', 'Standard bus', 120, 0.65, { support: 1050, d: { es: 'Soporta ≤1.050 kg', en: 'Supports ≤1,050 kg' } }),
  K('s_heavy', 'structure', 'Bus reforzado de compuesto', 'Reinforced composite bus', 170, 1.05, { support: 1800, d: { es: 'Soporta ≤1.800 kg', en: 'Supports ≤1,800 kg' } }),
  K('p_mono', 'prop', 'Monopropelente (hidracina)', 'Monopropellant (hydrazine)', 18, 0.45, { isp: 230, thrust: 220, pw: 25, d: { es: 'Isp 230 s · 220 N · barato', en: 'Isp 230 s · 220 N · cheap' } }),
  K('p_bi', 'prop', 'Bipropelente', 'Bipropellant', 38, 0.95, { isp: 315, thrust: 450, pw: 40, d: { es: 'Isp 315 s · 450 N', en: 'Isp 315 s · 450 N' } }),
  K('p_ion', 'prop', 'Propulsor iónico (xenón)', 'Ion thruster (xenon)', 32, 1.8, { isp: 2600, thrust: 0.12, pw: 1800, ion: 1, d: { es: 'Isp 2600 s · 0,12 N · exige 1,8 kW', en: 'Isp 2600 s · 0.12 N · needs 1.8 kW' } }),
  K('p_ionh', 'prop', 'Iónico de alta potencia', 'High-power ion thruster', 60, 3.4, { isp: 2900, thrust: 0.30, pw: 3600, ion: 1, d: { es: 'Isp 2900 s · 0,30 N · exige 3,6 kW', en: 'Isp 2900 s · 0.30 N · needs 3.6 kW' } }),
  K('pn_s', 'power', 'Panel solar rígido', 'Rigid solar panel', 13, 0.40, { gen: 150, d: { es: '150 W a 1 UA', en: '150 W at 1 AU' } }),
  K('pn_l', 'power', 'Panel desplegable grande', 'Large deployable array', 33, 1.00, { gen: 420, d: { es: '420 W a 1 UA', en: '420 W at 1 AU' } }),
  K('b_li', 'battery', 'Batería Li-ion 350 Wh', 'Li-ion battery 350 Wh', 11, 0.28, { wh: 350, d: { es: '350 Wh (80 % utilizable)', en: '350 Wh (80% usable)' } }),
  K('a_lga', 'comm', 'Antena de baja ganancia', 'Low-gain antenna', 3, 0.10, { pw: 20, ptx: 8, gdb: 6, d: { es: '8 W · 6 dBi', en: '8 W · 6 dBi' } }),
  K('a_mga', 'comm', 'Antena de ganancia media', 'Medium-gain antenna', 8, 0.30, { pw: 45, ptx: 20, gdb: 28, d: { es: '20 W · 28 dBi', en: '20 W · 28 dBi' } }),
  K('a_hga', 'comm', 'Antena de alta ganancia 1,2 m', 'High-gain antenna 1.2 m', 22, 0.65, { pw: 90, ptx: 40, gdb: 37, d: { es: '40 W · 37 dBi', en: '40 W · 37 dBi' } }),
  K('a_dsa', 'comm', 'Antena de espacio profundo 2 m', 'Deep-space antenna 2 m', 40, 1.20, { pw: 200, ptx: 100, gdb: 43, d: { es: '100 W · 43 dBi', en: '100 W · 43 dBi' } }),
  K('c_basic', 'computer', 'Computadora básica', 'Basic computer', 8, 0.30, { pw: 18, proc: 1.0, store: 8000, red: 0, d: { es: 'Proceso 1,0 · 8 GB', en: 'Processing 1.0 · 8 GB' } }),
  K('c_red', 'computer', 'Computadora redundante', 'Redundant computer', 15, 0.70, { pw: 30, proc: 2.0, store: 32000, red: 1, d: { es: 'Proceso 2,0 · 32 GB · tolerante a fallos', en: 'Processing 2.0 · 32 GB · fault tolerant' } }),
  K('t_pass', 'thermal', 'Control térmico pasivo (MLI)', 'Passive thermal (MLI)', 9, 0.30, { pw: 25, reject: 380, d: { es: 'Disipa 380 W', en: 'Rejects 380 W' } }),
  K('t_act', 'thermal', 'Control térmico activo', 'Active thermal loop', 24, 0.80, { pw: 70, reject: 1200, d: { es: 'Disipa 1.200 W', en: 'Rejects 1,200 W' } }),
  K('i_cam', 'instrument', 'Cámara científica', 'Science camera', 45, 0.70, { pw: 55, rate: 3000, proc: 0.4, obj: 'imaging', d: { es: '55 W · 3 GB/día', en: '55 W · 3 GB/day' } }),
  K('i_spec', 'instrument', 'Espectrómetro', 'Spectrometer', 52, 0.95, { pw: 80, rate: 2500, proc: 0.5, obj: 'spectral', d: { es: '80 W · 2,5 GB/día', en: '80 W · 2.5 GB/day' } }),
  K('i_env', 'instrument', 'Sensor ambiental (magnet./radiación)', 'Environment sensor (mag./radiation)', 12, 0.30, { pw: 14, rate: 40, proc: 0.1, obj: 'environment', d: { es: '14 W · 40 MB/día', en: '14 W · 40 MB/day' } }),
  K('i_radar', 'instrument', 'Radar subsuperficial', 'Subsurface radar', 70, 1.25, { pw: 140, rate: 1800, proc: 0.7, obj: 'subsurface', d: { es: '140 W · 1,8 GB/día', en: '140 W · 1.8 GB/day' } }),
  K('r_shield', 'shield', 'Blindaje contra radiación', 'Radiation shield', 16, 0.55, { prot: 0.6, d: { es: 'Reduce daños de tormentas solares 60 %', en: 'Cuts solar-storm damage by 60%' } }),
];
const CAT_BY_ID = {}; CATALOG.forEach(c => CAT_BY_ID[c.id] = c);

/* ---------- Missions ---------- */
const DAYS = (x) => x / DAY;
function buildMissions() {
  // AURORA: LEO 400 -> 700 km (Hohmann), launcher injects directly in 400 km LEO
  const rE = RAD.earth, r1 = rE + 4e5, r2 = rE + 7e5;
  const hA = P.hohmann(MU.earth, r1, r2);
  // LUNARIS: launcher provides trans-lunar injection; craft does TCM + lunar orbit insertion
  const rM = 3.844e8, hL = P.hohmann(MU.earth, r1, rM);
  const vMoon = P.circVel(MU.earth, rM), vinfMoon = vMoon - hL.vt2;
  const rpM = RAD.moon + 1e5, loi = P.captureDv(MU.moon, rpM, vinfMoon, null);
  // ARES ECHO: heliocentric Hohmann Earth->Mars, craft does TCM + Mars orbit insertion (1-sol capture ellipse)
  const hM = P.hohmann(MU.sun, AU, 1.5237 * AU);
  const vinfMars = Math.abs(P.circVel(MU.sun, 1.5237 * AU) - hM.vt2);
  const rpMs = RAD.mars + 3e5, raMs = RAD.mars + 3.3e7, moi = P.captureDv(MU.mars, rpMs, vinfMars, raMs);
  const L = (id, name, cap, cost) => ({ id, name, cap, cost });
  return [
    {
      id: 'aurora', name: 'Operation AURORA', body: 'earth', target: { es: 'Órbita terrestre 700 km', en: 'Earth orbit 700 km' }, diff: 1,
      tag: { es: 'Introductoria', en: 'Introductory' },
      brief: { es: 'Eleva una sonda de observación de la Tierra desde 400 km hasta 700 km, estudia el planeta durante tres meses y transmite los datos.', en: 'Raise an Earth-observation probe from 400 km to 700 km, study the planet for three months and downlink the data.' },
      budget: 8.0, duration: 90, commission: 3, transit: 0, injection: { es: 'Órbita baja de 400 km', en: '400 km low Earth orbit' },
      launchers: [L('c_s', 'Colibrí-S', 300, 1.2), L('c_m', 'Colibrí-M', 500, 1.9), L('c_l', 'Colibrí-L', 800, 2.8)],
      maneuvers: [{ id: 'hoh1', dv: hA.dv1, es: 'Hohmann 1 (400→700 km)', en: 'Hohmann burn 1 (400→700 km)' }, { id: 'hoh2', dv: hA.dv2, es: 'Hohmann 2 (circularizar)', en: 'Hohmann burn 2 (circularize)' }],
      dvCrit: hA.dv, dvReserve: 60, lowThrust: 1.0, sunAU: 1, orbitR: r2, bodyR: rE, ecl: P.eclipseFrac(rE, r2),
      comm: { d: 2.0e6, Gr: P.dishGain(3, LAMBDA), T: 120, contact: 2400 }, minObj: 2, targetDays: 68,
      objectives: [{ id: 'imaging', inst: 'i_cam', es: 'Imágenes de la Tierra', en: 'Earth imaging' }, { id: 'spectral', inst: 'i_spec', es: 'Espectro de la atmósfera', en: 'Atmosphere spectrum' }, { id: 'environment', inst: 'i_env', es: 'Radiación ambiental', en: 'Radiation environment' }],
      events: { solar_storm: 0.003, comm_loss: 0.006, instrument_fault: 0.005, power_dip: 0.004, attitude_error: 0.004, fuel_leak: 0.0015, energy_recovery: 0.004 },
      physics: { vinf: 0, transfer: hA, note: { es: 'Transferencia de Hohmann en órbita terrestre.', en: 'Hohmann transfer in Earth orbit.' } },
    },
    {
      id: 'lunaris', name: 'Operation LUNARIS', body: 'moon', target: { es: 'Órbita lunar 100 km', en: 'Lunar orbit 100 km' }, diff: 3,
      tag: { es: 'Avanzada', en: 'Advanced' },
      brief: { es: 'Diseña una sonda que llegue a una órbita lunar, realice tres experimentos científicos y transmita los resultados a la Tierra.', en: 'Design a probe that reaches lunar orbit, performs three science experiments and sends the results to Earth.' },
      budget: 10.0, duration: 180, commission: 3, transit: Math.round(DAYS(hL.t) * 10) / 10, injection: { es: 'Trayectoria translunar (TLI)', en: 'Trans-lunar injection (TLI)' },
      launchers: [L('k_s', 'Cóndor-S', 600, 2.6), L('k_m', 'Cóndor-M', 800, 3.4), L('k_l', 'Cóndor-L', 1000, 4.2)],
      maneuvers: [{ id: 'tcm', dv: 40, es: 'Correcciones de trayectoria (TCM)', en: 'Trajectory corrections (TCM)' }, { id: 'loi', dv: loi, es: 'Inserción en órbita lunar (LOI)', en: 'Lunar orbit insertion (LOI)' }],
      dvCrit: 40 + loi, dvReserve: 60, lowThrust: 1.5, sunAU: 1, orbitR: rpM, bodyR: RAD.moon, ecl: P.eclipseFrac(RAD.moon, rpM),
      comm: { d: rM, Gr: P.dishGain(2.4, LAMBDA), T: 150, contact: 21600 }, minObj: 2, targetDays: 135,
      objectives: [{ id: 'imaging', inst: 'i_cam', es: 'Características de la superficie', en: 'Surface features' }, { id: 'spectral', inst: 'i_spec', es: 'Análisis espectral de materiales', en: 'Material spectral analysis' }, { id: 'environment', inst: 'i_env', es: 'Condiciones ambientales', en: 'Environmental conditions' }],
      events: { solar_storm: 0.007, comm_loss: 0.008, instrument_fault: 0.006, traj_corr: 0.10, power_dip: 0.004, attitude_error: 0.005, fuel_leak: 0.002, energy_recovery: 0.004 },
      physics: { vinf: vinfMoon, transfer: hL, loi, note: { es: 'Velocidad de llegada a la Luna calculada con la transferencia de Hohmann Tierra–Luna.', en: 'Arrival speed at the Moon computed from the Earth–Moon Hohmann transfer.' } },
    },
    {
      id: 'ares', name: 'Operation ARES ECHO', body: 'mars', target: { es: 'Órbita elíptica de Marte', en: 'Elliptical Mars orbit' }, diff: 5,
      tag: { es: 'Experta', en: 'Expert' },
      brief: { es: 'Viaja 259 días hacia Marte, captúrate en órbita, busca agua subsuperficial y transmite desde 1,2 UA de distancia.', en: 'Travel 259 days to Mars, get captured into orbit, search for subsurface water and transmit from ~1.2 AU away.' },
      budget: 24.0, duration: 400, commission: 5, transit: Math.round(DAYS(hM.t) * 10) / 10, injection: { es: 'Trayectoria de transferencia a Marte (TMI)', en: 'Trans-Mars injection (TMI)' },
      launchers: [L('t_m', 'Titán-M', 900, 6.0), L('t_l', 'Titán-L', 1300, 8.5), L('t_x', 'Titán-X', 1800, 11.0)],
      maneuvers: [{ id: 'tcm', dv: 90, es: 'Correcciones de trayectoria (TCM)', en: 'Trajectory corrections (TCM)' }, { id: 'moi', dv: moi, es: 'Inserción en órbita marciana (MOI)', en: 'Mars orbit insertion (MOI)' }],
      dvCrit: 90 + moi, dvReserve: 120, lowThrust: 1.4, sunAU: 1.5237, orbitR: rpMs, bodyR: RAD.mars, ecl: 0.2,
      comm: { d: 1.8e11, Gr: P.dishGain(34, LAMBDA), T: 35, contact: 28800 }, minObj: 2, targetDays: 95,
      objectives: [{ id: 'imaging', inst: 'i_cam', es: 'Cartografía de la superficie', en: 'Surface mapping' }, { id: 'spectral', inst: 'i_spec', es: 'Espectro de la atmósfera', en: 'Atmosphere spectrum' }, { id: 'subsurface', inst: 'i_radar', es: 'Agua subsuperficial (radar)', en: 'Subsurface water (radar)' }, { id: 'environment', inst: 'i_env', es: 'Radiación y campo magnético', en: 'Radiation & magnetic field' }],
      events: { solar_storm: 0.006, comm_loss: 0.006, instrument_fault: 0.005, traj_corr: 0.016, power_dip: 0.006, attitude_error: 0.004, fuel_leak: 0.002, energy_recovery: 0.004 },
      physics: { vinf: vinfMars, transfer: hM, moi, note: { es: 'Transferencia de Hohmann heliocéntrica Tierra–Marte y captura en elipse de 1 sol.', en: 'Heliocentric Earth–Mars Hohmann transfer and 1-sol ellipse capture.' } },
    },
  ];
}
const MISSIONS = buildMissions();
const MISSION_BY_ID = {}; MISSIONS.forEach(m => MISSION_BY_ID[m.id] = m);

/* ---------- Helpers ---------- */
function antennaRate(an, M) {
  if (!an) return 0;
  return P.linkRate({ Pt: an.ptx, Gt: Math.pow(10, an.gdb / 10), Gr: M.comm.Gr, d: M.comm.d, T: M.comm.T, ebn0: 1.78, margin: 2.0, lambda: LAMBDA });
}
const emptyDesign = (M) => ({ launcher: M.launchers[0].id, items: {}, prop: 0 });
function qtyOf(d, id) { return d.items[id] | 0; }
function setItem(d, id, q) { const c = CAT_BY_ID[id]; const cat = CATS.find(x => x.id === c.cat); const nd = JSON.parse(JSON.stringify(d)); if (cat.single) { CATALOG.filter(x => x.cat === c.cat).forEach(x => delete nd.items[x.id]); if (q > 0) nd.items[id] = 1; } else { q = clamp(q, 0, cat.max || 8); if (q > 0) nd.items[id] = q; else delete nd.items[id]; } return nd; }
function pickCat(d, cat) { for (const id in d.items) { const c = CAT_BY_ID[id]; if (c && c.cat === cat && d.items[id] > 0) return c; } return null; }
function sumCat(d, cat, f) { let s = 0; for (const id in d.items) { const c = CAT_BY_ID[id]; if (c && c.cat === cat) s += (d.items[id] | 0) * f(c); } return s; }

/* ---------- Evaluation: all deterministic metrics + rule diagnostics ---------- */
function evaluate(d, M) {
  const L = M.launchers.find(l => l.id === d.launcher) || M.launchers[0];
  const st = pickCat(d, 'structure'), cp = pickCat(d, 'computer'), en = pickCat(d, 'prop'), an = pickCat(d, 'comm'), th = pickCat(d, 'thermal'), sh = pickCat(d, 'shield');
  const prop = Math.max(0, d.prop || 0), ion = !!(en && en.ion);
  const tank = prop > 0 ? 3 + 0.09 * prop : 0;
  const propCost = prop > 0 ? prop * (ion ? 0.012 : 0.0012) + 0.08 + 0.0006 * prop : 0;
  let dry = tank, cost = L.cost + propCost;
  const byCat = { launcher: L.cost, structure: 0, prop: propCost, power: 0, battery: 0, comm: 0, computer: 0, thermal: 0, instrument: 0, shield: 0 };
  const massCat = { structure: 0, prop: 0, power: 0, battery: 0, comm: 0, computer: 0, thermal: 0, instrument: 0, shield: 0, tank, fuel: prop };
  for (const id in d.items) { const c = CAT_BY_ID[id], q = d.items[id] | 0; if (!c || q <= 0) continue; dry += c.mass * q; cost += c.cost * q; byCat[c.cat] += c.cost * q; massCat[c.cat] += c.mass * q; }
  const m0 = dry + prop, ve = en ? en.isp * G0 : 0;
  const dvAvail = en && dry > 0 ? P.tsiolkovskyDv(ve, m0, dry) : 0;
  const dvCritEff = M.dvCrit * (ion ? M.lowThrust : 1);
  const dvReq = dvCritEff * 1.05 + M.dvReserve;
  const sun = 1 / (M.sunAU * M.sunAU);
  const gen = sumCat(d, 'power', c => c.gen) * sun * 0.97, genAvg = gen * (1 - M.ecl);
  const instPw = sumCat(d, 'instrument', c => c.pw);
  const nonShed = 25 + (cp ? cp.pw : 0) + (th ? th.pw : 0) + (an ? an.pw * 0.35 : 0) + (en && !ion ? en.pw * 0.5 : 0) + (ion ? 10 : 0);
  const loadSci = nonShed + instPw;
  const cruiseLoad = 25 + (cp ? cp.pw : 0) + (th ? th.pw : 0) + (an ? an.pw * 0.15 : 0) + (en && !ion ? en.pw * 0.5 : 0) + (ion ? 10 : 0);
  const heat = 0.9 * loadSci, reject = th ? th.reject : 0, thermalRatio = heat > 0 ? reject / heat : 0;
  const batCap = sumCat(d, 'battery', c => c.wh), batUse = batCap * 0.8;
  const eclHours = P.period(MU[M.body], M.orbitR) * M.ecl / 3600, eclNeed = loadSci * eclHours;
  const procNeed = sumCat(d, 'instrument', c => c.proc), procCap = cp ? cp.proc : 0;
  const rate = antennaRate(an, M), capMB = rate * M.comm.contact * 0.7 / 8e6;
  const objs = M.objectives.map(o => { const i = CAT_BY_ID[o.inst]; const has = qtyOf(d, o.inst) > 0; return { id: o.id, inst: o.inst, has, rate: i.rate, target: i.rate * M.targetDays }; });
  const covered = objs.filter(o => o.has).length, targetTotal = objs.filter(o => o.has).reduce((a, o) => a + o.target, 0), prodTotal = objs.filter(o => o.has).reduce((a, o) => a + o.rate, 0);
  // time estimate
  const arrival = Math.max(M.transit, M.commission);
  let insDays = 1;
  if (!en) insDays = Infinity; else if (ion) {
    const avail = genAvg - nonShed, frac = clamp(avail / en.pw, 0, 1), burnDuty = 1 - M.ecl * 0.5;
    const mavg = (m0 + dry) / 2; insDays = frac < 0.02 ? Infinity : dvCritEff * mavg / (en.thrust * frac * burnDuty * DAY);
  }
  const scienceDays = M.duration - arrival - insDays;
  const dataRatio = scienceDays > 0 && targetTotal > 0 ? capMB * scienceDays * 0.7 / targetTotal : 0;
  const supportMargin = st ? st.support / m0 : 0;
  const ev = { L, st, cp, en, an, th, sh, ion, prop, tank, dry, m0, cost, byCat, massCat, ve, dvAvail, dvCritEff, dvReq, gen, genAvg, loadSci, nonShed, cruiseLoad, heat, reject, thermalRatio, batCap, batUse, eclNeed, eclHours, procNeed, procCap, rate, capMB, objs, covered, targetTotal, prodTotal, insDays, scienceDays, dataRatio, supportMargin, budgetLeft: M.budget - cost, massMargin: L.cap - m0 };
  ev.diag = diagnose(ev, d, M);
  ev.valid = !ev.diag.some(x => x.sev === 'critical');
  ev.features = features(ev, M);
  return ev;
}
function features(e, M) {
  return [clamp(e.m0 / e.L.cap, 0, 1.3), clamp(e.loadSci > 0 ? e.genAvg / e.loadSci : 0, 0, 3) / 3, clamp(e.budgetLeft / M.budget, -0.2, 1), clamp(e.dvReq > 0 ? e.dvAvail / e.dvReq : 0, 0, 3) / 3, clamp(e.dataRatio, 0, 3) / 3, e.covered / M.objectives.length, clamp(e.thermalRatio, 0, 2) / 2];
}
const FEATURE_NAMES = [{ es: 'Masa / capacidad', en: 'Mass / capacity' }, { es: 'Balance energético', en: 'Power balance' }, { es: 'Presupuesto restante', en: 'Budget remaining' }, { es: 'Margen de Δv', en: 'Δv margin' }, { es: 'Capacidad de enlace', en: 'Link capacity' }, { es: 'Cobertura científica', en: 'Science coverage' }, { es: 'Margen térmico', en: 'Thermal margin' }];
const f1 = (x, n) => (Math.round(x * Math.pow(10, n === undefined ? 0 : n)) / Math.pow(10, n === undefined ? 0 : n));
function diagnose(e, d, M) {
  const out = [], add = (code, sev, es, en, wes, wen, fes, fen) => out.push({ code, sev, kind: 'rule', msg: { es, en }, why: { es: wes, en: wen }, fix: { es: fes, en: fen } });
  if (!e.st) add('NO_STRUCTURE', 'critical', 'Falta la estructura.', 'No structure selected.', 'Sin bus no hay dónde montar los sistemas.', 'Without a bus there is nothing to mount systems on.', 'Elige un bus en Estructura.', 'Pick a bus under Structure.');
  if (!e.en) add('NO_PROPULSION', 'critical', 'Falta el sistema de propulsión.', 'No propulsion system.', 'Sin motor no hay maniobras de inserción orbital.', 'Without an engine there is no orbit insertion.', 'Elige un motor en Propulsión.', 'Pick an engine under Propulsion.');
  if (!e.cp) add('NO_COMPUTER', 'critical', 'Falta la computadora de a bordo.', 'No flight computer.', 'La nave no puede operar instrumentos ni maniobrar sin computadora.', 'The craft cannot run instruments or maneuver without a computer.', 'Elige una computadora.', 'Pick a computer.');
  if (!e.an) add('NO_COMM', 'critical', 'La misión exige comunicación y no hay antena.', 'Communication is mandatory and there is no antenna.', 'Sin enlace de datos la ciencia no llega a la Tierra.', 'Without a data link the science never reaches Earth.', 'Instala una antena.', 'Install an antenna.');
  if (!e.th) add('NO_THERMAL', 'critical', 'Falta el control térmico.', 'No thermal control.', 'La electrónica se sobrecalienta sin disipación.', 'Electronics overheat without heat rejection.', 'Instala control térmico.', 'Install thermal control.');
  if (e.gen <= 0) add('NO_POWER', 'critical', 'No hay generación de energía.', 'No power generation.', 'Sin paneles solares la batería se agota en días.', 'Without solar panels the battery drains in days.', 'Agrega paneles solares.', 'Add solar panels.');
  if (e.m0 > e.L.cap) add('MASS_LIMIT_EXCEEDED', 'critical', `La masa de lanzamiento (${f1(e.m0)} kg) supera la capacidad del lanzador (${e.L.cap} kg).`, `Launch mass (${f1(e.m0)} kg) exceeds launcher capacity (${e.L.cap} kg).`, 'El lanzador no puede inyectar más masa que su capacidad en esa trayectoria.', 'The launcher cannot inject more mass than its capacity on that trajectory.', 'Reduce combustible o instrumentos, o elige un lanzador mayor (más caro).', 'Reduce propellant or instruments, or choose a bigger (pricier) launcher.');
  if (e.cost > M.budget) add('BUDGET_EXCEEDED', 'critical', `El costo (${f1(e.cost, 2)} M) supera el presupuesto (${M.budget} M).`, `Cost (${f1(e.cost, 2)} M) exceeds the budget (${M.budget} M).`, 'No se puede financiar el diseño.', 'The design cannot be funded.', 'Elige componentes más baratos o un lanzador menor.', 'Choose cheaper components or a smaller launcher.');
  if (e.st) {
    if (e.supportMargin < 1) add('STRUCT_OVERLOAD', 'critical', `El bus soporta ${e.st.support} kg pero el lanzamiento pesa ${f1(e.m0)} kg.`, `The bus supports ${e.st.support} kg but launch mass is ${f1(e.m0)} kg.`, 'Las cargas de lanzamiento romperían la estructura.', 'Launch loads would break the structure.', 'Usa un bus más robusto o reduce masa.', 'Use a stronger bus or cut mass.');
    else if (e.supportMargin < 1.15) add('STRUCT_MARGIN_LOW', 'medium', `Margen estructural bajo (${f1(e.supportMargin, 2)}×).`, `Low structural margin (${f1(e.supportMargin, 2)}×).`, 'Con poco margen, las vibraciones del lanzamiento pueden dañar los paneles.', 'With thin margin, launch vibration can damage the arrays.', 'Pasa a un bus más robusto (≥1,15×).', 'Use a stronger bus (≥1.15×).');
  }
  if (e.dvAvail < e.dvReq) add('DV_INSUFFICIENT', 'critical', `Δv disponible ${f1(e.dvAvail)} m/s < requerido ${f1(e.dvReq)} m/s.`, `Available Δv ${f1(e.dvAvail)} m/s < required ${f1(e.dvReq)} m/s.`, `Ecuación de Tsiolkovski: Δv = vₑ·ln(m₀/m_f). La inserción orbital exige ${f1(e.dvCritEff)} m/s + 5 % de margen + ${M.dvReserve} m/s de reserva.`, `Tsiolkovsky: Δv = vₑ·ln(m₀/m_f). Orbit insertion needs ${f1(e.dvCritEff)} m/s + 5% margin + ${M.dvReserve} m/s reserve.`, 'Más combustible, un motor de mayor Isp o menos masa seca.', 'More propellant, a higher-Isp engine or less dry mass.');
  else if (e.dvAvail < e.dvReq * 1.1) add('DV_MARGIN_LOW', 'medium', `Margen de Δv ajustado (${f1((e.dvAvail / e.dvReq - 1) * 100)} %).`, `Tight Δv margin (${f1((e.dvAvail / e.dvReq - 1) * 100)}%).`, 'Una corrección de trayectoria inesperada podría dejarte sin combustible.', 'An unexpected trajectory correction could leave you short.', 'Agrega ~10 % más de combustible.', 'Add ~10% more propellant.');
  if (e.gen > 0 && e.genAvg < e.loadSci) add('ENERGY_DEFICIT', 'high', `Déficit energético: generas ${f1(e.genAvg)} W promedio y consumes ${f1(e.loadSci)} W.`, `Power deficit: you generate ${f1(e.genAvg)} W average and draw ${f1(e.loadSci)} W.`, `E = P·t. Con eclipses el promedio cae a ${f1((1 - M.ecl) * 100)} % de la potencia solar${M.sunAU > 1 ? ' (y a esta distancia llega menos luz)' : ''}.`, `E = P·t. With eclipses the average falls to ${f1((1 - M.ecl) * 100)}% of solar power${M.sunAU > 1 ? ' (and sunlight is weaker at this distance)' : ''}.`, 'Agrega paneles, quita un instrumento o usa un motor menos hambriento.', 'Add panels, drop an instrument or use a less power-hungry engine.');
  if (e.batUse < e.eclNeed && e.gen > 0) add('ECLIPSE_BATTERY', 'high', `La batería (${f1(e.batUse)} Wh útiles) no cubre el eclipse (${f1(e.eclNeed)} Wh).`, `Battery (${f1(e.batUse)} Wh usable) cannot cover eclipse (${f1(e.eclNeed)} Wh).`, `En cada órbita pasas ${f1(e.eclHours * 60)} min en sombra consumiendo ${f1(e.loadSci)} W.`, `Each orbit you spend ${f1(e.eclHours * 60)} min in shadow drawing ${f1(e.loadSci)} W.`, 'Agrega baterías.', 'Add batteries.');
  if (e.thermalRatio < 1 && e.th) add('THERMAL_OVERLOAD', 'high', `Sobrecalentamiento: disipas ${f1(e.reject)} W y generas ${f1(e.heat)} W de calor.`, `Overheating: you reject ${f1(e.reject)} W but produce ${f1(e.heat)} W of heat.`, 'Los instrumentos se apagan para no dañarse.', 'Instruments throttle down to avoid damage.', 'Usa control térmico activo o menos instrumentos.', 'Use active thermal control or fewer instruments.');
  if (e.procNeed > e.procCap && e.cp) add('PROCESSING_LIMIT', 'medium', `Los instrumentos piden ${f1(e.procNeed, 1)} de proceso y la computadora ofrece ${f1(e.procCap, 1)}.`, `Instruments need ${f1(e.procNeed, 1)} processing; the computer offers ${f1(e.procCap, 1)}.`, 'El exceso reduce la actividad científica.', 'The excess reduces science activity.', 'Usa la computadora redundante.', 'Use the redundant computer.');
  if (e.covered < M.minObj) add('OBJECTIVES_UNREACHABLE', 'critical', `Solo cubres ${e.covered} objetivo(s) científico(s); la misión exige al menos ${M.minObj}.`, `You cover only ${e.covered} science objective(s); the mission requires at least ${M.minObj}.`, 'Cada objetivo necesita su instrumento.', 'Each objective needs its instrument.', 'Agrega los instrumentos de la lista de objetivos.', 'Add the instruments from the objectives list.');
  if (e.an && e.covered > 0 && e.dataRatio < 1) add('DATA_LINK', e.dataRatio < 0.35 ? 'critical' : 'high', `Enlace insuficiente: ${f1(e.capMB)} MB/día de descarga frente a ${f1(e.targetTotal / M.targetDays)} MB/día necesarios.`, `Link too slow: ${f1(e.capMB)} MB/day downlink vs ${f1(e.targetTotal / M.targetDays)} MB/day needed.`, `Rate = P·G_t·G_r·(λ/4πd)²/(k·T·Eb/N₀). A ${f1(M.comm.d / 1e9, 2)}×10⁶ km de distancia la señal llega muy débil.`, `Rate = P·G_t·G_r·(λ/4πd)²/(k·T·Eb/N₀). At ${f1(M.comm.d / 1e9, 2)}×10⁶ km the signal is very weak.`, 'Usa una antena de mayor ganancia o menos instrumentos de alto volumen.', 'Use a higher-gain antenna or fewer high-volume instruments.');
  if (e.scienceDays < 20) add('NO_SCIENCE_TIME', e.scienceDays < 5 ? 'critical' : 'high', `Solo quedan ${f1(Math.max(0, e.scienceDays))} días de ciencia: la inserción tarda ${Number.isFinite(e.insDays) ? f1(e.insDays) : '∞'} días.`, `Only ${f1(Math.max(0, e.scienceDays))} science days left: insertion takes ${Number.isFinite(e.insDays) ? f1(e.insDays) : '∞'} days.`, 't = m·Δv/F. Un propulsor iónico acelera muy poco: la espiral consume el calendario.', 't = m·Δv/F. An ion thruster has tiny thrust: the spiral eats your schedule.', 'Usa un motor químico o uno iónico más potente con más paneles.', 'Use a chemical engine or a stronger ion thruster with more panels.');
  if (e.ion && e.genAvg - e.nonShed < e.en.pw) add('ION_POWER', 'medium', `El propulsor iónico pide ${e.en.pw} W y solo sobran ${f1(Math.max(0, e.genAvg - e.nonShed))} W: empujará al ${f1(clamp((e.genAvg - e.nonShed) / e.en.pw, 0, 1) * 100)} %.`, `The ion thruster needs ${e.en.pw} W but only ${f1(Math.max(0, e.genAvg - e.nonShed))} W are spare: it will thrust at ${f1(clamp((e.genAvg - e.nonShed) / e.en.pw, 0, 1) * 100)}%.`, 'El empuje escala con la potencia disponible.', 'Thrust scales with available power.', 'Agrega paneles.', 'Add panels.');
  const order = { critical: 0, high: 1, medium: 2, info: 3 };
  out.sort((a, b) => order[a.sev] - order[b.sev]);
  return out;
}

/* ---------- Deterministic hash RNG (reproducible events regardless of decisions) ---------- */
function hash01() {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < arguments.length; i++) { h ^= (arguments[i] | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Events ---------- */
const EVK = ['solar_storm', 'comm_loss', 'instrument_fault', 'traj_corr', 'power_dip', 'attitude_error', 'fuel_leak', 'energy_recovery'];
const EV = {
  solar_storm: {
    phases: ['cruise', 'insertion', 'science'], ic: '☀', name: { es: 'Tormenta solar', en: 'Solar storm' },
    desc: (s, e) => ({ es: `Una eyección de masa coronal barre la nave. Radiación elevada durante ${e.dur} días.`, en: `A coronal mass ejection sweeps the craft. Elevated radiation for ${e.dur} days.` }),
    choices: [{ id: 'safe', es: 'Modo seguro (apagar instrumentos)', en: 'Safe mode (instruments off)', hint: { es: 'Pierdes ciencia 2 días pero proteges paneles', en: 'Lose 2 science days but protect arrays' } }, { id: 'keep', es: 'Mantener operaciones', en: 'Keep operating', hint: { es: 'Ciencia continua, riesgo de daño y reinicio', en: 'Science continues; risk of damage and reset' } }],
    apply(s, e, c) {
      const prot = s.ev.sh ? s.ev.sh.prot : 0, dmg = (0.04 + 0.10 * e.u2) * (1 - prot);
      if (c === 'safe') { s.health *= 1 - dmg * 0.35; s.safeUntil = s.day + 2; return { q: 0.9, log: { es: 'Modo seguro activado; daños mínimos a los paneles.', en: 'Safe mode on; minimal array damage.' } }; }
      s.health *= 1 - dmg; s.commDownUntil = Math.max(s.commDownUntil, s.day + 2);
      if (!s.ev.cp.red && e.u3 < 0.35) { s.safeUntil = s.day + 3; return { q: 0.2, log: { es: 'La computadora se reinició: 3 días en modo seguro y paneles dañados.', en: 'Computer reset: 3 days in safe mode and degraded arrays.' } }; }
      return { q: prot > 0 ? 0.7 : 0.45, log: { es: `Los paneles perdieron ${f1(dmg * 100, 1)} % de eficiencia; enlace caído 2 días.`, en: `Arrays lost ${f1(dmg * 100, 1)}% efficiency; link down 2 days.` } };
    },
    auto: (s) => (s.ev.sh ? 'keep' : 'safe'),
  },
  comm_loss: {
    phases: ['cruise', 'insertion', 'science'], ic: '⌁', name: { es: 'Pérdida temporal de comunicación', en: 'Temporary comms loss' },
    desc: (s, e) => ({ es: `Se pierde el enlace con la Tierra. Duración estimada: ${e.dur} días.`, en: `The link to Earth is lost. Estimated duration: ${e.dur} days.` }),
    choices: [{ id: 'reset', es: 'Reiniciar el enlace (−60 Wh)', en: 'Reset the link (−60 Wh)', hint: { es: '65 % de recuperar en 1 día', en: '65% chance to recover in 1 day' } }, { id: 'wait', es: 'Esperar la reconexión', en: 'Wait for reconnection', hint: { es: 'Sin costo, dura todo el evento', en: 'No cost, lasts the whole event' } }],
    apply(s, e, c) {
      if (c === 'reset') { s.soc = Math.max(0, s.soc - 60); if (e.u2 < 0.65) { s.commDownUntil = Math.max(s.commDownUntil, s.day + 1); return { q: 0.95, log: { es: 'Enlace restablecido en 1 día.', en: 'Link restored in 1 day.' } }; } s.commDownUntil = Math.max(s.commDownUntil, s.day + e.dur); return { q: 0.4, log: { es: 'El reinicio falló; se espera la reconexión.', en: 'Reset failed; waiting for reconnection.' } }; }
      s.commDownUntil = Math.max(s.commDownUntil, s.day + e.dur); return { q: 0.6, log: { es: `Enlace caído ${e.dur} días.`, en: `Link down ${e.dur} days.` } };
    },
    auto: (s) => (s.soc > 120 || s.phase !== 'science' ? 'reset' : 'wait'),
  },
  instrument_fault: {
    phases: ['science'], ic: '◉', name: { es: 'Un instrumento deja de responder', en: 'An instrument stops responding' },
    desc: (s, e) => ({ es: `${s.instName(e.inst, 'es')} no responde. Fuera de servicio hasta ${e.dur} días.`, en: `${s.instName(e.inst, 'en')} is unresponsive. Out of service for up to ${e.dur} days.` }),
    choices: [{ id: 'restart', es: 'Reiniciar el instrumento (−40 Wh)', en: 'Restart the instrument (−40 Wh)', hint: { es: '60 % de éxito (85 % con computadora redundante)', en: '60% success (85% with redundant computer)' } }, { id: 'leave', es: 'Dejarlo apagado', en: 'Leave it off', hint: { es: 'Sin costo, pierdes todos los días', en: 'No cost; lose all the days' } }],
    apply(s, e, c) {
      if (c === 'restart') { s.soc = Math.max(0, s.soc - 40); const p = s.ev.cp.red ? 0.85 : 0.6; if (e.u2 < p) { s.instOff[e.inst] = s.day; return { q: 1, log: { es: 'Instrumento recuperado de inmediato.', en: 'Instrument recovered immediately.' } }; } s.instOff[e.inst] = s.day + Math.ceil(e.dur * 1.5); return { q: 0.25, log: { es: 'El reinicio falló y el instrumento tardará más.', en: 'Restart failed; the instrument will take longer.' } }; }
      s.instOff[e.inst] = s.day + e.dur; return { q: 0.5, log: { es: `Instrumento fuera de servicio ${e.dur} días.`, en: `Instrument offline for ${e.dur} days.` } };
    },
    auto: () => 'restart',
  },
  traj_corr: {
    phases: ['cruise'], ic: '⤳', name: { es: 'La trayectoria necesita corrección', en: 'Trajectory needs a correction' },
    desc: (s, e) => ({ es: `La navegación detecta una desviación. Corrección requerida: ${e.dv} m/s.`, en: `Navigation detects a deviation. Required correction: ${e.dv} m/s.` }),
    choices: [{ id: 'now', es: 'Ejecutar la corrección ahora', en: 'Execute the correction now', hint: { es: 'Consume Δv y combustible hoy', en: 'Spends Δv and propellant now' } }, { id: 'defer', es: 'Posponer a la inserción', en: 'Defer to insertion', hint: { es: 'Costará ~2× más Δv después', en: 'Will cost ~2× more Δv later' } }],
    apply(s, e, c) {
      if (c === 'now') { const cons = s.mass * (1 - Math.exp(-e.dv / s.ev.ve)); if (cons > s.prop) { s.prop = 0; return { q: 0.1, log: { es: 'No había combustible suficiente para corregir.', en: 'Not enough propellant to correct.' } }; } s.prop -= cons; s.mass -= cons; s.dvUsedTcm += e.dv; return { q: 0.95, log: { es: `Corrección de ${e.dv} m/s ejecutada (${f1(cons, 1)} kg).`, en: `${e.dv} m/s correction executed (${f1(cons, 1)} kg).` } }; }
      s.dvTarget += e.dv * 2; return { q: 0.35, log: { es: `Corrección pospuesta; la inserción exigirá +${e.dv * 2} m/s.`, en: `Correction deferred; insertion will need +${e.dv * 2} m/s.` } };
    },
    auto: (s, e) => (s.ev.dvAvail > s.ev.dvReq * 1.02 ? 'now' : 'defer'),
  },
  power_dip: {
    phases: ['cruise', 'insertion', 'science'], ic: '⚡', name: { es: 'Disminuye la generación solar', en: 'Solar generation drops' },
    desc: (s, e) => ({ es: `La generación cae ${f1(e.loss * 100)} % durante ${e.dur} días (polvo/orientación).`, en: `Generation drops ${f1(e.loss * 100)}% for ${e.dur} days (dust/pointing).` }),
    choices: [{ id: 'reorient', es: 'Reorientar paneles (−3 kg de combustible)', en: 'Re-point arrays (−3 kg propellant)', hint: { es: 'Recupera ~70 % de la pérdida', en: 'Recovers ~70% of the loss' } }, { id: 'shed', es: 'Apagar instrumentos no críticos', en: 'Shed non-critical instruments', hint: { es: 'Sin costo, pausa la ciencia', en: 'Free, pauses science' } }],
    apply(s, e, c) {
      if (c === 'reorient') { const cons = Math.min(3, s.prop); s.prop -= cons; s.mass -= cons; s.dipUntil = s.day + e.dur; s.dipFactor = 1 - e.loss * 0.3; return { q: 0.85, log: { es: 'Paneles reorientados; pérdida reducida al 30 %.', en: 'Arrays re-pointed; loss reduced to 30%.' } }; }
      s.dipUntil = s.day + e.dur; s.dipFactor = 1 - e.loss; s.safeUntil = Math.max(s.safeUntil, s.day + e.dur); return { q: 0.55, log: { es: 'Instrumentos apagados mientras dura la caída.', en: 'Instruments off while generation is low.' } };
    },
    auto: (s) => (s.prop > 6 ? 'reorient' : 'shed'),
  },
  attitude_error: {
    phases: ['science', 'cruise'], ic: '⟳', name: { es: 'Error de orientación', en: 'Attitude error' },
    desc: (s, e) => ({ es: `Los sensores estelares pierden la referencia. Instrumentos no disponibles hasta ${e.dur} días.`, en: `Star trackers lose reference. Instruments unavailable for up to ${e.dur} days.` }),
    choices: [{ id: 'wheels', es: 'Recuperar actitud con ruedas de reacción (−30 Wh)', en: 'Recover attitude with reaction wheels (−30 Wh)', hint: { es: 'Rápido si la computadora tiene margen de proceso', en: 'Fast if the computer has processing headroom' } }, { id: 'auto', es: 'Esperar la rutina automática', en: 'Wait for the automatic routine', hint: { es: 'Sin costo, lento', en: 'Free, slow' } }],
    apply(s, e, c) {
      const off = s.safeUntil;
      if (c === 'wheels') { s.soc = Math.max(0, s.soc - 30); const days = s.ev.cp.proc >= 2 ? 1 : Math.ceil(e.dur / 2); s.safeUntil = Math.max(off, s.day + days); return { q: s.ev.cp.proc >= 2 ? 1 : 0.7, log: { es: `Actitud recuperada en ${days} día(s).`, en: `Attitude recovered in ${days} day(s).` } }; }
      s.safeUntil = Math.max(off, s.day + e.dur); return { q: 0.5, log: { es: `Instrumentos fuera ${e.dur} días.`, en: `Instruments out ${e.dur} days.` } };
    },
    auto: (s) => (s.soc > 80 ? 'wheels' : 'auto'),
  },
  fuel_leak: {
    phases: ['cruise', 'insertion', 'science'], ic: '💧', name: { es: 'Desgaste de combustible', en: 'Propellant leak' }, info: true,
    desc: (s, e) => ({ es: `Una microfuga en una válvula pierde ${f1(e.pct * 100, 1)} % del propelente.`, en: `A micro-leak in a valve loses ${f1(e.pct * 100, 1)}% of the propellant.` }),
    apply(s, e) { const lost = s.prop * e.pct; s.prop -= lost; s.mass -= lost; return { q: 0.5, log: { es: `Perdidos ${f1(lost, 1)} kg de propelente.`, en: `Lost ${f1(lost, 1)} kg of propellant.` } }; },
  },
  energy_recovery: {
    phases: ['science', 'cruise'], ic: '✚', name: { es: 'Recuperación de energía', en: 'Energy recovery' }, info: true,
    desc: () => ({ es: 'Los paneles se recuperan parcialmente tras un ciclo térmico.', en: 'Arrays partially recover after a thermal cycle.' }),
    apply(s) { s.health = Math.min(1, s.health * 1.03); return { q: 0.9, log: { es: 'Eficiencia de paneles +3 %.', en: 'Array efficiency +3%.' } }; },
  },
};

/* ---------- Simulation (day-stepped, seeded, pausable for player decisions) ---------- */
class Sim {
  constructor(d, M, seed, opts) {
    this.d = JSON.parse(JSON.stringify(d)); this.M = M; this.seed = seed | 0; this.opts = opts || {};
    const ev = this.ev = evaluate(d, M);
    this.log = []; this.hist = []; this.events = []; this.pending = null; this.over = false;
    this.s = this; // alias so event functions can use s.*
    this.day = 0; this.phase = 'launch'; this.status = 'running'; this.reason = null;
    this.soc = ev.batUse * 0.9; this.socCap = Math.max(ev.batUse, 1);
    this.health = 1; this.prop = ev.prop; this.mass = ev.m0;
    this.dvDone = 0; this.dvTarget = ev.dvCritEff; this.dvUsedTcm = 0; this.orbit = false;
    this.instOff = {}; this.safeUntil = -1; this.commDownUntil = -1; this.dipUntil = -1; this.dipFactor = 1;
    this.stored = {}; this.deliv = {}; this.prod = {}; this.lost = 0; this.storedMB = 0;
    this.objs = ev.objs.filter(o => o.has); this.objs.forEach(o => { this.stored[o.inst] = 0; this.deliv[o.inst] = 0; this.prod[o.inst] = 0; });
    this.blackout = 0; this.blackStreak = 0; this.dutyDays = 0; this.dutySum = 0; this.surplus = 0; this.genTot = 0; this.sciDays = 0; this.insDays = 0; this.dataFailDays = 0;
    this.quals = []; this.sciLost = 0;
    this.launch();
  }
  instName(id, l) { const c = CAT_BY_ID[id]; return c ? c[l] : id; }
  L(es, en, kind) { this.log.push({ day: this.day, es, en, kind: kind || 'info' }); }
  fail(es, en) { if (this.over) return; this.status = 'failed'; this.reason = { es, en }; this.L(es, en, 'bad'); this.finish(); }
  launch() {
    const e = this.ev, M = this.M;
    this.L(`Lanzamiento con ${e.L.name}: ${f1(e.m0, 1)} kg a ${M.injection.es}.`, `Launch on ${e.L.name}: ${f1(e.m0, 1)} kg to ${M.injection.en}.`, 'good');
    if (!e.valid && !this.opts.force) { this.fail('El diseño no supera las validaciones obligatorias.', 'The design fails mandatory validations.'); return; }
    if (e.supportMargin < 1.25) { const p = (1.25 - e.supportMargin) * 2.2, u = hash01(this.seed, 7001); if (u < p) { this.health *= 0.9; this.L('Vibración de lanzamiento: paneles −10 % de eficiencia.', 'Launch vibration: arrays −10% efficiency.', 'bad'); this.quals.push(0.3); } }
    this.phase = 'commission';
  }
  sunAU() { if (this.phase === 'cruise' || this.phase === 'commission') { const T = Math.max(this.M.transit, 1); return 1 + (this.M.sunAU - 1) * clamp(this.day / T, 0, 1); } return this.M.sunAU; }
  rollEvents() {
    const M = this.M;
    for (let k = 0; k < EVK.length; k++) {
      const key = EVK[k], p = M.events[key]; if (!p) continue;
      const def = EV[key]; if (!def.phases.includes(this.phase) || (key === 'instrument_fault' && !this.objs.length)) continue;
      if (hash01(this.seed, this.day, k, 11) < p) {
        const e = { type: key, day: this.day, u2: hash01(this.seed, this.day, k, 22), u3: hash01(this.seed, this.day, k, 33), u4: hash01(this.seed, this.day, k, 44) };
        e.dur = 2 + Math.floor(e.u4 * 4); e.loss = 0.15 + 0.35 * e.u2; e.pct = 0.01 + 0.03 * e.u4; e.dv = 8 + Math.round(e.u4 * 22);
        if (key === 'instrument_fault') e.inst = this.objs[Math.floor(e.u3 * this.objs.length) % this.objs.length].inst;
        if (key === 'power_dip' && M.sunAU > 1) e.loss = clamp(e.loss + 0.1, 0, 0.6);
        return e;
      }
    }
    return null;
  }
  step() {
    if (this.over || this.pending) return;
    this.day++;
    if (this.phase === 'commission' || this.phase === 'cruise') { const arr = Math.max(this.M.transit, this.M.commission); this.phase = this.day <= this.M.commission ? 'commission' : (this.day <= arr ? 'cruise' : 'insertion'); }
    const e = this.opts.noEvents ? null : this.rollEvents();
    if (e) {
      const def = EV[e.type]; e.name = def.name; e.text = def.desc(this, e); e.phase = this.phase;
      if (def.choices && this.opts.interactive) { this.pending = { ev: e, def }; this.L(def.name.es + ': ' + e.text.es, def.name.en + ': ' + e.text.en, 'warn'); return; }
      const c = def.choices ? (this.opts.policy ? this.opts.policy(this, e) : def.auto(this, e)) : null;
      this.applyEvent(e, def, c);
    }
    this.simDay();
  }
  applyEvent(e, def, c) {
    const r = def.apply(this, e, c); e.choice = c; e.q = r.q; e.res = r.log;
    this.quals.push(r.q); this.events.push(e);
    const ch = def.choices ? def.choices.find(x => x.id === c) : null;
    this.L(`${def.name.es}${ch ? ' → ' + ch.es : ''}. ${r.log.es}`, `${def.name.en}${ch ? ' → ' + ch.en : ''}. ${r.log.en}`, r.q >= 0.7 ? 'good' : (r.q < 0.4 ? 'bad' : 'warn'));
  }
  resolve(choice) {
    if (!this.pending) return;
    const { ev, def } = this.pending; this.pending = null;
    this.applyEvent(ev, def, choice || def.auto(this, ev));
    this.simDay();
  }
  simDay() {
    if (this.over) return;
    const e = this.ev, M = this.M, ph = this.phase, day = this.day;
    const inSafe = day <= this.safeUntil, sun = 1 / Math.pow(this.sunAU(), 2);
    const dip = day <= this.dipUntil ? this.dipFactor : 1;
    const ecl = ph === 'science' ? M.ecl : (ph === 'insertion' ? M.ecl * 0.5 : 0);
    const gen = sumCat(this.d, 'power', c => c.gen) * sun * 0.97 * this.health * dip, genAvg = gen * (1 - ecl);
    const comm = (ph === 'science' ? 0.35 : 0.15);
    const nonShed = 25 + e.cp.pw + e.th.pw + e.an.pw * comm + (e.en && !e.ion ? e.en.pw * 0.5 : 0) + (e.ion ? 10 : 0);
    const shed = (ph === 'science' && !inSafe) ? sumCat(this.d, 'instrument', c => c.pw) : 0;
    let supply = genAvg * 24 + this.soc;
    const needBase = nonShed * 24;
    let duty = 0, thrustFrac = 0, burnDvPot = 0;
    if (supply < needBase) { this.blackout++; this.blackStreak++; this.soc = 0; supply = 0; if (this.blackStreak >= 4) { this.fail('Pérdida total de energía: la nave quedó sin potencia.', 'Total power loss: the craft ran out of power.'); return; } }
    else {
      this.blackStreak = 0; let avail = supply - needBase;
      if (ph === 'insertion' && !inSafe) {
        if (e.ion) { const burnDuty = 1 - ecl, need = e.en.pw * 24 * burnDuty; thrustFrac = need > 0 ? clamp(avail / need, 0, 1) : 0; avail -= need * thrustFrac; burnDvPot = e.en.thrust * thrustFrac * burnDuty * DAY / this.mass; }
        else { thrustFrac = 1; burnDvPot = Infinity; }
      }
      if (shed > 0) duty = clamp(avail / (shed * 24), 0, 1);
      if (e.eclNeed > e.batUse && ph === 'science') duty = Math.min(duty, e.batUse / e.eclNeed);
      const heat = 0.9 * (nonShed + shed * duty); if (heat > e.th.reject) duty = Math.min(duty, e.th.reject / heat);
      if (e.procNeed > e.procCap) duty = Math.min(duty, e.procCap / e.procNeed);
      let socNew = supply - needBase - (e.ion && ph === 'insertion' ? e.en.pw * 24 * (1 - ecl) * thrustFrac : 0) - shed * 24 * duty;
      if (socNew > this.socCap) { if (ph === 'science') this.surplus += (socNew - this.socCap); socNew = this.socCap; }
      this.soc = Math.max(0, socNew);
    }
    this.genTot += genAvg * 24;
    // burn
    if (ph === 'insertion') {
      this.insDays++;
      if (thrustFrac > 0) {
        const need = this.dvTarget - this.dvDone; let dv = Math.min(need, burnDvPot);
        let cons = this.mass * (1 - Math.exp(-dv / e.ve));
        if (cons > this.prop) { cons = this.prop; dv = e.ve * Math.log(this.mass / (this.mass - cons)); }
        this.prop -= cons; this.mass -= cons; this.dvDone += dv;
        if (this.dvDone >= this.dvTarget - 1e-6) { this.phase = 'science'; this.orbit = true; this.L(`Órbita alcanzada en el día ${day}. Comienza la fase científica.`, `Orbit reached on day ${day}. Science phase begins.`, 'good'); }
        else if (this.prop <= 1e-6) { this.fail('Sin propelente: no se alcanzó la órbita objetivo.', 'Out of propellant: target orbit not reached.'); return; }
      }
    }
    // science
    if (ph === 'science') {
      this.sciDays++; this.dutyDays++; this.dutySum += duty;
      let prodTot = 0;
      for (const o of this.objs) { const off = (this.instOff[o.inst] || -1) >= day; const m = off ? 0 : o.rate * duty; this.prod[o.inst] += m; this.stored[o.inst] += m; prodTot += m; }
      let tot = 0; for (const o of this.objs) tot += this.stored[o.inst];
      if (tot > e.cp.store) { const f = e.cp.store / tot; for (const o of this.objs) { this.lost += this.stored[o.inst] * (1 - f); this.stored[o.inst] *= f; } tot = e.cp.store; }
      const up = day > this.commDownUntil ? 1 : 0, cap = e.capMB * up;
      if (!up) this.dataFailDays++;
      const send = Math.min(tot, cap);
      if (tot > 0) for (const o of this.objs) { const s = send * this.stored[o.inst] / tot; this.stored[o.inst] -= s; this.deliv[o.inst] += s; }
      this.storedMB = tot - send;
      if (inSafe || duty < 0.5) this.sciLost++;
    }
    this.hist.push({ d: day, soc: this.soc / this.socCap, gen: genAvg, load: nonShed + shed * duty, dv: Math.max(0, this.dvTarget - this.dvDone), prop: this.prop, del: Object.values(this.deliv).reduce((a, b) => a + b, 0), duty, ph });
    if (day >= M.duration && !this.over) this.finish();
  }
  finish() {
    if (this.over) return; this.over = true;
    const e = this.ev, M = this.M;
    if (this.status === 'running') this.status = this.finalStatus();
    this.result = this.score();
  }
  objDone() { return this.objs.filter(o => this.deliv[o.inst] >= o.target - 1e-6).length; }
  finalStatus() {
    if (!this.orbit) { this.reason = { es: 'No se alcanzó la órbita objetivo.', en: 'Target orbit not reached.' }; return 'failed'; }
    const n = this.objDone();
    if (n >= M_min(this.M)) return 'success';
    return n >= 1 ? 'partial' : 'partial';
  }
  abort() { if (this.over) return; this.status = 'aborted'; this.L('Misión abortada por el jugador.', 'Mission aborted by the player.', 'bad'); this.finish(); }
  score() {
    const e = this.ev, M = this.M;
    const C = 100 * M.objectives.reduce((a, o) => { const x = this.objs.find(z => z.id === o.id); return a + (x ? clamp(this.deliv[x.inst] / x.target, 0, 1) : 0); }, 0) / M.objectives.length;
    const propNeedRes = this.mass * (Math.exp(M.dvReserve / (e.ve || 1)) - 1);
    const lp = e.prop > 0 ? Math.max(0, (this.prop - propNeedRes)) / e.prop : 0, uw = this.genTot > 0 ? this.surplus / this.genTot : 0;
    const R = clamp(100 * (1 - 0.6 * Math.min(1, lp * 1.2) - 0.4 * Math.min(1, uw)), 0, 100);
    const B = clamp(100 * (e.budgetLeft / M.budget) / 0.25, 0, 100);
    const avgDuty = this.dutyDays ? this.dutySum / this.dutyDays : 0;
    const E = clamp(100 * avgDuty - 5 * this.blackout, 0, 100);
    const Dparts = [clamp((e.supportMargin - 1) / 0.2, 0, 1), clamp((e.thermalRatio - 0.9) / 0.2, 0, 1), clamp((e.dvAvail / e.dvReq - 0.95) / 0.15, 0, 1), e.eclNeed > 0 ? clamp(e.batUse / e.eclNeed, 0, 1) : 1, e.cp.red ? 1 : 0.5];
    const D = 100 * Dparts.reduce((a, b) => a + b, 0) / Dparts.length;
    const A = this.quals.length ? 100 * this.quals.reduce((a, b) => a + b, 0) / this.quals.length : 100;
    let S = 0.30 * C + 0.20 * R + 0.15 * B + 0.15 * E + 0.10 * D + 0.10 * A;
    if (this.status === 'failed') S = Math.min(S, 30); else if (this.status === 'partial') S = Math.min(S, 79); else if (this.status === 'aborted') S = Math.min(S, 25);
    const reserveOk = this.dvRemaining() >= M.dvReserve;
    return { S, C, R, B, E, D, A, reserveOk, avgDuty, blackout: this.blackout, done: this.objDone(), nobj: M.objectives.length, dvLeft: this.dvRemaining(), propLeft: this.prop };
  }
  dvRemaining() { const e = this.ev; return e.ve && this.mass > 0 && this.mass - this.prop > 0 ? e.ve * Math.log(this.mass / (this.mass - this.prop)) : 0; }
  runAll() { let g = 0; while (!this.over && g++ < 2000) { if (this.pending) this.resolve(); else this.step(); } return this; }
}
function M_min(M) { return M.minObj; }
function simulate(d, M, seed, opts) { const s = new Sim(d, M, seed, Object.assign({ interactive: false }, opts)); if (!s.over) s.runAll(); return s; }
function avgSim(d, M, seeds) { let S = 0, ok = 0, part = 0; for (const sd of seeds) { const s = simulate(d, M, sd); S += s.result.S; if (s.status === 'success') ok++; else if (s.status === 'partial') part++; } return { score: S / seeds.length, success: ok / seeds.length, partial: part / seeds.length }; }

/* ---------- Design sampling / optimisation / Neuron Core ML ---------- */
function sampleDesign(M, rnd) {
  const R = (a, b) => a + (b - a) * rnd(), pickOne = (arr) => arr[Math.floor(rnd() * arr.length)];
  let d = emptyDesign(M); d.launcher = pickOne(M.launchers).id;
  const ids = (cat) => CATALOG.filter(c => c.cat === cat).map(c => c.id);
  d = setItem(d, pickOne(ids('structure')), 1); d = setItem(d, pickOne(ids('computer')), 1); d = setItem(d, pickOne(ids('thermal')), 1);
  const engs = ids('prop'); d = setItem(d, rnd() < 0.78 ? pickOne(engs.slice(0, 2)) : pickOne(engs.slice(2)), 1);
  d = setItem(d, pickOne(ids('comm')), 1);
  if (rnd() < 0.3) d = setItem(d, 'r_shield', 1);
  const objIds = M.objectives.map(o => o.inst), need = M.minObj + (rnd() < 0.5 ? 1 : 0);
  objIds.slice().sort(() => rnd() - 0.5).slice(0, Math.min(need, objIds.length)).forEach(i => { d = setItem(d, i, 1); });
  d = setItem(d, 'b_li', 1 + Math.floor(rnd() * 3));
  d.prop = 0; let e = evaluate(d, M);
  const target = e.loadSci * R(0.85, 1.5) + (e.ion ? e.en.pw * R(0.3, 1) : 0);
  const per = (1 / (M.sunAU * M.sunAU)) * 0.97 * (1 - M.ecl);
  let nl = Math.floor(target / (420 * per) * R(0.3, 1)), rest = target - nl * 420 * per, ns = Math.max(0, Math.ceil(rest / (150 * per)));
  d = setItem(d, 'pn_l', clamp(nl, 0, 8)); d = setItem(d, 'pn_s', clamp(ns, 0, 8));
  e = evaluate(d, M);
  const dryNoProp = e.dry; let lo = 0, hi = e.L.cap - dryNoProp;
  const ve = e.en.isp * G0; let propNeeded = 0; for (let i = 0; i < 40; i++) { const p = (lo + hi) / 2; const dry = dryNoProp + 3 + 0.09 * p; if (ve * Math.log((dry + p) / dry) >= e.dvReq * R(1.0, 1.4)) hi = p; else lo = p; }
  propNeeded = hi; d.prop = clamp(Math.round(Math.min(propNeeded, e.L.cap - dryNoProp - 4)), 0, 1500);
  // repair: cheapen / lighten until hard budget/mass constraints are met (keeps the dataset focused on launchable designs)
  for (let k = 0; k < 14; k++) {
    e = evaluate(d, M); if (e.cost <= M.budget && e.m0 <= e.L.cap && e.supportMargin >= 1) break;
    const j = Math.floor(rnd() * 6), li = M.launchers.findIndex(l => l.id === d.launcher);
    if (j === 0 && li > 0) d.launcher = M.launchers[li - 1].id;
    else if (j === 1) { const c = ['a_dsa', 'a_hga', 'a_mga', 'a_lga'], cur = e.an ? c.indexOf(e.an.id) : 3; if (cur < 3) d = setItem(d, c[cur + 1], 1); }
    else if (j === 2 && qtyOf(d, 'r_shield')) d = setItem(d, 'r_shield', 0);
    else if (j === 3) d = setItem(d, 'b_li', Math.max(1, qtyOf(d, 'b_li') - 1));
    else if (j === 4) { const extra = M.objectives.map(o => o.inst).filter(i => qtyOf(d, i)); if (extra.length > M.minObj) d = setItem(d, extra[Math.floor(rnd() * extra.length)], 0); }
    else if (j === 5) { const e2 = evaluate(d, M); d.prop = Math.max(0, Math.round(d.prop * 0.9)); void e2; }
    if (e.supportMargin < 1) { const s = ['s_light', 's_std', 's_heavy'], cur = e.st ? s.indexOf(e.st.id) : 0; if (cur < 2) d = setItem(d, s[cur + 1], 1); }
  }
  return d;
}
class MLP {
  constructor(sizes, rnd) { this.sizes = sizes; this.W = []; this.b = []; for (let l = 0; l < sizes.length - 1; l++) { const n = sizes[l], m = sizes[l + 1], s = Math.sqrt(2 / (n + m)); this.W.push(Float64Array.from({ length: n * m }, () => (rnd() * 2 - 1) * s * 1.7)); this.b.push(new Float64Array(m)); } this.mW = this.W.map(w => new Float64Array(w.length)); this.vW = this.W.map(w => new Float64Array(w.length)); this.mb = this.b.map(w => new Float64Array(w.length)); this.vb = this.b.map(w => new Float64Array(w.length)); this.t = 0; }
  forward(x, keep) { let a = x; const acts = [a]; for (let l = 0; l < this.W.length; l++) { const n = this.sizes[l], m = this.sizes[l + 1], o = new Float64Array(m); for (let j = 0; j < m; j++) { let s = this.b[l][j]; for (let i = 0; i < n; i++) s += a[i] * this.W[l][i * m + j]; o[j] = l === this.W.length - 1 ? 1 / (1 + Math.exp(-s)) : Math.tanh(s); } a = o; acts.push(a); } return keep ? acts : a; }
  trainBatch(X, Y, idx, lr) {
    const gW = this.W.map(w => new Float64Array(w.length)), gb = this.b.map(w => new Float64Array(w.length)); let loss = 0;
    for (const k of idx) {
      const acts = this.forward(X[k], true), out = acts[acts.length - 1]; let delta = new Float64Array(out.length);
      for (let j = 0; j < out.length; j++) { const er = out[j] - Y[k][j]; loss += er * er; delta[j] = 2 * er * out[j] * (1 - out[j]); }
      for (let l = this.W.length - 1; l >= 0; l--) {
        const n = this.sizes[l], m = this.sizes[l + 1], a = acts[l], nd = new Float64Array(n);
        for (let i = 0; i < n; i++) { for (let j = 0; j < m; j++) { gW[l][i * m + j] += a[i] * delta[j]; nd[i] += this.W[l][i * m + j] * delta[j]; } }
        for (let j = 0; j < m; j++) gb[l][j] += delta[j];
        if (l > 0) { for (let i = 0; i < n; i++) nd[i] *= 1 - a[i] * a[i]; delta = nd; }
      }
    }
    this.t++; const B1 = 0.9, B2 = 0.999, n = idx.length;
    for (let l = 0; l < this.W.length; l++) {
      for (const [P_, G, M_, V_] of [[this.W[l], gW[l], this.mW[l], this.vW[l]], [this.b[l], gb[l], this.mb[l], this.vb[l]]]) for (let i = 0; i < P_.length; i++) { const g = G[i] / n; M_[i] = B1 * M_[i] + (1 - B1) * g; V_[i] = B2 * V_[i] + (1 - B2) * g * g; P_[i] -= lr * (M_[i] / (1 - Math.pow(B1, this.t))) / (Math.sqrt(V_[i] / (1 - Math.pow(B2, this.t))) + 1e-8); }
    }
    return loss / n;
  }
  toJSON() { return { sizes: this.sizes, W: this.W.map(w => Array.from(w)), b: this.b.map(w => Array.from(w)) }; }
  static fromJSON(j) { const m = new MLP(j.sizes, () => 0.5); m.W = j.W.map(w => Float64Array.from(w)); m.b = j.b.map(w => Float64Array.from(w)); return m; }
}
const SEEDS_LABEL = [101, 202, 303, 404, 505];
function makeSample(M, rnd) {
  const d = sampleDesign(M, rnd), e = evaluate(d, M); if (!e.valid) return null;
  let succ = 0, sc = 0, fail = 0;
  for (const sd of SEEDS_LABEL) { const s = simulate(d, M, sd + Math.floor(rnd() * 1e6)); succ += s.status === 'success' ? 1 : s.status === 'partial' ? 0.5 : 0; sc += s.result.S; if (s.status === 'failed') fail++; }
  const n = SEEDS_LABEL.length; return { x: e.features, y: [succ / n, sc / n / 100, fail / n], d };
}
function neighbor(d, M, rnd) {
  const R = (n) => Math.floor(rnd() * n); let nd = JSON.parse(JSON.stringify(d)); const k = R(10);
  const ids = (cat) => CATALOG.filter(c => c.cat === cat).map(c => c.id);
  if (k === 0) nd.prop = Math.max(0, nd.prop + (rnd() < 0.5 ? -1 : 1) * (5 + R(40)));
  else if (k === 1) nd = setItem(nd, 'pn_s', qtyOf(nd, 'pn_s') + (rnd() < 0.5 ? -1 : 1));
  else if (k === 2) nd = setItem(nd, 'pn_l', qtyOf(nd, 'pn_l') + (rnd() < 0.5 ? -1 : 1));
  else if (k === 3) nd = setItem(nd, 'b_li', qtyOf(nd, 'b_li') + (rnd() < 0.5 ? -1 : 1));
  else if (k === 4) { const a = ids('comm'); nd = setItem(nd, a[R(a.length)], 1); }
  else if (k === 5) { const a = M.objectives.map(o => o.inst), i = a[R(a.length)]; nd = setItem(nd, i, qtyOf(nd, i) ? 0 : 1); }
  else if (k === 6) { const a = ids('structure'); nd = setItem(nd, a[R(a.length)], 1); }
  else if (k === 7) { const a = ids('prop'); nd = setItem(nd, a[R(a.length)], 1); }
  else if (k === 8) { const a = ids('computer').concat(ids('thermal')); nd = setItem(nd, a[R(a.length)], 1); }
  else nd.launcher = M.launchers[R(M.launchers.length)].id;
  return nd;
}
function optimize(d, M, opts) {
  opts = opts || {}; const rnd = mulberry(opts.seed || 7), iters = opts.iters || 900, seeds = [11, 22, 33], J = (x) => { const e = evaluate(x, M); if (!e.valid) return -1; const r = avgSim(x, M, seeds); return r.score + 15 * r.success; };
  let cur = d, curJ = J(cur), best = cur, bestJ = curJ;
  if (curJ < 0) { for (let i = 0; i < 300 && curJ < 0; i++) { const c = sampleDesign(M, rnd); const j = J(c); if (j > curJ) { cur = c; curJ = j; } } best = cur; bestJ = curJ; }
  for (let i = 0; i < iters; i++) { const T = 6 * (1 - i / iters) + 0.2, n = neighbor(cur, M, rnd), j = J(n); if (j > curJ || (j >= 0 && Math.exp((j - curJ) / T) > rnd())) { cur = n; curJ = j; if (j > bestJ) { best = n; bestJ = j; } } }
  return { design: best, J: bestJ, stats: avgSim(best, M, [1, 2, 3, 4, 5, 6, 7, 8]) };
}
function diffDesign(a, b, M) {
  const out = []; const ids = new Set([...Object.keys(a.items), ...Object.keys(b.items)]);
  ids.forEach(id => { const qa = a.items[id] | 0, qb = b.items[id] | 0; if (qa !== qb) out.push({ id, from: qa, to: qb }); });
  if (a.launcher !== b.launcher) out.push({ launcher: [a.launcher, b.launcher] });
  if (Math.round(a.prop) !== Math.round(b.prop)) out.push({ prop: [Math.round(a.prop), Math.round(b.prop)] });
  return out;
}
function explain(model, x, mean) {
  const base = model.forward(x)[0]; return x.map((v, j) => { const z = x.slice(); z[j] = mean[j]; return { j, delta: base - model.forward(z)[0] }; }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

const api = { P, MU, RAD, AU, C, G0, DAY, CATS, CATALOG, CAT_BY_ID, MISSIONS, MISSION_BY_ID, emptyDesign, setItem, qtyOf, evaluate, Sim, simulate, avgSim, sampleDesign, MLP, makeSample, optimize, neighbor, diffDesign, explain, FEATURE_NAMES, EV, EVK, hash01, mulberry, antennaRate, clamp, f1, LAMBDA, pickCat };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NEB = api;
})(typeof window !== 'undefined' ? window : globalThis);
