import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';

/** Lists repository documentation only; generated output and personal vaults are never scanned. */
async function markdownFiles(folder) {
  const paths = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await markdownFiles(path)); else if (path.endsWith('.md')) paths.push(path);
  }
  return paths;
}
/** Collects semantic Markdown links and static HTML image/anchor attributes, excluding code examples. */
function links(node) {
  const result = [];
  if (node.type === 'link' || node.type === 'image') result.push(node.url);
  if (node.type === 'html') for (const match of node.value.matchAll(/(?:src|href)=["']([^"']+)["']/g)) result.push(match[1]);
  for (const child of node.children ?? []) result.push(...links(child));
  return result;
}
const root = resolve('.'), files = ['README.md', 'README.en.md', 'CONTRIBUTING.md', 'CHANGELOG.md', ...await markdownFiles('docs')];
let checked = 0;
for (const file of files) {
  // The supplied specification remains an independent immutable input, not rewritten documentation.
  if (file === 'docs/WRITELLER-EXCHANGE-SPEC.md') continue;
  for (const link of links(fromMarkdown(await readFile(file, 'utf8')))) {
    if (!link || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(link)) continue;
    const path = resolve(dirname(resolve(file)), decodeURIComponent(link.split(/[?#]/)[0]));
    if (relative(root, path).startsWith('..')) throw new Error(`${file}: Link außerhalb des Repositorys: ${link}`);
    try { await access(path); } catch { throw new Error(`${file}: lokales Linkziel fehlt: ${link}`); }
    checked++;
  }
}
console.log(`${checked} lokale Dokumentationslinks und Bilder geprüft.`);
