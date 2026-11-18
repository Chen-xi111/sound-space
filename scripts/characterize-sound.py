"""Welch PSD + output checks; numpy only. Run after characterize-sound.mjs.
Engineering assertions characterize signals, not attention/sleep outcomes.
"""
import json, sys, wave
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent.parent
source=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/wave-sound-characterization')
dest=root/'docs/verification/research-sound'
dest.mkdir(parents=True,exist_ok=True)
report={'method':'12 s noise, seed 29, 1 s warm-up; Hann Welch 8192/4096; log-spaced 100–8000 Hz bands; carrier actual Renderer 48 kHz stereo 60 s, master=1', 'noise':[], 'carrier':[]}
def psd(x,rate):
    n=8192;w=np.hanning(n);frames=np.lib.stride_tricks.sliding_window_view(x,n)[::n//2]
    power=np.mean(np.abs(np.fft.rfft((frames-frames.mean(axis=1)[:,None])*w,axis=1))**2,axis=0)/(rate*np.sum(w*w))
    return np.fft.rfftfreq(n,1/rate),power
def db(x): return float(20*np.log10(max(float(x),1e-15)))
def modulation(x,rate):
    # Analytic envelope of the same 200–1000 Hz analysis band in every variant.
    n=len(x);freq=np.fft.fftfreq(n,1/rate);spectrum=np.fft.fft(x)
    spectrum*=2*((freq>=200)&(freq<=1000));envelope=np.abs(np.fft.ifft(spectrum))
    envelope=envelope[rate:-rate];m=len(envelope);t=np.arange(m)/rate
    amp=lambda hz:float(2*abs(np.sum(envelope*np.exp(-2j*np.pi*hz*t)))/m/envelope.mean())
    return {'relative16HzEnvelope':amp(16),'relativeNeighborEnvelopeMax':max(amp(hz) for hz in [14,15,17,18])}
for item in json.loads((source/'manifest.json').read_text()):
    x=np.fromfile(source/(item['name']+'.f32'),dtype='<f4').astype(np.float64).reshape(-1,item['channels']);rate=item['rate']
    assert np.isfinite(x).all()
    if item['kind']=='noise':
        f,p=psd(x[:,0],rate);edges=np.geomspace(100,8000,33);centers=np.sqrt(edges[:-1]*edges[1:])
        band=np.array([p[(f>=lo)&(f<hi)].mean() for lo,hi in zip(edges[:-1],edges[1:])])
        slope,intercept=np.polyfit(np.log2(centers),10*np.log10(band),1)
        row={**item,'slopeDbPerOctave':float(slope),'rmsDbFS':db(np.sqrt(np.mean(x*x))),'mean':float(x.mean())}
        lo,hi={'white':(-.25,.25),'pink':(-3.8,-2.5),'brown':(-6.3,-5.5)}[item['color']]
        assert lo<slope<hi,row
        report['noise'].append(row)
    else:
        stable=x[rate*3:rate*55]
        jump=np.abs(np.diff(x,axis=0))
        row={**item,'rmsDbFS':db(np.sqrt(np.mean(stable*stable))),'peak':float(np.abs(x).max()),'clippedSamples':int((np.abs(x)>=.95).sum()),'crossfadeEntryJump':float(jump[rate*45-1].max()),'loopWrapJump':float(jump[round(rate*46.8)-1].max()),'p9999SampleJump':float(np.quantile(jump,.9999))}
        row.update(modulation(stable[:,0],rate))
        assert row['clippedSamples']==0,row
        # The seam must not be a jump outlier relative to ordinary texture.
        assert max(row['crossfadeEntryJump'],row['loopWrapJump'])<row['p9999SampleJump'],row
        if item['variant']=='band':assert row['relative16HzEnvelope']>10*row['relativeNeighborEnvelopeMax'],row
        report['carrier'].append(row)
        # Same source at matched RMS for comparison only. RMS is not perceived loudness.
        clip=x[:rate*20].copy()
        clip[-rate//2:]*=np.linspace(1,0,rate//2)[:,None]
        clip*=10**(-24/20)/np.sqrt(np.mean(clip*clip))
        assert np.abs(clip).max()<.9
        with wave.open(str(dest/(item['name']+'.wav')),'wb') as w:
            w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(np.round(clip*32767).astype('<i2').tobytes())
report['presetLevels']=json.loads((source/'preset-levels.json').read_text())
for rate in [44100,48000,96000]:
    levels=[row['rmsDbFS'] for row in report['presetLevels'] if row['rate']==rate]
    assert max(levels)-min(levels)<1,(rate,levels)
(dest/'measurements.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
