// Pruebas rápidas de física (sin dependencias):  node tests/fisica.test.js
const N = require('../src/engine.js');
let fallos = 0;
const ok = (n, c, d = '') => { console.log((c ? '✓ ' : '✗ ') + n + (d ? '  ' + d : '')); if (!c) fallos++; };
const { P, MU, RAD } = N;
const r = RAD.earth + 400e3, v = P.circVel(MU.earth, r), T = P.period(MU.earth, r);
ok('v circular a 400 km ≈ 7,67 km/s', Math.abs(v - 7672.6) < 5, v.toFixed(2) + ' m/s');
ok('periodo a 400 km ≈ 5545 s', Math.abs(T - 5545) < 5, T.toFixed(1) + ' s');
const ve = 315 * N.G0, dv = P.tsiolkovskyDv(ve, 500, 300);
ok('Tsiolkovski ida y vuelta', Math.abs(P.propellantFor(dv, ve, 300) - 200) < 1e-6);
const M = N.MISSION_BY_ID.aurora, d = N.sampleDesign(M, N.mulberry(1));
const a = N.simulate(d, M, 7), b = N.simulate(d, M, 7);
ok('misma semilla → mismo resultado', a.result.S === b.result.S && a.events.length === b.events.length, a.result.S.toFixed(2));
process.exit(fallos ? 1 : 0);
