import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stimulusStatus} from '../src/product/stimulus.js';
import {presetRecipe,customRecipe,assertPlayable} from '../src/product/recipes.js';
import {Renderer} from '../src/audio/dsp.js';

const draft=()=>({title:'对照',minutes:1,continuous:false,layers:[{id:'target',color:'pink',gain:.2,enabled:true},{id:'other',color:'brown',gain:.15,enabled:true}],rhythm:'amplitudeModulation',centerHz:200,beatHz:10,rateHz:16,depth:.4});
test('stimulus status reports actual target, rate and inactive depth without claiming a brain state',()=>{
  const r=customRecipe(draft()).recipe;assert(stimulusStatus(r).active);assert.match(stimulusStatus(r).text,/粉红噪声 · 16 Hz/);
  r.timeline.stages[0].rhythmState.depth=0;assert.equal(stimulusStatus(r).active,false);
  assert.match(stimulusStatus(r).text,/深度为零/);
});
test('disabled or zero-gain target has no AM effect although other layers still produce sound',()=>{
  for(const mode of ['disabled','zero','depth']){
    const p=customRecipe(draft()),st=p.recipe.timeline.stages[0];
    if(mode==='disabled')st.layerStates[0].enabled=false;
    if(mode==='zero')st.layerStates[0].gain=0;
    if(mode==='depth')st.rhythmState.depth=0;
    const control=structuredClone(p);control.recipe.timeline.stages[0].rhythmState.enabled=false;
    assertPlayable(p);assertPlayable(control);assert.equal(stimulusStatus(p.recipe).active,false);
    const render=x=>{const r=new Renderer(x.recipe,48000,{},1),a=new Float32Array(48000),b=new Float32Array(48000);r.process(a,b);return a;};
    const output=render(p);assert(output.some(x=>x!==0));assert.deepEqual(output,render(control));
  }
});
test('runtime mute overrides saved gain and inactive playback never claims output',()=>{
  const r=customRecipe(draft()).recipe;
  assert.equal(stimulusStatus(r,{gains:{target:0}}).active,false);
  assert.equal(stimulusStatus(r,{master:0}).text,'当前静音 节律不会发声');
  for(const state of ['paused','stopped','completed','preparing','error'])assert.equal(stimulusStatus(r,{state}).text,'');
  assert.equal(stimulusStatus(r,{gains:{other:0}}).active,true);
});
test('quiet stages and binaural disabled layers are not described as active',()=>{
  const r=presetRecipe('study-break').recipe;assert.equal(stimulusStatus(r,{stage:r.timeline.stages[1]}).active,false);
  const b=presetRecipe('stereo-space').recipe;assert.match(stimulusStatus(b).text,/10 Hz.*立体声耳机/);
  assert.equal(stimulusStatus(b,{gains:{beat:0}}).active,false);
  assert.equal(stimulusStatus(presetRecipe('reading').recipe).text,'');
});
test('controlled simulation is tied to current production sources and includes negative controls',()=>{
  const report=JSON.parse(readFileSync(new URL('../docs/verification/controls-2026-10-28/results.json',import.meta.url)));
  for(const [file,hash] of Object.entries(report.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),hash,`Regenerate sound controls after changing ${file}`);
  assert.equal(report.am.length,27);
  for(const rate of [44100,48000,96000])for(const offset of [0,10000,30000]){
    const rows=report.am.filter(r=>r.rate===rate&&r.offsetMs===offset);assert.deepEqual(rows.map(r=>r.conditionHz),[0,8,16]);
    assert(rows[2].at16Hz>5*Math.max(rows[0].at16Hz,rows[1].at16Hz));
    assert(rows.every(r=>Math.abs(r.matchedRmsDbFS+24)<1e-6));
  }
  assert.equal(report.binaural.monoDifferenceRms,0);
  assert(report.expectationIllustration.noTrueNoExpectation>.03&&report.expectationIllustration.noTrueNoExpectation<.07);
  assert.equal(report.expectationIllustration.noTrueExpectation025,report.expectationIllustration.true025NoExpectation);
});
