# Novel Planner - by Writeller 0.3.2

[Deutsch](#deutsch) · [English](#english) · [writeller.com](https://www.writeller.com)

## Deutsch

**Schreibprojekte gezielt löschen.**

- In der Schreibübersicht **Weitere Projektaktionen (⋯) → Projekt löschen** wählen. Auch über die Befehlspalette erreichbar.
- Der Dialog zeigt Projektname und Umfang. Zur Bestätigung den genauen Projektnamen eingeben.
- Zugeordnete Markdown-Notizen, auch nach Verschieben, und die privaten Projektdaten werden nach Obsidians Einstellung für gelöschte Dateien entfernt. Andere Projekte, nicht zugeordnete Dateien und vorhandene Exporte bleiben erhalten. Nur leere Ordner werden aufgeräumt.
- Vor dem ersten Entfernen werden die Originale gesichert und die Quellen erneut geprüft. Eine unterbrochene Löschung lässt sich über **Unterbrochenen Vorgang wiederherstellen** zurücknehmen; nachträglich fremd bearbeitete Dateien bleiben erhalten.
- Temporäre Sicherungen werden nach Abschluss ebenfalls über Obsidians Löschpräferenz entfernt. Eine abgeschlossene Löschung hat keinen eigenen Rückgängig-Befehl; Papierkorb oder vorhandenen Export verwenden.

**Update:** `writeller-0.3.2.zip` unter Assets herunterladen und die Plugin-Dateien in `<Vault>/.obsidian/plugins/writeller/` ersetzen. Einstellungen in `data.json` behalten und Obsidian neu laden. Mindestversion: Obsidian 1.14.5.

Die neuen Lösch- und Wiederherstellungsfälle sind in isolierten Speicher-/DOM-Tests geprüft. Native Desktop-/Mobile-Abnahme bleibt offen.

## English

**Delete writing projects explicitly.**

- Choose **More project actions (⋯) → Delete project** in the writing overview, or use the command palette.
- The confirmation shows the project name and scope. Enter the exact project name to continue.
- Assigned Markdown notes, including moved notes, and private project data are removed using your Obsidian deleted-file preference. Other projects, unassigned files and existing exports are kept. Only empty folders are cleaned up.
- All originals are backed up and fresh source checks run before removal. Use **Recover interrupted operation** after an interruption; externally edited files are preserved.
- Temporary backups are removed after completion using the same native deleted-file preference. Completed deletions have no plugin undo; use your trash or a saved export.

**Update:** Download `writeller-0.3.2.zip` from Assets, replace the plugin files in `<vault>/.obsidian/plugins/writeller/`, retain settings in `data.json` and reload Obsidian. Minimum: Obsidian 1.14.5.

Deletion and recovery cases are covered by isolated storage/DOM tests. Native desktop/mobile acceptance remains pending.

The public Writeller Exchange 1.0.0 contract is unchanged. / Der öffentliche Writeller Exchange 1.0.0-Vertrag bleibt unverändert.

[Changelog](https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/CHANGELOG.md)
