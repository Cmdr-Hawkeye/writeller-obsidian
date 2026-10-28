import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { _ } from 'ajv/dist/compile/codegen/index.js';
import { isInstant } from '../src/exchange/instant.mjs';

/** Precompiles the trusted schema during the build; plugin startup executes only static validators. */
export async function generateValidators() {
  const schema = JSON.parse(await readFile('src/exchange/writeller-exchange.schema.json', 'utf8'));
  // Keep the public artifact byte-identical. Its established linear Base64 filter avoids
  // V8 regexp stack limits; images.ts still checks length, padding and complete bytes.
  schema.$defs.attachment.properties.data.pattern = '^[A-Za-z0-9+/]*={0,2}$';
  const ajv = new Ajv2020({ allErrors: false, strict: true, ownProperties: true, validateFormats: true, inlineRefs: false,
    code: { source: true, esm: true, formats: _`({"date-time": {type: "string", validate: isInstant}})` } });
  ajv.addFormat('date-time', { type: 'string', validate: isInstant }); ajv.addSchema(schema);
  const names = { validateProject: 'project', validateChapter: 'chapter', validateScene: 'scene', validateCatalog: 'catalogItem',
    validateRelationship: 'relationship', validateNote: 'note', validateResearch: 'researchItem' };
  const validators = { validateExchange: schema.$id, ...Object.fromEntries(Object.entries(names).map(([name, ref]) => [name, `${schema.$id}#/$defs/${ref}`])) };
  const source = 'import { isInstant } from "./src/exchange/instant.mjs";\n' + standaloneCode(ajv, validators);
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'validators.ajv.mjs' },
    bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, legalComments: 'inline' });
  const output = result.outputFiles[0].text;
  if (/\beval\s*\(|new\s+Function\s*\(/.test(output)) throw new Error('Dynamische Codeausführung im erzeugten Validator');
  await mkdir('.generated', { recursive: true });
  const path = '.generated/validators.mjs';
  if (await readFile(path, 'utf8').catch(() => '') !== output) await writeFile(path, output);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await generateValidators();
