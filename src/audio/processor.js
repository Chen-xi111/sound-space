import { Renderer } from './dsp.js';
class WaveProcessor extends AudioWorkletProcessor {
  constructor(options){
    super();const p=options.processorOptions;
    this.renderer=new Renderer(p.recipe,sampleRate,p.assets,p.master);this.blocks=0;this.last='';
    this.port.onmessage=({data:m})=>{
      const r=this.renderer;
      if(m.type==='volume')r.volume(m.value);
      else if(m.type==='gain')r.layerGain(m.id,m.value);
      else if(m.type==='pause')r.pause();
      else if(m.type==='stop')r.stop();
      else if(m.type==='resume')r.resume();
      else if(m.type==='seek')r.seekMs(m.ms);
      else if(m.type==='skip')r.skip();
      else if(m.type==='extend')r.extend(m.ms);
    };
  }
  process(_inputs,outputs){
    const output=outputs[0];if(output.length<2)return true;
    this.renderer.process(output[0],output[1]);
    const status=this.renderer.status(),key=`${status.paused}:${status.finished}:${status.index}`;
    if(key!==this.last||++this.blocks%40===0){this.port.postMessage(status);this.last=key;}
    // Keep paused processors alive for explicit resume, but release completed ones.
    return !this.renderer.finished;
  }
}
registerProcessor('wave-core',WaveProcessor);
