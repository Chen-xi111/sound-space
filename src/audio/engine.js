import { validateRecipe,totalMs } from '../config/validate.js';
import { PlaybackOwnership } from './ownership.js';
import { loadAssets } from './assets.js';
export class AudioEngine extends EventTarget {
  constructor({catalog={},resources={},contextFactory=()=>new AudioContext(),ownership=new PlaybackOwnership(),now=()=>performance.now(),nodeFactory=(context,options)=>new AudioWorkletNode(context,'wave-core',options),mediaDevices=globalThis.navigator?.mediaDevices,visibilityTarget=globalThis.document}={}){
    super();Object.assign(this,{catalog,resources,contextFactory,ownership,now,nodeFactory,mediaDevices,visibilityTarget});
    this.state='idle';this.generation=0;this.master=.2;this.status=null;
    this.deviceChange=()=>{if(this.state==='running')this.interrupt('检测到音频设备变化');};
    this.mediaDevices?.addEventListener('devicechange',this.deviceChange);
    this.visibility=()=>{if(this.visibilityTarget?.visibilityState==='visible')this.reconcile();};
    this.visibilityTarget?.addEventListener('visibilitychange',this.visibility);
  }
  emit(state,reason=''){this.state=state;this.reason=reason;this.dispatchEvent(new Event('change'));}
  async start(value){
    if(['preparing','running','paused','interrupted','pausing','resuming','stopping'].includes(this.state))throw new Error('先停止当前会话');
    const result=validateRecipe(value,{catalog:this.catalog});
    if(!result.playable)throw new Error([...result.errors,...result.blockers].map(e=>`${e.code}: ${e.message}`).join('\n'));
    const token=++this.generation;this.snapshot=structuredClone(value);this.status=null;this.emit('preparing');
    this.abort=new AbortController();
    try{
      await this.ownership.acquire();if(token!==this.generation)return;
      this.context=this.contextFactory();
      const checked=validateRecipe(this.snapshot,{catalog:this.catalog,sampleRate:this.context.sampleRate});
      if(!checked.playable)throw new Error(checked.blockers.map(x=>x.message).join('\n'));
      if(!this.context.audioWorklet)throw new Error('CAPABILITY_UNAVAILABLE: 缺少 AudioWorklet');
      await this.context.audioWorklet.addModule(new URL('./processor.js',import.meta.url));
      const assets=await loadAssets(this.snapshot.recipe,this.context,this.catalog,this.resources,this.abort.signal);
      if(token!==this.generation)return;
      this.node=this.nodeFactory(this.context,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',processorOptions:{recipe:this.snapshot.recipe,assets,master:this.master}});
      this.node.port.onmessage=({data})=>{if(token!==this.generation)return;this.receive(data);};
      this.node.onprocessorerror=()=>{if(token===this.generation)this.fail('音频处理器异常，已停止');};
      this.output=this.context.createGain();this.output.gain.value=1;this.node.connect(this.output).connect(this.context.destination);
      await this.context.resume();if(token!==this.generation)return;
      this.context.onstatechange=()=>{if(token===this.generation&&this.state==='running'&&this.context.state!=='running')this.interrupt('系统音频中断');};
      if(this.context.state!=='running')throw new Error('CAPABILITY_UNAVAILABLE: 浏览器未允许播放');
      this.elapsed=0;this.anchor=this.now();this.emit('running');
    }catch(error){if(token!==this.generation)return;await this.dispose();this.emit('error',error.message);throw error;}
  }
  receive(status){
    this.status=status;
    if(status.finished){++this.generation;this.dispose();this.emit('completed');return;}
    if(status.paused&&this.pendingPause){this.elapsed=status.elapsedMs;this.pendingPause();this.pendingPause=null;}
    if(this.state==='running'){this.elapsed=status.elapsedMs;this.anchor=this.now();}
    this.dispatchEvent(new Event('change'));
  }
  async pause(){
    if(this.state!=='running')return;
    this.emit('pausing');
    await new Promise(resolve=>{this.pendingPause=resolve;this.node.port.postMessage({type:'pause'});this.pauseTimeout=setTimeout(()=>{if(this.pendingPause){this.interrupt('暂停未得到音频线程确认');this.pendingPause();this.pendingPause=null;}},1000);});
    clearTimeout(this.pauseTimeout);
    if(this.state!=='pausing')return;
    this.output.gain.value=0;await this.ownership.release();if(this.state==='pausing')this.emit('paused');
  }
  interrupt(reason){
    if(!['running','pausing'].includes(this.state))return;
    this.interruptedAt=this.now();this.interruptedElapsed=this.elapsed??0;
    if(['running','pausing'].includes(this.state))this.interruptedElapsed+=Math.max(0,this.interruptedAt-this.anchor);
    if(this.output)this.output.gain.value=0;
    this.node?.port.postMessage({type:'pause'});this.ownership.release();this.emit('interrupted',reason);
  }
  reconcile(){
    if(this.state!=='interrupted')return;
    const duration=this.status?.totalMs??totalMs(this.snapshot.recipe);
    if(this.interruptedElapsed+this.now()-this.interruptedAt>=duration)this.finishInterrupted(duration);
  }
  finishInterrupted(duration){
    ++this.generation;this.elapsed=duration;
    this.status={...this.status,elapsedMs:duration,totalMs:duration,frame:Math.round(duration*this.context.sampleRate/1000),finished:true,paused:false,cuePlaying:false,stageId:null,iteration:null};
    this.dispose();this.emit('completed','中断期间已到期，未补播');
  }
  async resume(){
    this.reconcile();if(!['paused','interrupted'].includes(this.state))return;
    const previous=this.state,token=this.generation;this.emit('resuming');
    try{
      await this.ownership.acquire();if(token!==this.generation)return;
      if(previous==='interrupted'){
        const duration=this.status?.totalMs??totalMs(this.snapshot.recipe);
        if(this.interruptedElapsed+this.now()-this.interruptedAt>=duration){this.finishInterrupted(duration);return;}
      }
      await this.context.resume();if(token!==this.generation)return;
      if(this.context.state!=='running')throw new Error('音频设备仍不可用');
      if(previous==='interrupted'){
        const ms=this.interruptedElapsed+this.now()-this.interruptedAt,duration=this.status?.totalMs??totalMs(this.snapshot.recipe);
        if(ms>=duration){this.finishInterrupted(duration);return;}
        this.node.port.postMessage({type:'seek',ms});this.elapsed=ms;
      }
      this.output.gain.setValueAtTime(0,this.context.currentTime);this.output.gain.linearRampToValueAtTime(1,this.context.currentTime+.02);
      this.node.port.postMessage({type:'resume'});this.anchor=this.now();this.emit('running');
    }catch(error){if(token===this.generation){this.ownership.release();this.emit(previous,error.message);}throw error;}
  }
  volume(value){if(!Number.isFinite(value)||value<0||value>1)throw new Error('音量范围错误');this.master=value;this.node?.port.postMessage({type:'volume',value});}
  gain(id,value){if(this.state!=='running'||!Number.isFinite(value)||value<0||value>1)return;this.node.port.postMessage({type:'gain',id,value});}
  skip(){if(this.state==='running')this.node.port.postMessage({type:'skip'});}
  extend(ms){if(this.state==='running'&&Number.isSafeInteger(ms)&&ms>0&&(this.status?.totalMs??0)+ms<=86400000)this.node.port.postMessage({type:'extend',ms});}
  stop(){
    if(this.stopPromise)return this.stopPromise;
    this.stopPromise=this.performStop().finally(()=>{this.stopPromise=null;});return this.stopPromise;
  }
  async performStop(){
    ++this.generation;this.emit('stopping');clearTimeout(this.pauseTimeout);this.pendingPause?.();this.pendingPause=null;
    if(this.output&&this.context?.state==='running'){
      this.output.gain.cancelScheduledValues(this.context.currentTime);this.output.gain.setValueAtTime(this.output.gain.value,this.context.currentTime);this.output.gain.linearRampToValueAtTime(0,this.context.currentTime+.02);
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    await this.dispose();this.emit('stopped');
  }
  async fail(reason){++this.generation;this.emit('error',reason);await this.dispose();}
  async dispose(){
    clearTimeout(this.pauseTimeout);this.pendingPause?.();this.pendingPause=null;
    this.abort?.abort();if(this.output)this.output.gain.value=0;
    this.node?.disconnect();this.node?.port.close();this.output?.disconnect();
    const ctx=this.context;this.context=null;this.node=null;this.output=null;
    const released=this.ownership.release();if(ctx)ctx.onstatechange=null;
    await Promise.all([released,ctx?.close().catch(()=>{})]);
  }
  async destroy(){await this.stop();this.mediaDevices?.removeEventListener('devicechange',this.deviceChange);this.visibilityTarget?.removeEventListener('visibilitychange',this.visibility);}
}
