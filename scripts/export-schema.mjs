import { writeFile } from 'node:fs/promises';
import { recipeSchema } from '../src/config/schema.js';
await writeFile(new URL('../schemas/recipe-v1.schema.json', import.meta.url), JSON.stringify(recipeSchema, null, 2) + '\n');
