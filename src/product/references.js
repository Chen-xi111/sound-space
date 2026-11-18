// References inform available sound techniques; timings/mixes are product choices.
export function referenceFor(kind){
  if(kind==='sleep')return {title:'连续粉红噪声与睡眠结构 · Basner 等 2026',url:'https://pubmed.ncbi.nlm.nih.gov/41627391/',description:'一项 25 人睡眠实验发现 持续粉红噪声减少 REM 睡眠 因此这里提供睡前定时陪伴与渐弱结束 不设置整夜深睡刺激 默认绵雨声床不叠加额外粉红噪声 已保存的个人选择继续保留'};
  if(kind==='carrier')return {title:'白／粉红噪声与注意任务 · Nigg 等，2024',url:'https://pubmed.ncbi.nlm.nih.gov/38428577/',description:'保留独立生成的粉红噪声，以自然录音重构的连续声床承载。音色匹配和混合比例属于听感设计；原噪声选项继续可用，融合版不宣称与论文刺激效果相同。'};
  if(kind==='nature')return {title:'自然声音与健康体验 · Buxton 等，2021',url:'https://doi.org/10.1073/pnas.2013097118',description:'自然声研究为放松和日常声景提供设计参考。这里将真实录音与可选背景噪声组合；混音比例、循环和时间安排由应用设计，不代表复现研究干预。'};
  if(kind==='am')return {title:'调制音乐与持续注意 · Woods 等，2024',url:'https://www.nature.com/articles/s42003-024-07026-3',description:'参考研究的 200–1000 Hz 频段设计 把 16 Hz 节律融入绵雨声床 减少高频抖动 研究使用音乐 这里使用自然声 深度与时间安排为应用设置 不等同于论文刺激'};
  if(kind==='binaural')return {title:'双耳节拍与脑电同步综述 · Ingendoh 等 2023',url:'https://pubmed.ncbi.nlm.nih.gov/37205669/',description:'左右耳分别接收 195 与 205 Hz 载波 需要立体声耳机 10 Hz 是频差 不是向耳朵播放的低频声 脑电同步研究结果不一致 这里提供声音体验 不保证进入特定脑波状态'};
  if(kind==='pink'||kind==='white')return {title:'白／粉红噪声与注意任务 · Nigg 等，2024',url:'https://pubmed.ncbi.nlm.nih.gov/38428577/',description:'白／粉红噪声研究支持在注意困难人群的任务场景中提供背景噪声选项。这里将声音选择、定时和渐弱结束整合为日常使用方案；不将这一结果推广为所有人必然受益。'};
  return {title:null,url:null,description:'棕噪声提供偏低频的背景音色。该方案按声音偏好与日常时间安排设计；时长、混音比例和渐弱设置可以自行选择。'};
}
