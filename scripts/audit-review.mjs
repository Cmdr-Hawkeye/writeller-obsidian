// One reviewed dev-tool advisory; runtime dependencies never receive an exception.
const reviewed = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';
/** Accepts only the reviewed minimatch advisory through development-only dependency paths. */
export function reviewAudit(report, lock) {
  if (report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities) throw new Error('Unvollständiger npm-Auditbericht');
  const vulnerabilities = report.vulnerabilities;
  /** Checks every advisory edge; peer-dependency cycles may point back to an already checked node. */
  const allowed = (name, seen = new Set()) => {
    const item = vulnerabilities[name];
    if (!item || item.severity !== 'moderate' || !item.nodes?.length || !item.via?.length) return false;
    if (!item.nodes.every(path => lock.packages?.[path]?.dev === true)) return false;
    if (seen.has(name)) return true;
    const next = new Set([...seen, name]);
    return item.via.every(via => typeof via === 'string' ? allowed(via, next) : via.url === reviewed && via.name === 'minimatch' && via.severity === 'moderate');
  };
  /** Rejects orphan cycles: every allowed package must reach a real reviewed advisory leaf. */
  const reachesAdvisory = (name, seen = new Set()) => {
    if (seen.has(name)) return false;
    const next = new Set([...seen, name]);
    return vulnerabilities[name]?.via?.some(via => typeof via === 'string' ? reachesAdvisory(via, next) : via.url === reviewed) ?? false;
  };
  const names = Object.keys(vulnerabilities);
  if (report.metadata.vulnerabilities.total !== names.length) throw new Error('Unvollständiger npm-Auditbericht');
  const rejected = names.filter(name => !allowed(name) || !reachesAdvisory(name));
  if (rejected.length) throw new Error(`Nicht freigegebene Abhängigkeitshinweise: ${rejected.join(', ')}`);
  return names.length;
}
