"""Controlled acoustic simulation, plus an explicitly hypothetical expectation model.
No EEG, physiological response, clinical efficacy, or placebo exclusion is inferred.
"""
import json,sys,math,wave
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent.parent
source=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/wave-controlled-simulation')
dest=root/'docs/verification/controls-2026-10-28';dest.mkdir(parents=True,exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text())
result={'date':'2026-10-28','scope':'Simulated acoustic signals; no participants or brain-response model','sourceHashes':manifest['sourceHashes'],'am':[],'mix':[],'binaural':{},'checks':[]}
def rms(x):return float(np.sqrt(np.mean(x*x)))
def db(x):return float(20*np.log10(max(x,1e-15)))
def envelope(x,rate):
    n=len(x);f=np.fft.fftfreq(n,1/rate)
    return np.abs(np.fft.ifft(np.fft.fft(x)*2*((f>=200)&(f<=1000))))[rate:-rate]
def component(x,hz,rate):
    t=np.arange(len(x))/rate
    return float(2*abs(np.sum(x*np.exp(-2j*np.pi*hz*t)))/len(x))
mixes={};curves={}
for item in manifest['samples']:
    rate=item['rate'];x=np.fromfile(source/(item['name']+'.f32'),dtype='<f4').astype(np.float64).reshape(-1,2)
    assert np.isfinite(x).all() and np.max(np.abs(x))<.95,item
    stable=x[3*rate:23*rate]
    if item['kind']=='am':
        # Paired identical source + starting offset; only AM condition changes.
        # Normalize before analysis so a static volume increase cannot explain AM.
        gain=10**(-24/20)/rms(stable);matched=stable*gain
        assert np.max(np.abs(matched))<.95
        env=envelope(matched[:,0],rate)
        values={str(hz):component(env,hz,rate)/float(env.mean()) for hz in range(1,31)}
        peak=max(values,key=values.get)
        result['am'].append({'rate':rate,'offsetMs':item['offset'],'conditionHz':item['hz'],'matchedRmsDbFS':db(rms(matched)),'at8Hz':values['8'],'at16Hz':values['16'],'peakHz':int(peak),'peak':float(np.max(np.abs(matched)))})
        if item['hz']:assert int(peak)==item['hz'],(item,peak)
        if rate==48000 and item['offset']==0:
            curves[str(item['hz'])]=values
            clip=matched.copy();n=rate//2;clip[:n]*=np.linspace(0,1,n)[:,None];clip[-n:]*=np.linspace(1,0,n)[:,None];clip*=10**(-24/20)/rms(clip)
            with wave.open(str(dest/f"control-{item['hz']}hz.wav"),'wb') as w:
                w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(np.round(clip*32767).astype('<i2').tobytes())
    elif item['kind']=='binaural':
        left,right=stable.T;mono=(left+right)/2
        amp=lambda x,hz:component(x,hz,rate)
        result['binaural']={'left195Hz':amp(left,195),'left205Hz':amp(left,205),'right195Hz':amp(right,195),'right205Hz':amp(right,205),'stereoDifferenceRms':rms(left-right),'monoDifferenceRms':rms(mono-mono),'mono195Hz':amp(mono,195),'mono205Hz':amp(mono,205)}
        assert amp(left,195)>100*amp(left,205) and amp(right,205)>100*amp(right,195)
    else:mixes[(item['preset'],item['variant'])]=stable
for preset in ['soft-rain-focus','water-veil-rest']:
    carrier=mixes[(preset,'carrier')];noise=mixes[(preset,'noise')];mixed=mixes[(preset,'mixed')]
    error=float(np.max(np.abs(mixed-(carrier+noise))))
    assert error<1e-7,error
    result['mix'].append({'preset':preset,'noiseToCarrierDb':db(rms(noise)/rms(carrier)),'noiseFractionOfSeparatePowers':rms(noise)**2/(rms(noise)**2+rms(carrier)**2),'additivityError':error})
for rate in [44100,48000,96000]:
    for offset in [0,10000,30000]:
        rows=[r for r in result['am'] if r['rate']==rate and r['offsetMs']==offset];by={r['conditionHz']:r for r in rows}
        assert max(r['matchedRmsDbFS'] for r in rows)-min(r['matchedRmsDbFS'] for r in rows)<1e-6
        assert by[16]['at16Hz']>5*max(by[0]['at16Hz'],by[8]['at16Hz'])
        assert by[16]['at16Hz']>.15
