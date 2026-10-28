import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';

/** Enumerates source files only, keeping fixtures and generated validators independent. */
async function sources(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await sources(path)); else if (path.endsWith('.ts')) result.push(path);
  }
  return result;
}
const dictionary = {};
for (const name of ['core', 'ui']) {
  const source = await readFile(`src/i18n/en-${name}.json`, 'utf8'), entries = JSON.parse(source);
  if (source.split('\n').length > 300 || Object.keys(entries).length > 300) throw new Error(`en-${name}: Übersetzungskatalog aufteilen`);
  for (const [key, value] of Object.entries(entries)) {
    if (Object.hasOwn(dictionary, key) || typeof value !== 'string' || !value.trim()) throw new Error(`Doppelte oder ungültige Übersetzung: ${key}`);
    const slots = text => [...new Set([...text.matchAll(/\{\d+\}/g)].map(match => match[0]))].sort().join(',');
    if (slots(key) !== slots(value)) throw new Error(`Übersetzungsplatzhalter fehlen: ${key}`);
    dictionary[key] = value;
  }
}
let count = 0;
for (const path of await sources('src')) {
  const file = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
  /** Checks static text at build time; interpolated user values never become translation keys. */
  const visit = node => {
    let key;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tr' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) key = node.arguments[0].text;
    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'tr') {
      const template = node.template;
      key = ts.isNoSubstitutionTemplateLiteral(template) ? template.text : template.head.text + template.templateSpans.map((span, i) => `{${i}}` + span.literal.text).join('');
    }
    if (key !== undefined) { if (!Object.hasOwn(dictionary, key)) throw new Error(`${path}: Übersetzung fehlt: ${key}`); count++; }
    ts.forEachChild(node, visit);
  };
  visit(file);
}
console.log(`${count} übersetzte Quelltexte und ${Object.keys(dictionary).length} Katalogeinträge einschließlich Platzhaltern geprüft.`);
