// Evaluates only the keywords used by our bundled schema. Unknown schema keywords
// throw: this is not advertised as a general-purpose JSON Schema implementation.
const supported = new Set('$schema $id $defs $ref type const enum oneOf properties required additionalProperties items minItems maxItems uniqueItems minLength maxLength minimum maximum'.split(' '));
export function checkSchema(value, schema, root = schema, path = '') {
  for (const key of Object.keys(schema)) if (!supported.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
  const error = message => [{ code: 'FORMAT_INVALID', path, message }];
  if (schema.$ref) {
    const name = schema.$ref.match(/^#\/\$defs\/([^/]+)$/)?.[1];
    if (!name || !root.$defs?.[name]) throw new Error('Unresolved bundled schema reference');
    return checkSchema(value, root.$defs[name], root, path);
  }
  if ('const' in schema && value !== schema.const) return error('固定值不匹配');
  if (schema.enum && !schema.enum.includes(value)) return error('未知选项');
  if (schema.oneOf) return schema.oneOf.filter(s => checkSchema(value, s, root, path).length === 0).length === 1 ? [] : error('字段不符合任何唯一支持的结构');
  if (schema.type) {
    const valid = schema.type === 'null' ? value === null : schema.type === 'array' ? Array.isArray(value)
      : schema.type === 'object' ? value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
      : schema.type === 'integer' ? Number.isSafeInteger(value) : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === schema.type;
    if (!valid) return error(`需要 ${schema.type}`);
  }
  if (typeof value === 'number' && (value < schema.minimum || value > schema.maximum)) return error('数值越界');
  if (typeof value === 'string' && ([...value].length < (schema.minLength ?? 0) || [...value].length > (schema.maxLength ?? Infinity))) return error('文本长度越界');
  if (Array.isArray(value)) {
    if (value.length < schema.minItems || value.length > schema.maxItems) return error('数组数量越界');
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) return error('重复选项');
    return value.flatMap((v, i) => checkSchema(v, schema.items, root, `${path}/${i}`));
  }
  if (schema.properties) {
    const errors = [];
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(...error(`缺少字段 ${key}`));
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key)) errors.push(...error(`未知字段 ${key}`));
      else errors.push(...checkSchema(value[key], schema.properties[key], root, `${path}/${key}`));
    }
    return errors;
  }
  return [];
}
