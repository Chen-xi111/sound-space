import {presets,isSoundscape} from './recipes.js';
export const PREFERENCE_PREFIX='wave-platform.preference.v1.';
const ids=new Set(presets.map(p=>p.id));
function valid(key,value){
  if(key==='master')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
  if(key==='dim')return typeof value==='boolean';
  const [group,id]=key.split(':');
  if(!ids.has(id)||key!==`${group}:${id}`)return false;
  if(group==='duration')return Number.isInteger(value)&&value>=1&&value<=120;
  return group==='natural'&&isSoundscape(presets.find(p=>p.id===id))&&typeof value==='boolean';
}
export class Preferences {
  constructor(storage=()=>globalThis.localStorage){this.storage=storage;}
  get(key,fallback){
    try{const raw=this.storage().getItem(PREFERENCE_PREFIX+key);if(raw===null||raw.length>100)return fallback;const value=JSON.parse(raw);return valid(key,value)?value:fallback;}catch{return fallback;}
  }
  set(key,value){
    if(!valid(key,value))return false;
    try{this.storage().setItem(PREFERENCE_PREFIX+key,JSON.stringify(value));return true;}catch{return false;}
  }
}
