const N=require('../src/engine.js');const {P,MU,RAD}=N;
console.log('v400km',P.circVel(MU.earth,RAD.earth+4e5), 'T',P.period(MU.earth,RAD.earth+4e5));
for(const M of N.MISSIONS){
  console.log('\n==',M.id,'transit',M.transit,'dvCrit',M.dvCrit.toFixed(1),'ecl',M.ecl.toFixed(3),'vinf',(M.physics.vinf||0).toFixed(1));
  for(const a of ['a_lga','a_mga','a_hga','a_dsa']){const an=N.CAT_BY_ID[a];const r=N.antennaRate(an,M);console.log(a,'rate bps',r.toExponential(2),'MB/day',(r*M.comm.contact*0.7/8e6).toFixed(0));}
}
// feasibility search
const rnd=N.mulberry(3);
for(const M of N.MISSIONS){
  let valid=0,tot=2000,succ=0,t0=Date.now();const stats={};let best=null;
  for(let i=0;i<tot;i++){const d=N.sampleDesign(M,rnd);const e=N.evaluate(d,M);if(!e.valid){e.diag.filter(x=>x.sev==='critical').forEach(x=>stats[x.code]=(stats[x.code]||0)+1);continue;}valid++;
    const r=N.avgSim(d,M,[1,2,3]);if(r.success>0.5)succ++;if(!best||r.score>best.s){best={s:r.score,d,e}}}
  console.log('\n',M.id,'valid',valid,'/',tot,'succ>.5',succ,'ms',Date.now()-t0,stats);
  if(best){const e=best.e;console.log('best',best.s.toFixed(1),JSON.stringify(best.d),'mass',e.m0.toFixed(0),'cost',e.cost.toFixed(2),'dv',e.dvAvail.toFixed(0),'/',e.dvReq.toFixed(0),'insDays',e.insDays.toFixed(1),'ion',e.ion);}
}
