// Pure DSP used both by AudioWorklet and deterministic/offline tests.
const TAU = Math.PI * 2;
export class Random {
  constructor(seed) { this.state = (seed >>> 0) || 0x9e3779b9; }
  next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state / 2147483648 - 1; }
}
export class Noise {
  constructor(color, seed, rate, version='noise-v1') {
    this.color = color; this.rng = new Random(seed); this.rows = new Float64Array(12);
    this.sum = 0; this.count = 0; this.brown = 0; this.leak = Math.exp(-TAU * 10 / rate);
    // For y[n]=a*y[n-1]+b*x[n], variance is b²*Var(x)/(1-a²).
    // v2 anchors brown-noise energy to v1 at 48 kHz; v1 stays sample-exact.
    this.brownStep=version==='noise-v2'?.015*Math.sqrt((1-this.leak**2)/(1-Math.exp(-TAU*10/48000)**2)):.015;
    for (let i=0;i<12;i++) { this.rows[i]=this.rng.next(); this.sum+=this.rows[i]; }
  }
  next() {
    const white = this.rng.next();
    if (this.color === 'white') return white;
    if (this.color === 'brown') { this.brown = this.brown*this.leak + white*this.brownStep; return Math.max(-1,Math.min(1,this.brown)); }
    this.count = (this.count+1) & 4095;
    let n=this.count, row=0;
    if (n !== 0) { while ((n & 1) === 0) { row++; n >>>=1; } this.sum -= this.rows[row]; this.rows[row]=this.rng.next(); this.sum+=this.rows[row]; }
    return (this.sum+white)/13;
  }
}
export function amEnvelope(phase, depth) { return 1-depth/2 + depth/2*Math.sin(phase); }
// Two second-order Butterworth sections. Edges roll off, not a brick-wall band.
class BandSection {
  constructor(kind,hz,rate){
    const w=TAU*hz/rate,c=Math.cos(w),a=Math.sin(w)/Math.sqrt(2),norm=1+a;
    const b=kind==='lowpass'?(1-c)/2:(1+c)/2;
    this.b0=b/norm;this.b1=(kind==='lowpass'?2:-2)*b/norm;this.b2=this.b0;
    this.a1=-2*c/norm;this.a2=(1-a)/norm;this.z1=0;this.z2=0;
  }
  next(x){const y=this.b0*x+this.z1;this.z1=this.b1*x-this.a1*y+this.z2;this.z2=this.b2*x-this.a2*y;return y;}
}
export class BandModulator {
  constructor(band,rate){
    this.filters=[0,1].map(()=>[new BandSection('highpass',band.lowHz,rate),new BandSection('lowpass',band.highHz,rate)]);
    this.sample=[0,0];
  }
  next(pair,phase,depth){
    // Zero-mean modulation injection preserves the unmodulated dry signal.
    // In-band index is depth (0.4 -> approx 0.6..1.4), unlike legacy AM depth.
    // No auto-gain: muting/removing another layer never raises this layer.
    const m=depth*Math.sin(phase);
    for(let c=0;c<2;c++){const [hp,lp]=this.filters[c],band=lp.next(hp.next(pair[c]));this.sample[c]=pair[c]+m*band;}
    return this.sample;
  }
}
export class LayerVoice {
  constructor(layer, state, rate, assets) {
    this.source=layer.source; this.state=JSON.parse(JSON.stringify(state)); this.rate=rate;
    this.phaseL=0; this.phaseR=0; this.lastLow=[0,0]; this.sample=[0,0];
    this.gain=state.gain; this.targetGain=state.gain; this.gainStep=0; this.gainFrames=0;
    const s=this.source;
    if (s.kind==='noise') { this.noiseL=new Noise(s.color,s.seed,rate,s.generatorVersion); this.noiseR=s.channels==='mono'?this.noiseL:new Noise(s.color,(s.seed^0xa341316c)>>>0,rate,s.generatorVersion); }
    if (s.kind==='asset') { this.asset=assets[`${s.assetRef.id}@${s.assetRef.revision}`]; if (!this.asset) throw new Error('Missing decoded asset'); this.position=s.playback.startMs*this.asset.sampleRate/1000; }
  }
  setGain(value) { this.targetGain=value; this.gainFrames=Math.max(1,Math.round(this.rate*.02)); this.gainStep=(value-this.gain)/this.gainFrames; }
  read(channel, position) {
    const data=this.asset.channels[Math.min(channel,this.asset.channels.length-1)];
    const i=Math.floor(position), fraction=position-i;
    if (i<0 || i>=data.length) return 0;
    return data[i]*(1-fraction)+(data[Math.min(i+1,data.length-1)])*fraction;
  }
  next() {
    const s=this.source,q=this.state.params;
    let l=0,r=0;
    if (s.kind==='noise') {
      l=this.noiseL.next();r=this.noiseR===this.noiseL?l:this.noiseR.next();
      if (q.filter) {
        const a=1-Math.exp(-TAU*q.filter.cutoffHz/this.rate);
        this.lastLow[0]+=a*(l-this.lastLow[0]);this.lastLow[1]+=a*(r-this.lastLow[1]);
        if (q.filter.kind==='lowpass') {l=this.lastLow[0];r=this.lastLow[1];} else {l-=this.lastLow[0];r-=this.lastLow[1];}
      }
    } else if (s.kind==='binaural') {
      const high=q.centerHz+q.beatHz/2, low=q.centerHz-q.beatHz/2;
      l=Math.sin(this.phaseL);r=Math.sin(this.phaseR);
      this.phaseL=(this.phaseL+TAU*(s.highEar==='left'?high:low)/this.rate)%TAU;
      this.phaseR=(this.phaseR+TAU*(s.highEar==='right'?high:low)/this.rate)%TAU;
    } else {
      const p=s.playback, scale=this.asset.sampleRate/1000;
      const end=p.mode==='loop'?p.loopEndMs*scale:this.asset.channels[0].length;
      const start=p.mode==='loop'?p.loopStartMs*scale:0, cross=p.mode==='loop'?p.crossfadeMs*scale:0;
      if (p.mode==='loop' && this.position>=end) this.position=start+cross+(this.position-end)%(end-start-cross);
      l=this.read(0,this.position);r=this.read(1,this.position);
      if (cross>0 && this.position>=end-cross) {
        const progress=this.position-(end-cross),mix=progress/cross;
        l=l*(1-mix)+this.read(0,start+progress)*mix;r=r*(1-mix)+this.read(1,start+progress)*mix;
      }
      this.position+=this.asset.sampleRate/this.rate;
    }
    if (s.kind!=='binaural') {
      const pan=q.pan;
      const mono=s.kind==='noise'?s.channels==='mono':this.asset.channels.length===1;
      if (mono) {l*=Math.cos((pan+1)*Math.PI/4);r*=Math.sin((pan+1)*Math.PI/4);}
      else {l*=pan<=0?1:Math.cos(pan*Math.PI/2);r*=pan>=0?1:Math.cos(-pan*Math.PI/2);}
    }
    if (this.gainFrames>0) {this.gain+=this.gainStep;if(--this.gainFrames===0)this.gain=this.targetGain;}
    this.sample[0]=l*this.gain;this.sample[1]=r*this.gain;
    return this.sample;
  }
}
export class Renderer {
  constructor(recipe, rate, assets={}, master=.2) {
    this.recipe=JSON.parse(JSON.stringify(recipe));recipe=this.recipe;this.rate=rate;this.assets=assets;this.master=master;this.masterTarget=master;
    this.masterFrames=0;this.masterStep=0;this.frame=0;this.index=0;this.running=true;this.finished=false;
    this.hold=false;this.action=null;this.releaseFrames=0;this.attack=0;this.amPhase=0;
    this.plan=[];let time=0;
    const repeats=recipe.timeline.kind==='continuous'?1:recipe.timeline.repeatCount;
    for(let n=0;n<repeats;n++)for(const stage of recipe.timeline.stages){
      const start=Math.round(time*rate/1000);time+=stage.durationMs??Infinity;
      this.plan.push({stage,iteration:n,start,end:Math.round(time*rate/1000)});
    }
    this.flowFrames=this.plan.at(-1).end;
    if(recipe.completion.cue){
      let id='__completion';while(this.recipe.layers.some(l=>l.id===id))id+='x';
      const ref=recipe.completion.cue,pcm=assets[`${ref.id}@${ref.revision}`];
      if(!pcm)throw new Error('Missing completion asset');
      const ms=pcm.channels[0].length/pcm.sampleRate*1000;
      this.recipe.layers.push({id,source:{kind:'asset',assetRef:ref,playback:{mode:'once',startMs:0}}});
      this.plan.push({iteration:0,start:this.flowFrames,end:this.flowFrames+Math.round(ms*rate/1000),isCue:true,stage:{id,label:'结束提示',durationMs:ms,fadeInMs:20,fadeOutMs:20,layerStates:[{layerId:id,enabled:true,gain:recipe.completion.gain,params:{pan:0}}],rhythmState:null}});
    }
    this.totalFrames=this.plan.at(-1).end;this.setupStage();
  }
  setupStage() {
    const entry=this.plan[this.index];this.amPhase=0;this.attack=0;
    if(!entry){this.finished=true;this.running=false;return;}
    this.voices=entry.stage.layerStates.filter(s=>s.enabled).map(s=>({id:s.layerId,voice:new LayerVoice(this.recipe.layers.find(l=>l.id===s.layerId),s,this.rate,this.assets)}));
    const rhythm=this.recipe.rhythm;
    if(rhythm.processorVersion && rhythm.processorVersion!=='band-am-v1')throw new Error('Unsupported AM processor');
    this.bandModulator=rhythm.processorVersion==='band-am-v1'?new BandModulator(rhythm.band,this.rate):null;
  }
  status() {const e=this.plan[this.index];return {frame:this.frame,elapsedMs:Math.min(this.frame,this.flowFrames)*1000/this.rate,totalMs:this.flowFrames*1000/this.rate,cuePlaying:!!e?.isCue,index:this.index,stageId:e?.stage.id??null,iteration:e?.iteration??null,paused:this.hold,finished:this.finished};}
  volume(v){this.masterTarget=v;this.masterFrames=Math.max(1,Math.round(this.rate*.02));this.masterStep=(v-this.master)/this.masterFrames;}
  layerGain(id,v){this.voices.find(x=>x.id===id)?.voice.setGain(v);}
  pause(){if(!this.hold&&!this.finished){this.action='pause';this.releaseFrames=Math.max(1,Math.round(this.rate*.02));}}
  stop(){if(!this.finished){this.action='stop';this.releaseFrames=Math.max(1,Math.round(this.rate*.02));if(this.hold){this.finished=true;this.running=false;}}}
  resume(){if(!this.finished){this.hold=false;this.running=true;this.attack=0;this.action=null;}}
  seekMs(ms){
    this.frame=Math.min(this.flowFrames,Math.max(0,Math.round(ms*this.rate/1000)));
    if(this.frame>=this.flowFrames){this.finished=true;this.running=false;return;}
    this.index=this.plan.findIndex(e=>this.frame<e.end);
    if(this.index<0){this.finished=true;this.running=false;return;}
    this.finished=false;this.setupStage();this.hold=true;this.running=false;
  }
  skip(){if(this.finished||this.hold)return;const end=this.plan[this.index]?.end;if(!Number.isFinite(end)){this.stop();return;}this.action='skip';this.skipTargetMs=end*1000/this.rate;this.releaseFrames=Math.max(1,Math.round(this.rate*.02));}
  extend(ms){
    const current=this.plan[this.index];if(!current||current.isCue||!Number.isFinite(current.end))return;
    const amount=Math.round(ms*this.rate/1000);current.end+=amount;
    for(let i=this.index+1;i<this.plan.length;i++){this.plan[i].start+=amount;this.plan[i].end+=amount;}
    this.totalFrames+=amount;this.flowFrames+=amount;
  }
  process(left,right) {
    left.fill(0);right.fill(0);
    if(this.finished||this.hold)return;
    const smooth=Math.max(1,Math.round(this.rate*.02));
    for(let i=0;i<left.length;i++){
      while(this.frame>=this.plan[this.index]?.end){if(this.action==='skip'){this.action=null;this.releaseFrames=0;}this.index++;this.setupStage();if(this.finished)break;}
      if(this.finished||this.hold)break;
      const e=this.plan[this.index],s=e.stage,local=this.frame-e.start;
      const duration=e.end-e.start;
      let fadeIn=Math.max(smooth,s.fadeInMs*this.rate/1000),fadeOut=Math.max(smooth,s.fadeOutMs*this.rate/1000);
      const scale=Math.min(1,duration/(fadeIn+fadeOut));fadeIn*=scale;fadeOut*=scale;
      let envelope=Math.min(1,local/fadeIn,(e.end-this.frame)/fadeOut,this.attack/smooth);
      if(this.action)envelope*=this.releaseFrames/smooth;
      let l=0,r=0;
      const am=s.rhythmState;
      const modulation=am?.enabled?amEnvelope(this.amPhase,am.depth):1;
      for(const v of this.voices){
        let pair=v.voice.next(),mod=1;
        if(this.recipe.rhythm.kind==='amplitudeModulation'&&this.recipe.rhythm.targetLayerId===v.id){
          if(this.bandModulator)pair=this.bandModulator.next(pair,this.amPhase,am?.enabled?am.depth:0);
          else mod=modulation;
        }
        l+=pair[0]*mod;r+=pair[1]*mod;
      }
      if(am)this.amPhase=(this.amPhase+TAU*am.rateHz/this.rate)%TAU;
      if(this.masterFrames>0){this.master+=this.masterStep;if(--this.masterFrames===0)this.master=this.masterTarget;}
      // Fixed headroom: layer removal never unexpectedly raises the remaining layers.
      left[i]=Math.max(-.95,Math.min(.95,l*.25*this.master*envelope));
      right[i]=Math.max(-.95,Math.min(.95,r*.25*this.master*envelope));
      this.frame++;this.attack++;
      if(this.action&&--this.releaseFrames<=0){if(this.action==='stop'){this.finished=true;this.running=false;}else if(this.action==='skip'){this.seekMs(this.skipTargetMs);if(!this.finished)this.resume();}else{this.hold=true;this.running=false;}this.action=null;}
    }
    if(this.frame>=this.totalFrames){this.finished=true;this.running=false;}
  }
}
