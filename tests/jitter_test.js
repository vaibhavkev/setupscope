// Messy, realistic guitar signals: weak fundamental, strong 2nd harmonic, pick-attack noise burst,
// a sympathetic string ringing, amplitude flutter and room noise. Measures needle jitter and lag.
// Usage: node tests/jitter_test.js [path-to-old-index.html]
const fs=require('fs');
function load(file){
  const html=fs.readFileSync(file,'utf8'), src=html.split('/*DSP-START*/')[1].split('/*DSP-END*/')[0];
  return new Function(src+';return {makeTracker,cents,makeDisplay:typeof makeDisplay==="undefined"?null:makeDisplay};')();
}
function messy(f0,cFrom,cTo,secs,sr,seed,glideStart){
  let s=seed||1; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const N=Math.floor(secs*sr), x=new Float32Array(N), fT=new Float32Array(N), ph=new Float64Array(10), B=1.2e-4;
  let flut=1, phs=0;
  for(let i=0;i<N;i++){
    const t=i/sr, prog=Math.max(0,Math.min(1,(t-glideStart)/(secs-glideStart-0.5))), c=cFrom+(cTo-cFrom)*prog, f=f0*Math.pow(2,c/1200); fT[i]=f*Math.sqrt(1+B);
    if(i%480===0) flut=1+0.03*(rnd()*2-1);
    let v=0; const amps=[0,0.25,1,0.6,0.45,0.3,0.22,0.15,0.1,0.07];
    for(let n=1;n<=9;n++){ ph[n]+=2*Math.PI*n*f*Math.sqrt(1+B*n*n)/sr; v+=amps[n]*Math.exp(-t*n/4)*Math.sin(ph[n]); }
    phs+=2*Math.PI*82.41*0.5/sr*2; // sympathetic low string (one octave down region), faint
    x[i]=0.15*flut*Math.exp(-t/1.6)*v + 0.006*Math.exp(-t/2)*Math.sin(phs) + 0.012*(rnd()*2-1) + (t<0.04?0.25*(rnd()*2-1)*(1-t/0.04):0);
  }
  return {x,fT};
}
function simulate(g, kind, sig, target){
  const sr=48000, hop=Math.round(sr/60), W=16384, out=[];
  if(kind==='old'){ // tracker + spring (previous app version)
    const trk=g.makeTracker(); let d=null,v=0,tgt=null,last=-1e9;
    for(let end=W,k=0;end<=sig.x.length;end+=hop,k++){ const now=k*1000/60, r=trk.step(sig.x.subarray(end-W,end),sr,now);
      if(r.f){ tgt=g.cents(r.f,target); last=now; if(d==null) d=tgt; }
      if(d!=null&&now-last<1500){ const a=22*22*(tgt-d)-2*22*v; v+=a/60; d+=v/60; }
      out.push({t:now,d,truth:g.cents(sig.fT[end-1],target)}); }
  } else {
    const trk=g.makeTracker(), disp=g.makeDisplay();
    for(let end=W,k=0;end<=sig.x.length;end+=hop,k++){ const now=k*1000/60, r=trk.step(sig.x.subarray(end-W,end),sr,now);
      const d=disp.step(r.f?g.cents(r.f,target):null,now,r.onset);
      out.push({t:now,d,truth:g.cents(sig.fT[end-1],target)}); }
  }
  return out;
}
function stats(out,t0,t1){
  const w=out.filter(o=>o.t>=t0&&o.t<=t1&&o.d!=null);
  if(!w.length) return {n:0};
  const diffs=[]; for(let i=1;i<w.length;i++) diffs.push(Math.abs(w[i].d-w[i-1].d));
  const err=w.map(o=>o.d-o.truth), mean=err.reduce((a,b)=>a+b,0)/err.length, sd=Math.sqrt(err.reduce((a,b)=>a+(b-mean)**2,0)/err.length);
  diffs.sort((a,b)=>a-b);
  return {n:w.length, sd:sd.toFixed(2), bias:mean.toFixed(2), maxErr:Math.max(...err.map(Math.abs)).toFixed(1), p95step:(diffs[Math.floor(diffs.length*0.95)]||0).toFixed(2), maxStep:(diffs[diffs.length-1]||0).toFixed(2)};
}
const NEW=load(__dirname+'/../index.html'), OLD=process.argv[2]?load(process.argv[2]):null;
for(const [name,f0] of [['low E',82.41],['A',110],['D',146.83],['G',196],['B',246.94],['high E',329.63]]){
  const steady=messy(f0,-10,-10,3,48000,11,99), glide=messy(f0,-30,0,3.5,48000,5,0.3);
  const line=(lab,g,kind)=>{ const s1=stats(simulate(g,kind,steady,f0),300,2500), s2=stats(simulate(g,kind,glide,f0),500,3000);
    console.log(`${lab.padEnd(4)} ${name.padEnd(7)} steady: jitter sd ${s1.sd}c, max err ${s1.maxErr}c, p95 frame step ${s1.p95step}c | glide: sd ${s2.sd}c, bias(lag) ${s2.bias}c, frames ${s2.n}`); };
  if(OLD) line('old',OLD,'old');
  line('new',NEW,'new');
}

