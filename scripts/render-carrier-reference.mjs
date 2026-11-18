// Offline reference for sound design. No changes to the runtime generator.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Noise} from '../src/audio/dsp.js';
const directory=new URL('../docs/verification/carriers/',import.meta.url);
mkdirSync(directory,{recursive:true});
const noise=new Noise('pink',29,48000);
const pcm=Float32Array.from({length:48000*20},()=>noise.next());
writeFileSync(new URL('pink-reference.f32',directory),Buffer.from(pcm.buffer));
