# Novel Planner - by Writeller 0.3.7

[Deutsch](#deutsch) · [English](#english) · [writeller.com](https://www.writeller.com)

## Deutsch

**Objekte regulär löschen und fehlende Verweise reparieren.**

- **Neu: Löschen…** Figuren, Orte, Szenen, Kapitel und andere Objekte lassen sich über das Aktionsmenü (⋯), das Dateimenü einer Notiz oder die Befehlspalette löschen. Der Dialog nennt vorher, was sich mitändert. Alle Verweise werden im selben geprüften Speichervorgang aufgeräumt: Szenen verlieren die Perspektive, Szenen eines gelöschten Kapitels sind danach keinem Kapitel mehr zugeordnet, Beziehungen zum Objekt werden mit entfernt, verknüpfte Notizen verlieren ihr Ziel, Links im Text werden zu normalem Text. Die Notiz kommt nach Obsidians Löscheinstellung in den Papierkorb; die Begleitdaten bleiben gesichert.
- **Neu: Fehlende Verweise reparieren.** Wurde eine Projektnotiz direkt im Dateiexplorer gelöscht, meldete das Projekt bisher „Verweisziel fehlt im Projekt“ und „POV muss eine Figur sein“, und eine neu angelegte gleichnamige Datei half nicht. Jetzt erklärt die Übersicht den Fehler und bietet zwei Wege: **Objekt wiederherstellen** legt die Notiz aus den gesicherten Daten neu an (bei belegtem Namen unter neuem Namen), **Verweise entfernen** räumt auf wie beim regulären Löschen. Auch als Befehl verfügbar.

**Update:** `writeller-0.3.7.zip` unter Assets herunterladen und die Plugin-Dateien in `<Vault>/.obsidian/plugins/writeller/` ersetzen. Einstellungen in `data.json` behalten und Obsidian neu laden. Mindestversion: Obsidian 1.14.5.

Geprüft in Integrations- und Oberflächentests: Löschen mit Bereinigung aller Verweisarten, Wiederherstellen nach direktem Löschen (auch neben einer gleichnamigen Datei) und Entfernen der Verweise. Eine vollständige native Desktop-/Mobile-Abnahme bleibt offen.

## English

**Delete objects properly and repair missing references.**

- **New: Delete…** Characters, places, scenes, chapters and other objects can be deleted from the action menu (⋯), a note's file menu or the command palette. The dialog lists what changes along with it. All references are cleaned up in the same checked save: scenes lose the point of view, scenes of a deleted chapter are no longer assigned to a chapter, relationships to the object are removed, linked notes lose their target, links in text become plain text. The note then goes to the trash according to your Obsidian setting; its preserved data is kept.
- **New: Repair missing references.** If a project note was deleted directly in the file explorer, the project previously reported “Reference target is missing from the project” and “Point of view must reference a character”, and a newly created file with the same name did not help. Now the overview explains the problem and offers two ways: **Restore object** recreates the note from the preserved data (under a new name if the old one is taken), **Remove references** cleans up as a regular deletion would. Also available as a command.

**Update:** Download `writeller-0.3.7.zip` from Assets, replace the plugin files in `<vault>/.obsidian/plugins/writeller/`, retain settings in `data.json` and reload Obsidian. Minimum: Obsidian 1.14.5.

Covered by integration and UI tests: deletion with cleanup of every reference kind, restore after a direct deletion (also next to a file with the same name) and removing the references. Full native desktop/mobile acceptance remains pending.

The public Writeller Exchange 1.0.0 contract is unchanged. / Der öffentliche Writeller Exchange 1.0.0-Vertrag bleibt unverändert.

[Changelog](https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/CHANGELOG.md)
