import test from 'node:test';import assert from 'node:assert/strict';
import {presets,presetRecipe,personalDraft,customRecipe} from '../src/product/recipes.js';
import {PersonalLibrary,savedRecipe,normalizedDraft} from '../src/product/library.js';
for(const p of presets.filter(p=>p.kind!=='am'))test(`personal copy preserves complete sound behavior: ${p.id}`,()=>{
  const original=presetRecipe(p.id),snapshot=structuredClone(original),draft=personalDraft(original),copy=customRecipe(draft).recipe;
  for(const key of ['layers','rhythm','timeline','completion','capabilityProfile'])assert.deepEqual(copy[key],original.recipe[key]);
  draft.template.recipe.timeline.stages[0].layerStates[0].gain=.1;assert.deepEqual(original,snapshot);
});
test('mixed and pure nature retain the exact asset revision and sources',()=>{for(const naturalOnly of [true,false]){const value=presetRecipe('rain-focus',15,{naturalOnly}),d=personalDraft(value);assert.deepEqual(customRecipe(d).recipe.layers,value.recipe.layers);}});
test('shortening a sleep copy clamps fades without losing the original long ending',()=>{const d=personalDraft(presetRecipe('soft-rain-sleep',30));d.minutes=1;assert.equal(customRecipe(d).recipe.timeline.stages[0].fadeOutMs,57500);d.minutes=30;assert.equal(customRecipe(d).recipe.timeline.stages[0].fadeOutMs,300000);assert.equal(d.template.recipe.timeline.stages[0].fadeOutMs,300000);});
test('multi-stage or repeated recipes cannot be silently converted or imported',()=>{assert.throws(()=>personalDraft(presetRecipe('study-break')),/完整阶段/);const d=personalDraft(presetRecipe('reading'));d.template.recipe.timeline.repeatCount=2;assert.throws(()=>normalizedDraft(d),/单阶段/);});
test('personal copies survive save, reopen, backup merge and revision editing',async()=>{
  let nextId=0;const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},opts={storage:()=>storage,locks:{request:(_k,fn)=>fn()},id:()=> `saved-copy-${++nextId}`};
  const lib=new PersonalLibrary(opts),d=personalDraft(presetRecipe('stereo-space',20));d.template.recipe.timeline.stages[0].layerStates[1].gain=.07;
  const saved=await lib.save(d);d.template.recipe.timeline.stages[0].layerStates[1].gain=.9;
  const reopened=new PersonalLibrary(opts).read().saved[0];assert.equal(savedRecipe(reopened).recipe.timeline.stages[0].layerStates[1].gain,.07);
  const raw=lib.backup();values.clear();await lib.importBackup(raw);assert.deepEqual(lib.read().saved[0],saved);
  const changed=structuredClone(saved.draft);changed.title='修改后的搭配';const updated=await lib.save(changed,{id:saved.id,baseRevision:1});assert.equal(updated.revision,2);assert.equal((await lib.importBackup(raw)).copies,1);
});
test('invalid personal templates are rejected without a fallback to free mixing',()=>{const d=personalDraft(presetRecipe('reading'));d.template.recipe.layers[0].source.seed='bad';assert.throws(()=>normalizedDraft(d));assert.throws(()=>normalizedDraft({kind:'future'}),/类型/);});
