import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Persist a machine-readable local report while keeping console results concise. */
export default defineConfig({ resolve: { alias: { obsidian: fileURLToPath(new URL('./tests/helpers/obsidian-ui.ts', import.meta.url)) } },
  test: { reporters: ['default', 'json'], outputFile: { json: 'test-results/vitest.json' } } });
