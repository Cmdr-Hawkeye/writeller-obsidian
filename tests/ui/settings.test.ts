import { Window } from 'happy-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { createUiApp, installDomHelpers } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { defaultSettings } from '../../src/projects/layout';
import { WritellerSettingsTab } from '../../src/ui/settings';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { createProject } from '../../src/objects/factory';

/** Supplies controlled UI methods only; actual Obsidian search rendering is a native-host check. */
beforeEach(() => { const win = new Window(); vi.stubGlobal('window', win); vi.stubGlobal('document', win.document); installDomHelpers(win as unknown as globalThis.Window); });
/** Restores independent tests' globals. */
afterEach(() => { vi.unstubAllGlobals(); });
/** Uses the real preference object shared by the settings tab and persistence coordinator. */
function setup(save = vi.fn(async () => {})) {
  const vault = new FakeVault(), { app } = createUiApp(vault), settings = { ...defaultSettings };
  return { vault, settings, save, tab: new WritellerSettingsTab(app, {} as Plugin, settings, save), service: new TransferCoordinator(vault, settings) };
}
describe('native durchsuchbare Einstellungsdefinitionen', () => {
  it('liefert native Gruppen und durchsuchbare Steuerelemente anstelle manueller HTML-Überschriften', () => {
    const { tab } = setup(), definitions = tab.getSettingDefinitions();
    expect(definitions[0]).toMatchObject({ type: 'group', heading: 'Dein Schreibbereich', items: expect.arrayContaining([
      expect.objectContaining({ name: 'Schreibprojekte ablegen unter', control: expect.objectContaining({ type: 'folder', key: 'projectFolder' }) }),
      expect.objectContaining({ name: 'Technische Informationen anzeigen', control: expect.objectContaining({ type: 'toggle', key: 'showTechnicalInfo' }) })
    ]) });
    expect(tab.getControlValue('projectFolder')).toBe('Schreibprojekte'); expect(tab.getControlValue('unknown')).toBeUndefined();
  });
  it('speichert native Control-Änderungen und verwendet den neuen Ordner beim tatsächlichen Anlegen', async () => {
    const { tab, service, vault, save } = setup(); await tab.setControlValue('projectFolder', 'Meine Bücher');
    const pkg = createProject('Ein Roman'); await service.commit(await service.previewSave(pkg, null));
    expect(vault.data.has('Meine Bücher/Ein Roman/Ein Roman.md')).toBe(true); expect(save).toHaveBeenCalledOnce();
  });
  it('weist überlappende Pfade und falsche Datentypen ohne Änderung oder Speicherung zurück', async () => {
    const { tab, settings, save } = setup();
    await expect(tab.setControlValue('projectFolder', 'Exporte/Romane')).rejects.toThrow();
    await expect(tab.setControlValue('showTechnicalInfo', 'true')).rejects.toThrow();
    expect(settings.projectFolder).toBe('Schreibprojekte'); expect(settings.showTechnicalInfo).toBe(false); expect(save).not.toHaveBeenCalled();
  });
  it('stellt bei einem Speicherfehler die bisherigen gemeinsamen Einstellungen wieder her', async () => {
    const { tab, settings } = setup(vi.fn(async () => { throw new Error('Speichern fehlgeschlagen'); }));
    await expect(tab.setControlValue('showTechnicalInfo', true)).rejects.toThrow('Speichern fehlgeschlagen'); expect(settings.showTechnicalInfo).toBe(false);
  });
});
