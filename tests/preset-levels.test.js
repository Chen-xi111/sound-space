import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/audio/dsp.js';
import {presetRecipe,personalDraft,customRecipe} from '../src/product/recipes.js';

for(const rate of [44100,48000,96000])test(`pure noise starting levels stay within 1 dB at ${rate} Hz`,()=>{
  const levels=[];
  for(const id of ['even-background','reading','low-background']){
    const r=new Renderer(presetRecipe(id,1).recipe,rate,{},1),a=new Float32Array(rate*15),b=new Float32Array(a.length);r.process(a,b);
    let power=0;for(let i=rate*3;i<a.length;i++)power+=(a[i]**2+b[i]**2)/2;
    levels.push(10*Math.log10(power/(rate*12)));
  }
  assert(Math.max(...levels)-Math.min(...levels)<1,JSON.stringify(levels));
});
test('new white default does not overwrite stored white levels or live gain changes',()=>{
  const p=presetRecipe('even-background'),d=personalDraft(p);assert.equal(p.recipe.timeline.stages[0].layerStates[0].gain,.1);
  d.template.recipe.revision=1;d.template.recipe.timeline.stages[0].layerStates[0].gain=.35;
  assert.equal(customRecipe(d).recipe.timeline.stages[0].layerStates[0].gain,.35);
  const old={title:'旧白噪声',minutes:10,continuous:false,layers:[{id:'white',color:'white',gain:.35,enabled:true}],rhythm:'none',centerHz:200,beatHz:10,rateHz:16,depth:.4};
  assert.equal(customRecipe(old).recipe.timeline.stages[0].layerStates[0].gain,.35);
  const r=new Renderer(p.recipe,48000,{},1);r.layerGain('background',.4);r.process(new Float32Array(960),new Float32Array(960));assert.equal(r.voices[0].voice.gain,.4);
});
