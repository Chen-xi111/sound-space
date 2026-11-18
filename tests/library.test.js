import test from 'node:test';import assert from 'node:assert/strict';
import {PersonalLibrary,LIBRARY_KEY,savedRecipe} from '../src/product/library.js';
import {validateRecipe} from '../src/config/validate.js';
const draft=()=>({title:'常用组合',minutes:25,continuous:false,layers:[{id:'layer-1',color:'pink',gain:.35,enabled:true}],rhythm:'none',centerHz:200,beatHz:10,rateHz:16,depth:.4});
function setup(){const values=new Map();let id=0,queue=Promise.resolve();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};const locks={request:(_name,fn)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};const options={storage:()=>storage,locks,id:()=>`saved-${++id}`,now:()=> '2026-10-07T12:00:00.000Z'};return {values,storage,options,lib:new PersonalLibrary(options)};}
test('personal combination survives reopening and produces a playable recipe',async()=>{const h=setup(),entry=await h.lib.save(draft()),again=new PersonalLibrary(h.options).read();assert.equal(again.saved[0].id,entry.id);assert.equal(validateRecipe(savedRecipe(entry)).playable,true);assert.equal(entry.revision,1);});
test('saving snapshots mutable input before awaiting storage',async()=>{const h=setup(),d=draft(),task=h.lib.save(d);d.layers[0].gain=.99;assert.equal((await task).draft.layers[0].gain,.35);});
test('parallel favorite edits in two tabs retain both entries',async()=>{const h=setup(),other=new PersonalLibrary(h.options);await Promise.all([h.lib.favorite('reading'),other.favorite('before-sleep')]);assert.deepEqual(h.lib.read().favorites,['reading','before-sleep']);await other.favorite('reading');assert.deepEqual(h.lib.read().favorites,['before-sleep']);});
test('stale revision cannot overwrite another tab update',async()=>{const h=setup(),old=await h.lib.save(draft()),newer=await h.lib.save({...draft(),title:'新版'},{id:old.id,baseRevision:1});assert.equal(newer.revision,2);await assert.rejects(()=>h.lib.save(draft(),{id:old.id,baseRevision:1}),/另一个页面/);assert.equal(h.lib.read().saved[0].draft.title,'新版');});
test('quota failure does not mark or replace a saved entry',async()=>{const h=setup(),old=await h.lib.save(draft());h.storage.setItem=()=>{throw new Error('quota');};await assert.rejects(()=>h.lib.save({...draft(),title:'改名'},{id:old.id,baseRevision:1}),/没有保存成功/);assert.equal(h.lib.read().saved[0].revision,1);});
test('corrupt or unsupported data is preserved and never overwritten',async()=>{for(const raw of ['broken','{"version":2,"favorites":[],"saved":[]}']){const h=setup();h.values.set(LIBRARY_KEY,raw);await assert.rejects(()=>h.lib.favorite('reading'),/原数据已保留/);assert.equal(h.lib.backup(),raw);}});
test('deletion can be undone, but stale deletion cannot remove an updated entry',async()=>{const h=setup(),entry=await h.lib.save(draft());await assert.rejects(()=>h.lib.remove(entry.id,2),/发生变化/);const removed=await h.lib.remove(entry.id,1);assert.equal(h.lib.read().saved.length,0);await h.lib.restore(removed);assert.equal(h.lib.read().saved.length,1);});
test('unavailable storage or lock support leaves playback data untouched',async()=>{const d=draft();assert.throws(()=>new PersonalLibrary({storage:()=>{throw new Error();}}).read(),/无法读取/);await assert.rejects(()=>new PersonalLibrary({locks:null}).save(d),/无法安全保存/);assert.equal(d.title,'常用组合');});
test('unsafe layer identifiers cannot enter saved markup',()=>{const h=setup(),d=draft();d.layers[0].id='layer-1" onclick="alert(1)';assert.throws(()=>h.lib.save(d),/声音层标识无效/);assert.equal(h.lib.read().saved.length,0);});
test('malformed saved metadata is preserved without allowing playback',async()=>{const h=setup();await h.lib.save(draft());const data=h.lib.read();data.saved[0].updatedAt='yesterday';const raw=JSON.stringify(data);h.values.set(LIBRARY_KEY,raw);assert.throws(()=>h.lib.read(),/原数据已保留/);assert.equal(h.lib.backup(),raw);});

