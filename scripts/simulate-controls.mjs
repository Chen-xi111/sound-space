// Production-engine control stimuli. No brain model and no human outcomes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {Renderer} from '../src/audio/dsp.js';
import {catalog,resources} from '../src/audio/catalog.js';
import {presetRecipe,assertPlayable} from '../src/product/recipes.js';
const dir=resolve(process.argv[2]??'/tmp/wave-controlled-simulation');mkdirSync(dir,{recursive:true});
const samples=[],assets={},assetFiles=new Set();
function load(recipe){for(const layer of recipe.layers){if(layer.source.kind!=='asset')continue;
  const ref=layer.source.assetRef,key=`${ref.id}@${ref.revision}`;if(assets[key])continue;
  const file=resources[catalog[key].resourceKey].slice(1),b=readFileSync(new URL('../'+file,import.meta.url));assetFiles.add(file);
  if(createHash('sha256').update(b).digest('hex')!==catalog[key].contentHash)throw new Error('Asset digest differs from production catalog');
  if(b.toString('ascii',36,40)!=='data'||b.readUInt16LE(20)!==1||b.readUInt16LE(34)!==16)throw new Error('Expected bundled PCM16 WAV');
  const channels=b.readUInt16LE(22);assets[key]={sampleRate:b.readUInt32LE(24),channels:Array.from({length:channels},(_,c)=>Float32Array.from({length:(b.length-44)/2/channels},(_,i)=>b.readInt16LE(44+2*(i*channels+c))/32768))};
}}
function render(name,value,rate,meta){
  assertPlayable(value);const r=value.recipe;load(r);
  const core=new Renderer(r,rate,assets,1),n=rate*24,a=new Float32Array(n),b=new Float32Array(n),data=new Float32Array(2*n);
  for(let at=0;at<n;at+=128)core.process(a.subarray(at,Math.min(n,at+128)),b.subarray(at,Math.min(n,at+128)));
  for(let i=0;i<n;i++){data[2*i]=a[i];data[2*i+1]=b[i];}
  writeFileSync(join(dir,name+'.f32'),Buffer.from(data.buffer));samples.push({name,rate,channels:2,...meta});
}
for(const rate of [44100,48000,96000])for(const offset of [0,10000,30000])for(const hz of [0,8,16]){
  const p=presetRecipe('study-break',1),r=p.recipe;
  r.layers[0].source.playback.startMs=offset;
  r.timeline.repeatCount=1;r.timeline.stages.length=1;
  r.timeline.stages[0].rhythmState.enabled=hz!==0;r.timeline.stages[0].rhythmState.rateHz=hz||16;
  render(`am-${rate}-${offset}-${hz}`,p,rate,{kind:'am',offset,hz});
}
render('binaural',presetRecipe('stereo-space',1),48000,{kind:'binaural'});
for(const id of ['soft-rain-focus','water-veil-rest'])for(const variant of ['mixed','carrier','noise']){
  const p=presetRecipe(id,1,{naturalOnly:false});
  if(variant!=='mixed')for(const layer of p.recipe.timeline.stages[0].layerStates)layer.enabled=(layer.layerId==='nature')===(variant==='carrier');
  render(`${id}-${variant}`,p,48000,{kind:'mix',preset:id,variant});
}
const files=['src/audio/dsp.js','src/product/recipes.js','src/audio/catalog.js',...assetFiles];
const sourceHashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')]));
writeFileSync(join(dir,'manifest.json'),JSON.stringify({sourceHashes,samples},null,2));
console.log(`${samples.length} production-engine conditions rendered to ${dir}`);
