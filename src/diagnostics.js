import {Renderer} from './audio/dsp.js';
import {makeDemo} from './config/demos.js';
import {validateRecipe} from './config/validate.js';
export function render(recipe,ms,rate=48000,assets={}){
 const core=new Renderer(recipe,rate,assets,1),size=Math.round(ms*rate/1000),left=new Float32Array(size),right=new Float32Array(size);
 for(let at=0;at<size;at+=128)core.process(left.subarray(at,Math.min(size,at+128)),right.subarray(at,Math.min(size,at+128)));
 return {core,left,right};
}
export function runDiagnostics(){
 const lines=[];const check=(condition,label)=>{if(!condition)throw new Error(label);lines.push('通过 · '+label);};
 const value=makeDemo('pink',1000);check(validateRecipe(value).playable,'工程配置通过结构与能力检查');
 const output=render(value.recipe,1200);check(output.core.finished,'有限声音按采样时钟结束');check(output.left.slice(48000).every(x=>x===0),'截止后输出为零');
 check(output.left.some(x=>x!==0)&&output.left.every(Number.isFinite),'采样有效且非空');
 const am=makeDemo('am',1000);const a=render(am.recipe,4500);check(a.left.slice(48000,48000*4).every(x=>x===0),'休息阶段完整静音');
 const pair=makeDemo('binaural',1000);pair.recipe.layers=pair.recipe.layers.filter(l=>l.id==='beat');pair.recipe.timeline.stages[0].layerStates=pair.recipe.timeline.stages[0].layerStates.filter(l=>l.layerId==='beat');
 const b=render(pair.recipe,1000);const crossings=x=>{let n=0;for(let i=1;i<x.length;i++)if(x[i-1]<=0&&x[i]>0)n++;return n;};
 check(Math.abs(crossings(b.left)-195)<=1&&Math.abs(crossings(b.right)-205)<=1,'左右载波分别为 195 / 205 Hz');
 return lines;
}
