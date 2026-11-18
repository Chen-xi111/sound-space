import {scenes,presets,isSoundscape,defaultNaturalOnly,colorNames,draftLayerLabel,presetRecipe,searchPresets,composition,durationText,totalMs,customRecipe,personalDraft} from './recipes.js';
import {PersonalLibrary,LIBRARY_KEY,MAX_BACKUP_LENGTH,savedRecipe} from './library.js';
import {Preferences} from './preferences.js';
import {stimulusStatus} from './stimulus.js';
import {natureSounds} from './nature.js';
import {creditsPage} from './credits.js';
import {referenceFor} from './references.js';
import {gardenArt,philosophyPage} from './story.js';
import {SessionController,stateLabels,friendlyError,activeStates} from './session.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const controller=new SessionController();
const preferences=new Preferences();
controller.volume(preferences.get('master',.2));
document.body.classList.toggle('dim',preferences.get('dim',false));
const naturalModes=new Map(presets.filter(isSoundscape).map(p=>[p.id,preferences.get(`natural:${p.id}`,defaultNaturalOnly(p))])),durations=new Map(presets.map(p=>[p.id,preferences.get(`duration:${p.id}`,p.minutes)])),personalLibrary=new PersonalLibrary();
let preferenceWarning=false;
function remember(key,value){if(!preferences.set(key,value)&&!preferenceWarning){preferenceWarning=true;notify('设置已应用 本次无法保存偏好 重新打开后可能恢复默认');}}
function preferredRecipe(id){return presetRecipe(id,durations.get(id),{naturalOnly:naturalModes.get(id)});}
let libraryData={favorites:[],saved:[]},libraryError='',draftRef=null,draftDirty=false,deletedEntry=null,draftSaving=false,draftGeneration=0;
function loadLibrary(){try{libraryData=personalLibrary.read();libraryError='';}catch(e){libraryError=e.message;}}
loadLibrary();
function favoriteButton(id,title){return `<button type="button" data-favorite="${esc(id)}" aria-label="${libraryData.favorites.includes(id)?'取消收藏':'收藏'}${esc(title)}" aria-pressed="${libraryData.favorites.includes(id)}">${libraryData.favorites.includes(id)?'已收藏':'收藏'}</button>`;}
function referenceBlock(kind,sleep=false){if(kind==='carrier'&&!sleep)return '<p>把自然录音整理成连续声床<br>柔化突出的水花与声音起伏</p><p>粉红背景保持独立<br>可以在播放页调整两种声音的比例</p><a href="#/about">原理与研究参考 →</a>';const r=referenceFor(sleep?'sleep':kind);return `<p>${esc(r.description)}</p>${r.url?`<a href="${r.url}" target="_blank" rel="noopener">${esc(r.title)}</a>`:''}<p>声音类型与节律参考已有研究，时长、组合比例和阶段安排属于可调的应用设置。</p>`;}

