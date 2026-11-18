// Actual production DSP, no sound device. Raw intermediates belong in a temp dir.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Noise,Renderer} from '../src/audio/dsp.js';
import {catalog,resources} from '../src/audio/catalog.js';
import {presetRecipe} from '../src/product/recipes.js';
const dir=resolve(process.argv[2]??'/tmp/wave-sound-characterization');mkdirSync(dir,{recursive:true});
const manifest=[];
function raw(name,data,metadata){writeFileSync(join(dir,name+'.f32'),Buffer.from(data.buffer,data.byteOffset,data.byteLength));manifest.push({name,...metadata});}
for(const rate of [44100,48000,96000])for(const color of ['white','pink','brown']){
  const n=new Noise(color,29,rate);for(let i=0;i<rate;i++)n.next();
  raw(`${color}-${rate}`,Float32Array.from({length:rate*12},()=>n.next()),{kind:'noise',color,rate,channels:1});
}
for(const rate of [44100,48000,96000]){
  const n=new Noise('brown',29,rate,'noise-v2');for(let i=0;i<rate;i++)n.next();
  raw(`brown-v2-${rate}`,Float32Array.from({length:rate*12},()=>n.next()),{kind:'noise',color:'brown',version:'noise-v2',rate,channels:1});
}
const p=presetRecipe('study-break',1).recipe,assets={};
for(const l of p.layers){const ref=l.source.assetRef,key=`${ref.id}@${ref.revision}`,meta=catalog[key],b=readFileSync(new URL('..'+resources[meta.resourceKey],import.meta.url));
  if(b.toString('ascii',36,40)!=='data'||b.readUInt16LE(20)!==1||b.readUInt16LE(34)!==16)throw new Error('Expected bundled PCM16 WAV');
  const channels=b.readUInt16LE(22),rate=b.readUInt32LE(24);
  assets[key]={sampleRate:rate,channels:Array.from({length:channels},(_,c)=>Float32Array.from({length:(b.length-44)/channels/2},(_,i)=>b.readInt16LE(44+2*(i*channels+c))/32768))};
}
for(const variant of ['dry','wide','band']){
  const r=structuredClone(p);r.timeline.repeatCount=1;r.timeline.stages.length=1;
  if(variant==='wide'){r.rhythm={kind:'amplitudeModulation',targetLayerId:'nature',waveform:'sine'};r.timeline.stages[0].rhythmState.depth=4/7;} // legacy depth -> modulation index 0.4
  if(variant==='dry')r.timeline.stages[0].rhythmState.enabled=false;
  const rate=48000,core=new Renderer(r,rate,assets,1),data=new Float32Array(rate*60*2),left=new Float32Array(128),right=new Float32Array(128);
  for(let offset=0;offset<rate*60;offset+=128){core.process(left,right);for(let i=0;i<128&&offset+i<rate*60;i++){data[(offset+i)*2]=left[i];data[(offset+i)*2+1]=right[i];}}
  raw(`carrier-${variant}`,data,{kind:'carrier',variant,rate,channels:2,modulationIndex:variant==='dry'?0:.4});
}
writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
const levels=[];
for(const rate of [44100,48000,96000])for(const id of ['even-background','reading','low-background']){
  const r=presetRecipe(id,1).recipe,core=new Renderer(r,rate,{},1),a=new Float32Array(rate*15),b=new Float32Array(a.length);core.process(a,b);
  let power=0;for(let i=rate*3;i<a.length;i++)power+=(a[i]**2+b[i]**2)/2;
  levels.push({id,rate,layerGain:r.timeline.stages[0].layerStates[0].gain,rmsDbFS:10*Math.log10(power/(rate*12))});
}
writeFileSync(join(dir,'preset-levels.json'),JSON.stringify(levels,null,2));
console.log(dir);
