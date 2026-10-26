// Tests the app's own DSP code (extracted from index.html) on synthetic guitar signals.
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const src=html.split('/*DSP-START*/')[1].split('/*DSP-END*/')[0];
eval(src.replace(/^function (\w+)/gm,'global.$1=function $1').replace(/^const (\w+)=/gm,'global.$1=')+';');
let worst=0,fails=0;
function test(name,f0,sr,opts){
  const B=opts.B??1.2e-4, N=4096, M=3*N, x=synthPluck(f0,sr,M+opts.offset,B,opts.noise??0.02,opts.seed??3);
  if(opts.weakFund){ // simulate phone mic roll-off: rebuild with fundamental at 10%
     for(let i=0;i<x.length;i++){ const t=i/sr; x[i]-=0.54*Math.exp(-t/1.5)*Math.sin(2*Math.PI*f0*Math.sqrt(1+B)*t); }
  }
  const win=x.subarray(opts.offset,opts.offset+M); const r=detectPitch(win.subarray(M-N),sr,60,1400); if(r&&!opts.raw){ const fr=fundamentalPitch(win,sr,r.f,N); if(fr) r.f=fr; } const truth=f0*Math.sqrt(1+B);
  const e=r?cents(r.f,truth):NaN; worst=Math.max(worst,Math.abs(e)||99); if(!(Math.abs(e)<1))fails++;
  console.log(name.padEnd(34),truth.toFixed(3).padStart(9),(r?r.f.toFixed(3):'null').padStart(9),(isNaN(e)?'NaN':e.toFixed(3)).padStart(8),'c  clarity',r?r.clarity.toFixed(3):'-');
}
for(const sr of [48000,44100]) for(const [n,f] of [['E2',82.41],['A2',110],['D3',146.83],['G3',196],['B3',246.94],['E4',329.63],['E3 harm',164.81],['E5 harm',659.26]]){
  test(`${n} sr${sr}`,f,sr,{offset:2048});
  test(`${n} sr${sr} late decay`,f,sr,{offset:sr*2,noise:0.004});
  test(`${n} sr${sr} weak fundamental`,f,sr,{offset:2048,weakFund:true});
  test(`${n} sr${sr} noisy`,f,sr,{offset:2048,noise:0.15,seed:9});
}
console.log('worst |error| cents:',worst.toFixed(3),' failures(>1c):',fails);

// Spectrum / inharmonicity check: build dB spectrum like the AnalyserNode (Blackman window, 32768)
function dbSpectrum(x){ const n=x.length, re=new Float64Array(n), im=new Float64Array(n);
  for(let i=0;i<n;i++){ const w=0.42-0.5*Math.cos(2*Math.PI*i/n)+0.08*Math.cos(4*Math.PI*i/n); re[i]=x[i]*w; }
  fft(re,im,false); const db=new Float32Array(n/2); for(let k=0;k<n/2;k++) db[k]=20*Math.log10(Math.hypot(re[k],im[k])/n+1e-12); return db; }
for(const [f0,B] of [[82.41,1e-4],[110,2e-4],[196,5e-5],[329.63,3e-5]]){
  const sr=48000, x=synthPluck(f0,sr,32768,B,0.005,5), db=dbSpectrum(x), parts=findPartials(db,sr/32768,f0*Math.sqrt(1+B),10), Bh=fitInharmonicity(parts);
  console.log(`B test f0=${f0}: true ${(B*1e4).toFixed(2)}e-4  fitted ${Bh==null?'null':(Bh*1e4).toFixed(2)+'e-4'}  partials found ${parts.length}`);
}
// Saddle formula: simulate the geometry directly and confirm the shift removes the error.
for(const [L,c] of [[647.7,5],[647.7,-8],[628.65,12],[650,2.5]]){
  const d=saddleShift(L,c), k=Math.pow(2,c/1200); // after the move: ratio fretted/harmonic = k*(L+d)/(L+2d)
  const resid=1200*Math.log2(k*(L+d)/(L+2*d));
  console.log(`saddle L=${L} err=${c}c -> move ${d.toFixed(3)} mm, residual ${resid.toExponential(2)} c`);
}
// Tension check against D'Addario's published EXL110 tensions at 25.5" (lb): 16.2 15.4 16.6 18.4 19.5 17.5
const uw=[0.00002215,0.00003744,0.00006402,0.00012671,0.00023964,0.00038216], fhz=[329.63,246.94,196.00,146.83,110.00,82.41], pub=[16.2,15.4,16.6,18.4,19.5,17.5];
console.log('EXL110 tension (lb) computed vs published:',uw.map((u,i)=>(tensionN(u*17.858,0.6477,fhz[i])/4.44822).toFixed(1)+'/'+pub[i]).join('  '));
