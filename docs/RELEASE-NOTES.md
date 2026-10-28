# Novel Planner - by Writeller 0.3.1

[Deutsch](#deutsch) · [English](#english) · [writeller.com](https://www.writeller.com)

## Deutsch

**Schnellere Bedienung bei wachsenden Vaults und Journalhistorien.**

- Unveränderte Ansichten lesen keine Projektdateien erneut. Überlappende Aktualisierungen teilen sich ihre Arbeit; Buttons und Fokus bleiben erhalten.
- Der Anzeigeindex liest gezielt geänderte Notizen. Die Prüfung vor dem Schreiben liest die Quellen weiterhin frisch und erkennt Änderungen, Duplikate und belegte Ziele.
- Abgeschlossene Journale lösen nicht mehr bei jedem Klick eine vollständige Prüfung aller historischen Sicherungsbytes aus. Ihre Abschluss-/Besitzmetadaten bleiben geprüft; ausdrückliche Wiederherstellung prüft die Originalbackups weiterhin vollständig.
- Bereits vollständig geprüfte Bilder müssen nach erneuter Hash- und Metadatenprüfung nicht immer wieder dekodiert werden.
- Längeres Speichern erhält eine vorübergehende Rückmeldung. Nach Formularbestätigung kann der Host zuerst zeichnen; unveränderte Editorpuffer werden nicht unnötig gespeichert.

**Messung:** Bei bereits geöffneter Ansicht mit 1.000 fremden Notizen und 16 weiteren gespeicherten Vorgängen sinken die Dateilesen beim Öffnen eines Figurenformulars von **2.321 auf 66**, beim Speichern samt Ansicht von **5.672 auf 1.332** und bei fünf unveränderten Aktualisierungen von **11.655 auf 0**. Das ist ein kontrollierter Vergleich der Produktionsmodule, keine native Obsidian-Zeitmessung oder garantierte Beschleunigung in Sekunden.

**Update:** `writeller-0.3.1.zip` unter Assets herunterladen und die Plugin-Dateien in `<Vault>/.obsidian/plugins/writeller/` ersetzen. Obsidian neu laden. Projektdateien und Einstellungen behalten. Der Anzeigename, die interne ID `writeller` und die Sprachwahl bleiben unverändert. Mindestversion: Obsidian 1.14.5.

**Prüfung:** 528 Tests in 21 Dateien und 13 Browserchecks bestanden. Native Desktop-/Mobile-Performanceabnahme bleibt offen.

## English

**Faster interaction as vaults and journal history grow.**

- Unchanged views no longer reread project files. Overlapping refreshes share work while preserving buttons and focus.
- The display index reads changed notes selectively. Before writing, fresh source reads still detect edits, duplicate identities and occupied targets.
- Completed journals no longer trigger repeated validation of all historical backup bytes on every click. Completion/ownership metadata remains checked; explicit recovery still fully validates original backups.
- Fully validated images can skip repeated decoding after their hash and exact metadata have been verified again.
- Longer saves show temporary activity feedback. The host can paint after form confirmation, and unchanged editor buffers are not saved unnecessarily.

**Measurement:** With an already open view, 1,000 unrelated notes and 16 additional saved operations, file reads drop from **2,321 to 66** when opening a character form, from **5,672 to 1,332** when saving and refreshing, and from **11,655 to 0** for five unchanged refreshes. This controlled production-module comparison is not a native Obsidian timing or a guaranteed wall-clock speedup.

**Update:** Download `writeller-0.3.1.zip` from Assets, replace the plugin files in `<vault>/.obsidian/plugins/writeller/` and reload Obsidian. Retain project files and settings. The display name, internal ID `writeller` and language preference are unchanged. Minimum: Obsidian 1.14.5.

**Validation:** 528 tests across 21 files and 13 browser checks passed. Native desktop/mobile performance acceptance remains pending.

The public Writeller Exchange 1.0.0 contract is unchanged. / Der öffentliche Writeller Exchange 1.0.0-Vertrag bleibt unverändert.

[Performance analysis](https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/docs/performance.md) · [Changelog](https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/CHANGELOG.md)
