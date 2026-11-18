export const recordingCredits = [
  {id:'nature-rain',label:'雨声',title:'Rain',author:'ezwa',license:'Public domain',licenseUrl:'https://commons.wikimedia.org/wiki/File:Rain_(1).ogg#Licensing',url:'https://commons.wikimedia.org/wiki/File:Rain_(1).ogg',edit:'截取第 5—35 秒 重采样 音量调整与柔化瞬态'},
  {id:'nature-stream',label:'溪流',title:'Swale',author:'Siddharth Patil（Ksd5 / Sidpatil）',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',url:'https://commons.wikimedia.org/wiki/File:Swale.ogg',edit:'截取第 1—29 秒 重采样 音量调整与柔化瞬态'},
  {id:'nature-wind',label:'林间风声',title:'Wind in sparren in het Vijlenerbos',author:'luc de bruijn',license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',url:'https://commons.wikimedia.org/wiki/File:Wind_in_sparren_in_het_Vijlenerbos_-_SoundCloud_-_luc_de_bruijn.ogg',edit:'截取第 60—105 秒 重采样 音量调整与柔化瞬态'},
];
recordingCredits.push(
  {...recordingCredits[0],id:'carrier-soft-rain',label:'绵雨声床',edit:'基于雨声片段重构连续双声道纹理 调整音色与起伏 处理循环接缝 并非原始现场录音'},
  {...recordingCredits[1],id:'carrier-water-veil',label:'水幕声床',edit:'基于溪流片段重构连续双声道纹理 柔化水花与起伏 处理循环接缝 并非瀑布现场录音'},
);
export function creditsPage(){return `<article class="philosophy"><a class="back" href="#/library">← 回到声音方案</a><div class="intro"><p class="eyebrow">来自真实世界的声音</p><h1>录音来源与授权</h1><p class="subtle">感谢记录这些声音的人</p></div>${recordingCredits.map(c=>`<section class="panel"><h2>${c.label}</h2><p>${c.title}<br>${c.author}</p><p class="caption">${c.edit}<br>播放时以交叉淡化连接循环</p><div class="actions"><a href="${c.url}" target="_blank" rel="noopener noreferrer">原始录音 ↗</a><a href="${c.licenseUrl}" target="_blank" rel="noopener noreferrer">${c.license} ↗</a></div></section>`).join('')}<p class="caption">录音经过处理并与应用一同提供<br>作者与本平台无关联 也不为本平台的效果作背书</p></article>`;}
