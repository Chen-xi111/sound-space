// Original, static vector artwork. It represents the product's visual direction,
// not measured attention, brain activity, or an earned progress indicator.
export function gardenArt(){return `<svg class="garden-art" viewBox="0 0 320 240" fill="none" aria-hidden="true" focusable="false">
  <circle cx="234" cy="57" r="25" fill="currentColor" opacity=".09"/>
  <path d="M20 186C68 153 106 170 151 161C205 148 250 157 300 182V214H20Z" fill="currentColor" opacity=".07"/>
  <path d="M21 196C92 169 177 196 299 175" stroke="currentColor" stroke-width="1.5" opacity=".35"/>
  <path d="M139 184V124M139 150L115 129M139 139L163 113" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M137 145C89 150 78 101 102 88C126 79 144 110 137 145Z" fill="currentColor" opacity=".19"/>
  <path d="M141 132C126 89 147 62 168 68C197 79 181 124 141 132Z" fill="currentColor" opacity=".27"/>
  <path d="M209 184V160M209 168L222 155M209 175L198 165" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M209 169C204 150 218 142 228 147C233 160 222 169 209 169Z" fill="currentColor" opacity=".23"/>
  <path d="M208 176C196 179 184 169 189 158C204 155 210 164 208 176Z" fill="currentColor" opacity=".16"/>
  <path d="M57 117H81M67 110H90M250 125H279" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".25"/>
</svg>`;}

const studies=[
  {topic:'睡前陪伴与整夜声音',meta:'Basner 等 · 2026 · SLEEP',finding:'25 人实验用多导睡眠监测比较不同夜间声音条件 连续粉红噪声减少 REM 睡眠',boundary:'声音遮盖环境干扰 不代表整体睡眠质量改善 自然声床也不据此获得改善睡眠的保证',application:'默认绵雨入夜仅用声床 定时渐弱 不自动整夜续播',url:'https://pubmed.ncbi.nlm.nih.gov/41627391/',link:'夜间粉红噪声与睡眠结构研究'},
  {topic:'背景噪声与注意',meta:'Nigg 等 · 2024 · 系统综述与荟萃分析',finding:'白／粉红噪声在有 ADHD 或明显注意困难的儿童与年轻人中，对实验任务表现有小幅帮助。',boundary:'非 ADHD 对照组平均表现下降。这项结果支持提供声音选择，不代表噪声对所有人都有益。棕噪声按音色偏好提供。',application:'当前白／粉红噪声选项的参考。',url:'https://pubmed.ncbi.nlm.nih.gov/38428577/',link:'白／粉红噪声与注意任务研究'},
  {topic:'声音节律与持续注意',meta:'Woods 等 · 2024 · Communications Biology',finding:'特定振幅调制音乐在部分实验条件下改善持续注意，结果与听者的注意困难程度有关。',boundary:'研究使用音乐；平台学习方案采用自然声床的频段调制 参考 200–1000 Hz 频段设计 载体与深度仍是应用设置 不等同于研究音乐。',application:'当前振幅调制模块的设计参考。',url:'https://www.nature.com/articles/s42003-024-07026-3',link:'调制音乐与持续注意研究'},
  {topic:'自然声音与放松',meta:'Buxton 等 · 2021 · PNAS',finding:'一项综合研究发现，自然声音有助于降低压力和烦扰，并改善部分积极情绪指标。',boundary:'这是自然声景的设计依据，不证明自然声与任意节律混合后仍有相同效果。',application:'雨声、溪流与林间风声的设计参考。',url:'https://doi.org/10.1073/pnas.2013097118',link:'自然声音与健康体验研究'},
  {topic:'音乐与睡前体验',meta:'Jespersen 等 · 2022 · Cochrane 系统综述',finding:'综述纳入 13 项研究，支持听音乐改善有失眠症状成年人的主观睡眠质量。',boundary:'客观睡眠指标的证据仍有限。这项结果不能直接套用到目前的棕噪声睡前方案。',application:'后续睡前音乐内容的参考；音乐素材尚未上线。',url:'https://doi.org/10.1002/14651858.CD010459.pub3',link:'音乐与成人睡眠综述'},
];

