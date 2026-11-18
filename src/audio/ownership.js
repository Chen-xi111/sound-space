// Fail closed if Web Locks is unavailable. No localStorage heartbeat fallback:
// background throttling makes a lease based on that heartbeat unsafe.
export class PlaybackOwnership {
  constructor(locks=globalThis.navigator?.locks){this.locks=locks;this.releaseFn=null;this.pending=false;this.token=0;this.released=Promise.resolve();}
  async acquire(){
    if(this.releaseFn||this.pending)throw new Error('PLAYBACK_OWNED: 当前实例已占用或正在申请播放权');
    if(!this.locks)throw new Error('CAPABILITY_UNAVAILABLE: 当前环境缺少可靠的播放互斥能力');
    this.pending=true;const token=++this.token;
    return new Promise((resolve,reject)=>{
      this.requestDone=this.locks.request('wave-platform-audio-v1',{ifAvailable:true},async lock=>{
        this.pending=false;
        if(!lock||token!==this.token){reject(new Error('PLAYBACK_OWNED: 另一个页面正在播放或申请已取消'));return;}
        await new Promise(release=>{this.releaseFn=release;resolve();});
      }).catch(error=>{this.pending=false;reject(error);});
    });
  }
  release(){this.token++;this.releaseFn?.();this.releaseFn=null;this.released=this.requestDone??Promise.resolve();return this.released;}
}
