import {AudioEngine} from './audio/engine.js';
import {catalog,resources} from './audio/catalog.js';
import {makeDemo} from './config/demos.js';
import {parseRecipe} from './config/validate.js';
import {runDiagnostics} from './diagnostics.js';
const $=id=>document.getElementById(id),engine=new AudioEngine({catalog,resources});
const names={idle:'尚未播放',preparing:'正在准备',running:'播放中',pausing:'正在暂停',paused:'已暂停',resuming:'正在恢复',interrupted:'播放已中断',completed:'已完成',stopping:'正在停止',stopped:'已停止',error:'无法播放'};
const current=()=>makeDemo($('kind').value,Number($('duration').value));
const time=ms=>Number.isFinite(ms)?`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`:'持续';
let previous='';
function update(){
 $('state').textContent=names[engine.state];const s=engine.status;
 $('position').textContent=s?`${time(s.elapsedMs)} / ${time(s.totalMs)}`:'00:00 / —';
 $('stage').textContent=engine.state==='completed'?'流程已结束':s?.stageId?`阶段：${s.stageId} · 第 ${(s.iteration??0)+1} 轮`:'等待开始';
 $('error').textContent=engine.reason??'';
 const active=['preparing','running','paused','interrupted','pausing','resuming','stopping'].includes(engine.state);
 $('play').disabled=active;$('play-config').disabled=active;
 $('pause').disabled=engine.state!=='running';$('resume').disabled=!['paused','interrupted'].includes(engine.state);
 $('stop').disabled=!active;
 for(const id of ['skip','extend','interrupt'])$(id).disabled=engine.state!=='running';
 if(previous!==engine.state){const li=document.createElement('li');li.textContent=`${new Date().toLocaleTimeString()} · ${names[engine.state]}${engine.reason?' · '+engine.reason:''}`;$('events').prepend(li);while($('events').children.length>30)$('events').lastChild.remove();previous=engine.state;}
}
engine.addEventListener('change',update);
const action=fn=>async()=>{try{await fn();}catch(e){$('error').textContent=e.message;}};
function layers(recipe){$('layers').replaceChildren();for(const layer of recipe.layers){const label=document.createElement('label');label.textContent=layer.label;const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.value=String(recipe.timeline.stages[0].layerStates.find(s=>s.layerId===layer.id).gain*100);input.setAttribute('aria-label',layer.label+' 音量');input.addEventListener('input',()=>engine.gain(layer.id,Number(input.value)/100));label.append(input);$('layers').append(label);}}
$('play').onclick=action(async()=>{const p=current();layers(p.recipe);await engine.start(p);});
$('pause').onclick=action(()=>engine.pause());$('resume').onclick=action(()=>engine.resume());$('stop').onclick=action(()=>engine.stop());
$('skip').onclick=()=>engine.skip();$('extend').onclick=()=>engine.extend(10000);$('interrupt').onclick=()=>engine.interrupt('调试页模拟中断：截止时间继续流逝');
$('volume').oninput=()=>{const n=Number($('volume').value);engine.volume(n/100);$('volume-value').textContent=`${n}%`;};
$('load-demo').onclick=()=>{$('recipe').value=JSON.stringify(current(),null,2);};
$('validate').onclick=()=>{const result=parseRecipe($('recipe').value,{catalog});$('validation').textContent=JSON.stringify({结构合法:result.valid,可以播放:result.playable,错误:result.errors,播放限制:result.blockers},null,2);};
$('play-config').onclick=action(async()=>{const r=parseRecipe($('recipe').value,{catalog});if(!r.playable)throw new Error([...r.errors,...r.blockers].map(e=>e.message).join('\n'));layers(r.value.recipe);await engine.start(r.value);});
$('self-test').onclick=()=>{try{$('diagnostics').textContent=runDiagnostics().join('\n');}catch(e){$('diagnostics').textContent='失败 · '+e.message;}};
$('capabilities').textContent=JSON.stringify({安全上下文:isSecureContext,WebAudio:typeof AudioContext!=='undefined',AudioWorklet:typeof AudioWorkletNode!=='undefined',跨标签互斥:!!navigator.locks,设备变化事件:!!navigator.mediaDevices,浏览器:navigator.userAgent,后台及锁屏:'尚未验证，不作为睡眠可靠定时承诺'},null,2);
$('load-demo').click();update();
window.addEventListener('pagehide',()=>{engine.stop();});
