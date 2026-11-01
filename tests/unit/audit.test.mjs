import { describe, expect, it } from 'vitest';
import { reviewAudit } from '../../scripts/audit-review.mjs';

/** Isolates the exact advisory decision without relying on mutable registry responses. */
function fixture() {
  return { report: { metadata: { vulnerabilities: { total: 2 } }, vulnerabilities: {
    minimatch: { severity: 'moderate', nodes: ['node_modules/minimatch'], via: [{ name: 'minimatch', severity: 'moderate', url: 'https://github.com/advisories/GHSA-g3hv-75wg-m249' }] },
    eslint: { severity: 'moderate', nodes: ['node_modules/eslint'], via: ['minimatch'] }
  } }, lock: { packages: { 'node_modules/minimatch': { dev: true }, 'node_modules/eslint': { dev: true } } } };
}
describe('scoped development advisory review', () => {
  it('accepts only the reviewed advisory and its dev-only dependency chain', () => {
    const { report, lock } = fixture(); expect(reviewAudit(report, lock)).toBe(2);
  });
  it('rejects a known advisory if any affected package ships at runtime', () => {
    const { report, lock } = fixture(); lock.packages['node_modules/minimatch'].dev = false;
    expect(() => reviewAudit(report, lock)).toThrow('Nicht freigegebene');
  });
  it('rejects new advisories and stronger severity without changing a release threshold', () => {
    const { report, lock } = fixture(); report.vulnerabilities.minimatch.via[0].url = 'https://github.com/advisories/GHSA-unknown';
    expect(() => reviewAudit(report, lock)).toThrow('Nicht freigegebene');
    const next = fixture(); next.report.vulnerabilities.minimatch.severity = 'high';
    expect(() => reviewAudit(next.report, next.lock)).toThrow('Nicht freigegebene');
  });
  it('rejects unavailable or malformed audit responses', () => {
    expect(() => reviewAudit({ error: { code: 'ENETWORK' } }, {})).toThrow('Unvollständiger');
  });
  it('handles dev-tool peer cycles only when they reach the reviewed advisory', () => {
    const { report, lock } = fixture(); report.vulnerabilities.eslint.via.push('eslint');
    expect(reviewAudit(report, lock)).toBe(2);
    report.vulnerabilities.eslint.via = ['eslint'];
    expect(() => reviewAudit(report, lock)).toThrow('Nicht freigegebene');
  });
});
