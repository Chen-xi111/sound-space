import test from 'node:test';
import assert from 'node:assert/strict';
import {BandModulator,Renderer,Noise} from '../src/audio/dsp.js';
import {presetRecipe,previewRecipe,personalDraft,customRecipe,defaultNaturalOnly,presets} from '../src/product/recipes.js';
import {validateRecipe} from '../src/config/validate.js';
import {catalog} from '../src/audio/catalog.js';
import {PersonalLibrary,savedRecipe} from '../src/product/library.js';
const band={lowHz:200,highHz:1000};
const amplitude=(samples,hz,rate)=>{
  let re=0,im=0;for(let i=0;i<samples.length;i++){re+=samples[i]*Math.cos(2*Math.PI*hz*i/rate);im+=samples[i]*Math.sin(2*Math.PI*hz*i/rate);}
  return 2*Math.hypot(re,im)/samples.length;
};
for(const rate of [44100,48000,96000])test(`band AM actual sidebands and channel isolation at ${rate} Hz`,()=>{
  const ratios=[];
  for(const hz of [80,500,4000]){
    const m=new BandModulator(band,rate),out=new Float64Array(rate);
    for(let i=0;i<rate*2;i++){
      const pair=m.next([Math.sin(2*Math.PI*hz*i/rate),0],2*Math.PI*16*i/rate,.4);
      assert.equal(pair[1],0);
      if(i>=rate)out[i-rate]=pair[0];
    }
    const carrier=amplitude(out,hz,rate),side=amplitude(out,hz+16,rate);
    assert(Math.abs(carrier-1)<1e-8); // Dry tone remains at its original level.
    assert(Math.abs(side-amplitude(out,hz-16,rate))<1e-8);
    assert(amplitude(out,hz+12,rate)<1e-8); // 16 Hz, not just any tremolo.
    ratios.push(side/carrier);
  }
  assert(ratios[1]>.18&&ratios[1]<.21,JSON.stringify(ratios));
  assert(ratios[0]<ratios[1]/5);assert(ratios[2]<ratios[1]/12);
});
test('zero-depth band AM is sample-exact dry signal even with filter history',()=>{
  const m=new BandModulator(band,48000);
  for(let i=0;i<3000;i++){const pair=[Math.sin(i*.19),Math.cos(i*.31)];if(i<1000)m.next(pair,i,.4);else assert.deepEqual(m.next(pair,i,0),pair);}
});
test('unsupported band processor and invalid band fail closed',()=>{
  for(const edit of [r=>r.rhythm.processorVersion='future',r=>r.rhythm.band.lowHz=1000,r=>r.rhythm.band.highHz=24000]){
    const p=presetRecipe('study-break');edit(p.recipe);assert.equal(validateRecipe(p,{catalog}).playable,false);
  }
  const p=presetRecipe('study-break');assert.equal(validateRecipe(p,{catalog,sampleRate:2000}).playable,false);
});
test('preview preserves band configuration and paused/quiet stages emit no residual filter output',()=>{
  const p=presetRecipe('study-break',1),sample=previewRecipe(p);
  assert.deepEqual(sample.recipe.rhythm,p.recipe.rhythm);assert.deepEqual(sample.recipe.layers,p.recipe.layers);
  assert.equal(sample.recipe.timeline.stages[0].rhythmState.depth,.4);
  const assets={'carrier-soft-rain@1':{sampleRate:48000,channels:[new Float32Array(48000).fill(.2),new Float32Array(48000).fill(.1)]}};
  const r=new Renderer(p.recipe,48000,assets,0),a=new Float32Array(4800),b=new Float32Array(4800);
  r.process(a,b);assert(a.every(v=>v===0));r.volume(1);r.process(a,b);assert(a.some(v=>v!==0));
  r.pause();r.process(a,b);const frame=r.frame;r.process(a,b);assert(a.every(v=>v===0));assert.equal(r.frame,frame);
  r.seekMs(60000);r.resume();r.process(a,b);assert(a.every(v=>v===0));assert(b.every(v=>v===0));
});
test('band preset snapshots and legacy drafts coexist through backup restore',async()=>{
  let n=0;const data=new Map();const lib=new PersonalLibrary({storage:()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}),locks:{request:(_k,fn)=>fn()},id:()=>`band-${++n}`});
  const sample=previewRecipe(presetRecipe('study-break'));sample.recipe.timeline.stages[0].durationMs=60000;
  const d=personalDraft(sample);await lib.save(d);
  const old={title:'旧调制',minutes:10,continuous:false,layers:[{id:'a',color:'pink',gain:.3,enabled:true}],rhythm:'amplitudeModulation',centerHz:200,beatHz:10,rateHz:16,depth:.4};
  await lib.save(old);const before=lib.read().saved.map(savedRecipe),raw=lib.backup();data.clear();await lib.importBackup(raw);
  assert.deepEqual(lib.read().saved.map(savedRecipe),before);
  assert.equal(customRecipe(old).recipe.rhythm.processorVersion,undefined);
});
test('sleep pure default is consistent and explicit existing mixes remain intact',()=>{
  const p=presets.find(x=>x.id==='soft-rain-sleep');assert.equal(defaultNaturalOnly(p),true);
  assert.equal(presetRecipe(p.id).recipe.layers.length,1);
  const legacy=presetRecipe(p.id,30,{naturalOnly:false});assert.equal(legacy.recipe.layers.length,2);
  assert.equal(legacy.recipe.timeline.stages[0].layerStates[1].gain,.12);
  assert.deepEqual(customRecipe(personalDraft(legacy)).recipe.layers,legacy.recipe.layers);
  assert.equal(legacy.recipe.timeline.stages[0].fadeOutMs,300000);
});
test('brown v2 keeps RMS stable across sample rates; v1 and 48 kHz anchor remain unchanged',()=>{
  const rms=[];
  for(const rate of [44100,48000,96000]){
    const n=new Noise('brown',29,rate,'noise-v2'),old=new Noise('brown',29,rate),explicit=new Noise('brown',29,rate,'noise-v1');let power=0;
    for(let i=0;i<rate*15;i++){
      const x=n.next(),legacy=old.next();assert.equal(legacy,explicit.next());if(rate===48000)assert.equal(x,legacy);
      if(i>=rate)power+=x*x;
    }
    rms.push(Math.sqrt(power/(rate*14)));
  }
  assert(20*Math.log10(Math.max(...rms)/Math.min(...rms))<.5,JSON.stringify(rms));
  const d=personalDraft(presetRecipe('before-sleep'));assert.equal(customRecipe(d).recipe.layers[0].source.generatorVersion,'noise-v2');
  d.template.recipe.layers[0].source.generatorVersion='noise-v1';assert.equal(customRecipe(d).recipe.layers[0].source.generatorVersion,'noise-v1');
});
