// Single source of truth; also exported as standard JSON Schema draft 2020-12.
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = (maxLength = 200) => ({ type: 'string', minLength: 1, maxLength });
const number = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => ({ type: 'number', minimum, maximum });
const integer = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => ({ type: 'integer', minimum, maximum });
const bool = { type: 'boolean' }, nil = { type: 'null' };
const lit = value => ({ const: value });
const choice = (...values) => ({ enum: values });
const union = (...oneOf) => ({ oneOf });
const array = (items, minItems = 0, maxItems = 100) => ({ type: 'array', items, minItems, maxItems });
const ref = name => ({ $ref: `#/$defs/${name}` });
const assetRef = obj({ id: str(), revision: integer(1) });
const params = union(
  obj({ pan: number(-1, 1), filter: union(nil, obj({ kind: choice('lowpass', 'highpass'), cutoffHz: number(0.001) })) }),
  obj({ pan: number(-1, 1) }),
  obj({ centerHz: number(0.001), beatHz: number(0.001) }),
);
const stage = durationMs => obj({
  id: str(), label: str(80), durationMs, fadeInMs: integer(0, 86400000), fadeOutMs: integer(0, 86400000),
  layerStates: array(obj({ layerId: str(), enabled: bool, gain: number(0, 1), params }), 1, 4),
  rhythmState: union(nil, obj({ enabled: bool, rateHz: number(0.001), depth: number(0, 1) })),
});
export const recipeSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:wave-platform:recipe:1',
  ...obj({ format: lit('wave-platform.recipe'), schemaVersion: lit(1), exampleOnly: bool, recipe: ref('recipe') }),
  $defs: {
    recipe: obj({
      id: str(), revision: integer(1), title: str(80), description: { type: 'string', maxLength: 2000 },
      scenes: { ...array(choice('focus', 'study', 'relax', 'rest', 'sleep', 'custom'), 1, 6), uniqueItems: true },
      createdAt: str(40), updatedAt: str(40), derivedFrom: union(nil, assetRef), capabilityProfile: str(),
      layers: array(ref('layer'), 1, 4),
      rhythm: union(obj({ kind: lit('none') }), obj({ kind: lit('binaural'), layerId: str() }),
        obj({ kind: lit('amplitudeModulation'), targetLayerId: str(), waveform: lit('sine') }),
        obj({ kind: lit('amplitudeModulation'), targetLayerId: str(), waveform: lit('sine'), processorVersion: str(), band: obj({lowHz:number(20),highHz:number(20)}) })),
      timeline: union(obj({ kind: lit('finite'), repeatCount: integer(1, 100), stages: array(stage(integer(1, 86400000)), 1, 32) }),
        obj({ kind: lit('continuous'), stages: array(stage(nil), 1, 1) })),
      completion: obj({ cue: union(nil, assetRef), gain: number(0, 1) }),
      provenance: array(obj({ path: { type: 'string', maxLength: 500 }, kind: choice('research', 'design', 'user'),
        referenceId: union(nil, str()), locator: union(nil, str(500)), note: { type: 'string', maxLength: 2000 } }), 1, 256),
    }),
    layer: obj({ id: str(), label: str(80), source: union(
      obj({ kind: lit('noise'), color: choice('white', 'pink', 'brown'), generatorVersion: str(), seed: integer(0, 4294967295), channels: choice('mono', 'independentStereo') }),
      obj({ kind: lit('binaural'), oscillatorVersion: str(), highEar: choice('left', 'right') }),
      obj({ kind: lit('asset'), assetRef, playback: union(
        obj({ mode: lit('once'), startMs: integer() }),
        obj({ mode: lit('loop'), startMs: integer(), loopStartMs: integer(), loopEndMs: integer(1), crossfadeMs: integer() }),
      ) }),
    ) }),
  },
};
