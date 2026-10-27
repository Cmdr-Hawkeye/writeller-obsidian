import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Removes unused jpeg-js IO and Node allocation branches from the browser-only decoder. */
export const browserLibraries = {
  name: 'offline-jpeg-decoder',
  setup(build) {
    // The default browser entry uses innerHTML to decode entities; the data-table entry is pure JS.
    build.onResolve({ filter: /^decode-named-character-reference$/ }, () => ({ path: require.resolve('decode-named-character-reference') }));
    build.onLoad({ filter: /jpeg-js[/\\]lib[/\\]decoder\.js$/ }, async args => {
      let contents = await readFile(args.path, 'utf8');
      const loader = / {4}load: function load\(path\) \{[\s\S]*? {4}\},\r?\n {4}parse:/;
      if (!loader.test(contents) || !contents.includes('Buffer.alloc(bytesNeeded)')) throw new Error('jpeg-js upstream changed: browser transform must be reviewed');
      contents = contents.replace(loader, '    parse:').replace('Buffer.alloc(bytesNeeded)', 'new Uint8Array(bytesNeeded)');
      return { contents, loader: 'js' };
    });
  }
};