result['modulationCurves48000']=curves
result['checks']=['27 AM conditions: exact matched RMS, expected peak in all active conditions, 16 Hz component exceeds both controls by >5x','Mixed carriers equal independently rendered source sum within 1e-7','Stereo 195/205 Hz channel separation exceeds 40 dB; mono removes interaural separation','All rendered conditions finite and free of output clipping']
# Identifiability illustration, NOT simulated participants or a trial power plan.
rng=np.random.default_rng(20261028);z=rng.standard_normal((20000,20)).mean(axis=1)*math.sqrt(20)
significant=lambda shift:float(np.mean(np.abs(z+math.sqrt(20)*shift)>1.95996398454))
result['expectationIllustration']={'assumptions':'20 independent paired differences, known SD=1, Gaussian noise, two-sided known-variance z test alpha=.05; hypothetical standardized mean shift=.25, unrelated to published effect sizes','replications':20000,'noTrueNoExpectation':significant(0),'noTrueExpectation025':significant(.25),'true025NoExpectation':significant(.25),'interpretation':'Same observed mean shift can be entirely expectation or entirely specific effect; this simulation cannot distinguish them.'}
(dest/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
rows=''.join(f"<tr><td>{r['rate']/1000:g} kHz</td><td>{r['offsetMs']/1000:g} 秒</td><td>{'原声' if r['conditionHz']==0 else str(r['conditionHz'])+' Hz'}</td><td>{r['matchedRmsDbFS']:.2f}</td><td>{r['at16Hz']:.3f}</td></tr>" for r in result['am'])
active=[r['at16Hz'] for r in result['am'] if r['conditionHz']==16];controls=[r['at16Hz'] for r in result['am'] if r['conditionHz']!=16]
rendered=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>声音对照模拟 · 声音空间</title><link rel="stylesheet" href="/public/product.css"><link rel="stylesheet" href="/public/verification.css"></head><body>
<header class="site-header"><a class="brand" href="/#/home">声音空间</a><a href="/#/settings">返回使用说明</a></header><main id="main"><div class="intro"><p class="eyebrow">声学验证 · 2026-10-28</p><h1>声音里的节律 经过对照检查</h1><p>同一段绵雨 同一输出能量 对比无调制、8 Hz 与 16 Hz</p><p class="caption">这是程序生成的声音测试 没有模拟脑电或真人表现 不能据此排除安慰剂或宣称提升学习与睡眠</p></div>
<div class="cards"><section class="panel"><h2>27 组条件</h2><p>3 种采样率 × 3 个录音起点 × 3 种节律设置</p><p class="caption">实际调用应用音频引擎</p></section><section class="panel"><h2>能量相同</h2><p>所有对照统一至 −24 dBFS RMS</p><p class="caption">避免把音量变化误当作节律差异 等 RMS 不代表主观等响</p></section><section class="panel"><h2>节律没有消失</h2><p>16 Hz 包络相对分量 {min(active):.3f}—{max(active):.3f}<br>其他对照最高 {max(controls):.3f}</p><p class="caption">是声音包络指标 不是脑波或改善百分比</p></section></div>
<section class="panel"><h2>模拟能确认什么</h2><ul class="list"><li>16 Hz 声学节律在不同设备采样率和录音片段中保留</li><li>自然声与独立噪声都实际进入混合输出</li><li>双耳方案左右输出分别含 195 与 205 Hz 载波</li><li>合成单声道会丢失左右分离 仍可能产生单耳拍频 因而不能替代立体声耳机</li></ul></section>
<section class="panel"><h2>怎样才能排除安慰剂</h2><p>需要真人随机对照 比较同载体的有节律和无节律声音 并控制音量、顺序、练习与期待差异</p><p>专注看预先确定的任务表现 睡眠看对应的客观指标 不能只问“觉得有没有用” 也不能把听出两段声音不同当成有效证明</p><p class="caption">声音差异可能被听出来 隐去名称不等于成功双盲 当前平台尚未完成这样的效果试验</p></section>
<details class="panel"><summary>期待效应为什么不能靠模拟排除</summary><p>在一个明确假设的统计模型中 真实效应为零、期待效应为 0.25，与真实效应为 0.25、期待效应为零，可以产生完全相同的结果分布</p><p class="caption">本例使用 20 个独立高斯配对差 已知标准差 1 和双侧 5% 检验 重复 20000 次；数字仅说明混杂问题 不是用户数据、效应预测或样本量建议</p></details>
<details class="panel"><summary>逐项声学结果</summary><div class="table-scroll"><table><thead><tr><th>采样率</th><th>录音起点</th><th>条件</th><th>RMS dBFS</th><th>16 Hz 分量／均值</th></tr></thead><tbody>{rows}</tbody></table></div><p class="caption">200–1000 Hz 分析包络 去除边界后测量 左声道 指标无量纲 阈值是工程检查值 并非生理有效阈值</p></details>
<section class="panel"><h2>研究依据</h2><p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11499863/" target="_blank" rel="noopener">调制音乐与持续注意 · Woods 等 2024 ↗</a></p><p><a href="https://pubmed.ncbi.nlm.nih.gov/38428577/" target="_blank" rel="noopener">白／粉红噪声与注意任务 · Nigg 等 2024 ↗</a></p><p><a href="https://pubmed.ncbi.nlm.nih.gov/37205669/" target="_blank" rel="noopener">双耳节拍与脑电同步综述 · Ingendoh 等 2023 ↗</a></p><p class="caption">原研究不等于本平台完整组合的验证 详细数据与源代码指纹保存在项目验收记录</p></section></main></body></html>'''
(root/'public/sound-verification.html').write_text(rendered)
print(json.dumps({'amConditions':len(result['am']),'active16Range':[min(active),max(active)],'control16Max':max(controls),'mix':result['mix'],'binaural':result['binaural'],'expectationIllustration':result['expectationIllustration']},ensure_ascii=False,indent=2))
