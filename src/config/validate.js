import { recipeSchema } from './schema.js';
import { checkSchema } from './schema-check.js';
export const PROFILE = 'audio-v1-core';
export const MAX_BYTES = 1024 * 1024;
export const assetKey = ref => `${ref.id}@${ref.revision}`;
export const totalMs = recipe => recipe.timeline.kind === 'continuous' ? Infinity
  : recipe.timeline.repeatCount * recipe.timeline.stages.reduce((sum, s) => sum + s.durationMs, 0);
const issue = (code, path, message) => ({ code, path, message });
function utc(value) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return false;
  const d = new Date(value);
  return Number.isFinite(+d) && d.toISOString() === value.replace(/(?<!\.\d{3})Z$/, '.000Z');
}
function pointerExists(object, path) {
  if (path === '') return true;
  if (!path.startsWith('/') || /~(?![01])/.test(path)) return false;
  for (const part of path.slice(1).split('/')) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (object === null || typeof object !== 'object' || !Object.hasOwn(object, key)) return false;
    object = object[key];
  }
  return true;
}
export function parseRecipe(text, options = {}) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) return { valid: false, playable: false, errors: [issue('FORMAT_INVALID', '', '配置文件超过 1 MiB 或不是文本')], blockers: [] };
  let value;
  try { value = JSON.parse(text); } catch { return { valid: false, playable: false, errors: [issue('FORMAT_INVALID', '', 'JSON 格式不正确')], blockers: [] }; }
  return { value, ...validateRecipe(value, options) };
}
export function validateRecipe(value, { catalog = {}, sampleRate = 48000 } = {}) {
  if (value?.schemaVersion !== 1) return { valid: false, playable: false, errors: [issue('VERSION_UNSUPPORTED', '/schemaVersion', '不支持的格式版本')], blockers: [] };
  const errors = checkSchema(value, recipeSchema), blockers = [];
  if (errors.length) return { valid: false, playable: false, errors, blockers };
  const r = value.recipe, layers = new Map(r.layers.map(l => [l.id, l]));
  const fail = (code, path, message) => errors.push(issue(code, path, message));
  const block = (code, path, message) => blockers.push(issue(code, path, message));
  if (value.exampleOnly) block('EXAMPLE_ONLY', '/exampleOnly', '结构示例不能播放');
  if (r.capabilityProfile !== PROFILE) block('CAPABILITY_UNAVAILABLE', '/recipe/capabilityProfile', '尚未支持的音频引擎配置');
  if (!utc(r.createdAt) || !utc(r.updatedAt) || +new Date(r.createdAt) > +new Date(r.updatedAt)) fail('FORMAT_INVALID', '/recipe/createdAt', 'UTC 日期或日期顺序错误');
  if (layers.size !== r.layers.length) fail('REFERENCE_INVALID', '/recipe/layers', '声音层 ID 重复');
  const beats = r.layers.filter(l => l.source.kind === 'binaural');
  if (r.rhythm.kind === 'binaural' ? beats.length !== 1 || beats[0]?.id !== r.rhythm.layerId : beats.length !== 0) fail('RHYTHM_CONFLICT', '/recipe/rhythm', '双耳层数量或节律模式冲突');
  if (r.rhythm.kind === 'amplitudeModulation' && !['noise', 'asset'].includes(layers.get(r.rhythm.targetLayerId)?.source.kind)) fail('REFERENCE_INVALID', '/recipe/rhythm', '调制目标必须是现有噪声或素材层');
  if (r.rhythm.processorVersion !== undefined) {
    if(r.rhythm.processorVersion !== 'band-am-v1') block('CAPABILITY_UNAVAILABLE','/recipe/rhythm','不支持的频段调制版本');
    const {lowHz,highHz}=r.rhythm.band;
    if(lowHz>=highHz) fail('FORMAT_INVALID','/recipe/rhythm/band','调制频段上下限顺序错误');
    if(highHz>=Math.min(20000,sampleRate*.45)) block('CAPABILITY_UNAVAILABLE','/recipe/rhythm/band','调制频段超出引擎范围');
  }
  const stages = r.timeline.stages;
  if (new Set(stages.map(s => s.id)).size !== stages.length) fail('REFERENCE_INVALID', '/recipe/timeline/stages', '阶段 ID 重复');
  if (r.timeline.kind === 'finite' && totalMs(r) > 86400000) fail('TIMELINE_INVALID', '/recipe/timeline', '有限流程超过 24 小时');
  if (r.timeline.kind === 'continuous' && (stages[0].fadeOutMs !== 0 || r.completion.cue !== null)) fail('TIMELINE_INVALID', '/recipe/timeline', '持续模式不能有定时淡出或完成提示');
  if (r.completion.cue === null && r.completion.gain !== 0) fail('FORMAT_INVALID', '/recipe/completion', '无提示音时增益应为 0');
  const checkAsset = (ref, path, needed = true) => {
    const a = catalog[assetKey(ref)];
    if (needed && (!a || a.fixtureOnly || a.licenseStatus !== 'verified' || !a.licenseRef || !a.resourceKey || !/^[a-f0-9]{64}$/.test(a.contentHash ?? ''))) block('ASSET_UNAVAILABLE', path, '所需素材缺失、版本不符或授权未确认');
    return a;
  };
  for (const l of r.layers) {
    const s = l.source, path = `/recipe/layers/${r.layers.indexOf(l)}/source`;
    if (s.kind === 'noise' && !['noise-v1','noise-v2'].includes(s.generatorVersion)) block('CAPABILITY_UNAVAILABLE', path, '不支持的噪声算法版本');
    if (s.kind === 'binaural' && s.oscillatorVersion !== 'sine-v1') block('CAPABILITY_UNAVAILABLE', path, '不支持的振荡器版本');
    if (s.kind === 'asset') {
      const a = checkAsset(s.assetRef, path, stages.some(stage => stage.layerStates.some(x => x.layerId === l.id && x.enabled)));
      const p = s.playback;
      if (p.mode === 'loop' && !(p.loopStartMs <= p.startMs && p.startMs < p.loopEndMs && p.crossfadeMs <= (p.loopEndMs - p.loopStartMs) / 2)) fail('TIMELINE_INVALID', path, '素材循环范围不正确');
      if (a && (p.startMs >= a.durationMs || (p.mode === 'loop' && p.loopEndMs > a.durationMs))) fail('TIMELINE_INVALID', path, '素材起点或循环终点超出时长');
    }
  }
  if (r.completion.cue) {
    const a = checkAsset(r.completion.cue, '/recipe/completion');
    if (a && (a.category !== 'cue' || a.durationMs > 10000)) fail('FORMAT_INVALID', '/recipe/completion', '结束提示必须是 10 秒以内的 cue 素材');
  }
  for (const [i, stage] of stages.entries()) {
    const p = `/recipe/timeline/stages/${i}`;
    if (stage.durationMs !== null && stage.fadeInMs + stage.fadeOutMs > stage.durationMs) fail('TIMELINE_INVALID', p, '包络长度超出阶段');
    const ids = stage.layerStates.map(s => s.layerId);
    if (ids.length !== layers.size || new Set(ids).size !== ids.length || ids.some(id => !layers.has(id))) fail('REFERENCE_INVALID', p, '每阶段必须包含每个声音层且仅一次');
    for (const st of stage.layerStates) {
      const kind = layers.get(st.layerId)?.source.kind, q = st.params;
      if (!kind) continue;
      const expected = kind === 'binaural' ? ['centerHz','beatHz'] : kind === 'noise' ? ['pan','filter'] : ['pan'];
      if (Object.keys(q).sort().join() !== expected.sort().join()) { fail('FORMAT_INVALID', p, '参数类型与声音来源不匹配'); continue; }
      if (kind === 'binaural') {
        if (q.centerHz <= q.beatHz / 2) fail('FORMAT_INVALID', p, '双耳载波必须大于频差的一半');
        if (q.centerHz < 80 || q.centerHz > 1000 || q.beatHz < 1 || q.beatHz > 30 || q.centerHz + q.beatHz/2 >= sampleRate/2) block('CAPABILITY_UNAVAILABLE', p, '当前引擎范围：载波 80—1000 Hz，频差 1—30 Hz');
      }
      if (kind === 'noise' && q.filter && (q.filter.cutoffHz < 20 || q.filter.cutoffHz >= Math.min(20000,sampleRate*.45))) block('CAPABILITY_UNAVAILABLE', p, '滤波频率超出引擎范围');
    }
    if (r.rhythm.kind === 'amplitudeModulation') {
      if (stage.rhythmState === null) fail('RHYTHM_CONFLICT', p, '缺少调制状态');
      else if (stage.rhythmState.rateHz < 1 || stage.rhythmState.rateHz > 30) block('CAPABILITY_UNAVAILABLE', p, '当前引擎调制范围为 1—30 Hz');
    } else if (stage.rhythmState !== null) fail('RHYTHM_CONFLICT', p, '当前模式不能包含 AM 状态');
  }
  const paths = new Set();
  for (const o of r.provenance) {
    if (paths.has(o.path) || !pointerExists(r,o.path)) fail('REFERENCE_INVALID', '/recipe/provenance', '来源指针重复或不存在');
    paths.add(o.path);
    if (o.kind === 'research' ? !o.referenceId || !o.locator : o.referenceId !== null || o.locator !== null) fail('FORMAT_INVALID', '/recipe/provenance', '来源类别与出处字段不匹配');
  }
  if (!paths.has('')) fail('REFERENCE_INVALID', '/recipe/provenance', '缺少覆盖整个方案的根级来源说明');
  return { valid: errors.length === 0, playable: errors.length === 0 && blockers.length === 0, errors, blockers };
}
