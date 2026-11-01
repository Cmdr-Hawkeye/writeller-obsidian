import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { reviewAudit } from './audit-review.mjs';

/** Runs npm through its actual JS entrypoint on Windows and Linux without a command shell. */
function audit(runtimeOnly) {
  if (!process.env.npm_execpath) throw new Error('Audit über npm run audit:release starten');
  const args = [process.env.npm_execpath, 'audit', '--json', '--fetch-retries=0', '--fetch-timeout=30000'];
  if (runtimeOnly) args.push('--omit=dev');
  try { return JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 8 * 1024 ** 2 })); }
  catch (error) {
    if (error.status !== 1 || !error.stdout) throw error;
    return JSON.parse(error.stdout);
  }
}
const runtime = audit(true);
const all = audit(false), lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
await mkdir('test-results', { recursive: true });
await writeFile('test-results/audit.json', JSON.stringify({ runtime, all }, null, 2));
if (runtime.error || !runtime.metadata?.vulnerabilities || runtime.metadata.vulnerabilities.total !== 0) throw new Error('Laufzeit-Audit fehlgeschlagen');
const reviewed = reviewAudit(all, lock);
console.log(`Laufzeit: keine bekannten Schwachstellen. Entwicklungswerkzeuge: ${reviewed} Hinweise ausschließlich zur geprüften GHSA-g3hv-75wg-m249-Ausnahme (docs/development-audit.md).`);
