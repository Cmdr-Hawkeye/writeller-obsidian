# Novel Planner - by Writeller 0.3.6

[Deutsch](#deutsch) · [English](#english) · [writeller.com](https://www.writeller.com)

## Deutsch

**Sprachwechsel der Ordner: Fehler behoben und Reparatur.**

- **Behoben:** Ein Sprachwechsel der Strukturordner scheiterte, wenn Obsidian beim Umbenennen Links in Notizen selbst aktualisierte (Einstellung „Interne Links automatisch aktualisieren“). Die automatische Rücknahme blieb dann halb stehen und blockierte alle Projekte. Reine Änderungen von Linkzielen gelten jetzt nicht mehr als fremde Bearbeitung.
- **Neu: Sprachwechsel reparieren.** Hängt ein Wechsel fest, zeigt die Übersicht einen Button mit Erklärung; derselbe Befehl steht in der Befehlspalette. Die Reparatur benennt jeden Strukturordner zurück, dessen vorheriger Name frei ist, setzt vom Plugin oder von Obsidian geänderte Links auf den gesicherten Stand und lässt Notizen mit eigenen Textänderungen unverändert; diese werden gemeldet. Alle Originale bleiben gesichert.
- **Betroffen?** Wenn die Übersicht „Dieses Projekt braucht eine Überprüfung“ und wiederholt „Der Sprachwechsel ist noch nicht abgeschlossen“ meldet: nach dem Update **Sprachwechsel reparieren** wählen.

**Update:** `writeller-0.3.6.zip` unter Assets herunterladen und die Plugin-Dateien in `<Vault>/.obsidian/plugins/writeller/` ersetzen. Einstellungen in `data.json` behalten und Obsidian neu laden. Mindestversion: Obsidian 1.14.5.

Die Korrektur ist in Integrationstests mit simulierter Obsidian-Linkaktualisierung geprüft: erfolgreicher Wechsel, vollständige Rücknahme und Reparatur eines halb zurückgenommenen Wechsels. Eine vollständige native Desktop-/Mobile-Abnahme bleibt offen.

## English

**Folder language switch: bug fix and repair.**

- **Fixed:** A language switch of the structure folders failed when Obsidian updated links in notes by itself while renaming (setting “Automatically update internal links”). The automatic rollback then stopped halfway and blocked all projects. Pure link-target changes no longer count as foreign edits.
- **New: Repair language switch.** If a switch is stuck, the overview shows a button with an explanation; the same command is in the command palette. The repair renames every structure folder back whose previous name is free, resets links changed by the plugin or by Obsidian to the backed-up state, and leaves notes with your own text changes untouched; those are reported. All originals stay backed up.
- **Affected?** If the overview says “This project needs a check” and repeatedly reports that the language switch is not finished: after updating, choose **Repair language switch**.

**Update:** Download `writeller-0.3.6.zip` from Assets, replace the plugin files in `<vault>/.obsidian/plugins/writeller/`, retain settings in `data.json` and reload Obsidian. Minimum: Obsidian 1.14.5.

The fix is covered by integration tests with simulated Obsidian link updates: successful switch, complete rollback and repair of a half rolled-back switch. Full native desktop/mobile acceptance remains pending.

The public Writeller Exchange 1.0.0 contract is unchanged. / Der öffentliche Writeller Exchange 1.0.0-Vertrag bleibt unverändert.

[Changelog](https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/CHANGELOG.md)