export function philosophyPage(hasSession=false){return `<article class="philosophy" aria-labelledby="philosophy-title">
  <a class="back" data-about-back href="${hasSession?'#/player':'#/home'}">← ${hasSession?'回到播放':'回到声音空间'}</a>
  <header class="story-hero"><div><p class="eyebrow">声音空间 · 我们的理念</p><h1 id="philosophy-title">把注意力还给当下<br>把休息留给自己</h1><p class="story-lead">用声音陪伴专注与休息<br>留出一段属于自己的时间</p></div>${gardenArt()}</header>
  <section class="story-section" aria-labelledby="purpose-title"><p class="eyebrow">我们为什么做这件事</p><h2 id="purpose-title">专注值得被支持 休息也一样</h2><div class="purpose-grid"><div><h3>专注与学习</h3><p>给阅读、写作和思考一段稳定的声音背景</p></div><div><h3>放松与休息</h3><p>暂时放下手头的事 这一刻不必追赶什么</p></div><div><h3>睡前与睡眠</h3><p>用定时与渐弱 为一天安排温和的收尾</p></div></div></section>
  <section class="story-section" aria-labelledby="principle-title"><p class="eyebrow">声音如何参与</p><h2 id="principle-title">背景、节律与自己的节奏</h2><dl class="principle-list"><div><dt>背景</dt><dd>连续的声音可以掩盖部分环境声变化。白、粉红、棕噪声，区别在于不同频段的能量分布与听感。</dd></div><div><dt>节律</dt><dd>振幅调制让声音的强弱规律变化；双耳节拍向左右耳送入略有频差的声音，需要立体声耳机。</dd></div><div><dt>时间</dt><dd>定时、暂停和渐弱，把一次播放变成一段有边界的专注或休息。何时开始、何时停下，都由你决定。</dd></div></dl><p class="caption">声学节律不等于大脑状态；平台不检测脑波，也不把某个频率当作专注或睡眠的开关。</p></section>
  <section class="story-section" aria-labelledby="approach-title"><p class="eyebrow">我们的选择</p><h2 id="approach-title">声音退到背景 你回到生活</h2><p class="story-prose">以已有研究为起点 把声音做得更易用、更耐听<br>少一点设置 少一点打扰<br>无需打卡 也不必给每一次休息打分</p><p class="story-prose">以连续的雨幕与水声承载噪声<br>让声音平稳地陪伴这一段时间</p><p class="caption">当前可用 融合声床、自然录音、背景噪声与节律<br><a href="#/credits">录音来源与授权 →</a></p></section>
  <section class="story-section research-section" aria-labelledby="research-title"><p class="eyebrow">研究给我们的启发</p><h2 id="research-title">以研究为起点</h2><p class="subtle">把研究转化为声音选择与设计方向<br>展开主题 查看结论与原文</p>${studies.map(s=>`<details class="study"><summary>${s.topic}<span class="study-meta">${s.meta}</span></summary><div class="study-body"><p>${s.finding}</p><p class="subtle">${s.boundary}</p><p class="caption">${s.application}</p><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.link} ↗<span class="sr-only">（新窗口打开）</span></a></div></details>`).join('')}<p class="caption research-note">研究结果来自特定人群与声音条件，不是对本平台完整组合的功效验证。声音空间是一款日常声音工具，不用于诊断或治疗。</p></section>
  <section class="story-closing"><h2>这一段时间 留给你</h2><p>选一种舒服的声音 从此刻开始</p><a class="button primary" data-about-action href="${hasSession?'#/player':'#/library'}">${hasSession?'回到正在使用的声音':'选择我的声音'}</a></section>
</article>`;}
