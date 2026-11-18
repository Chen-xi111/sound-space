import test from 'node:test';
import assert from 'node:assert/strict';
import {presets,presetRecipe,searchPresets,previewRecipe,customRecipe,totalMs} from '../src/product/recipes.js';
import {validateRecipe} from '../src/config/validate.js';
import {catalog} from '../src/audio/catalog.js';
import {SessionController} from '../src/product/session.js';

const baseDraft=()=>({title:'我的组合',minutes:25,continuous:false,layers:[{id:'a',color:'pink',gain:.3,enabled:true}],rhythm:'none',centerHz:200,beatHz:10,rateHz:16,depth:.4});
test('all development presets are playable, describe design provenance and cover five scenes',()=>{
 const covered=new Set();for(const item of presets){const p=presetRecipe(item.id);assert.equal(validateRecipe(p,{catalog}).playable,true);assert.equal(p.recipe.provenance[0].kind,'design');p.recipe.scenes.forEach(s=>covered.add(s));}
 for(const scene of ['focus','study','relax','rest','sleep'])assert(covered.has(scene));
});
test('scene, keyword and headphone filters compose',()=>{
 assert.equal(searchPresets({scene:'relax',query:'双耳',headphones:'no'}).length,0);
 assert.equal(searchPresets({scene:'study',query:'双耳'}).length,1);
 assert.equal(searchPresets({query:'不存在的内容'}).length,0);
});
test('duration edits reject invalid input and preserve rest and repeat semantics',()=>{
 for(const n of [0,-1,NaN,Infinity,2.5,121])assert.throws(()=>presetRecipe('reading',n));
 const p=presetRecipe('study-break',10);assert.equal(totalMs(p.recipe),30*60000);assert.equal(p.recipe.timeline.stages[1].durationMs,300000);
 assert.equal(presetRecipe('reading').recipe.timeline.stages[0].durationMs,25*60000);
});
test('preview is a detached, at-most-ten-second audible stage with no cue',()=>{
 const p=presetRecipe('study-break');p.recipe.timeline.stages.reverse();const before=structuredClone(p),sample=previewRecipe(p);
 assert.deepEqual(p,before);assert.equal(totalMs(sample.recipe),10000);assert.equal(sample.recipe.timeline.repeatCount,1);assert.equal(sample.recipe.timeline.stages[0].id,'sound');assert.equal(sample.recipe.completion.cue,null);assert.equal(validateRecipe(sample,{catalog}).playable,true);
});
test('preview rejects silence and supports a continuous custom source',()=>{
 const d=baseDraft();d.layers[0].enabled=false;assert.throws(()=>previewRecipe(customRecipe(d)),/没有可预听/);
 d.layers[0].enabled=true;d.continuous=true;const p=customRecipe(d);assert.equal(totalMs(p.recipe),Infinity);assert.equal(totalMs(previewRecipe(p).recipe),10000);
});
test('custom combinations enforce four layers including binaural and validate parameters',()=>{
 const d=baseDraft();d.layers=Array.from({length:4},(_,i)=>({...d.layers[0],id:`a${i}`}));assert.equal(validateRecipe(customRecipe(d)).playable,true);
 d.rhythm='binaural';assert.throws(()=>customRecipe(d),/最多四/);d.layers.pop();assert.equal(validateRecipe(customRecipe(d)).playable,true);
 d.beatHz=50;assert.throws(()=>customRecipe(d));d.rhythm='amplitudeModulation';assert.equal(customRecipe(d).recipe.rhythm.targetLayerId,'a0');
 d.depth=2;assert.throws(()=>customRecipe(d));d.layers=[];assert.throws(()=>customRecipe(d),/添加/);
});
const gate=()=>{let resolve;return {promise:new Promise(r=>resolve=r),release:()=>resolve()};};
class FakeEngine extends EventTarget{
 constructor(){super();this.state='idle';this.calls=[];}
 emit(s){this.state=s;this.dispatchEvent(new Event('change'));}
 async start(value){this.calls.push('start');this.snapshot=structuredClone(value);this.emit('preparing');if(this.startGate)await this.startGate.promise;if(this.state!=='preparing')return;if(this.error){this.emit('error');throw new Error(this.error);}this.emit('running');}
 async pause(){this.calls.push('pause');this.emit('pausing');if(this.pauseGate)await this.pauseGate.promise;if(this.state==='pausing')this.emit('paused');}
 async resume(){this.calls.push('resume');this.emit('running');}
 async stop(){this.calls.push('stop');this.emit('stopped');}
 volume(v){this.master=v;}
 async destroy(){await this.stop();}
}
function harness(){const main=new FakeEngine(),preview=new FakeEngine();let count=0;return {main,preview,c:new SessionController(()=>count++?preview:main)};}
test('replacement requires an explicit choice and does not silently stop a session',async()=>{
 const {c,main}=harness(),p=presetRecipe('reading');await c.start(p);await assert.rejects(()=>c.start(p),/确认/);assert.equal(main.state,'running');await c.start(p,{replace:true});assert.deepEqual(main.calls,['start','stop','start']);
});
test('preview waits for pause acknowledgement and never automatically resumes the main session',async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading');await c.start(p);await assert.rejects(()=>c.listen(p),/确认/);
 main.pauseGate=gate();const pending=c.listen(p,{pauseCurrent:true});assert.equal(preview.calls.length,0);main.pauseGate.release();await pending;
 assert.equal(main.state,'paused');assert.equal(preview.state,'running');preview.emit('completed');assert.equal(main.state,'paused');assert(!main.calls.includes('resume'));await c.resume();assert.equal(main.state,'running');
});
test('preview failure leaves the original session paused and allows explicit resume',async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading');await c.start(p);preview.error='PLAYBACK_OWNED';await assert.rejects(()=>c.listen(p,{pauseCurrent:true}),/PLAYBACK_OWNED/);assert.equal(main.state,'paused');assert.equal(c.busy,false);await c.resume();assert.equal(main.state,'running');
});
test('preview during interruption preserves the main interrupted state and deadline',async()=>{
 const {c,main}=harness(),p=presetRecipe('reading');await c.start(p);main.emit('interrupted');await c.listen(p);await c.stopPreview();assert.equal(main.state,'interrupted');assert(!main.calls.includes('pause'));assert(!main.calls.includes('resume'));
});
test('navigation cancels preview even while the formal pause is pending',async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading');await c.start(p);main.pauseGate=gate();const pending=c.listen(p,{pauseCurrent:true});await Promise.resolve();assert.equal(main.state,'pausing');await c.stopPreview();main.pauseGate.release();await pending;assert(!preview.calls.includes('start'));assert.equal(main.state,'paused');assert.equal(c.busy,false);
});
test('rapid preview clicks cannot create overlapping starts, and stop cancels startup',async()=>{
 const {c,preview}=harness(),p=presetRecipe('reading');preview.startGate=gate();const pending=c.listen(p);await assert.rejects(()=>c.listen(p),/上一个操作/);await c.stopPreview();preview.startGate.release();await pending;assert.equal(preview.state,'stopped');assert.equal(preview.calls.filter(x=>x==='start').length,1);
});
test('starting a formal session ends preview first and shares the selected volume',async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading');c.volume(0);await c.listen(p);await c.start(p);assert.equal(preview.state,'stopped');assert.equal(main.state,'running');assert.equal(main.master,0);assert.equal(preview.master,0);
});
test('preview waits for an interrupted session asynchronous ownership release',async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading');await c.start(p);main.emit('interrupted');const released=gate();main.ownership={released:released.promise};
 const pending=c.listen(p);await Promise.resolve();assert.equal(preview.calls.length,0);released.release();await pending;assert.equal(preview.state,'running');assert.equal(main.state,'interrupted');
});
for(const operation of ['start','listen','resume'])test(`${operation} waits for a naturally completed preview to release playback ownership`,async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading');
 if(operation==='resume'){await c.start(p);await c.pause();}
 const released=gate();preview.emit('completed');preview.ownership={released:released.promise};
 const pending=operation==='resume'?c.resume():c[operation](p);await Promise.resolve();
 assert.equal(operation==='resume'?main.calls.includes('resume'):operation==='start'?main.calls.includes('start'):preview.calls.includes('start'),false);
 released.release();await pending;assert.equal(operation==='listen'?preview.state:main.state,'running');
});
test('formal start snapshots its recipe before waiting for preview shutdown',async()=>{
 const {c,main,preview}=harness(),p=presetRecipe('reading'),released=gate();preview.emit('completed');preview.ownership={released:released.promise};
 const pending=c.start(p);p.recipe.title='changed later';released.release();await pending;assert.equal(main.snapshot.recipe.title,'阅读背景');
});
