import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog,resources} from '../src/audio/catalog.js';
import {LayerVoice} from '../src/audio/dsp.js';
import {presets,presetRecipe,customRecipe,previewRecipe} from '../src/product/recipes.js';
import {PersonalLibrary,savedRecipe} from '../src/product/library.js';
import {validateRecipe} from '../src/config/validate.js';
const carriers=presets.filter(p=>p.kind==='carrier');
const readPCM=ref=>{
  const metadata=catalog[`${ref.id}@${ref.revision}`],b=readFileSync(new URL('..'+resources[metadata.resourceKey],import.meta.url));
  return {sampleRate:24000,channels:[0,1].map(c=>Float32Array.from({length:(b.length-44)/4},(_,i)=>b.readInt16LE(44+i*4+c*2)/32768))};
};
for(const p of carriers)test(`${p.id}: new carrier retains an unfiltered live noise layer and coherent stereo sources`,()=>{
  const value=presetRecipe(p.id,undefined,{naturalOnly:false}),r=value.recipe,stage=r.timeline.stages[0];
  assert(validateRecipe(value,{catalog}).playable);
  assert.equal(r.layers[0].source.kind,'asset');
  assert.equal(catalog[`${r.layers[0].source.assetRef.id}@1`].channels,2);
  const noise=r.layers[1];assert.equal(noise.source.kind,'noise');assert.equal(noise.source.generatorVersion,'noise-v1');assert.equal(noise.source.color,'pink');assert.equal(noise.source.channels,'independentStereo');
  assert.equal(stage.layerStates.find(s=>s.layerId===noise.id).params.filter,null);
  assert.equal(r.rhythm.kind,'none');
  assert.equal(presetRecipe(p.id,1,{naturalOnly:true}).recipe.layers.length,1);
  assert.deepEqual(previewRecipe(value).recipe.layers,r.layers);
  assert.equal(presetRecipe(p.compareId,1,{naturalOnly:false}).recipe.layers.length,2);
});
test('recorded nature defaults to pure playback while explicit legacy mixes remain available',()=>{
  for(const p of presets.filter(p=>p.kind==='nature')){
    assert.equal(presetRecipe(p.id).recipe.layers.length,1);
    assert.equal(presetRecipe(p.id,1,{naturalOnly:false}).recipe.layers.length,2);
  }
});
for(const id of ['soft-rain-focus','water-veil-rest'])test(`${id}: matching head/tail avoids the crossfade energy dip and reaches the next sample continuously`,()=>{
  const r=presetRecipe(id).recipe,layer=r.layers[0],pcm=readPCM(layer.source.assetRef),frames=pcm.channels[0].length,cross=layer.source.playback.crossfadeMs*24;
  for(const channel of pcm.channels)assert.deepEqual(channel.slice(frames-cross),channel.slice(0,cross));
  const gain=r.timeline.stages[0].layerStates[0].gain;
  const voice=new LayerVoice(layer,r.timeline.stages[0].layerStates[0],24000,{[`${layer.source.assetRef.id}@1`]:pcm});
  voice.position=frames-cross;
  for(let i=0;i<=cross;i++){
    const output=voice.next();
    for(let c=0;c<2;c++)assert(Math.abs(output[c]-pcm.channels[c][i]*gain)<1e-7);
  }
});
test('saving a carrier with noise preserves the source version and stereo mix on reopening',async()=>{
  const draft={title:'绵雨组合',minutes:25,continuous:false,layers:[{id:'bed',assetRef:{id:'carrier-soft-rain',revision:1},gain:.55,enabled:true},{id:'noise',color:'pink',gain:.16,enabled:true}],rhythm:'none',centerHz:200,beatHz:10,rateHz:16,depth:.4};
  let raw=null;const options={storage:()=>({getItem:()=>raw,setItem:(_key,value)=>raw=value}),locks:{request:(_key,fn)=>fn()},id:()=> 'saved-carrier'};
  const lib=new PersonalLibrary(options);await lib.save(draft);
  const saved=savedRecipe(new PersonalLibrary(options).read().saved[0]);
  assert.deepEqual(saved.recipe.layers,customRecipe(draft).recipe.layers);
  assert.equal(saved.recipe.layers[1].source.channels,'independentStereo');
  draft.layers.shift();assert.equal(customRecipe(draft).recipe.layers[0].source.channels,'mono');
});
