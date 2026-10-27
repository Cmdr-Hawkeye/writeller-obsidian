import { build, context } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { browserLibraries } from './scripts/browser-libraries.mjs';

// Browser targeting catches accidental Node dependencies before a mobile release.
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  format: 'cjs', platform: 'browser', target: 'es2022', outfile: 'main.js',
  sourcemap: false, minify: false, metafile: true, legalComments: 'inline', plugins: [browserLibraries]
};
if (process.argv.includes('--watch')) {
  await (await context(options)).watch();
} else {
  const result = await build(options);
  await writeFile('build-meta.json', JSON.stringify(result.metafile, null, 2));
  const { verifyBundle } = await import('./scripts/structure.mjs');
  await verifyBundle(result.metafile);
}
