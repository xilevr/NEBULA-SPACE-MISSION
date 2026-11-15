const N=require('../src/engine.js');const rnd=N.mulberry(5);
for(const M of N.MISSIONS){
 const rows=[];for(let i=0;i<4000&&rows.length<400;i++){const d=N.sampleDesign(M,rnd);const e=N.evaluate(d,M);if(!e.valid)continue;const r=N.avgSim(d,M,[1,2,3,4,5,6]);rows.push({r,e,d});}
 const bins={0:0,'(0,.5]':0,'(.5,1)':0,1:0};rows.forEach(x=>{const s=x.r.success;if(s===0)bins[0]++;else if(s<=.5)bins['(0,.5]']++;else if(s<1)bins['(.5,1)']++;else bins[1]++;});
 const sc=rows.map(x=>x.r.score).sort((a,b)=>a-b);
 console.log(M.id,'n',rows.length,'succ bins',bins,'score p10/50/90',sc[Math.floor(sc.length*.1)].toFixed(0),sc[Math.floor(sc.length*.5)].toFixed(0),sc[Math.floor(sc.length*.9)].toFixed(0));
 const def=rows.filter(x=>x.e.diag.some(y=>y.code==='ENERGY_DEFICIT'));console.log('  with energy deficit',def.length,'mean score',(def.reduce((a,x)=>a+x.r.score,0)/Math.max(1,def.length)).toFixed(1));
 const s1=N.simulate(rows[0].d,M,1);console.log('  sample result',s1.status,JSON.stringify(Object.fromEntries(Object.entries(s1.result).map(([k,v])=>[k,+(+v).toFixed(1)]))),'events',s1.events.length);
}
