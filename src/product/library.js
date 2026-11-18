import {customRecipe,assertPlayable} from './recipes.js';

export const LIBRARY_KEY='wave-platform.library.v1';
const empty=()=>({version:1,favorites:[],saved:[]});
const clone=value=>structuredClone(value);
const validId=id=>typeof id==='string'&&/^[a-z0-9-]{1,80}$/.test(id);
export const MAX_BACKUP_LENGTH=1500000;
export function parseBackup(raw){
  try{
    if(typeof raw!=='string'||raw.length>MAX_BACKUP_LENGTH)throw new Error();
    const data=JSON.parse(raw.replace(/^\uFEFF/,''));
    if(data?.version!==1||!Array.isArray(data.favorites)||!Array.isArray(data.saved)||data.favorites.length>200||data.saved.length>50)throw new Error();
    if(data.favorites.some(id=>!validId(id))||new Set(data.favorites).size!==data.favorites.length)throw new Error();
    const saved=data.saved.map(x=>{
      if(!x||!validId(x.id)||!Number.isSafeInteger(x.revision)||x.revision<1)throw new Error();
      const entry={id:x.id,revision:x.revision,createdAt:x.createdAt,updatedAt:x.updatedAt,draft:normalizedDraft(x.draft)};
      savedRecipe(entry);return entry;
    });
    if(new Set(saved.map(x=>x.id)).size!==saved.length)throw new Error();
    return {version:1,favorites:[...data.favorites],saved};
  }catch{throw new Error('无法识别这份备份 请使用声音空间导出的完整 JSON 备份');}
}
const entryContent=entry=>JSON.stringify([entry.revision,entry.createdAt,entry.updatedAt,entry.draft]);
function mergePlan(current,incoming){
  const favorites=incoming.favorites.filter(id=>!current.favorites.includes(id));
  const additions=[];let skipped=0,copies=0;
  for(const entry of incoming.saved){
    const sameId=current.saved.find(x=>x.id===entry.id);
    const duplicate=sameId&&current.saved.some(x=>entryContent(x)===entryContent(entry));
    if(duplicate){skipped++;continue;}
    const copy=Boolean(sameId);if(copy)copies++;
    additions.push({entry,copy});
  }
  if(current.saved.length+additions.length>50||current.favorites.length+favorites.length>200)throw new Error('恢复后会超过本地容量 请先整理已有组合或收藏');
  return {favorites,additions,added:additions.length,skipped,copies};
}
export function normalizedDraft(input){
  if(input?.kind==='preset'){const d={kind:'preset',title:input.title,minutes:input.minutes,template:clone(input.template)};customRecipe(d);return d;}
  if(input?.kind!==undefined)throw new Error('组合类型不支持');
  const d={title:input.title,minutes:input.minutes,continuous:input.continuous,layers:input.layers?.map(l=>({id:l.id,...(l.assetRef?{assetRef:{id:l.assetRef.id,revision:l.assetRef.revision},...(l.color!==undefined?{color:l.color}:{})}:{color:l.color}),gain:l.gain,enabled:l.enabled})),rhythm:input.rhythm,centerHz:input.centerHz,beatHz:input.beatHz,rateHz:input.rateHz,depth:input.depth};
  if(typeof d.title!=='string'||typeof d.continuous!=='boolean'||!Array.isArray(d.layers))throw new Error('组合格式不完整');
  if(d.layers.some(l=>!validId(l.id)))throw new Error('声音层标识无效');
  customRecipe(d);return clone(d);
}
export function savedRecipe(entry){
  const value=customRecipe(entry.draft);
  Object.assign(value.recipe,{id:entry.id,revision:entry.revision,createdAt:entry.createdAt,updatedAt:entry.updatedAt,description:'保存在这台设备上的个人声音组合。'});
  return assertPlayable(value);
}
export class PersonalLibrary {
  constructor({storage=()=>globalThis.localStorage,locks=globalThis.navigator?.locks,id=()=>`saved-${crypto.randomUUID()}`,now=()=>new Date().toISOString()}={}){Object.assign(this,{storage,locks,id,now});}
  read(){
    let raw;try{raw=this.storage().getItem(LIBRARY_KEY);}catch{throw new Error('无法读取本地方案。可以继续播放，保存需要浏览器允许本地存储。');}
    if(raw===null)return empty();
    try{return parseBackup(raw);}catch{throw new Error('本地方案暂时无法读取，原数据已保留。请先导出备份，再处理数据问题。');}
  }
  async change(fn){
    if(!this.locks)throw new Error('当前浏览器无法安全保存多个页面的修改，请换用支持本地保存的浏览器。');
    return this.locks.request('wave-platform-library-v1',async()=>{
      const data=this.read(),result=fn(data),text=JSON.stringify(data);
      if(text.length>1500000)throw new Error('本地方案空间已满，请删除不再需要的组合后重试。');
      try{this.storage().setItem(LIBRARY_KEY,text);}catch{throw new Error('没有保存成功。修改仍在当前页面，请检查浏览器存储空间后重试。');}
      return clone(result);
    });
  }
  favorite(id){
    if(!validId(id))throw new Error('方案标识无效');
    return this.change(data=>{const i=data.favorites.indexOf(id);if(i>=0)data.favorites.splice(i,1);else{if(data.favorites.length>=200)throw new Error('收藏数量已达上限');data.favorites.push(id);}return data.favorites.includes(id);});
  }
  save(input,{id=null,baseRevision=null}={}){
    const draft=normalizedDraft(input);
    return this.change(data=>{
      const old=id?data.saved.find(x=>x.id===id):null;
      if(id&&(!old||old.revision!==baseRevision))throw new Error('这个组合已在另一个页面更新或删除。当前修改已保留，请另存副本。');
      if(!old&&data.saved.length>=50)throw new Error('已保存 50 个组合，请先删除不再使用的组合。');
      const stamp=this.now(),entry={id:old?.id??this.id(),revision:(old?.revision??0)+1,createdAt:old?.createdAt??stamp,updatedAt:stamp,draft};
      if(old)data.saved[data.saved.indexOf(old)]=entry;else data.saved.unshift(entry);return entry;
    });
  }
  remove(id,revision){return this.change(data=>{const entry=data.saved.find(x=>x.id===id);if(!entry||entry.revision!==revision)throw new Error('组合已发生变化，请刷新列表后再删除。');data.saved=data.saved.filter(x=>x.id!==id);return entry;});}
  async restore(entry){return this.change(data=>{if(data.saved.some(x=>x.id===entry.id))throw new Error('相同组合已经存在');if(data.saved.length>=50)throw new Error('个人组合数量已达上限');normalizedDraft(entry.draft);data.saved.unshift(clone(entry));return entry;});}
  backup(){return this.storage().getItem(LIBRARY_KEY)??JSON.stringify(empty());}
  previewImport(raw){
    const incoming=parseBackup(raw),plan=mergePlan(this.read(),incoming);
    return {added:plan.added,skipped:plan.skipped,copies:plan.copies,favorites:plan.favorites.length,titles:plan.additions.map(x=>x.entry.draft.title)};
  }
  importBackup(raw){
    const incoming=parseBackup(raw);
    return this.change(data=>{
      // Recompute under the shared lock so a preview never overwrites later edits.
      const plan=mergePlan(data,incoming),used=new Set([...data.saved,...incoming.saved].map(x=>x.id));
      const additions=plan.additions.map(({entry,copy})=>{
        if(!copy)return entry;
        let id;for(let attempt=0;attempt<100;attempt++){const candidate=this.id();if(validId(candidate)&&!used.has(candidate)){id=candidate;break;}}
        if(!id)throw new Error('暂时无法创建组合副本 请重试');
        used.add(id);return {...entry,id};
      });
      data.saved.unshift(...additions);data.favorites.push(...plan.favorites);
      return {added:plan.added,skipped:plan.skipped,copies:plan.copies,favorites:plan.favorites.length};
    });
  }
}
