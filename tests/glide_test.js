// Simulates turning the peg while a plucked string decays, and runs the app's frame analysis.
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const src=html.split('/*DSP-START*/')[1].split('/*DSP-END*/')[0];
eval(src.replace(/^function (\w+)/gm,'global.$1=function $1').replace(/^const (\w+)=/gm,'global.$1=')+';');
function glide(f0,c0,c1,secs,sr,amp,tau,noise,seed){
  let s=seed||1; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const N=Math.floor(secs*sr), x=new Float32Array(N), fInst=new Float32Array(N), ph=new Float64Array(9); const B=1e-4;
  for(let i=0;i<N;i++){ const t=i/sr, c=c0+(c1-c0)*Math.min(1,t/(secs*0.8)), f=f0*Math.pow(2,c/1200); fInst[i]=f*Math.sqrt(1+B);
    let v=0; for(let n=1;n<=8;n++){ ph[n]+=2*Math.PI*n*f*Math.sqrt(1+B*n*n)/sr; v+=(n===1?0.5:1)/n*Math.exp(-t*n/(tau*3))*Math.sin(ph[n]); }
    x[i]=amp*Math.exp(-t/tau)*v+noise*(rnd()*2-1); }
  return {x,fInst};
}
function run(label, analyze){
  for(const [name,f0] of [['low E',82.41],['A',110],['G',196],['high E',329.63]]){
    const sr=48000, {x,fInst}=glide(f0,-35,0,4,sr,0.12,1.1,0.01,7), hop=Math.round(sr/60), W=3*4096;
    let frames=0,valid=0,errs=[];
    const trk=makeTracker();
    for(let end=W;end<=x.length;end+=hop){ frames++; const r=analyze(trk,x.subarray(end-W,end),sr,end/sr*1000);
      if(r){ valid++; errs.push(Math.abs(cents(r,fInst[end-1]))); } }
    errs.sort((a,b)=>a-b);
    console.log(label.padEnd(10),name.padEnd(7),'coverage',(100*valid/frames).toFixed(0).padStart(3)+'%','median err',(errs[errs.length>>1]||0).toFixed(2),'c  p95',(errs[Math.floor(errs.length*0.95)]||0).toFixed(2),'c');
  }
}
// old behaviour: detect only (level > -66 dB, clarity > 0.8), fixed 4096 window
run('old',(trk,buf,sr)=>{ const seg=buf.subarray(buf.length-4096); if(rmsDb(seg)<=-66) return null; const r=detectPitch(seg,sr,60,1400); if(!r||r.clarity<=0.8) return null; return fundamentalPitch(buf,sr,r.f,4096)||r.f; });
if(typeof makeTracker==='function' && makeTracker.length===0 && global.__hasTracker) {}
run('new',(trk,buf,sr,now)=>{ const r=trk.step(buf,sr,now); return r.f; });

// Display smoothness: frame-to-frame needle movement while the peg is turned (A string, -35 -> 0 cents)
{
  const sr=48000, {x,fInst}=glide(110,-35,0,4,sr,0.12,1.1,0.01,7), hop=Math.round(sr/60), W=3*4096, target=110;
  // old display: median of last 120 ms of detect-only readings, EMA 0.45, freezes when readings stop
  let rd=[], dOld=null, jumpsOld=[], liveOld=0;
  // new display: tracker + spring (w=22, zeta=1)
  const trk=makeTracker(); let dNew=null, v=0, tgt=null, last=-1e9, jumpsNew=[], liveNew=0;
  let k=0;
  for(let end=W;end<=x.length;end+=hop,k++){
    const now=k*1000/60, buf=x.subarray(end-W,end);
    const seg=buf.subarray(buf.length-4096); let f=null;
    if(rmsDb(seg)>-66){ const r=detectPitch(seg,sr,60,1400); if(r&&r.clarity>0.8) f=fundamentalPitch(buf,sr,r.f,4096)||r.f; }
    rd.push({f,t:now}); rd=rd.filter(q=>now-q.t<120&&q.f); const m=rd.map(q=>q.f).sort((a,b)=>a-b);
    if(m.length>=2){ const c=cents(m[m.length>>1],target), prev=dOld; dOld=(dOld==null||Math.abs(c-dOld)>25)?c:dOld+0.45*(c-dOld); if(prev!=null) jumpsOld.push(Math.abs(dOld-prev)); liveOld++; }
    const r2=trk.step(buf,sr,now); if(r2.f){ tgt=cents(r2.f,target); last=now; if(dNew==null) dNew=tgt; }
    if(dNew!=null&&now-last<1500){ const prev=dNew; const a=22*22*(tgt-dNew)-2*22*v; v+=a/60; dNew+=v/60; jumpsNew.push(Math.abs(dNew-prev)); liveNew++; }
  }
  const p=(a,q)=>{a=a.slice().sort((x,y)=>x-y); return a[Math.floor(a.length*q)]||0;};
  console.log('display old: live frames',liveOld,' max jump/frame',Math.max(...jumpsOld).toFixed(2),'c  p95',p(jumpsOld,0.95).toFixed(2));
  console.log('display new: live frames',liveNew,' max jump/frame',Math.max(...jumpsNew).toFixed(2),'c  p95',p(jumpsNew,0.95).toFixed(2));
}
