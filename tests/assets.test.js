import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadAssets} from '../src/audio/assets.js';
import {catalog,resources} from '../src/audio/catalog.js';
import {makeDemo} from '../src/config/demos.js';
const bytes=await readFile(new URL('../public/assets/diagnostic-tone.wav',import.meta.url));
function decoder({duration=2,channels=1}={}){return {async decodeAudioData(){return {duration,numberOfChannels:channels,length:48000,sampleRate:24000,getChannelData:()=>new Float32Array(48000)};}};}
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}
test('bundled asset hash and directory metadata agree with actual WAV',()=>{const r=catalog['diagnostic-tone@1'];assert.equal(createHash('sha256').update(bytes).digest('hex'),r.contentHash);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),r.channels);assert.equal(bytes.readUInt32LE(24),24000);assert.equal((bytes.length-44)/2/24000*1000,r.durationMs);});
test('only trusted resource mapping is fetched, matching hash decodes successfully',async()=>withFetch(async(url,options)=>{assert.equal(url,resources['diagnostic-tone-v1']);assert.equal(options.redirect,'error');return new Response(bytes);},async()=>{const result=await loadAssets(makeDemo('asset').recipe,decoder(),catalog,resources);assert.equal(result['diagnostic-tone@1'].channels[0].length,48000);}));
test('missing resource is blocked before any network call',async()=>withFetch(()=>{assert.fail('should not fetch');},async()=>await assert.rejects(()=>loadAssets(makeDemo('asset').recipe,decoder(),catalog,{}),/ASSET_UNAVAILABLE/)));
test('corrupted asset is rejected before decode',async()=>withFetch(async()=>new Response('corrupt'),async()=>await assert.rejects(()=>loadAssets(makeDemo('asset').recipe,{decodeAudioData(){assert.fail('must not decode corrupted data');}},catalog,resources),/校验失败/)));
test('decode metadata mismatch rejected',async()=>withFetch(async()=>new Response(bytes),async()=>await assert.rejects(()=>loadAssets(makeDemo('asset').recipe,decoder({duration:3}),catalog,resources),/解码结果/)));
test('inactive asset layers never download',async()=>withFetch(()=>{assert.fail('should not fetch');},async()=>{const p=makeDemo('asset').recipe;p.timeline.stages[0].layerStates[0].enabled=false;assert.deepEqual(await loadAssets(p,decoder(),catalog,resources),{});}));
test('oversized declared file rejected before reading body',async()=>withFetch(async()=>new Response(bytes,{headers:{'content-length':String(17*1024*1024)}}),async()=>await assert.rejects(()=>loadAssets(makeDemo('asset').recipe,decoder(),catalog,resources),/过大/)));
test('abort after decoding does not permit delayed audio start',async()=>withFetch(async()=>new Response(bytes),async()=>{const abort=new AbortController();abort.abort();await assert.rejects(()=>loadAssets(makeDemo('asset').recipe,decoder(),catalog,resources,abort.signal),{name:'AbortError'});}));
