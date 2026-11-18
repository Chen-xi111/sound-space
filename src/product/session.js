import {AudioEngine} from '../audio/engine.js';
import {catalog,resources} from '../audio/catalog.js';
import {previewRecipe,assertPlayable} from './recipes.js';
export const activeStates=new Set(['preparing','running','pausing','paused','resuming','interrupted','stopping']);
export const stateLabels={idle:'尚未开始',preparing:'正在准备',running:'播放中',pausing:'正在暂停',paused:'已暂停',resuming:'正在恢复',interrupted:'播放已中断',completed:'已完成',stopping:'正在停止',stopped:'已停止',error:'无法播放'};
export function friendlyError(reason='') {
  if(reason.includes('PLAYBACK_OWNED'))return '另一个页面正在播放，请先在那里停止，然后重试。';
  if(reason.includes('CAPABILITY_UNAVAILABLE'))return '当前浏览器无法使用所需的音频功能，请使用支持 Web Audio 和播放互斥的浏览器。';
  if(reason.includes('ASSET_UNAVAILABLE')||/Failed to fetch|Load failed/.test(reason))return '这段声音暂时没有加载成功 请重试或选择其他声音';
  return reason;
}
export class SessionController extends EventTarget {
  constructor(factory=()=>new AudioEngine({catalog,resources})){
    super();this.main=factory();this.preview=factory();this.busy=false;this.token=0;this.master=.2;
    this.main.addEventListener('change',()=>this.changed());this.preview.addEventListener('change',()=>this.changed());
  }
  changed(){this.dispatchEvent(new Event('change'));}
  get hasMain(){return activeStates.has(this.main.state);}
  get hasPreview(){return activeStates.has(this.preview.state);}
  get output(){return this.hasPreview?this.preview:this.main;}
  async run(fn,intent='main'){
    if(this.busy)throw new Error('正在处理上一个操作，请稍候');
    this.busy=true;this.intent=intent;const token=++this.token;this.changed();
    try{return await fn(()=>token===this.token);}finally{if(token===this.token){this.busy=false;this.intent=null;this.changed();}}
  }
  async start(value,{replace=false}={}){
    assertPlayable(value);
    const snapshot=structuredClone(value);
    if(this.hasMain&&!replace)throw new Error('请先确认停止当前方案');
    return this.run(async live=>{
      if(this.hasPreview)await this.preview.stop();if(!live())return;
      await this.preview.ownership?.released;if(!live())return;
      if(this.hasMain)await this.main.stop();if(!live())return;
      this.main.volume(this.master);await this.main.start(snapshot);
    });
  }
  async listen(value,{pauseCurrent=false}={}){
    const sample=previewRecipe(value);
    if(this.main.state==='running'&&!pauseCurrent)throw new Error('请先确认暂停当前方案');
    return this.run(async live=>{
      if(['preparing','pausing','resuming','stopping'].includes(this.main.state))throw new Error('等待当前播放操作完成后再预听');
      if(this.hasPreview)await this.preview.stop();if(!live())return;
      await this.preview.ownership?.released;if(!live())return;
      if(this.main.state==='running')await this.main.pause();if(!live())return;
      await this.main.ownership?.released;if(!live())return;
      // Interrupted sessions keep their deadline; preview must never convert
      // them into a manual pause or auto-resume them on completion/failure.
      this.preview.volume(this.master);await this.preview.start(sample);
    },'preview');
  }
  async pause(){return this.run(()=>this.main.pause());}
  async resume(){return this.run(async live=>{if(this.hasPreview)await this.preview.stop();await this.preview.ownership?.released;if(live())await this.main.resume();});}
  async stop(){
    ++this.token;this.busy=true;this.intent=null;this.changed();
    try{await Promise.all([this.main.stop(),this.preview.stop()]);}finally{this.busy=false;this.changed();}
  }
  async stopPreview(){
    ++this.token;this.busy=true;this.intent=null;this.changed();
    try{await this.preview.stop();}finally{this.busy=false;this.changed();}
  }
  volume(value){this.main.volume(value);this.preview.volume(value);this.master=value;this.changed();}
  async destroy(){await this.stop();await Promise.all([this.main.destroy(),this.preview.destroy()]);}
}
