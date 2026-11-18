import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioEngine} from '../src/audio/engine.js';
import {PlaybackOwnership} from '../src/audio/ownership.js';
import {makeDemo} from '../src/config/demos.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Locks {
 held=false;
 async request(_name,_options,fn){if(this.held)return fn(null);this.held=true;try{return await fn({name:'lock'});}finally{this.held=false;}}
}
function harness({moduleGate=null,lockManager=new Locks()}={}){
 let now=0,created=0,duration=15000;const messages=[];
 const gain={value:1,setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},cancelScheduledValues(){}};
 const ctx={sampleRate:48000,currentTime:0,state:'suspended',audioWorklet:{addModule:()=>moduleGate?.promise??Promise.resolve()},destination:{},createGain(){return {gain,connect(){return this;},disconnect(){}};},async resume(){this.state='running';},async close(){this.state='closed';}};
 const node={connect(){return {connect(){}};},disconnect(){},port:{onmessage:null,close(){},postMessage(message){messages.push(message);if(message.type==='pause')queueMicrotask(()=>this.onmessage?.({data:{elapsedMs:1000,totalMs:duration,paused:true,finished:false}}));}}};
 const engine=new AudioEngine({contextFactory:()=>{created++;return ctx;},nodeFactory:(_context,options)=>{const t=options.processorOptions.recipe.timeline;duration=t.kind==='continuous'?Infinity:t.stages.reduce((n,s)=>n+s.durationMs,0)*t.repeatCount;return node;},ownership:new PlaybackOwnership(lockManager),now:()=>now,mediaDevices:null,visibilityTarget:null});
 return {engine,ctx,node,messages,gain,setTime:ms=>now=ms,get created(){return created;}};
}
test('second owner cannot acquire while first holds; release allows new owner',async()=>{const locks=new Locks(),a=new PlaybackOwnership(locks),b=new PlaybackOwnership(locks);await a.acquire();await assert.rejects(()=>b.acquire(),/PLAYBACK_OWNED/);a.release();await tick();await b.acquire();b.release();});
test('missing lock API fails closed',async()=>await assert.rejects(()=>new PlaybackOwnership(null).acquire(),/CAPABILITY_UNAVAILABLE/));
test('cancelled lock acquisition cannot create a later hidden owner',async()=>{const gate=deferred(),locks={async request(n,o,fn){await gate.promise;return fn({});}};const owner=new PlaybackOwnership(locks);const task=owner.acquire();owner.release();gate.resolve();await assert.rejects(task,/取消/);assert.equal(owner.releaseFn,null);});
test('rapid duplicate start creates only one context',async()=>{const gate=deferred(),h=harness({moduleGate:gate});const task=h.engine.start(makeDemo());await tick();await assert.rejects(()=>h.engine.start(makeDemo()),/先停止/);assert.equal(h.created,1);gate.resolve();await task;await h.engine.stop();});
test('stop during preparation never reconnects after module resolves',async()=>{const gate=deferred(),h=harness({moduleGate:gate});const task=h.engine.start(makeDemo());await tick();await h.engine.stop();gate.resolve();await task;assert.equal(h.engine.state,'stopped');assert.equal(h.engine.node,null);assert.equal(h.ctx.state,'closed');});
test('caller mutation during async startup cannot change snapshot',async()=>{const gate=deferred(),h=harness({moduleGate:gate}),p=makeDemo();const task=h.engine.start(p);await tick();p.recipe.layers[0].source.color='white';gate.resolve();await task;assert.equal(h.engine.snapshot.recipe.layers[0].source.color,'pink');await h.engine.stop();});
test('manual pause freezes time and releases playback ownership',async()=>{const locks=new Locks(),h=harness({lockManager:locks});await h.engine.start(makeDemo());await h.engine.pause();assert.equal(h.engine.state,'paused');h.setTime(60000);await tick();assert.equal(locks.held,false);await h.engine.resume();assert.equal(h.engine.state,'running');assert.equal(h.engine.elapsed,1000);assert(!h.messages.some(m=>m.type==='seek'));await h.engine.stop();});
test('system interruption advances wall time and expires without resuming',async()=>{const h=harness();await h.engine.start(makeDemo('pink',3000));h.setTime(1000);h.engine.interrupt('test');await tick();h.setTime(5000);await h.engine.resume();assert.equal(h.engine.state,'completed');assert(!h.messages.some(m=>m.type==='resume'));assert.equal(h.engine.node,null);});
test('system interruption seeks elapsed position before explicit resume',async()=>{const h=harness();await h.engine.start(makeDemo());h.setTime(1000);h.engine.interrupt('test');await tick();h.setTime(3000);await h.engine.resume();assert.equal(h.engine.state,'running');assert.equal(h.messages.find(m=>m.type==='seek').ms,3000);await h.engine.stop();});
test('resume denied by another owner stays paused',async()=>{const locks=new Locks(),h=harness({lockManager:locks});await h.engine.start(makeDemo());await h.engine.pause();await tick();const other=new PlaybackOwnership(locks);await other.acquire();await assert.rejects(()=>h.engine.resume(),/PLAYBACK_OWNED/);assert.equal(h.engine.state,'paused');other.release();await h.engine.stop();});
test('stale processor event after stop cannot mark new session completed',async()=>{const h=harness();await h.engine.start(makeDemo());const stale=h.node.port.onmessage;await h.engine.stop();stale({data:{finished:true}});assert.equal(h.engine.state,'stopped');});
test('repeated stop is idempotent and prevents restart while stopping',async()=>{const h=harness();await h.engine.start(makeDemo());const a=h.engine.stop(),b=h.engine.stop();assert.equal(a,b);await assert.rejects(()=>h.engine.start(makeDemo()),/先停止/);await a;assert.equal(h.engine.state,'stopped');});
test('processor failure during pause resolves outstanding pause and closes audio',async()=>{const h=harness();await h.engine.start(makeDemo());h.node.port.postMessage=()=>{};const task=h.engine.pause();await h.engine.fail('failure');await task;assert.equal(h.engine.state,'error');assert.equal(h.ctx.state,'closed');});
test('invalid/fixture configs never acquire context or autoplay',async()=>{const h=harness(),p=makeDemo();p.exampleOnly=true;await assert.rejects(()=>h.engine.start(p),/EXAMPLE_ONLY/);assert.equal(h.created,0);assert.equal(h.engine.state,'idle');});
test('interruption expiry publishes final progress and invalidates delayed worklet messages',async()=>{
 const h=harness();await h.engine.start(makeDemo('pink',3000));const stale=h.node.port.onmessage;
 h.setTime(1000);h.engine.interrupt('test');await tick();h.setTime(5000);await h.engine.resume();
 assert.equal(h.engine.status.elapsedMs,3000);assert.equal(h.engine.status.totalMs,3000);assert.equal(h.engine.status.finished,true);assert.equal(h.engine.status.paused,false);assert.equal(h.engine.status.cuePlaying,false);
 stale({data:{elapsedMs:1000,totalMs:3000,paused:true,finished:false}});assert.equal(h.engine.status.elapsedMs,3000);
});
test('expiry during ownership reacquisition completes without resuming the audio context',async()=>{
 const gate=deferred(),h=harness();await h.engine.start(makeDemo('pink',3000));h.engine.interrupt('test');await tick();
 h.engine.ownership.acquire=()=>gate.promise;let resumed=false;h.ctx.resume=async()=>{resumed=true;};
 const pending=h.engine.resume();h.setTime(5000);gate.resolve();await pending;
 assert.equal(h.engine.state,'completed');assert.equal(h.engine.status.elapsedMs,3000);assert.equal(resumed,false);assert.equal(h.engine.node,null);
});
test('expiry while waiting for audio context recovery cannot replay expired audio',async()=>{
 const gate=deferred(),h=harness();await h.engine.start(makeDemo('pink',3000));h.engine.interrupt('test');await tick();
 h.ctx.resume=async()=>{await gate.promise;h.ctx.state='running';};
 const pending=h.engine.resume();await tick();h.setTime(5000);gate.resolve();await pending;
 assert.equal(h.engine.state,'completed');assert.equal(h.engine.status.elapsedMs,3000);assert(!h.messages.some(m=>m.type==='resume'));assert.equal(h.engine.node,null);
});
test('interrupted resume seeks using time after audio context recovery',async()=>{
 const gate=deferred(),h=harness();await h.engine.start(makeDemo('pink',15000));h.setTime(1000);h.engine.interrupt('test');await tick();
 h.ctx.resume=async()=>{await gate.promise;h.ctx.state='running';};
 const pending=h.engine.resume();await tick();h.setTime(5000);gate.resolve();await pending;
 assert.equal(h.engine.state,'running');assert.equal(h.messages.find(m=>m.type==='seek').ms,5000);await h.engine.stop();
});
test('pause resolves only after the browser has actually released the Web Lock',async()=>{
 const released=deferred();let held=false;
 const locks={async request(name,options,fn){if(held)return fn(null);held=true;try{return await fn({name});}finally{await released.promise;held=false;}}};
 const h=harness({lockManager:locks});await h.engine.start(makeDemo());const pause=h.engine.pause();await tick();
 assert.equal(h.engine.state,'pausing');assert.equal(held,true);released.resolve();await pause;assert.equal(held,false);assert.equal(h.engine.state,'paused');
 const previewOwner=new PlaybackOwnership(locks);await previewOwner.acquire();await previewOwner.release();await h.engine.stop();
});
