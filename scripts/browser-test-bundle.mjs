import { build } from 'esbuild';
import { browserLibraries } from './browser-libraries.mjs';

// No runtime external or Node polyfill is permitted in this independently executed test bundle.
await build({ entryPoints: ['tests/browser/entry.ts'], outfile: 'test-results/browser-contract.cjs',
  bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', plugins: [browserLibraries] });
