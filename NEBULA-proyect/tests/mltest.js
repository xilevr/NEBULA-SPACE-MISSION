const N=require('../src/engine.js');
for(const M of N.MISSIONS){
 const rnd=N.mulberry(42);let t0=Date.now();const S=[];let tries=0;while(S.length<1400&&tries<40000){tries++;const s=N.makeSample(M,rnd);if(s)S.push(s);}
 const t1=Date.now();
 const idx=S.map((_,i)=>i).sort(()=>rnd()-.5);const nTr=Math.floor(S.length*.8),tr=idx.slice(0,nTr),te=idx.slice(nTr);
 const X=S.map(s=>s.x),Y=S.map(s=>s.y);const net=new N.MLP([7,14,8,3],rnd);
 for(let ep=0;ep<140;ep++){const sh=tr.slice().sort(()=>rnd()-.5);for(let b=0;b<sh.length;b+=64)net.trainBatch(X,Y,sh.slice(b,b+64),0.01);}
 const t2=Date.now();
 const mean=[0,1,2].map(j=>tr.reduce((a,i)=>a+Y[i][j],0)/tr.length);
 let mae=[0,0,0],base=[0,0,0];te.forEach(i=>{const o=net.forward(X[i]);for(let j=0;j<3;j++){mae[j]+=Math.abs(o[j]-Y[i][j]);base[j]+=Math.abs(mean[j]-Y[i][j]);}});
 console.log(M.id,'samples',S.length,'tries',tries,'gen ms',t1-t0,'train ms',t2-t1,'MAE',mae.map(v=>(v/te.length).toFixed(3)),'baseline',base.map(v=>(v/te.length).toFixed(3)));
 const t3=Date.now();const best=N.optimize(N.sampleDesign(M,rnd),M,{iters:500});console.log('  optimize ms',Date.now()-t3,'score',best.stats.score.toFixed(1),'succ',best.stats.success);
}