test('backup preview and import retain existing entries and merge favorites',async()=>{
  const local=setup(),source=setup();await local.lib.favorite('reading');await source.lib.favorite('before-sleep');
  await source.lib.save(draft());const raw=source.lib.backup();
  assert.deepEqual(local.lib.previewImport(raw),{added:1,skipped:0,copies:0,favorites:1,titles:['常用组合']});
  assert.equal(local.lib.read().saved.length,0);
  await local.lib.importBackup(raw);assert.equal(local.lib.read().saved.length,1);
  assert.deepEqual(local.lib.read().favorites,['reading','before-sleep']);
  assert.deepEqual(await local.lib.importBackup(raw),{added:0,skipped:1,copies:0,favorites:0});
});
test('conflicting backup versions are copied once without replacing a newer local version',async()=>{
  const h=setup(),old=await h.lib.save(draft()),raw=h.lib.backup();
  await h.lib.save({...draft(),title:'本机新版'},{id:old.id,baseRevision:1});
  assert.equal(h.lib.previewImport(raw).copies,1);const result=await h.lib.importBackup(raw);
  assert.equal(result.copies,1);const data=h.lib.read();
  assert.equal(data.saved.find(x=>x.id===old.id).draft.title,'本机新版');
  assert.equal(data.saved.find(x=>x.id!==old.id).draft.title,'常用组合');
  assert.equal((await h.lib.importBackup(raw)).added,0);assert.equal(h.lib.read().saved.length,2);
});
test('import rechecks edits made after preview while holding the library lock',async()=>{
  const h=setup(),old=await h.lib.save(draft()),raw=h.lib.backup();assert.equal(h.lib.previewImport(raw).added,0);
  const edit=h.lib.save({...draft(),title:'其他页面修改'},{id:old.id,baseRevision:1});
  const imported=h.lib.importBackup(raw);await edit;assert.equal((await imported).copies,1);
  assert.equal(h.lib.read().saved.find(x=>x.id===old.id).draft.title,'其他页面修改');
});
test('invalid imports never partially change the library',async()=>{
  const h=setup();await h.lib.save(draft());const original=h.lib.backup(),base=JSON.parse(original);
  const cases=['broken',JSON.stringify({...base,version:2}),'null','x'.repeat(1500001)];
  for(const mutate of [x=>x.saved.push({...x.saved[0]}),x=>x.favorites.push('bad"id'),x=>x.saved[0].draft.layers[0].assetRef={id:'unknown',revision:1},x=>x.saved[0].updatedAt='yesterday',x=>x.saved[0].draft=null]){const x=structuredClone(base);mutate(x);cases.push(JSON.stringify(x));}
  for(const raw of cases){assert.throws(()=>h.lib.previewImport(raw),/无法识别/);assert.throws(()=>h.lib.importBackup(raw),/无法识别/);assert.equal(h.lib.backup(),original);}
});
test('import refuses capacity overflow and quota failure atomically',async()=>{
  const h=setup();for(let i=0;i<50;i++)await h.lib.save({...draft(),title:`组合 ${i}`});
  const source=setup();await source.lib.save({...draft(),title:'新增'});const original=h.lib.backup();
  await assert.rejects(()=>h.lib.importBackup(source.lib.backup()),/容量/);assert.equal(h.lib.backup(),original);
  const target=setup();await target.lib.favorite('reading');const before=target.lib.backup();target.storage.setItem=()=>{throw new Error('quota');};
  await assert.rejects(()=>target.lib.importBackup(source.lib.backup()),/没有保存成功/);assert.equal(target.lib.backup(),before);
});
test('import accepts UTF-8 BOM and registered carriers but strips unknown properties',async()=>{
  const h=setup(),source=setup(),d=draft();d.layers.unshift({id:'rain',assetRef:{id:'carrier-soft-rain',revision:1},gain:.55,enabled:true});
  await source.lib.save(d);const data=JSON.parse(source.lib.backup());data.tracking='discard';data.saved[0].draft.layers[0].url='https://example.invalid';
  await h.lib.importBackup('\uFEFF'+JSON.stringify(data));const result=h.lib.read();
  assert.equal(result.saved[0].draft.layers[0].assetRef.id,'carrier-soft-rain');assert.equal(result.tracking,undefined);assert.equal(result.saved[0].draft.layers[0].url,undefined);
  assert.equal(savedRecipe(result.saved[0]).recipe.layers[1].source.channels,'independentStereo');
});
test('two simultaneous imports create only one copy and preserve corrupt local data',async()=>{
  const h=setup(),source=setup();await source.lib.save(draft());const raw=source.lib.backup();
  await Promise.all([h.lib.importBackup(raw),h.lib.importBackup(raw)]);assert.equal(h.lib.read().saved.length,1);
  h.values.set(LIBRARY_KEY,'broken');await assert.rejects(()=>h.lib.importBackup(raw),/原数据已保留/);assert.equal(h.lib.backup(),'broken');
});
test('generated copy identifiers cannot collide with later incoming entries',async()=>{
  const h=setup();await h.lib.save({...draft(),title:'本机'});const source=setup();await source.lib.save({...draft(),title:'版本一'});await source.lib.save({...draft(),title:'版本二'});
  await h.lib.importBackup(source.lib.backup());assert.equal(h.lib.read().saved.length,3);assert.equal(new Set(h.lib.read().saved.map(x=>x.id)).size,3);
});
