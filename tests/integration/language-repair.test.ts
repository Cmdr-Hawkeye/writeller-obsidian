import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { readExchange } from '../../src/exchange/codec';
import { planLanguage } from '../../src/projects/language-plan';
import { LanguageJournalService } from '../../src/storage/language-journal';
import { pendingJournals } from '../../src/storage/recovery-index';
import { sameExceptLinkTargets } from '../../src/projects/link-equivalence';
import { setLanguage } from '../../src/i18n/language';
import { text, utf8 } from '../../src/storage/vault-port';

/** Keeps each test independent of a preceding UI-language selection. */
beforeEach(() => setLanguage('de'));
/** Never leaks a locale into unrelated test files. */
afterEach(() => setLanguage('de'));

/** Imitates Obsidian's own link update after a folder rename: link destinations become the shortest form. */
function obsidianLinkUpdates(vault: FakeVault): { failBack: boolean } {
  const control = { failBack: false }, move = vault.moveFolder.bind(vault);
  vault.moveFolder = async (from: string, to: string) => {
    if (control.failBack && from.split('/').length > 1 && !/(?:Writing Projects|Exports)$/.test(from)) throw new Error('host rename failed');
    await move(from, to);
    for (const [path, bytes] of [...vault.data]) if (path.endsWith('.md')) {
      const next = text(bytes).replace(/\]\(<([^>]*\/)([^/>]+)>\)/g, '](<$2>)');
      if (next !== text(bytes)) vault.data.set(path, utf8(next));
    }
  };
  return control;
}
/** Imports the independent harbor fixture into an isolated German-language vault. */
async function setup() {
  const vault = new FakeVault(), settings = { ...defaultSettings, language: 'de' as const, folderLanguage: 'de' as const };
  const service = new TransferCoordinator(vault, settings), pkg = await readExchange(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url)));
  await service.commit(await service.resolve(await service.previewImport(pkg, 'new')));
  return { vault, service };
}
/** Snapshot of every visible file except the switch's own backup folder. */
function contents(vault: FakeVault): Map<string, string> {
  return new Map([...vault.data].filter(([path]) => !path.includes('/language-changes/')).map(([path, bytes]) => [path, Buffer.from(bytes).toString('base64')]));
}

describe('Sprachwechsel trotz Obsidians eigener Linkaktualisierung', () => {
  it('erkennt reine Linkzieländerungen, aber keine Textänderungen', () => {
    expect(sameExceptLinkTargets('Siehe [Intro](<A/B/01 - Intro.md>) heute.', 'Siehe [Intro](<01 - Intro.md>) heute.')).toBe(true);
    expect(sameExceptLinkTargets('[[Ordner/Lina|Lina]] kommt.', '[[Lina|Lina]] kommt.')).toBe(true);
    expect(sameExceptLinkTargets('Siehe [Intro](<A/Intro.md>) heute.', 'Siehe [Intro](<Intro.md>) morgen.')).toBe(false);
    expect(sameExceptLinkTargets('Siehe [Intro](<A/Intro.md>).', 'Siehe [Anfang](<A/Intro.md>).')).toBe(false);
  });
  it('schließt den Wechsel ab, wenn Obsidian Links beim Umbenennen selbst anpasst', async () => {
    const { vault, service } = await setup(); obsidianLinkUpdates(vault);
    const plan = await planLanguage(service, 'en');
    expect(plan.writes.some(write => write.path.endsWith('.md'))).toBe(true);
    await new LanguageJournalService(vault).commit(plan, { ...service.settings }, async () => { Object.assign(service.settings, plan.settings); });
    expect(await pendingJournals(vault)).toEqual([]);
    expect(vault.files().some(file => file.path.includes('/Characters/'))).toBe(true);
  });
  it('nimmt einen gescheiterten Wechsel trotz Obsidian-Linkänderungen vollständig zurück', async () => {
    const { vault, service } = await setup(); obsidianLinkUpdates(vault);
    const before = contents(vault), plan = await planLanguage(service, 'en');
    await expect(new LanguageJournalService(vault).commit(plan, { ...service.settings }, async () => { throw new Error('save failed'); })).rejects.toThrow('save failed');
    expect(await pendingJournals(vault)).toEqual([]);
    expect(contents(vault)).toEqual(before);
  });
  it('repariert einen halb zurückgenommenen Wechsel per Reparatur und behält echte Textänderungen', async () => {
    const { vault, service } = await setup(), control = obsidianLinkUpdates(vault);
    const before = contents(vault), settings = { ...service.settings }, plan = await planLanguage(service, 'en');
    const edited = plan.writes.find(write => write.path.endsWith('.md'))!;
    await expect(new LanguageJournalService(vault).commit(plan, settings, async () => { control.failBack = true; throw new Error('save failed'); })).rejects.toThrow();
    const [journal] = await pendingJournals(vault); expect(journal?.projectId).toBe('language');
    expect(vault.files().some(file => file.path.includes('/Characters/'))).toBe(true);
    control.failBack = false;
    const other = [...vault.data.keys()].find(path => path.endsWith('.md') && !path.includes('/language-changes/') && text(vault.data.get(path)!).includes('](<'))!;
    vault.data.set(other, utf8(text(vault.data.get(other)!) + '\nEin eigener neuer Satz.\n'));
    const result = await new LanguageJournalService(vault).repair(journal!.path);
    expect(result.conflicts).toEqual([]); expect(result.settings).toEqual(settings);
    expect(await pendingJournals(vault)).toEqual([]);
    expect(vault.files().some(file => file.path.includes('/Characters/'))).toBe(false);
    const kept = [...vault.data].filter(([path, bytes]) => path.endsWith('.md') && !path.includes('/language-changes/') && text(bytes).includes('Ein eigener neuer Satz.')).map(([path]) => path);
    expect(kept).toHaveLength(1); expect(result.kept).toHaveLength(1); expect(kept[0]!.split('/').at(-1)).toBe(other.split('/').at(-1));
    const after = contents(vault);
    for (const [path, value] of before) if (path !== kept[0]) expect(after.get(path), path).toBe(value);
    expect(edited.from).toBeTruthy();
  });
});
