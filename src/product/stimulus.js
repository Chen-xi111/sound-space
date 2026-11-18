// Describes configured signal output, never inferred brain activity or efficacy.
export function stimulusStatus(recipe,{stage=recipe.timeline.stages[0],gains={},master=1,state='configured'}={}){
  const rhythm=recipe.rhythm;
  if(rhythm.kind==='none')return {active:false,text:''};
  if(state!=='configured'&&state!=='running')return {active:false,text:''};
  if(master===0)return {active:false,text:'当前静音 节律不会发声'};
  const target=recipe.layers.find(l=>l.id===(rhythm.targetLayerId??rhythm.layerId));
  const layer=stage?.layerStates.find(l=>l.layerId===target?.id);
  const gain=layer?(gains[layer.layerId]??layer.gain):0;
  if(!layer?.enabled||gain===0)return {active:false,text:'节律目标未发声 当前没有节律输出'};
  if(rhythm.kind==='amplitudeModulation'){
    if(!stage.rhythmState?.enabled||stage.rhythmState.depth===0)return {active:false,text:'调制已关闭或深度为零 当前没有节律变化'};
    return {active:true,text:`节律作用于${target.label} · ${stage.rhythmState.rateHz} Hz${rhythm.band?' · 中低频调制':''}`};
  }
  return {active:true,text:`左右频差 ${layer.params.beatHz} Hz · 需要立体声耳机`};
}
