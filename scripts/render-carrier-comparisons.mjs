// Render through the actual application DSP; use equal RMS only in these
// comparison exports so an output level change cannot masquerade as improvement.
import {readFileSync,writeFileSync} from 'node:fs';
import {Renderer} from '../src/audio/dsp.js';
import {catalog,resources} from '../src/audio/catalog.js';
import {presetRecipe} from '../src/product/recipes.js';
const dir=new URL('../docs/verification/carriers/',import.meta.url);
function decoded(ref){
  const record=catalog[`${ref.id}@${ref.revision}`],b=readFileSync(new URL('..'+resources[record.resourceKey],import.meta.url));
  const channels=b.readUInt16LE(22),sampleRate=b.readUInt32LE(24),n=(b.length-44)/channels/2;
  return {sampleRate,channels:Array.from({length:channels},(_,c)=>Float32Array.from({length:n},(_,i)=>b.readInt16LE(44+2*(i*channels+c))/32768))};
}
const manifest=[];
for(const [name,id] of [['rain-before','rain-focus'],['rain-after','soft-rain-focus'],['water-before','stream-rest'],['water-after','water-veil-rest']]){
  const r=presetRecipe(id,1,{naturalOnly:false}).recipe;
  r.timeline.stages[0].durationMs=20000;r.timeline.stages[0].fadeInMs=500;r.timeline.stages[0].fadeOutMs=500;
  const assets={};for(const l of r.layers)if(l.source.kind==='asset'){const ref=l.source.assetRef;assets[`${ref.id}@${ref.revision}`]=decoded(ref);}
  const renderer=new Renderer(r,48000,assets,1),left=new Float32Array(960000),right=new Float32Array(960000);
  renderer.process(left,right);
  let sum=0,peak=0;for(let i=0;i<left.length;i++){sum+=left[i]**2+right[i]**2;peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
  const rms=Math.sqrt(sum/(2*left.length)),gain=10**(-24/20)/rms;
  if(peak*gain>.9)throw new Error('Comparison normalization would exceed peak headroom');
  const n=left.length/2,b=Buffer.alloc(44+n*4);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);
  for(let i=0;i<n;i++)for(const [c,data] of [left,right].entries())b.writeInt16LE(Math.round((data[i*2]+data[i*2+1])*.5*gain*32767),44+4*i+2*c);
  writeFileSync(new URL(name+'.wav',dir),b);manifest.push({name,id,applicationRmsAtMaster1:rms,applicationPeak:peak,comparisonGain:gain,comparisonTargetDbFS:-24});
}
writeFileSync(new URL('comparison-levels.json',dir),JSON.stringify(manifest,null,2)+'\n');
console.log(manifest);
