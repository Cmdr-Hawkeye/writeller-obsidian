import { Window } from 'happy-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { App, Plugin } from 'obsidian';
import { createUiApp, installDomHelpers } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { defaultSettings } from '../../src/projects/layout';
import { WritellerSettingsTab } from '../../src/ui/settings';
import { WhatsNewModal, compareVersions, hasReleaseNote, releaseNotesPlan, releaseNotesSince, supportUrl } from '../../src/ui/whats-new';
import { pluginVersion } from '../../src/domain/version';
import { setLanguage } from '../../src/i18n/language';

/** Controlled DOM only; native modal rendering remains a manual Obsidian check. */
beforeEach(() => { const win = new Window(); vi.stubGlobal('window', win); vi.stubGlobal('document', win.document); installDomHelpers(win as unknown as globalThis.Window); setLanguage('de'); });
/** Restores independent tests' globals. */
afterEach(() => { vi.unstubAllGlobals(); setLanguage('de'); });

describe('Neuigkeiten nach Updates', () => {
  it('pflegt für jede veröffentlichte Version eigene Hinweise', () => {
    expect(hasReleaseNote(pluginVersion)).toBe(true);
  });
  it('vergleicht Versionen numerisch statt als Text', () => {
    expect(compareVersions('0.3.10', '0.3.9')).toBeGreaterThan(0); expect(compareVersions('0.3.3', '0.3.3')).toBe(0);
    expect(compareVersions('kaputt', '0.0.1')).toBeLessThan(0);
  });
  it('zeigt bei Neuinstallation nichts, nach einem Update einmal und nie bei abgeschalteter Einstellung', () => {
    expect(releaseNotesPlan(false, undefined, true, pluginVersion)).toEqual({ record: true, show: false });
    expect(releaseNotesPlan(true, undefined, true, pluginVersion)).toEqual({ record: true, show: true });
    expect(releaseNotesPlan(true, '0.3.2', true, pluginVersion)).toEqual({ record: true, show: true });
    expect(releaseNotesPlan(true, pluginVersion, true, pluginVersion)).toEqual({ record: false, show: false });
    expect(releaseNotesPlan(true, '0.3.2', false, pluginVersion)).toEqual({ record: true, show: false });
    expect(releaseNotesSince(pluginVersion, pluginVersion)).toEqual([]);
  });
  it('rendert nur Text, einen Ko-fi-Link und eine Abschaltmöglichkeit', async () => {
    const disable = vi.fn(async () => {}), modal = new WhatsNewModal({} as App, pluginVersion, '0.3.2', disable); modal.open();
    const el = document.querySelector('.modal')!;
    expect(el.querySelector('h2')?.textContent).toBe(`Neu in Novel Planner ${pluginVersion}`);
    expect(el.querySelector<HTMLAnchorElement>('a.writeller-kofi')?.getAttribute('href')).toBe(supportUrl);
    expect(el.querySelectorAll('img, script, iframe')).toHaveLength(0);
    expect(el.querySelectorAll('li').length).toBeGreaterThan(0);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Nach Updates nicht mehr zeigen')!.click();
    await vi.waitFor(() => expect(document.querySelector('.modal')).toBeNull()); expect(disable).toHaveBeenCalledOnce();
  });
  it('bietet beim manuellen Aufruf keine Abschaltung an und übersetzt ins Englische', () => {
    setLanguage('en'); new WhatsNewModal({} as App, pluginVersion, undefined).open();
    const el = document.querySelector('.modal')!;
    expect(el.querySelector('h2')?.textContent).toBe(`New in Novel Planner ${pluginVersion}`);
    expect(el.textContent).toContain('Support on Ko-fi'); expect(el.textContent).not.toContain("Don't show after updates");
  });
  it('speichert den Schalter in den Einstellungen und liest fehlende Werte als eingeschaltet', async () => {
    const { app } = createUiApp(new FakeVault()), settings = { ...defaultSettings }, save = vi.fn(async () => {});
    const tab = new WritellerSettingsTab(app, {} as Plugin, settings, save);
    expect(tab.getControlValue('showReleaseNotes')).toBe(true);
    await tab.setControlValue('showReleaseNotes', false); expect(settings.showReleaseNotes).toBe(false); expect(save).toHaveBeenCalledOnce();
    await expect(tab.setControlValue('showReleaseNotes', 'nein')).rejects.toThrow();
  });
});
