// Recording identities are revisioned so saved combinations keep their sound.
import {catalog} from '../audio/catalog.js';

export const natureSounds = [
  {id:'soft-rain',assetId:'carrier-soft-rain',revision:1,label:'绵雨声床',family:'carrier'},
  {id:'water-veil',assetId:'carrier-water-veil',revision:1,label:'水幕声床',family:'carrier'},
  {id:'rain',assetId:'nature-rain',revision:1,label:'雨声'},
  {id:'stream',assetId:'nature-stream',revision:1,label:'溪流'},
  {id:'wind',assetId:'nature-wind',revision:1,label:'林间风声'},
];
export function natureSound(ref){
  const sound=natureSounds.find(s=>s.assetId===ref?.id&&s.revision===ref?.revision);
  if(!sound)throw new Error('找不到这个版本的自然声音');
  return sound;
}
export function natureLayer(id,ref){
  const sound=natureSound(ref),record=catalog[`${ref.id}@${ref.revision}`];
  if(!record)throw new Error('自然声音尚未准备好');
  return {id,label:sound.label,source:{kind:'asset',assetRef:{id:ref.id,revision:ref.revision},playback:{mode:'loop',startMs:0,loopStartMs:0,loopEndMs:record.durationMs,crossfadeMs:1800}}};
}
