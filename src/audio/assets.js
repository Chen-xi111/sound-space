import {assetKey} from '../config/validate.js';
export async function loadAssets(recipe,context,catalog,resources,signal){
  const refs=new Map();
  for(const layer of recipe.layers){
    if(layer.source.kind==='asset'&&recipe.timeline.stages.some(s=>s.layerStates.some(x=>x.layerId===layer.id&&x.enabled)))refs.set(assetKey(layer.source.assetRef),layer.source.assetRef);
  }
  if(recipe.completion.cue)refs.set(assetKey(recipe.completion.cue),recipe.completion.cue);
  const decoded={};
  for(const [key]of refs){
    const record=catalog[key];const resource=resources[record?.resourceKey];
    if(!record||record.licenseStatus!=='verified'||!resource)throw new Error(`ASSET_UNAVAILABLE: ${key}`);
    const response=await fetch(resource,{signal,redirect:'error'});
    if(!response.ok)throw new Error(`ASSET_UNAVAILABLE: HTTP ${response.status}`);
    if(Number(response.headers.get('content-length'))>16*1024*1024)throw new Error('ASSET_UNAVAILABLE: 素材文件过大');
    const reader=response.body.getReader();const chunks=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16*1024*1024){await reader.cancel();throw new Error('ASSET_UNAVAILABLE: 素材超过 16 MiB');}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==record.contentHash)throw new Error('ASSET_UNAVAILABLE: 素材校验失败');
    const buffer=await context.decodeAudioData(bytes.buffer);
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(Math.abs(buffer.duration*1000-record.durationMs)>2||buffer.numberOfChannels!==record.channels||buffer.length*buffer.numberOfChannels*4>64*1024*1024)throw new Error('ASSET_UNAVAILABLE: 解码结果与目录不符或超过内存上限');
    decoded[key]={sampleRate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice())};
  }
  return decoded;
}
