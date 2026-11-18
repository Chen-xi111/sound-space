"""Reconstruct continuous stereo carriers from the bundled licensed recordings.

Development only: Python + numpy. Runtime remains dependency-free.
Run `node scripts/render-carrier-reference.mjs` first to export the engine's
reference noise, then this script. Source recordings remain unchanged.
"""
from pathlib import Path
import hashlib, json, wave
import numpy as np

root = Path(__file__).resolve().parents[1]
rate = 24000
duration = 45
crossfade = 1.8
analysis_dir = root / 'docs/verification/carriers'
analysis_dir.mkdir(parents=True, exist_ok=True)

def read_wav(path):
    with wave.open(str(path)) as f:
        assert f.getsampwidth() == 2 and f.getframerate() == rate
        return np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').reshape(-1,f.getnchannels()).astype(float)/32768

def spectrum(x, sr=rate):
    n = 4096
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::n//2]
    return np.mean(abs(np.fft.rfft(frames*np.hanning(n),axis=1))**2,axis=0), np.fft.rfftfreq(n,1/sr)

pink = np.fromfile(analysis_dir/'pink-reference.f32',dtype='<f4')
ref_ps, ref_f = spectrum(pink,48000)
centers = np.geomspace(45,10500,40)
def band_levels(ps, f):
    return np.array([np.mean(ps[(f>=c/1.16)&(f<c*1.16)]) for c in centers])
reference = band_levels(ref_ps,ref_f)
reference /= reference.sum()

manifest = []
for name, source, seed in [('soft-rain','nature-rain-v1.wav',613),('water-veil','nature-stream-v1.wav',947)]:
    path = root/'public/assets'/source
    original = read_wav(path).mean(axis=1)
    original_ps, f = spectrum(original)
    bands = band_levels(original_ps,f); bands /= bands.sum()
    # Broad, bounded EQ is applied to the CARRIER, never the live pink generator.
    correction_db = np.clip(10*np.log10(reference/bands),-9,9)
    correction_db = np.convolve(np.pad(correction_db,2,mode='edge'),np.ones(5)/5,'valid')
    n = len(original)
    freq = np.fft.rfftfreq(n,1/rate)
    eq = 10**(np.interp(np.log(np.maximum(freq,1)),np.log(centers),correction_db)/20)
    eq[freq<30] *= (freq[freq<30]/30)**2
    shaped = np.fft.irfft(np.fft.rfft(original)*eq,n=n)
    # Overlapping long grains diffuse individual droplets and produce matching
    # left/right textures without imposing a fast beat or a rhythmic pump.
    length = rate*duration
    grain_size, hop = rate*2, rate//4
    window = np.sin(np.linspace(0,np.pi,grain_size,endpoint=False))**2
    rng = np.random.default_rng(seed)
    channels=[]
    for channel in range(2):
        out=np.zeros(length)
        for position in range(0,length,hop):
            start=int(rng.integers(len(shaped)))
            grain=shaped[(start+np.arange(grain_size))%len(shaped)]
            np.add.at(out,(position+np.arange(grain_size))%length,grain*window)
        # A slow circular energy envelope reduces residual swells. Not a
        # playback noise gate: the signal never switches on/off at a threshold.
        energy=np.array([np.mean(out[i:i+hop]**2) for i in range(0,length,hop)])
        energy=sum(np.roll(energy,k) for k in range(-6,7))/13
        times=np.arange(len(energy))*hop+hop/2
        smooth=np.interp(np.arange(length),np.r_[times[-1]-length,times,times[0]+length],np.r_[energy[-1],energy,energy[0]])
        out *= np.sqrt(np.mean(smooth)/np.maximum(smooth,1e-10))
        out *= .15/np.sqrt(np.mean(out*out))
        out = .6*np.tanh(out/.6)
        out *= .15/np.sqrt(np.mean(out*out))
        channels.append(out)
    carrier=np.stack(channels,axis=1)
    assert np.max(abs(carrier))<.95, 'Choose a different grain seed; do not hard-clip'
    # The crossfade tail exactly repeats the head. The runtime's linear
    # crossfade now combines identical samples, avoiding a 3 dB seam dip.
    output=np.concatenate([carrier,carrier[:round(crossfade*rate)]])
    pcm=np.rint(output*32767).astype('<i2')
    target=root/'public/assets'/f'carrier-{name}-v1.wav'
    with wave.open(str(target),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
    ps,_=spectrum(carrier[:,0]);new_bands=band_levels(ps,f);new_bands/=new_bands.sum()
    distance=lambda b:float(np.sqrt(np.mean((10*np.log10(b/reference))**2)))
    rms=np.sqrt(np.mean(carrier.reshape(duration,rate,2)**2,axis=1))
    item={'id':f'carrier-{name}','revision':1,'durationMs':round(len(output)/rate*1000),'channels':2,
          'source':source,'sourceHash':hashlib.sha256(path.read_bytes()).hexdigest(),'seed':seed,
          'crossfadeMs':round(crossfade*1000),'loopPeriodMs':duration*1000,
          'contentHash':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,
          'peak':float(np.max(abs(carrier))),'rmsPerChannel':[float(x) for x in np.sqrt(np.mean(carrier**2,axis=0))],
          'oneSecondRangeDb':[float(x) for x in 20*np.log10(rms.max(axis=0)/rms.min(axis=0))],
          'spectralDistanceDbBefore':distance(bands),'spectralDistanceDbAfter':distance(new_bands),
          'correctionCentersHz':centers.tolist(),'correctionDb':correction_db.tolist()}
    manifest.append(item)
    print(name,{k:item[k] for k in ['peak','oneSecondRangeDb','spectralDistanceDbBefore','spectralDistanceDbAfter']})
(root/'public/assets/carrier-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
