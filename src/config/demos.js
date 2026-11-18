// Engineering-only playable configurations. They are not the future clinical or
// product preset library, and never mutate the exampleOnly documentation files.
const noise = (id,color) => ({id,label:color,source:{kind:'noise',color,generatorVersion:'noise-v1',seed:29,channels:'mono'}});
const state = (layer,enabled=true) => ({layerId:layer.id,enabled,gain:layer.source.kind==='binaural'?.12:.35,params:layer.source.kind==='binaural'?{centerHz:200,beatHz:10}:layer.source.kind==='noise'?{pan:0,filter:null}:{pan:0}});
export function makeDemo(kind='pink', durationMs=15000) {
  let layers=[noise('background',['white','brown'].includes(kind)?kind:'pink')],rhythm={kind:'none'};
  if(kind==='binaural') {layers.push({id:'beat',label:'双耳节拍',source:{kind:'binaural',oscillatorVersion:'sine-v1',highEar:'right'}});rhythm={kind:'binaural',layerId:'beat'};}
  if(kind==='am')rhythm={kind:'amplitudeModulation',targetLayerId:'background',waveform:'sine'};
  if(kind==='asset')layers=[{id:'tone',label:'自生成测试音',source:{kind:'asset',assetRef:{id:'diagnostic-tone',revision:1},playback:{mode:'loop',startMs:0,loopStartMs:0,loopEndMs:2000,crossfadeMs:100}}}];
  const stage=(id,ms,enabled=true)=>({id,label:id==='rest'?'静音休息':'声音播放',durationMs:ms,fadeInMs:enabled?Math.min(500,ms/4):0,fadeOutMs:enabled?Math.min(500,ms/4):0,layerStates:layers.map(l=>state(l,enabled)),rhythmState:kind==='am'?{enabled,rateHz:16,depth:.4}:null});
  return {format:'wave-platform.recipe',schemaVersion:1,exampleOnly:false,recipe:{id:`core-demo-${kind}`,revision:1,title:`工程测试 · ${kind}`,description:'验证音频和播放流程用，不代表研究方案或最终产品预设。',scenes:['custom'],createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z',derivedFrom:null,capabilityProfile:'audio-v1-core',layers,rhythm,timeline:{kind:'finite',repeatCount:kind==='am'?2:1,stages:kind==='am'?[stage('sound',durationMs),stage('rest',3000,false)]:[stage('sound',durationMs)]},completion:{cue:null,gain:0},provenance:[{path:'',kind:'design',referenceId:null,locator:null,note:'工程诊断默认值；来源和数值由产品正式预设阶段另外确定。'}]}};
}
