import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog,resources} from '../src/audio/catalog.js';
import {loadAssets} from '../src/audio/assets.js';
import {LayerVoice} from '../src/audio/dsp.js';
import {presets,presetRecipe,customRecipe,previewRecipe} from '../src/product/recipes.js';
import {natureSounds} from '../src/product/nature.js';
import {recordingCredits} from '../src/product/credits.js';
import {PersonalLibrary,savedRecipe} from '../src/product/library.js';
import {SessionController} from '../src/product/session.js';
import {validateRecipe} from '../src/config/validate.js';

const naturalPresets=presets.filter(p=>p.kind==='nature');
const draft=()=>({title:'自然组合',minutes:25,continuous:false,layers:[{id:'rain',assetRef:{id:'nature-rain',revision:1},gain:.8,enabled:true},{id:'pink',color:'pink',gain:.08,enabled:true}],rhythm:'none',centerHz:200,beatHz:10,rateHz:16,depth:.4});
function wav(bytes){
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(34),16);
  assert.equal(bytes.toString('ascii',36,40),'data');assert.equal(bytes.readUInt32LE(40),bytes.length-44);
  const channels=bytes.readUInt16LE(22),sampleRate=bytes.readUInt32LE(24),length=(bytes.length-44)/channels/2;
  return {sampleRate,channels:Array.from({length:channels},(_,c)=>Float32Array.from({length},(_,i)=>bytes.readInt16LE(44+(i*channels+c)*2)/32768))};
}
const recordings=new Map();
for(const s of natureSounds){const key=`${s.assetId}@${s.revision}`,record=catalog[key],bytes=await readFile(new URL('..'+resources[record.resourceKey],import.meta.url));recordings.set(key,{bytes,pcm:wav(bytes)});}

for(const p of naturalPresets)test(`${p.id}: pure/mixed recipes and previews retain the same versioned recording`,()=>{
  for(const naturalOnly of [true,false]){
    const value=presetRecipe(p.id,1,{naturalOnly}),r=value.recipe;
    assert(validateRecipe(value,{catalog}).playable);
    assert.equal(r.layers.length,naturalOnly?1:2);assert.equal(r.layers[0].source.kind,'asset');
    assert.equal(r.timeline.stages[0].layerStates[0].gain,.8);
    assert.deepEqual(previewRecipe(value).recipe.layers,r.layers);
    assert(r.timeline.stages[0].fadeInMs+r.timeline.stages[0].fadeOutMs<=60000);
    assert.equal(r.rhythm.kind,'none');
  }
});
for(const [key,{bytes,pcm}] of recordings)test(`${key}: delivered file matches catalog and has bounded audible PCM`,()=>{
  const c=catalog[key];assert.equal(createHash('sha256').update(bytes).digest('hex'),c.contentHash);
  assert.equal(pcm.channels.length,c.channels);assert.equal(pcm.channels[0].length/pcm.sampleRate*1000,c.durationMs);
  assert(bytes.length<16*1024*1024);assert.equal(c.licenseStatus,'verified');
  assert(recordingCredits.some(x=>x.id===c.id&&x.author&&x.licenseUrl.startsWith('https://')));
  for(const channel of pcm.channels){let sum=0,peak=0;for(const x of channel){assert(Number.isFinite(x));sum+=x*x;peak=Math.max(peak,Math.abs(x));}
    assert(Math.sqrt(sum/channel.length)>.09);assert(peak<.81);
  }
});
for(const p of naturalPresets)test(`${p.id}: actual PCM crosses the loop boundary at both device sample rates`,()=>{
  const r=presetRecipe(p.id).recipe,layer=r.layers[0],key=`${layer.source.assetRef.id}@1`,pcm=recordings.get(key).pcm;
  for(const rate of [44100,48000]){
    const voice=new LayerVoice(layer,r.timeline.stages[0].layerStates[0],rate,{[key]:pcm});
    const cross=layer.source.playback.crossfadeMs*pcm.sampleRate/1000;
    // Land exactly at the loop seam; expected sample continues the already mixed head.
    voice.position=pcm.channels[0].length;
    const result=[...voice.next()];
    for(let c=0;c<2;c++){
      const channel=pcm.channels[Math.min(c,pcm.channels.length-1)];
      const expected=channel[cross]*.8*(pcm.channels.length===1?Math.SQRT1_2:1);
      assert(Math.abs(result[c]-expected)<1e-7);
    }
    assert.equal(voice.position,cross+pcm.sampleRate/rate);
    for(let i=0;i<rate;i++)assert(voice.next().every(Number.isFinite));
  }
});
test('natural drafts round trip alongside legacy noise drafts without losing source revisions',async()=>{
  let raw=null,n=0;const options={storage:()=>({getItem:()=>raw,setItem:(_k,v)=>raw=v}),locks:{request:(_k,fn)=>fn()},id:()=>`saved-${++n}`,now:()=> '2026-10-09T12:00:00.000Z'};
  const lib=new PersonalLibrary(options),old=draft();old.layers=old.layers.slice(1);
  await lib.save(old);await lib.save(draft());
  const reopened=new PersonalLibrary(options).read();assert.equal(reopened.saved.length,2);
  assert.deepEqual(reopened.saved[0].draft.layers,draft().layers);
  for(const e of reopened.saved)assert(validateRecipe(savedRecipe(e),{catalog}).playable);
  const d=draft();d.layers[0].assetRef.revision=999;assert.throws(()=>lib.save(d),/版本/);
  d.layers[0].assetRef.revision=1;d.layers[0].color='brown';assert.throws(()=>lib.save(d),/一种来源/);
  assert.equal(lib.read().saved.length,2);
});
test('natural sound supports continuous playback, AM target and independent binaural layer',()=>{
  const d=draft();d.continuous=true;d.rhythm='amplitudeModulation';
  const am=customRecipe(d);assert(validateRecipe(am,{catalog}).playable);assert.equal(am.recipe.rhythm.targetLayerId,'rain');
  d.rhythm='binaural';const beat=customRecipe(d);assert.equal(beat.recipe.layers.length,3);assert.equal(beat.recipe.layers[2].source.kind,'binaural');assert.equal(beat.recipe.timeline.stages[0].layerStates[2].params.beatHz,10);
  d.layers.push({...d.layers[0],id:'rain2'},{...d.layers[0],id:'rain3'});assert.throws(()=>customRecipe(d),/最多四/);
});
test('production session engines receive the bundled catalog and resource allowlist',()=>{
  const c=new SessionController();assert.equal(c.main.catalog,catalog);assert.equal(c.preview.resources,resources);
});
test('duplicate natural layers download only once and a missing recording never falls back to noise',async()=>{
  const oldFetch=globalThis.fetch,d=draft();d.layers.push({...d.layers[0],id:'rain2'});
  const recipe=customRecipe(d).recipe,{bytes,pcm}=recordings.get('nature-rain@1');let calls=0;
  const context={decodeAudioData:async()=>({sampleRate:pcm.sampleRate,numberOfChannels:1,length:pcm.channels[0].length,duration:30,getChannelData:()=>pcm.channels[0]})};
  try{
    globalThis.fetch=async url=>{calls++;assert.equal(url,resources['nature-rain-v1']);return new Response(bytes);};
    const loaded=await loadAssets(recipe,context,catalog,resources);assert.equal(calls,1);assert.deepEqual(Object.keys(loaded),['nature-rain@1']);
    globalThis.fetch=async()=>new Response('',{status:404});
    await assert.rejects(()=>loadAssets(recipe,context,catalog,resources),/ASSET_UNAVAILABLE/);
  }finally{globalThis.fetch=oldFetch;}
});
