import {makeDemo} from '../config/demos.js';
import {totalMs, validateRecipe} from '../config/validate.js';
import {catalog} from '../audio/catalog.js';
import {natureSounds,natureLayer,natureSound} from './nature.js';

export const scenes = [
  {id:'focus',label:'专注',description:'阅读、写作与工作'},
  {id:'study',label:'学习',description:'学习与安静休息'},
  {id:'relax',label:'放松',description:'给自己一点缓冲'},
  {id:'rest',label:'休息',description:'暂时放下手头的事'},
  {id:'sleep',label:'睡前',description:'定时播放，渐弱结束'},
  {id:'custom',label:'自由组合',description:'按自己的偏好搭配'},
];
export const colorNames = {white:'白噪声',pink:'粉红噪声',brown:'棕噪声'};
export const draftLayerLabel=l=>l.assetRef?natureSound(l.assetRef).label:colorNames[l.color];
export const isSoundscape=p=>['nature','carrier'].includes(p.kind);
export const defaultNaturalOnly=p=>p.kind==='nature'||(isSoundscape(p)&&p.scenes.includes('sleep'));
export const presets = [
  {id:'soft-rain-focus',title:'绵雨专注',description:'细密连续的雨幕 给阅读一片平稳背景',scenes:['focus','study'],kind:'carrier',sound:'soft-rain',background:'pink',carrierGain:.55,noiseGain:.16,compareId:'rain-focus',minutes:25},
  {id:'water-veil-rest',title:'水幕放松',description:'柔化近处水花 让水声缓缓铺开',scenes:['relax','rest'],kind:'carrier',sound:'water-veil',background:'pink',carrierGain:.5,noiseGain:.16,compareId:'stream-rest',minutes:10},
  {id:'soft-rain-sleep',title:'绵雨入夜',description:'一片平缓的雨声 慢慢收尾',scenes:['sleep','relax'],kind:'carrier',sound:'soft-rain',background:'pink',carrierGain:.55,noiseGain:.12,compareId:'rain-focus',minutes:30},
  {id:'rain-focus',title:'雨中专注',description:'让连绵雨声陪你读完这一页',scenes:['focus','study'],kind:'nature',sound:'rain',background:'pink',minutes:25},
  {id:'stream-rest',title:'溪边小憩',description:'听水流经过 给思绪一点余地',scenes:['relax','rest'],kind:'nature',sound:'stream',background:'pink',minutes:10},
  {id:'wind-down',title:'林间入夜',description:'让风声慢慢变轻 为一天收尾',scenes:['sleep','relax'],kind:'nature',sound:'wind',background:'brown',minutes:30},
  {id:'reading',title:'阅读背景',description:'均匀的粉红噪声，给阅读留一片简单的声音背景。',scenes:['focus','study'],kind:'pink',minutes:25},
  {id:'low-background',title:'低沉背景',description:'偏低频的棕噪声。喜欢厚一些的声音时，可以从这里开始。',scenes:['focus','relax'],kind:'brown',minutes:25},
  {id:'even-background',title:'均匀背景',description:'明亮、均匀的白噪声，适合按自己的偏好调整音量。',scenes:['focus'],kind:'white',minutes:15},
  {id:'study-break',title:'学习与安静休息',description:'把轻柔节律融入绵雨 一段学习 一段安静',scenes:['study'],kind:'am',minutes:25},
  {id:'gentle-pause',title:'短暂放松',description:'十分钟粉红背景，结束时渐弱，留一点时间给自己。',scenes:['relax','rest'],kind:'pink',minutes:10},
  {id:'stereo-space',title:'双耳声音',description:'双耳节拍配合粉红背景，使用立体声耳机体验。',scenes:['relax','study'],kind:'binaural',minutes:15},
  {id:'before-sleep',title:'睡前渐弱',description:'低沉的棕噪声，在最后五分钟逐渐减弱，安静结束。',scenes:['sleep'],kind:'brown',minutes:30},
];
export function assertPlayable(value) {
  const r=validateRecipe(value,{catalog});
  if(!r.playable) throw new Error([...r.errors,...r.blockers].map(x=>x.message).join('；'));
  return value;
}
export function presetRecipe(id, minutes, {naturalOnly}={}) {
  const item=presets.find(x=>x.id===id);
  if(!item) throw new Error('找不到这个方案');
  naturalOnly??=defaultNaturalOnly(item);
  const duration=minutes??item.minutes;
  if(!Number.isInteger(duration)||duration<1||duration>120) throw new Error('时长请输入 1—120 的整数分钟');
  const value=makeDemo(isSoundscape(item)?item.background:item.kind,duration*60000),r=value.recipe;
  if(item.kind==='white'){
    // Fixed default only: white v1 has ~11 dB more RMS than pink v1.
    // Do not normalize during playback or alter saved personal snapshots.
    r.timeline.stages[0].layerStates[0].gain=.1;
    r.revision=2;r.updatedAt='2026-10-27T00:00:00Z';
  }
  if(r.layers.some(l=>l.source.color==='brown')){
    r.layers.filter(l=>l.source.color==='brown').forEach(l=>l.source.generatorVersion='noise-v2');
    r.revision=2;r.updatedAt='2026-10-26T00:00:00Z';
  }
  Object.assign(r,{id:item.id,title:item.title,description:item.description,scenes:[...item.scenes]});
  r.layers.forEach(l=>{if(l.source.kind==='noise')l.label=colorNames[l.source.color];});
  if(isSoundscape(item)){
    const sound=natureSounds.find(s=>s.id===item.sound),stage=r.timeline.stages[0];
    const recording=natureLayer('nature',{id:sound.assetId,revision:sound.revision});
    stage.layerStates[0].gain=item.noiseGain??(item.background==='brown'?.04:.08);
    if(item.kind==='carrier')r.layers[0].source.channels='independentStereo';
    r.layers=naturalOnly?[recording]:[recording,...r.layers];
    stage.layerStates=naturalOnly?[]:stage.layerStates;
    stage.layerStates.unshift({layerId:'nature',enabled:true,gain:item.carrierGain??.8,params:{pan:0}});
  }
  r.timeline.stages[0].label=item.kind==='am'?'学习':'声音播放';
  r.timeline.stages[0].fadeInMs=isSoundscape(item)?2500:1000;
  r.timeline.stages[0].fadeOutMs=item.scenes.includes('sleep')?Math.min(300000,duration*60000-r.timeline.stages[0].fadeInMs):3000;
  if(item.kind==='am')r.timeline.stages[1].durationMs=5*60000;
  if(item.kind==='am'){
    r.revision=2;r.updatedAt='2026-10-26T00:00:00Z';
    r.layers=[natureLayer('nature',{id:'carrier-soft-rain',revision:1})];
    r.rhythm={kind:'amplitudeModulation',targetLayerId:'nature',waveform:'sine',processorVersion:'band-am-v1',band:{lowHz:200,highHz:1000}};
    for(const stage of r.timeline.stages)stage.layerStates=[{layerId:'nature',enabled:stage.id!=='rest',gain:.55,params:{pan:0}}];
    r.timeline.stages[0].fadeInMs=2500;
  }
  r.provenance[0].note='声音类型与节律参考已有研究方向；此配方的时长、混音比例、阶段和包络属于应用设计设置。';
  if(item.kind==='am'){
    r.provenance[0].note='绵雨载体 200–1000 Hz 频段调制采用 band-am-v1；深度 0.4 为应用设置，不对应论文低中高档。保留完整干声，不是论文音乐刺激或功效复现。';
    r.provenance.push({path:'/rhythm/band',kind:'research',referenceId:'doi:10.1038/s42003-024-07026-3',locator:'Methods / Experiment 4: Stimuli',note:'参考研究将额外调制限制在 200 Hz 至 1 kHz 的频段设计；研究使用音乐，本应用使用自然声床。'});
  }
  if(item.kind==='carrier'){
    r.createdAt=r.updatedAt='2026-10-10T00:00:00Z';
    if(item.scenes.includes('sleep')){r.revision=2;r.updatedAt='2026-10-26T00:00:00Z';}
    r.provenance[0].note='自然录音经连续纹理重构、宽频段音色匹配与双声道处理成为载体；'+(naturalOnly?'本次仅播放声床，无额外合成噪声。':'粉红噪声由 noise-v1 独立生成，无滤波。')+'声音融合设计不表示研究刺激或功效等效。';
  }
  if(r.layers.some(l=>l.source.generatorVersion==='noise-v2'))r.provenance[0].note+=' 棕噪声采用 noise-v2 采样率能量补偿，48 kHz 输出保留原版本。';
  if(item.kind==='white')r.provenance[0].note+=' 默认白噪声层增益 0.1，用于接近其他纯噪声方案的数字能量，不代表声压标定或主观等响。';
  return assertPlayable(value);
}
export function searchPresets({scene='all',query='',headphones='all'}={}) {
  return presets.filter(p=>(scene==='all'||p.scenes.includes(scene))
    &&(headphones!=='no'||p.kind!=='binaural')
    &&`${p.title} ${p.description} ${composition(presetRecipe(p.id).recipe)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
}
export function composition(r){return r.layers.map(l=>l.label).join(' + ')+(r.rhythm.kind==='amplitudeModulation'?' · 振幅调制':'');}
export function durationText(ms){return Number.isFinite(ms)?`${Math.round(ms/60000*10)/10} 分钟`:'持续播放';}
export function previewRecipe(value) {
  assertPlayable(value);
  const p=structuredClone(value),r=p.recipe;
  const stage=r.timeline.stages.find(s=>s.layerStates.some(l=>l.enabled&&l.gain>0));
  if(!stage) throw new Error('这个组合没有可预听的声音，请先启用一个声音层');
  stage.durationMs=Math.min(10000,stage.durationMs??10000);stage.fadeInMs=Math.min(500,stage.durationMs/4);stage.fadeOutMs=Math.min(500,stage.durationMs/4);
  r.timeline={kind:'finite',repeatCount:1,stages:[stage]};r.completion={cue:null,gain:0};
  r.provenance=[{path:'',kind:'design',referenceId:null,locator:null,note:'用户主动选择的预听片段，最长 10 秒，无完成提示。'}];
  return assertPlayable(p);
}
export function canPersonalize(value){
  const r=value?.recipe;
  return r?.timeline?.kind==='finite'&&r.timeline.repeatCount===1&&r.timeline.stages.length===1&&r.completion.cue===null;
}
export function personalDraft(value){
  assertPlayable(value);
  if(!canPersonalize(value))throw new Error('这个方案包含完整阶段流程 暂不转换为个人搭配');
  const draft={kind:'preset',title:`${value.recipe.title} · 我的搭配`,minutes:totalMs(value.recipe)/60000,template:structuredClone(value)};
  personalRecipe(draft);return draft;
}
export function personalRecipe(draft){
  if(typeof draft.title!=='string'||!Number.isInteger(draft.minutes)||draft.minutes<1||draft.minutes>120)throw new Error('请输入名称和 1—120 的整数分钟');
  assertPlayable(draft.template);
  if(!canPersonalize(draft.template))throw new Error('个人搭配只支持单阶段方案');
  const value=structuredClone(draft.template),r=value.recipe,stage=r.timeline.stages[0];
  r.title=draft.title.trim()||'我的声音搭配';
  stage.durationMs=draft.minutes*60000;
  stage.fadeInMs=Math.min(stage.fadeInMs,stage.durationMs);
  stage.fadeOutMs=Math.min(stage.fadeOutMs,stage.durationMs-stage.fadeInMs);
  r.provenance=[...r.provenance.filter(p=>p.path!==''),{path:'',kind:'user',referenceId:null,locator:null,note:'个人搭配 保留原声音配置 可调整名称、时长和声音比例'}];
  return assertPlayable(value);
}
export function customRecipe(draft) {
  if(draft.kind==='preset')return personalRecipe(draft);
  const {layers,minutes,continuous,rhythm}=draft;
  if(!layers.length)throw new Error('先添加一个声音层');
  if(layers.length+(rhythm==='binaural'?1:0)>4)throw new Error('最多四个声音层；双耳节拍也占用一层');
  if(!['none','binaural','amplitudeModulation'].includes(rhythm))throw new Error('节律类型无效');
  if(!continuous&&(!Number.isInteger(minutes)||minutes<1||minutes>120))throw new Error('时长请输入 1—120 的整数分钟');
  const p=makeDemo('pink',Math.max(1,minutes||1)*60000),r=p.recipe;
  r.id='custom-session';r.title=draft.title.trim()||'我的声音组合';r.description='按个人偏好搭配的声音组合。';r.scenes=['custom'];
  if(layers.some(l=>l.assetRef&&l.color!==undefined))throw new Error('一个声音层只能选择一种来源');
  const carrier=layers.some(l=>l.assetRef&&natureSound(l.assetRef).family==='carrier');
  r.layers=layers.map(l=>l.assetRef?natureLayer(l.id,l.assetRef):({id:l.id,label:colorNames[l.color],source:{kind:'noise',color:l.color,generatorVersion:'noise-v1',seed:29,channels:carrier?'independentStereo':'mono'}}));
  const states=layers.map(l=>({layerId:l.id,enabled:l.enabled,gain:l.gain,params:l.assetRef?{pan:0}:{pan:0,filter:null}}));
  if(rhythm==='binaural'){
    r.layers.push({id:'custom-beat',label:'双耳节拍',source:{kind:'binaural',oscillatorVersion:'sine-v1',highEar:'right'}});
    states.push({layerId:'custom-beat',enabled:true,gain:.12,params:{centerHz:draft.centerHz,beatHz:draft.beatHz}});
    r.rhythm={kind:'binaural',layerId:'custom-beat'};
  }else r.rhythm=rhythm==='amplitudeModulation'?{kind:rhythm,targetLayerId:layers[0].id,waveform:'sine'}:{kind:'none'};
  const stage=r.timeline.stages[0];stage.layerStates=states;
  stage.rhythmState=rhythm==='amplitudeModulation'?{enabled:true,rateHz:draft.rateHz,depth:draft.depth}:null;
  stage.fadeInMs=1000;stage.fadeOutMs=continuous?0:3000;stage.durationMs=continuous?null:minutes*60000;
  r.timeline=continuous?{kind:'continuous',stages:[stage]}:{kind:'finite',repeatCount:1,stages:[stage]};
  r.provenance=[{path:'',kind:'user',referenceId:null,locator:null,note:'用户在自由组合页面选择；未调整的控件初始值为产品设计默认值，不代表最佳研究参数。'}];
  return assertPlayable(p);
}
export {totalMs};