// Strumming: all six strings ring while one of them is tuned (glides -30 -> 0 cents).
function strum(tuneIdx,secs,sr,seed){
  let s=seed||1; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const F=[82.41,110,146.83,196,246.94,329.63], det=[3,-4,2,-5,4,-2], N=Math.floor(secs*sr), x=new Float32Array(N), fT=new Float32Array(N);
  const ph=F.map(()=>new Float64Array(9)), B=1.2e-4, amps=[0,0.4,1,0.6,0.45,0.3,0.2,0.14,0.1];
  for(let i=0;i<N;i++){ const t=i/sr; let v=0;
    for(let k=0;k<6;k++){ const c=k===tuneIdx?-30+30*Math.min(1,Math.max(0,(t-0.3)/(secs-0.8))):det[k], f=F[k]*Math.pow(2,c/1200); if(k===tuneIdx) fT[i]=f*Math.sqrt(1+B);
      for(let n=1;n<=8;n++){ ph[k][n]+=2*Math.PI*n*f*Math.sqrt(1+B*n*n)/sr; v+=amps[n]*Math.exp(-t*n/4)*Math.sin(ph[k][n]); } }
    x[i]=0.05*Math.exp(-t/1.6)*v+0.01*(rnd()*2-1)+(t<0.04?0.25*(rnd()*2-1):0); }
  return {x,fT};
}
console.log('\nStrumming all six strings while tuning one (manual string choice):');
for(const [k,name,f0] of [[0,'low E',82.41],[1,'A',110],[2,'D',146.83],[3,'G',196],[4,'B',246.94],[5,'high E',329.63]]){
  const sig=strum(k,3.5,48000,13), sr=48000, hop=Math.round(sr/60), W=16384;
  const runOne=(g,focus)=>{ const trk=g.makeTracker(), disp=g.makeDisplay?g.makeDisplay():null; const out=[]; let d=null,v=0,tgt=null,last=-1e9;
    for(let end=W,j=0;end<=sig.x.length;end+=hop,j++){ const now=j*1000/60, r=trk.step(sig.x.subarray(end-W,end),sr,now,focus?f0:undefined);
      if(disp){ d=disp.step(r.f?g.cents(r.f,f0):null,now,r.onset); }
      else { if(r.f){ tgt=g.cents(r.f,f0); last=now; if(d==null) d=tgt; } if(d!=null&&now-last<1500){ const a=22*22*(tgt-d)-2*22*v; v+=a/60; d+=v/60; } }
      out.push({t:now,d,truth:g.cents(sig.fT[end-1],f0)}); }
    return stats(out,500,3000); };
  const o=OLD?runOne(OLD,false):null, n=runOne(NEW,true);
  console.log(`${name.padEnd(7)} ${o?`old: err sd ${o.sd}c, max err ${o.maxErr}c | `:''}new (focused): err sd ${n.sd}c, max err ${n.maxErr}c, frames ${n.n}`);
}