const emptyDraft=()=>({title:'我的声音组合',minutes:25,continuous:false,layers:[],rhythm:'none',centerHz:200,beatHz:10,rateHz:16,depth:.4});
const draft=emptyDraft();
function replaceDraft(value){for(const key of Object.keys(draft))delete draft[key];Object.assign(draft,value);}
function markDraftDirty(){draftDirty=true;if($('save-status'))$('save-status').textContent='有未保存的修改';}
let nextLayer=1,route,filters={scene:'all',query:'',headphones:'all'},lastAnnounced='',renderedPlayer=null,adjusted=false;
const runtimeGains=new Map();
const clock=ms=>{const n=Math.max(0,Math.floor(ms/1000));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};
function parseRoute(){const [path,query='']=location.hash.slice(1).split('?');return {path:path||'/home',params:new URLSearchParams(query)};}
function notify(message){$('notice').hidden=false;$('notice').querySelector('span').textContent=friendlyError(message);}
$('dismiss-notice').onclick=()=>{$('notice').hidden=true;};
document.querySelector('.skip-link').onclick=e=>{e.preventDefault();$('main').focus();};
async function act(fn){
  const trigger=document.activeElement;
  try{await fn();}catch(error){notify(error.message);}
  finally{if(trigger?.isConnected&&!trigger.disabled&&trigger.getClientRects().length&&[document.body,$('main')].includes(document.activeElement))trigger.focus({preventScroll:true});}
}
function confirmAction(title,body,label){
  const dialog=$('confirm-dialog');if(dialog.open)return Promise.resolve(false);
  const trigger=document.activeElement;$('confirm-title').textContent=title;$('confirm-body').textContent=body;$('confirm-yes').textContent=label;
  return new Promise(resolve=>{
    const finish=result=>{dialog.close();dialog.oncancel=null;trigger?.isConnected&&trigger.focus();resolve(result);};
    $('confirm-no').onclick=()=>finish(false);$('confirm-yes').onclick=()=>finish(true);
    dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();$('confirm-no').focus();
  });
}
function go(path){if(location.hash===`#${path}`)render();else location.hash=path;}
function option(value,label,selected){return `<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;}
function mainVolume(){return `<div class="volume-row"><label for="master-volume">主音量</label><output id="master-value">${Math.round(controller.master*100)}%</output></div><input type="range" id="master-volume" min="0" max="100" value="${Math.round(controller.master*100)}"><p class="caption">记住这台设备的音量 重新打开不会自动播放</p>`;}
function card(p){const r=preferredRecipe(p.id).recipe;return `<article class="card"><h3><a class="title" href="#/recipe/${p.id}">${esc(p.title)}</a></h3><div class="caption">${esc(composition(r))}</div><p>${esc(p.description)}</p><div class="meta">${durationText(totalMs(r))}${p.kind==='binaural'?' · 需要立体声耳机':''}</div><div class="actions"><a href="#/recipe/${p.id}">查看方案</a><button type="button" data-preview="${p.id}" aria-label="预听${esc(p.title)}">预听</button>${favoriteButton(p.id,p.title)}</div></article>`;}
function home(){
  $('main').innerHTML=`<section class="home-hero"><div><p class="eyebrow">专注 · 放松 · 安静休息</p><h1>留一点空间<br>给此刻的自己</h1><p class="hero-description">选一种声音 按自己的节奏开始</p><div class="actions"><button type="button" class="primary" id="quick-start">开始 ${durations.get('soft-rain-focus')} 分钟专注</button><a href="#/library">选择其他声音</a></div><p class="caption">${naturalModes.get('soft-rain-focus')?'绵雨声床':'绵雨与粉红背景'} · 结束时渐弱</p><a class="philosophy-link" href="#/about">了解我们的理念 <span aria-hidden="true">↗</span></a></div><div class="hero-garden">${gardenArt()}<p>认真做事 也好好休息</p></div></section><h2 class="scene-heading">现在想做些什么</h2><section aria-label="使用场景" class="scenes">${scenes.map(s=>`<a class="scene" href="${s.id==='custom'?'#/editor':`#/library?scene=${s.id}`}"><strong>${s.label}</strong><span class="caption">${s.description}</span></a>`).join('')}</section><div class="section-row"><h2>让声音融成一片</h2><a href="#/library">查看全部方案</a></div><div class="cards">${presets.slice(0,3).map(card).join('')}</div>${libraryData.favorites.length?`<div class="section-row"><h2>我的收藏</h2><a href="#/mine">查看我的方案</a></div><div class="cards">${presets.filter(p=>libraryData.favorites.includes(p.id)).slice(0,3).map(card).join('')}</div>`:''}`;
  $('quick-start').onclick=()=>act(()=>start(preferredRecipe('soft-rain-focus')));
}
function library(){
  const scene=route.params.get('scene');if(scene&&scenes.some(s=>s.id===scene))filters.scene=scene;
  $('main').innerHTML=`<div class="intro"><h1>声音方案</h1><p class="subtle">根据场景、声音偏好和设备，找到这一段时间的背景。</p></div><div class="filters"><div class="search-field"><label for="search">搜索名称或声音</label><input type="search" id="search" maxlength="100" value="${esc(filters.query)}" placeholder="例如：雨声、溪流、粉红"></div><div><label for="scene-filter">场景</label><select id="scene-filter">${option('all','全部场景',filters.scene==='all')}${scenes.filter(s=>s.id!=='custom').map(s=>option(s.id,s.label,s.id===filters.scene)).join('')}</select></div><div><label for="headphone-filter">设备</label><select id="headphone-filter">${option('all','不限制',filters.headphones==='all')}${option('no','不使用耳机',filters.headphones==='no')}</select></div></div><div class="section-row"><p id="result-count" class="caption" role="status"></p><button type="button" id="clear-filters">清除筛选</button></div><div id="results"></div>`;
  const update=()=>{const list=searchPresets(filters);$('result-count').textContent=`${list.length} 个方案`;$('results').innerHTML=list.length?`<div class="cards">${list.map(card).join('')}</div>`:'<div class="empty"><h2>暂时没有匹配的方案</h2><p class="subtle">换个关键词，或清除筛选再看看。</p></div>';};
  $('search').oninput=e=>{filters.query=e.target.value;update();};$('scene-filter').onchange=e=>{filters.scene=e.target.value;history.replaceState(null,'',`#/library${filters.scene==='all'?'':`?scene=${filters.scene}`}`);update();};$('headphone-filter').onchange=e=>{filters.headphones=e.target.value;update();};
  $('clear-filters').onclick=()=>{filters={scene:'all',query:'',headphones:'all'};history.replaceState(null,'','#/library');route=parseRoute();library();};update();
}
function detail(id){
  const p=presets.find(p=>p.id===id);if(!p)return missing();
  const minutes=durations.get(id)??p.minutes;
  const pure=()=>naturalModes.get(id)??defaultNaturalOnly(p);
  $('main').innerHTML=`<a class="back" href="#/library">← 返回方案库</a><div class="intro"><h1>${esc(p.title)}</h1><p class="subtle">${esc(p.description)}</p></div><div class="two-col"><section class="panel"><h2>声音与时间</h2><ul class="list" id="detail-layers"></ul>${isSoundscape(p)?`<div class="field"><label for="nature-mode">声音搭配</label><select id="nature-mode">${option('mixed',p.kind==='carrier'?'融合背景':'自然声 + 轻柔背景噪声',!pure())}${option('pure',p.kind==='carrier'?'单独声床':'纯自然声',pure())}</select><p class="caption">播放时可以分别调整声音比例</p></div>`:''}<div class="field"><label for="duration-minutes">${p.kind==='am'?'每轮学习时长':'播放时长'}（分钟）</label><input id="duration-minutes" type="number" min="1" max="120" step="1" value="${esc(minutes)}" aria-describedby="duration-error"><p id="duration-error" class="error" role="alert"></p></div><p id="duration-summary"></p><ol id="detail-stages" class="list"></ol><p class="caption">${p.kind==='am'?'学习后安静休息 5 分钟，整个流程重复 2 轮。':'结束时渐弱，默认没有提示音。'}</p><div class="actions"><button id="start-recipe" class="primary" type="button">开始播放</button><button id="preview-recipe" type="button">预听 10 秒</button>${favoriteButton(p.id,p.title)}${p.kind!=='am'?'<button id="personalize-recipe" type="button">调整并保存搭配</button>':''}</div>${p.kind==='am'?'<p class="caption">此方案保留完整学习与休息流程 可先收藏使用</p>':''}</section><aside><section class="panel"><h2>开始之前</h2><p>${p.kind==='binaural'?'此方案需要立体声耳机，左右耳播放不同载波。':'从较低音量开始 让背景声轻于你正在做的事'}</p>${mainVolume()}</section><details class="panel"><summary>${p.kind==='carrier'?'声音组成与原版试听':'声音设置与研究依据'}</summary>${referenceBlock(p.kind,p.scenes.includes('sleep'))}<p>预听播放首个声音片段，最长 10 秒。</p>${isSoundscape(p)?'<a href="#/credits">录音来源与授权 →</a>':''}${p.compareId?'<p class="caption">声床来自自然录音重构 可沿用当前主音量试听之前的混音</p><button id="compare-original" type="button">预听原混音 10 秒</button>':''}</details></aside></div>`;
  const get=()=>presetRecipe(id,Number($('duration-minutes').value),{naturalOnly:pure()});
  const update=()=>{try{const value=get(),r=value.recipe;durations.set(id,Number($('duration-minutes').value));$('duration-error').textContent='';$('start-recipe').disabled=false;$('preview-recipe').disabled=false;if($('personalize-recipe'))$('personalize-recipe').disabled=false;$('duration-summary').textContent=`完整流程：${durationText(totalMs(r))}`;$('detail-layers').innerHTML=r.layers.map(l=>`<li>${esc(l.label)}</li>`).join('');$('detail-stages').innerHTML=r.timeline.stages.map(s=>`<li>${esc(s.label)} <span class="subtle">${durationText(s.durationMs)}</span></li>`).join('');}catch(e){$('duration-error').textContent=e.message;$('start-recipe').disabled=true;$('preview-recipe').disabled=true;if($('personalize-recipe'))$('personalize-recipe').disabled=true;$('duration-summary').textContent='请先修正时长';}};
  if($('personalize-recipe'))$('personalize-recipe').onclick=()=>act(async()=>{const value=personalDraft(get());if(draftDirty&&!(await confirmAction('打开个人搭配？','编辑区还有未保存的内容 打开后会替换这些内容','放弃修改并打开')))return;draftGeneration++;replaceDraft(value);draftRef=null;draftDirty=true;go('/editor');});
  if($('compare-original'))$('compare-original').onclick=()=>act(()=>listen(presetRecipe(p.compareId,minutes,{naturalOnly:false})));
  if($('nature-mode'))$('nature-mode').onchange=e=>{naturalModes.set(id,e.target.value==='pure');remember(`natural:${id}`,e.target.value==='pure');update();};
  $('duration-minutes').oninput=()=>{update();if(!$('start-recipe').disabled)remember(`duration:${id}`,Number($('duration-minutes').value));};$('start-recipe').onclick=()=>act(()=>start(get()));$('preview-recipe').onclick=()=>act(()=>listen(get()));update();
}
async function start(value){
  let replace=false;
  if(controller.hasMain){replace=await confirmAction('切换当前方案？',`“${controller.main.snapshot?.recipe.title??'当前方案'}”仍在会话中。开始新方案会结束这一次会话。`,'停止当前并开始');if(!replace)return;}
  // run() claims the operation synchronously; duplicate clicks cannot enqueue.
  const task=controller.start(value,{replace});adjusted=false;runtimeGains.clear();go('/player');await task;sync();
}
async function listen(value){
  let pauseCurrent=false;
  if(controller.main.state==='running'){pauseCurrent=await confirmAction('先暂停当前声音？','预听会暂停当前方案。预听结束后，由你决定是否继续原方案。','暂停当前并预听');if(!pauseCurrent)return;}
  for(const key of runtimeGains.keys())if(key.startsWith('preview:'))runtimeGains.delete(key);
  await controller.listen(value,{pauseCurrent});sync();
}
function player(){
  const e=controller.output,r=e.snapshot?.recipe;renderedPlayer=e.snapshot;
  if(!r){$('main').innerHTML='<div class="empty"><h1>还没有开始播放</h1><p class="subtle">先选一个声音方案，或搭配自己的组合。</p><div class="actions"><a class="button primary" href="#/library">选择方案</a><a href="#/editor">自由组合</a></div></div>';return;}
  const preview=controller.hasPreview;
  $('main').innerHTML=`<a class="back" href="#/library">← 浏览其他方案</a><div class="intro"><h1>${esc(r.title)}</h1><p class="subtle">${esc(composition(r))}${preview?' · 预听片段':''}</p></div><div class="two-col"><section class="panel play-main"><div id="player-state" class="play-state"></div><div id="player-clock" class="timer"></div><p id="player-time-label" class="caption"></p><progress id="player-progress" max="100" value="0" aria-label="完整流程进度"></progress><h2 id="player-stage"></h2><p id="player-position" class="caption"></p><p id="player-reason" class="error"></p><div class="actions"><button id="toggle-play" class="primary" type="button">暂停</button><button id="stop-play" type="button">停止</button><button id="replay" class="primary" type="button">再播一次</button></div><div class="actions"><button id="skip-stage" type="button">跳过当前阶段</button><button id="extend-stage" type="button">延长 5 分钟</button></div><p class="caption" id="adjusted-label"></p></section><aside><section class="panel"><h2>音量</h2>${mainVolume()}<details class="sound-adjustments"><summary>调整声音比例</summary><p id="player-stimulus" class="caption" role="status"></p><div id="layer-controls">${r.layers.map(l=>`<div class="layer"><div class="volume-row"><label for="gain-${esc(l.id)}">${esc(l.label)}</label><output id="gain-value-${esc(l.id)}"></output></div><input type="range" id="gain-${esc(l.id)}" data-gain="${esc(l.id)}" min="0" max="100"><span class="caption" id="layer-state-${esc(l.id)}"></span></div>`).join('')}</div><p class="caption">百分比表示声音层增益 可按听感调整</p></details></section><section class="panel"><label class="check"><input id="dim-mode" type="checkbox"${document.body.classList.contains('dim')?' checked':''}>低亮显示</label><p class="caption">只改变页面显示，不影响播放或设备亮度。</p></section></aside></div>`;
  $('toggle-play').onclick=()=>act(()=>controller.hasPreview?controller.stopPreview():e.state==='running'?controller.pause():controller.resume());
  $('stop-play').onclick=()=>act(()=>controller.hasPreview?controller.stopPreview():controller.stop());
  $('replay').onclick=()=>act(()=>start({format:'wave-platform.recipe',schemaVersion:1,exampleOnly:false,recipe:structuredClone(r)}));
  $('skip-stage').onclick=()=>{controller.main.skip();adjusted=true;};$('extend-stage').onclick=()=>{controller.main.extend(300000);adjusted=true;};
  $('dim-mode').onchange=e=>{document.body.classList.toggle('dim',e.target.checked);remember('dim',e.target.checked);};
}
function editor(){
  if(draft.kind==='preset')return personalEditor();
  $('main').innerHTML=`<div class="intro"><h1>自由组合</h1><p class="subtle">从一个声音开始，按你的偏好调整。最多四层。</p><div class="section-row"><p class="caption" id="draft-mode">${draftRef?'正在编辑已保存的组合':'新组合'}</p><button type="button" id="new-draft">新建组合</button></div></div><div class="two-col"><section><section class="panel"><div class="field"><label for="draft-title">组合名称</label><input id="draft-title" maxlength="80" value="${esc(draft.title)}"></div><h2>声音层</h2><div id="draft-layers"></div><div class="actions"><label for="add-color" class="sr-only">添加的声音类型</label><select id="add-color"><optgroup label="融合声床">${natureSounds.filter(s=>s.family==='carrier').map(s=>option(s.id,s.label,false)).join('')}</optgroup><optgroup label="自然录音">${natureSounds.filter(s=>s.family!=='carrier').map(s=>option(s.id,s.label,false)).join('')}</optgroup><optgroup label="背景噪声">${Object.entries(colorNames).map(([v,l])=>option(v,l,false)).join('')}</optgroup></select><button type="button" id="add-layer">添加声音层</button></div><p class="caption">融合声床 自然录音 与三种背景噪声<br><a href="#/credits">录音来源与授权</a></p></section><section class="panel"><h2>时间</h2><label class="check"><input id="continuous" type="checkbox"${draft.continuous?' checked':''}>持续播放，直到手动停止</label><div class="field"><label for="draft-minutes">播放时长（分钟）</label><input id="draft-minutes" type="number" min="1" max="120" step="1" value="${esc(draft.minutes)}"${draft.continuous?' disabled':''}></div><p class="caption">定时结束时渐弱，无结束提示音。</p></section></section><aside><details class="panel"><summary>高级节律（可选）</summary><label for="draft-rhythm">节律类型</label><select id="draft-rhythm">${option('none','无',draft.rhythm==='none')}${option('binaural','双耳节拍 · 需要立体声耳机',draft.rhythm==='binaural')}${option('amplitudeModulation','振幅调制 · 作用于第一层',draft.rhythm==='amplitudeModulation')}</select><div id="binaural-fields"${draft.rhythm==='binaural'?'':' hidden'}><p class="caption">双耳节拍占用一个声音层。参数初始值为产品设计值。</p><label for="center-hz">中心载波（80—1000 Hz）</label><input id="center-hz" type="number" min="80" max="1000" value="${esc(draft.centerHz)}"><label for="beat-hz">左右频差（1—30 Hz）</label><input id="beat-hz" type="number" min="1" max="30" value="${esc(draft.beatHz)}"></div><div id="am-fields"${draft.rhythm==='amplitudeModulation'?'':' hidden'}><p class="caption">调制作用于列表第一层；移除目标层时会同时关闭调制。</p><label for="rate-hz">调制频率（1—30 Hz）</label><input id="rate-hz" type="number" min="1" max="30" value="${esc(draft.rateHz)}"><label for="depth">调制深度（0—100%）</label><input id="depth" type="number" min="0" max="100" value="${esc(draft.depth*100)}"></div></details><section class="panel"><h2>这一次的声音</h2><p id="draft-summary"></p><p id="draft-stimulus" class="caption" role="status"></p><p id="draft-error" class="error" role="alert"></p>${mainVolume()}<div class="actions"><button id="start-custom" class="primary" type="button">开始播放</button><button id="preview-custom" type="button">预听 10 秒</button></div><div class="actions"><button id="save-custom" type="button">${draftRef?'保存修改':'保存到我的方案'}</button>${draftRef?'<button id="save-copy" type="button">另存副本</button>':''}</div><p id="save-status" class="caption" role="status">${draftDirty?'有未保存的修改':draftRef?'已保存在这台设备':''}</p><p class="caption">修改组合不会改变正在播放的会话；重新开始时应用。</p></section></aside></div>`;
  const update=()=>{try{const p=customRecipe(draft);$('draft-stimulus').textContent=stimulusStatus(p.recipe).text;$('draft-error').textContent='';$('draft-summary').textContent=`${composition(p.recipe)} · ${durationText(totalMs(p.recipe))}`;$('start-custom').disabled=false;$('save-custom').disabled=draftSaving;if($('save-copy'))$('save-copy').disabled=draftSaving;$('preview-custom').disabled=!p.recipe.timeline.stages.some(s=>s.layerStates.some(l=>l.enabled&&l.gain>0));}catch(e){$('draft-stimulus').textContent='';$('draft-error').textContent=draft.layers.length?e.message:'';$('draft-summary').textContent=draft.layers.length?'修正参数后就可以播放。':'先添加一个喜欢的声音。';$('start-custom').disabled=true;$('save-custom').disabled=true;if($('save-copy'))$('save-copy').disabled=true;$('preview-custom').disabled=true;}$('add-layer').disabled=draft.layers.length+(draft.rhythm==='binaural'?1:0)>=4;};
  const drawLayers=()=>{$('draft-layers').innerHTML=draft.layers.length?draft.layers.map(l=>`<div class="layer"><div class="layer-top"><label class="check"><input type="checkbox" data-enabled="${l.id}"${l.enabled?' checked':''}>${esc(draftLayerLabel(l))}</label><button type="button" data-remove="${l.id}" aria-label="移除${esc(draftLayerLabel(l))}">移除</button></div><label for="draft-gain-${l.id}" class="caption">${esc(draftLayerLabel(l))}声音比例 <output id="draft-gain-value-${l.id}">${Math.round(l.gain*100)}%</output></label><input type="range" id="draft-gain-${l.id}" data-draft-gain="${l.id}" min="0" max="100" value="${l.gain*100}"></div>`).join(''):'<p class="subtle">还没有声音层。</p>';update();};
  $('add-layer').onclick=()=>{if(draft.layers.length+(draft.rhythm==='binaural'?1:0)>=4)return;markDraftDirty();const choice=$('add-color').value,sound=natureSounds.find(s=>s.id===choice);draft.layers.push({id:`layer-${nextLayer++}`,...(sound?{assetRef:{id:sound.assetId,revision:sound.revision}}:{color:choice}),gain:sound?(sound.family==='carrier'?.55:.8):.15,enabled:true});drawLayers();};
  $('draft-layers').onclick=e=>{const id=e.target.closest('[data-remove]')?.dataset.remove;if(id){const index=draft.layers.findIndex(l=>l.id===id);if(draft.rhythm==='amplitudeModulation'&&index===0){draft.rhythm='none';$('draft-rhythm').value='none';$('am-fields').hidden=true;notify('已移除调制目标，同时关闭振幅调制。需要时可重新选择。');}markDraftDirty();draft.layers=draft.layers.filter(l=>l.id!==id);drawLayers();}};
  $('draft-layers').oninput=e=>{const el=e.target,l=draft.layers.find(x=>x.id===(el.dataset.enabled??el.dataset.draftGain));if(!l)return;if(el.dataset.enabled)l.enabled=el.checked;else{l.gain=Number(el.value)/100;$(`draft-gain-value-${l.id}`).textContent=`${el.value}%`;}update();};
  const numeric={'draft-minutes':'minutes','center-hz':'centerHz','beat-hz':'beatHz','rate-hz':'rateHz','depth':'depth'};
  for(const [id,key] of Object.entries(numeric))$(id).oninput=e=>{draft[key]=Number(e.target.value)/(key==='depth'?100:1);update();};
  $('draft-title').oninput=e=>{draft.title=e.target.value;update();};
  $('continuous').onchange=e=>{draft.continuous=e.target.checked;$('draft-minutes').disabled=draft.continuous;update();};
  $('draft-rhythm').onchange=e=>{draft.rhythm=e.target.value;$('binaural-fields').hidden=draft.rhythm!=='binaural';$('am-fields').hidden=draft.rhythm!=='amplitudeModulation';update();};
  bindDraftSaving(update);
  $('start-custom').onclick=()=>act(()=>start(customRecipe(draft)));$('preview-custom').onclick=()=>act(()=>listen(customRecipe(draft)));drawLayers();
}
function bindDraftSaving(update){
  const save=async copy=>{
    if(draftSaving)return;draftSaving=true;const generation=draftGeneration,saveButton=$('save-custom');
    $('save-custom').disabled=true;if($('save-copy'))$('save-copy').disabled=true;
    try{const before=JSON.stringify(draft),entry=await personalLibrary.save(draft,copy?{}:{id:draftRef?.id,baseRevision:draftRef?.revision});
      loadLibrary();if(generation!==draftGeneration)return;
      draftRef={id:entry.id,revision:entry.revision};draftDirty=JSON.stringify(draft)!==before;
      if(!saveButton.isConnected){if(route.path==='/mine')mine();return;}
      $('notice').hidden=true;$('draft-mode').textContent='正在编辑已保存的组合';
      $('save-status').textContent=draftDirty?'已保存，之后的修改尚未保存':'已保存在这台设备';$('save-custom').textContent='保存修改';
      if(!$('save-copy')){const button=document.createElement('button');button.type='button';button.id='save-copy';button.textContent='另存副本';button.onclick=()=>act(()=>save(true));$('save-custom').after(button);}
    }finally{draftSaving=false;if(saveButton.isConnected)update();else if(route.path==='/editor'){editor();bindVolume();}}
  };
  $('new-draft').onclick=()=>act(async()=>{if(draftDirty&&!(await confirmAction('新建一个组合？','当前组合尚有未保存的修改。可以先保存，或放弃修改后新建。','放弃修改并新建')))return;draftGeneration++;replaceDraft(emptyDraft());draftRef=null;draftDirty=false;nextLayer=1;go('/editor');$('draft-title').focus();});
  $('save-custom').onclick=()=>act(()=>save(false));if($('save-copy'))$('save-copy').onclick=()=>act(()=>save(true));
}
function personalEditor(){
  const template=draft.template.recipe,stage=template.timeline.stages[0];
  $('main').innerHTML=`<div class="intro"><h1>调整个人搭配</h1><p class="subtle">留下适合你的声音比例 下次直接开始</p><div class="section-row"><p class="caption" id="draft-mode">${draftRef?'正在编辑已保存的组合':'来自 '+esc(template.title)}</p><button id="new-draft" type="button">新建组合</button></div></div><div class="two-col"><section class="panel"><div class="field"><label for="draft-title">组合名称</label><input id="draft-title" maxlength="80" value="${esc(draft.title)}"></div><div class="field"><label for="draft-minutes">播放时长（分钟）</label><input id="draft-minutes" type="number" min="1" max="120" step="1" value="${draft.minutes}"></div><h2>声音比例</h2>${stage.layerStates.map(st=>{const layer=template.layers.find(l=>l.id===st.layerId);return `<div class="layer"><div class="volume-row"><label for="personal-gain-${esc(st.layerId)}">${esc(layer.label)}</label><output id="personal-value-${esc(st.layerId)}">${Math.round(st.gain*100)}%</output></div><input id="personal-gain-${esc(st.layerId)}" data-personal-gain="${esc(st.layerId)}" type="range" min="0" max="100" step="1" value="${st.gain*100}"${st.enabled?'':' disabled'}></div>`;}).join('')}<p class="caption" id="personal-ending"></p><p class="caption">保留原方案的声源与节律设置</p></section><aside><section class="panel"><h2>我的声音</h2><p id="draft-summary"></p><p id="draft-stimulus" class="caption" role="status"></p><p class="error" id="draft-error" role="alert"></p>${mainVolume()}<div class="actions"><button id="start-custom" type="button" class="primary">开始播放</button><button id="preview-custom" type="button">预听 10 秒</button></div><div class="actions"><button id="save-custom" type="button">${draftRef?'保存修改':'保存到我的方案'}</button>${draftRef?'<button id="save-copy" type="button">另存副本</button>':''}</div><p id="save-status" class="caption" role="status">${draftDirty?'有未保存的修改':draftRef?'已保存在这台设备':''}</p><p class="caption">保存后在我的方案里直接使用</p></section></aside></div>`;
  const update=()=>{try{const value=customRecipe(draft),r=value.recipe;$('draft-stimulus').textContent=stimulusStatus(r).text;$('draft-summary').textContent=`${composition(r)} · ${durationText(totalMs(r))}`;const fadeMs=r.timeline.stages[0].fadeOutMs;$('personal-ending').textContent=`结束前 ${fadeMs>=60000?durationText(fadeMs):`${fadeMs/1000} 秒`}渐弱`;$('draft-error').textContent='';$('start-custom').disabled=false;$('preview-custom').disabled=!r.timeline.stages[0].layerStates.some(l=>l.enabled&&l.gain>0);$('save-custom').disabled=draftSaving;if($('save-copy'))$('save-copy').disabled=draftSaving;}catch(error){$('draft-stimulus').textContent='';$('draft-error').textContent=error.message;for(const id of ['start-custom','preview-custom','save-custom','save-copy'])if($(id))$(id).disabled=true;}};
  $('draft-title').oninput=e=>{draft.title=e.target.value;update();};
  $('draft-minutes').oninput=e=>{draft.minutes=Number(e.target.value);update();};
  document.querySelectorAll('[data-personal-gain]').forEach(input=>{input.oninput=()=>{const st=stage.layerStates.find(x=>x.layerId===input.dataset.personalGain);st.gain=Number(input.value)/100;$(`personal-value-${st.layerId}`).textContent=`${input.value}%`;update();};});
  bindDraftSaving(update);$('start-custom').onclick=()=>act(()=>start(customRecipe(draft)));$('preview-custom').onclick=()=>act(()=>listen(customRecipe(draft)));update();
}
function savedCard(entry){const value=savedRecipe(entry);return `<article class="card"><h3>${esc(entry.draft.title||'我的声音组合')}</h3><p class="caption">${esc(composition(value.recipe))} · ${durationText(totalMs(value.recipe))}</p><div class="actions"><button type="button" data-saved-start="${entry.id}" class="primary">开始播放</button><button type="button" data-edit-saved="${entry.id}">编辑</button><button type="button" data-remove-saved="${entry.id}" aria-label="删除${esc(entry.draft.title)}">删除</button></div></article>`;}
function mine(){
 loadLibrary();$('main').innerHTML=`<div class="intro"><h1>我的方案</h1><p class="subtle">把常用的声音留在这里，下次直接开始。</p></div>${libraryError?`<p class="error" role="alert">${esc(libraryError)}</p><button type="button" id="backup-library">导出原始备份</button>`:''}<div class="section-row"><h2>个人组合</h2><a href="#/editor">创建或继续编辑</a></div>${libraryData.saved.length?`<div class="cards">${libraryData.saved.map(savedCard).join('')}</div>`:'<div class="empty"><p>还没有保存的组合。</p><a class="button" href="#/editor">搭配自己的声音</a></div>'}${deletedEntry?'<p role="status">组合已删除。<button id="undo-delete" type="button">撤销删除</button></p>':''}<div class="section-row"><h2>收藏</h2><a href="#/library">浏览声音</a></div>${libraryData.favorites.length?`<div class="cards">${presets.filter(p=>libraryData.favorites.includes(p.id)).map(card).join('')}</div>`:'<p class="subtle">收藏喜欢的方案，就能在这里快速找到。</p>'}<p class="caption">方案保存在当前浏览器，不上传使用记录。清理浏览器数据会移除这些内容。</p>`;
 if($('undo-delete'))$('undo-delete').onclick=()=>act(async()=>{await personalLibrary.restore(deletedEntry);deletedEntry=null;if(route.path==='/mine'){mine();$('main').focus();}});
 if($('backup-library'))$('backup-library').onclick=backupLibrary;
}
function backupLibrary(){act(async()=>{
  const raw=personalLibrary.backup();let panel=$('backup-panel');
  if(!panel){panel=document.createElement('section');panel.id='backup-panel';panel.className='panel';panel.innerHTML='<h2>本地备份</h2><p class="caption">可以下载文件，或全选下面的内容，复制并保存为 .json 文件。备份仅包含收藏和个人组合。</p><label for="backup-text">备份内容</label><textarea id="backup-text" readonly rows="8" spellcheck="false"></textarea><div class="actions"><button id="download-backup" type="button">下载 JSON 文件</button><button id="select-backup" type="button">全选备份内容</button><button id="close-backup" type="button">收起</button></div>'; const parent=$('backup-library').closest('.panel');if(parent)parent.after(panel);else $('backup-library').after(panel);}
  $('backup-text').value=raw;panel.hidden=false;
  $('select-backup').onclick=()=>{$('backup-text').focus();$('backup-text').select();};
  $('close-backup').onclick=()=>{panel.hidden=true;$('backup-library').focus();};
  $('download-backup').onclick=()=>{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='声音空间-本地备份.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  $('backup-text').focus();
});}
function importLibrary(){
  let panel=$('import-panel');
  if(panel){panel.hidden=false;panel.querySelector('textarea').focus();return;}
  panel=document.createElement('section');panel.id='import-panel';panel.className='panel';
  panel.innerHTML='<h2>恢复本地备份</h2><p class="caption">选择备份文件 或粘贴备份内容<br>已有组合会保留 有不同版本时另存副本</p><div class="field"><label for="import-file">选择 JSON 备份</label><input id="import-file" type="file" accept=".json,application/json"></div><label for="import-text">备份内容</label><textarea id="import-text" rows="5" spellcheck="false" placeholder="在这里粘贴完整备份"></textarea><div class="actions"><button id="check-import" type="button">查看恢复内容</button><button id="close-import" type="button">收起</button></div><p id="import-status" role="status" aria-live="polite"></p><div id="import-review" hidden><details><summary>将添加的组合</summary><ul id="import-titles" class="list"></ul></details><div class="actions"><button id="apply-import" type="button" class="primary">合并到我的方案</button><a href="#/mine">打开我的方案</a></div></div>';
  $('import-library').closest('.two-col').after(panel);
  const text=panel.querySelector('#import-text'),file=panel.querySelector('#import-file'),check=panel.querySelector('#check-import'),apply=panel.querySelector('#apply-import'),status=panel.querySelector('#import-status'),review=panel.querySelector('#import-review'),close=panel.querySelector('#close-import');
  text.maxLength=MAX_BACKUP_LENGTH;
  let checkedRaw=null,generation=0,busy=false;
  const invalidate=()=>{checkedRaw=null;review.hidden=true;status.textContent='';status.className='';generation++;};
  const inspect=()=>{
    invalidate();
    try{
      const plan=personalLibrary.previewImport(text.value);checkedRaw=text.value;
      status.textContent=`将添加 ${plan.added} 个组合 · ${plan.favorites} 个收藏${plan.skipped?` · ${plan.skipped} 个组合已存在`:''}${plan.copies?` · 其中 ${plan.copies} 个不同版本将另存副本`:''}`;
      panel.querySelector('#import-titles').innerHTML=plan.titles.map(title=>`<li>${esc(title||'我的声音组合')}</li>`).join('');
      panel.querySelector('details').hidden=!plan.added;review.hidden=false;apply.disabled=!(plan.added||plan.favorites);
      if(apply.disabled)status.textContent='这份备份中的内容已全部保留 无需再次恢复';
    }catch(error){status.className='error';status.textContent=error.message;}
  };
  text.oninput=invalidate;check.onclick=inspect;
  file.onchange=async()=>{
    invalidate();const token=generation,selected=file.files[0];text.value='';if(!selected)return;
    try{
      // UTF-8 may occupy up to four bytes per character; parsing also checks the character limit.
      if(selected.size>MAX_BACKUP_LENGTH*4)throw new Error('文件过大 请选择声音空间导出的 JSON 备份');
      const raw=await selected.text();if(token!==generation||!panel.isConnected)return;
      text.value=raw;inspect();
    }catch(error){if(token===generation&&panel.isConnected){status.className='error';status.textContent=error.message;}}
  };
  close.onclick=()=>{generation++;panel.hidden=true;$('import-library')?.focus();};
  apply.onclick=async()=>{
    if(busy||checkedRaw===null)return;
    if(checkedRaw!==text.value){inspect();return;}
    busy=true;[apply,text,file,check,close].forEach(el=>el.disabled=true);
    try{
      const result=await personalLibrary.importBackup(checkedRaw);loadLibrary();
      if(!panel.isConnected)return;
      status.className='';status.textContent=`已恢复 ${result.added} 个组合 · ${result.favorites} 个收藏${result.skipped?` · 跳过 ${result.skipped} 个已有组合`:''}`;
      checkedRaw=null;apply.disabled=true;panel.querySelector('details').hidden=true;status.tabIndex=-1;status.focus();
    }catch(error){if(panel.isConnected){status.className='error';status.textContent=error.message;apply.disabled=false;}}
    finally{busy=false;[text,file,check,close].forEach(el=>el.disabled=false);}
  };
  text.focus();
}
function settings(){
  $('main').innerHTML=`<div class="intro"><h1>使用说明</h1><p class="subtle">选声音，调时长，开始这一段专注或休息。</p></div><div class="two-col"><section class="panel"><h2>播放与音量</h2>${mainVolume()}<label class="check"><input id="dim-mode" type="checkbox"${document.body.classList.contains('dim')?' checked':''}>低亮显示</label><p class="caption">显示偏好也会保留</p><ul class="list"><li>暂停后，计时保持不变。</li><li>预听结束后，原方案保持暂停，由你决定何时继续。</li><li>切换站内页面可以继续播放；刷新或关闭页面会结束会话。</li><li>系统中断后，时间继续流逝；到期的声音不会补播。</li></ul></section><section class="panel"><h2>我的声音</h2><p>收藏常用方案，或在自由组合中保存自己的搭配。全部保存在这台设备，无需账户。</p><div class="actions"><a href="#/mine">打开我的方案</a><button id="backup-library" type="button">导出本地备份</button><button id="import-library" type="button">恢复备份</button></div><p class="caption">备份包含收藏和个人组合 只在这台设备处理</p></section></div><section class="panel philosophy-entry"><h2>声音背后的想法</h2><p>我们为什么选择这些声音 又希望带来什么</p><a href="#/about">我们的理念与研究参考 →</a></section><details class="panel"><summary>声音与研究依据</summary><p><a href="#/credits">录音来源与授权 →</a></p><p>平台把背景噪声、双耳节拍和振幅调制组合为可重复使用的日常方案。具体声音与参数来源可以在方案详情查看。</p><p>棕噪声按低频音色偏好提供；时间安排、混音比例与渐弱结束由应用设置管理。</p></details><details class="panel"><summary>设备兼容与高级检查</summary><p>当前面向电脑使用 双耳节拍需要立体声耳机<br>关闭页面或电脑进入睡眠会结束或中断播放</p><p>当前提供融合声床 自然录音 与本机生成的噪声和节律</p><p><a href="/public/sound-verification.html" target="_blank" rel="noopener">查看声音对照模拟</a></p><a href="/public/diagnostics.html" target="_blank" rel="noopener">打开声音实验台（新页面）</a></details>`;
  $('backup-library').onclick=backupLibrary;
  $('import-library').onclick=importLibrary;
}
function missing(){ $('main').innerHTML='<div class="empty"><h1>找不到这个页面</h1><p class="subtle">可以回到方案库重新选择。</p><a class="button" href="#/library">浏览方案</a></div>'; }
function render(){
  route=parseRoute();$('notice').hidden=true;
  if(route.path==='/home')home();else if(route.path==='/library')library();else if(route.path.startsWith('/recipe/'))detail(route.path.slice(8));else if(route.path==='/player')player();else if(route.path==='/editor')editor();else if(route.path==='/settings')settings();else if(route.path==='/mine')mine();else if(route.path==='/credits')$('main').innerHTML=creditsPage();
  else if(route.path==='/about')$('main').innerHTML=philosophyPage(controller.hasMain);else missing();
  document.querySelectorAll('[data-nav]').forEach(a=>{const on=a.dataset.nav===(route.path==='/editor'?'editor':route.path==='/settings'?'settings':route.path==='/mine'?'mine':['/about','/credits'].includes(route.path)?null:'home');if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=route.path==='/about'?'我们的理念 · 声音空间':route.path==='/home'?'声音空间':`${$('main').querySelector('h1')?.textContent??'声音空间'} · 声音空间`;
  bindVolume();sync();$('main').focus({preventScroll:true});window.scrollTo(0,0);
}
function bindVolume(){const input=$('master-volume');if(input){input.oninput=e=>controller.volume(Number(e.target.value)/100);input.onchange=e=>remember('master',Number(e.target.value)/100);}const dim=$('dim-mode');if(dim)dim.onchange=e=>{document.body.classList.toggle('dim',e.target.checked);remember('dim',e.target.checked);};}
function sync(){
  const storyBack=document.querySelector('[data-about-back]'),storyAction=document.querySelector('[data-about-action]');
  if(storyBack){storyBack.href=controller.hasMain?'#/player':'#/home';storyBack.textContent=controller.hasMain?'← 回到播放':'← 回到声音空间';}
  if(storyAction){storyAction.href=controller.hasMain?'#/player':'#/library';storyAction.textContent=controller.hasMain?'回到正在使用的声音':'选择我的声音';}
  const e=controller.output,r=e.snapshot?.recipe,s=e.status,preview=controller.hasPreview;
  const state=stateLabels[e.state],has=controller.hasMain||preview||!!controller.main.snapshot;
  if(route?.path==='/player'&&renderedPlayer!==e.snapshot){player();bindVolume();}
  const total=s?.totalMs??(r?totalMs(r):0),elapsed=s?.elapsedMs??0;
  const title=preview?`预听 · ${r?.title??'声音'}`:r?.title??'声音';
  $('mini').hidden=!has||route?.path==='/player';$('mini-title').textContent=title;$('mini-state').textContent=state;$('mini-time').textContent=Number.isFinite(total)?`${clock(elapsed)} / ${clock(total)}`:`${clock(elapsed)} · 持续播放`;
  const canToggle=preview||['running','paused','interrupted'].includes(e.state);
  $('mini').querySelector('a').hidden=preview;$('mini-toggle').hidden=!canToggle;$('mini-toggle').textContent=preview?'结束预听':e.state==='running'?'暂停':'继续';$('mini-toggle').disabled=controller.busy;
  $('mini-stop').hidden=!activeStates.has(e.state);$('mini-stop').disabled=e.state==='stopping';
  const stamp=`${preview}:${e.state}`;if(stamp!==lastAnnounced){$('announcement').textContent=`${title}，${state}`;lastAnnounced=stamp;}
  const master=$('master-volume');if(master){if(document.activeElement!==master)master.value=String(Math.round(controller.master*100));$('master-value').textContent=`${Math.round(controller.master*100)}%`;}
  if(!$('player-state'))return;
  $('player-state').textContent=preview?`预听 · ${state}`:state;
  $('player-clock').textContent=Number.isFinite(total)?clock(Math.ceil(Math.max(0,total-elapsed)/1000)*1000):clock(elapsed);
  $('player-time-label').textContent=Number.isFinite(total)?'剩余时间':'已播放 · 直到手动停止';
  $('player-progress').hidden=!Number.isFinite(total);$('player-progress').value=total?Math.min(100,elapsed/total*100):0;
  const stage=r?.timeline.stages.find(x=>x.id===s?.stageId)??r?.timeline.stages[0];
  const currentGains=Object.fromEntries((r?.layers??[]).map(l=>[l.id,runtimeGains.get(`${preview?'preview':'main'}:${s?.index??0}:${l.id}`)]));
  if($('player-stimulus'))$('player-stimulus').textContent=stimulusStatus(r,{stage,gains:currentGains,master:controller.master,state:e.state}).text;
  const silent=stage?.layerStates.every(l=>!l.enabled||l.gain===0);
  $('player-stage').textContent=e.state==='completed'?'流程已结束':e.state==='stopped'?'会话已停止':silent?'安静休息中':stage?.label??'正在准备';
  $('player-position').textContent=`${Number.isFinite(total)?'流程进度':'已播放'} ${clock(elapsed)}${Number.isFinite(total)?` · 总计 ${durationText(total)}`:''}${r?.timeline.repeatCount>1?` · 第 ${(s?.iteration??0)+1} / ${r.timeline.repeatCount} 轮`:''}`;
  $('player-reason').className=e.reason?'error':'caption';
  $('player-reason').textContent=friendlyError(e.reason)|| (e.state==='paused'?'计时已暂停，等待你继续。':'');
  $('toggle-play').hidden=!canToggle;$('toggle-play').textContent=preview?'结束预听':e.state==='running'?'暂停':'继续播放';$('toggle-play').disabled=controller.busy;
  $('stop-play').hidden=!activeStates.has(e.state);$('stop-play').textContent=['preparing','resuming'].includes(e.state)?'取消':'停止';$('stop-play').disabled=e.state==='stopping';
  $('replay').hidden=preview||activeStates.has(e.state);$('replay').textContent=e.state==='error'?'重试':'再播一次';$('replay').disabled=controller.busy;
  for(const id of ['skip-stage','extend-stage']){$(id).hidden=preview||!Number.isFinite(total);$(id).disabled=e.state!=='running'||controller.busy;}
  $('extend-stage').disabled||=total+300000>86400000;
  $('adjusted-label').textContent=adjusted?'本次已调整，不修改原方案。':'';
  for(const l of r?.layers??[]){const input=$(`gain-${l.id}`),st=stage?.layerStates.find(x=>x.layerId===l.id);if(!input||!st)continue;
    const key=`${preview?'preview':'main'}:${s?.index??0}:${l.id}`,gain=runtimeGains.get(key)??st.gain;
    if(document.activeElement!==input)input.value=String(Math.round(gain*100));$(`gain-value-${l.id}`).textContent=`${Math.round(gain*100)}%`;
    input.disabled=e.state!=='running'||!st.enabled||controller.busy;$(`layer-state-${l.id}`).textContent=st.enabled?'':'本阶段静音';
    input.oninput=()=>{runtimeGains.set(key,Number(input.value)/100);e.gain(l.id,Number(input.value)/100);currentGains[l.id]=Number(input.value)/100;$('player-stimulus').textContent=stimulusStatus(r,{stage,gains:currentGains,master:controller.master,state:e.state}).text;$(`gain-value-${l.id}`).textContent=`${input.value}%`;adjusted=true;};
  }
}
$('mini-toggle').onclick=()=>act(()=>controller.hasPreview?controller.stopPreview():controller.main.state==='running'?controller.pause():controller.resume());
$('mini-stop').onclick=()=>act(()=>controller.hasPreview?controller.stopPreview():controller.stop());
document.addEventListener('click',event=>{const button=event.target.closest('[data-preview]');if(button)act(()=>listen(preferredRecipe(button.dataset.preview)));});
document.addEventListener('input',event=>{if(route?.path==='/editor'&&event.target.id!=='master-volume'&&event.target.closest('#main')){markDraftDirty();}});
document.addEventListener('click',event=>{
 const fav=event.target.closest('[data-favorite]');if(fav)act(async()=>{fav.disabled=true;try{await personalLibrary.favorite(fav.dataset.favorite);loadLibrary();if(route.path==='/mine')mine();else if(route.path==='/home')home();else document.querySelectorAll('[data-favorite]').forEach(b=>{const p=presets.find(p=>p.id===b.dataset.favorite),on=libraryData.favorites.includes(b.dataset.favorite);b.textContent=on?'已收藏':'收藏';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',`${on?'取消收藏':'收藏'}${p?.title??''}`);});}finally{if(fav.isConnected)fav.disabled=false;else if([document.body,$('main')].includes(document.activeElement))document.querySelector(`[data-favorite="${fav.dataset.favorite}"]`)?.focus({preventScroll:true});}});
 const play=event.target.closest('[data-saved-start]');if(play)act(async()=>{loadLibrary();const entry=libraryData.saved.find(x=>x.id===play.dataset.savedStart);if(!entry)throw new Error('组合已被删除，请刷新列表');await start(savedRecipe(entry));});
 const edit=event.target.closest('[data-edit-saved]');if(edit)act(async()=>{loadLibrary();const entry=libraryData.saved.find(x=>x.id===edit.dataset.editSaved);if(!entry)throw new Error('组合已被删除，请刷新列表');if(draftDirty&&!(await confirmAction('打开已保存的组合？','当前编辑内容尚未保存。打开后会替换编辑区的内容，正在播放的声音不受影响。','放弃修改并打开')))return;draftGeneration++;replaceDraft(structuredClone(entry.draft));draftRef={id:entry.id,revision:entry.revision};draftDirty=false;nextLayer=Math.max(0,...(draft.layers??[]).map(l=>Number(l.id.replace('layer-',''))||0))+1;go('/editor');});
 const remove=event.target.closest('[data-remove-saved]');if(remove)act(async()=>{loadLibrary();const entry=libraryData.saved.find(x=>x.id===remove.dataset.removeSaved);if(!entry)return;deletedEntry=await personalLibrary.remove(entry.id,entry.revision);if(route.path==='/mine'){mine();$('undo-delete')?.focus({preventScroll:true});}});
});
window.addEventListener('storage',event=>{if(event.key===LIBRARY_KEY||event.key===null){loadLibrary();if(route?.path==='/mine')mine();else if(route?.path==='/home')home();}});
window.addEventListener('beforeunload',event=>{if(draftDirty&&(draft.kind==='preset'||draft.layers?.length)){event.preventDefault();event.returnValue='';}});
controller.addEventListener('change',sync);
window.addEventListener('hashchange',()=>{if(controller.intent!=='main'&&(controller.hasPreview||controller.intent==='preview'))act(()=>controller.stopPreview());render();});
window.addEventListener('pagehide',()=>{controller.stop();});
render();
