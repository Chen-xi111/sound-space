"""Development-only recording preparation, not an app dependency.

Usage: python3 scripts/prepare-nature.py /path/to/original-ogg-directory
Requires numpy, soundfile and macOS afconvert. Source files: rain/stream/wind.ogg.
Licenses and exact source links: public/assets/SOURCE.md.
Writes PCM WAVs and a provenance/measurement manifest. Rebuilds need a new
catalog revision if the resulting bytes differ from the checked-in hashes.
"""
from pathlib import Path
import hashlib, io, json, subprocess, sys, tempfile, wave
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[1]
source_dir = Path(sys.argv[1])
manifest = []
for name, start, seconds in [('rain', 5, 30), ('stream', 1, 28), ('wind', 60, 45)]:
    original = (source_dir / (name + '.ogg')).read_bytes()
    # Rain's original container also has an Ogg Skeleton track. Preserve only
    # the Vorbis logical stream; whole pages retain their original CRCs.
    pages, serial, pos = [], None, 0
    while pos < len(original):
        assert original[pos:pos+4] == b'OggS'
        count = original[pos+26]
        size = 27 + count + sum(original[pos+27:pos+27+count])
        page = original[pos:pos+size]
        if page[27+count:].startswith(b'\x01vorbis'):
            serial = page[14:18]
        pages.append(page)
        pos += size
    data, rate = sf.read(io.BytesIO(b''.join(p for p in pages if p[14:18] == serial)), always_2d=True)
    data = data[start*rate:(start+seconds)*rate]
    assert len(data) == seconds*rate
    with tempfile.TemporaryDirectory() as tmp:
        sf.write(tmp+'/trim.wav', data, rate, subtype='PCM_24')
        subprocess.run(['afconvert', tmp+'/trim.wav', tmp+'/resampled.wav', '-f', 'WAVE', '-d', 'LEI16@24000'], check=True)
        data, rate = sf.read(tmp+'/resampled.wav', always_2d=True)
    data -= data.mean(axis=0)
    gain = .16 / np.sqrt(np.mean(data**2))
    # Smooth, bounded peak shaping reduces sharp water transients without hard clipping.
    data = .8 * np.tanh(data * gain / .8)
    pcm = np.rint(data * 32767).astype('<i2')
    target = root / 'public/assets' / f'nature-{name}-v1.wav'
    with wave.open(str(target), 'wb') as out:
        out.setnchannels(pcm.shape[1]); out.setsampwidth(2); out.setframerate(rate); out.writeframes(pcm.tobytes())
    item = {'id':f'nature-{name}', 'revision':1, 'sourceSha256':hashlib.sha256(original).hexdigest(),
            'trimStartSeconds':start, 'durationMs':len(pcm)*1000//rate, 'sampleRate':rate, 'channels':pcm.shape[1],
            'normalizationGain':float(gain), 'rms':float(np.sqrt(np.mean((pcm/32768.)**2))),
            'peak':float(np.max(np.abs(pcm/32768.))), 'bytes':target.stat().st_size,
            'contentHash':hashlib.sha256(target.read_bytes()).hexdigest()}
    manifest.append(item); print(item)
(root/'public/assets/nature-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
