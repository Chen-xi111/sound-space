import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {makeDemo} from '../src/config/demos.js';
import {validateRecipe,parseRecipe,totalMs} from '../src/config/validate.js';
import {recipeSchema} from '../src/config/schema.js';
import {checkSchema} from '../src/config/schema-check.js';
import {catalog} from '../src/audio/catalog.js';
const valid=p=>validateRecipe(p,{catalog});
const mutate=(fn,kind='pink')=>{const p=makeDemo(kind,1000);fn(p.recipe,p);return valid(p);};
test('five planning fixtures are structurally valid but never playable',async()=>{
 for(const name of await readdir(new URL('../docs/examples',import.meta.url))){if(!/^0.*json$/.test(name))continue;const p=JSON.parse(await readFile(new URL('../docs/examples/'+name,import.meta.url)));const result=valid(p);assert.equal(result.valid,true,JSON.stringify(result.errors));assert.equal(result.playable,false);assert(result.blockers.some(e=>e.code==='EXAMPLE_ONLY'));}
});
test('all six engineering demos are playable',()=>{for(const kind of ['white','pink','brown','am','binaural','asset']){const r=valid(makeDemo(kind,3000));assert.equal(r.playable,true,JSON.stringify(r));}});
test('exported JSON Schema stays in sync with runtime',async()=>assert.deepEqual(JSON.parse(await readFile(new URL('../schemas/recipe-v1.schema.json',import.meta.url))),recipeSchema));
test('schema evaluator fails closed on unknown schema keywords',()=>assert.throws(()=>checkSchema('x',{type:'string',madeUp:true})));
const badCases=[
 ['unknown top-level field',(_r,p)=>p.url='https://invalid.example'],
 ['unknown source field',r=>r.layers[0].source.path='/tmp/audio'],
 ['boolean is not a seed',r=>r.layers[0].source.seed=true],
 ['zero revision',r=>r.revision=0],
 ['nonfinite gain',r=>r.timeline.stages[0].layerStates[0].gain=Infinity],
 ['blank title',r=>r.title=''],
 ['duplicate scene',r=>r.scenes=['focus','focus']],
 ['invalid calendar date',r=>r.createdAt='2026-02-31T00:00:00Z'],
 ['reversed dates',r=>r.createdAt='2027-01-01T00:00:00Z'],
 ['five layers',r=>{for(let i=0;i<4;i++)r.layers.push({...r.layers[0],id:'x'+i});}],
 ['duplicate layer id',r=>r.layers.push(structuredClone(r.layers[0]))],
 ['missing stage layer',r=>r.timeline.stages[0].layerStates=[]],
 ['unknown stage layer',r=>r.timeline.stages[0].layerStates[0].layerId='gone'],
 ['duplicate stage layer',r=>r.timeline.stages[0].layerStates.push(structuredClone(r.timeline.stages[0].layerStates[0]))],
 ['wrong layer params',r=>r.timeline.stages[0].layerStates[0].params={centerHz:200,beatHz:10}],
 ['zero duration',r=>r.timeline.stages[0].durationMs=0],
 ['negative duration',r=>r.timeline.stages[0].durationMs=-1],
 ['fractional duration',r=>r.timeline.stages[0].durationMs=1.5],
 ['excessive fades',r=>r.timeline.stages[0].fadeInMs=1001],
 ['over 24h',r=>{r.timeline.stages[0].durationMs=86400000;r.timeline.repeatCount=2;}],
 ['continuous with finite length',r=>{r.timeline={kind:'continuous',stages:r.timeline.stages};}],
 ['root source missing',r=>r.provenance[0].path='/title'],
 ['dangling provenance',r=>r.provenance[0].path='/not/here'],
 ['research lacks locator',r=>r.provenance[0].kind='research'],
 ['double binaural',r=>r.layers.push({...r.layers[1],id:'another'}),'binaural'],
 ['AM plus binaural',r=>r.rhythm={kind:'amplitudeModulation',targetLayerId:'background',waveform:'sine'},'binaural'],
 ['missing AM target',r=>r.rhythm.targetLayerId='gone','am'],
 ['missing AM state',r=>r.timeline.stages[0].rhythmState=null,'am'],
 ['binaural invalid center',r=>r.timeline.stages[0].layerStates[1].params.centerHz=1,'binaural'],
 ['loop crosses duration',r=>r.layers[0].source.playback.loopEndMs=3000,'asset'],
 ['loop crossfade too long',r=>r.layers[0].source.playback.crossfadeMs=1001,'asset'],
];
for(const [name,fn,kind]of badCases)test(name,()=>assert.equal(mutate(fn,kind).valid,false));
test('unsupported frequency is valid configuration but cannot play',()=>{const r=mutate(p=>p.timeline.stages[0].layerStates[1].params.beatHz=40,'binaural');assert(r.valid);assert(!r.playable);});
test('unknown asset is valid but blocked, no silent substitution',()=>{const r=mutate(p=>p.layers[0].source.assetRef.id='missing','asset');assert(r.valid);assert(!r.playable);});
test('unknown versions, excessive input, invalid JSON rejected',()=>{assert(!parseRecipe('x').valid);assert(!parseRecipe(' '.repeat(1048577)).valid);const p=makeDemo();p.schemaVersion=2;assert.equal(valid(p).errors[0].code,'VERSION_UNSUPPORTED');});
test('date milliseconds compare numerically',()=>assert(mutate(r=>{r.createdAt='2026-10-06T00:00:00Z';r.updatedAt='2026-10-06T00:00:00.001Z';}).valid));
test('continuous mode requires explicit shape',()=>{const p=makeDemo();const s=p.recipe.timeline.stages[0];s.durationMs=null;s.fadeOutMs=0;p.recipe.timeline={kind:'continuous',stages:[s]};assert(valid(p).playable);assert.equal(totalMs(p.recipe),Infinity);p.recipe.timeline.repeatCount=1;assert(!valid(p).valid);});
test('legitimate four-layer source pool accepted',()=>{const p=makeDemo();for(let i=1;i<4;i++){p.recipe.layers.push({...structuredClone(p.recipe.layers[0]),id:'noise'+i});p.recipe.timeline.stages[0].layerStates.push({...structuredClone(p.recipe.timeline.stages[0].layerStates[0]),layerId:'noise'+i});}assert(valid(p).playable);});
