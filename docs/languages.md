# Sprachen und Projektordner / Languages and project folders

## Deutsch

Ab 0.3.0 heißt das Plugin **Novel Planner - by Writeller**. Die interne Plugin-ID `writeller`, vorhandene Einstellungen, Befehls-IDs und Projektidentitäten bleiben erhalten. Eine Neuinstallation ist nicht erforderlich.

Unter **Einstellungen → Novel Planner - by Writeller → Sprache** stehen **Automatisch (Obsidian)**, **Deutsch** und **English** zur Auswahl. Automatisch verwendet die offizielle Obsidian-Sprachschnittstelle: Deutsch bei `de` einschließlich regionaler Varianten, sonst Englisch. Eine ausdrückliche Auswahl überschreibt die Obsidian-Sprache. Bei einer später geänderten Obsidian-Sprache wird die automatische Auswahl beim nächsten Pluginstart erneut geprüft.

Ein Sprachwechsel aktualisiert Oberfläche, Formulare, Befehlspalette, Hinweise und die folgenden Strukturordner. Bei vorhandenen Ordnern zeigt das Plugin zuerst die konkreten Umbenennungen. **Abbrechen** lässt Sprache, Einstellungen und Dateien unverändert. Neue Installationen ohne Projektordner benötigen keine Ordnerbestätigung.

| Deutsch | English |
| --- | --- |
| Schreibprojekte | Writing Projects |
| Exporte | Exports |
| Manuskript | Manuscript |
| Ohne Kapitel | Without Chapter |
| Figuren | Characters |
| Orte | Locations |
| Gegenstände | Items |
| Ereignisse | Events |
| Handlungsbögen | Story Arcs |
| Beziehungen | Relationships |
| Notizen | Notes |
| Recherche | Research |
| Eigene Typen | Custom Types |

**Erhalten bleiben:** alle `.md`-Dateinamen, Projekttitel, Titel von Kapitel-/Unterszenenordnern, eigene Unterordner und benutzerdefinierte Ablagewurzeln. Ein selbst gewähltes `Meine Bücher` wird nicht zu `Writing Projects`. Auch gewöhnliche, noch nicht zugeordnete Notizen und andere Dateien innerhalb eines Strukturordners ziehen mit demselben Namen mit um. Die Sprache des Manuskripts und importierte Fachwerte werden nicht übersetzt. Bei neu angelegten Projekten wird die aktuelle Oberflächensprache als anfänglicher Sprachcode gesetzt.

Lokale Linkziele und die internen Pfadzuordnungen werden angepasst. Projektdaten, Fachhashes, eigene YAML-Eigenschaften, Empfangsbasen und Bildbytes bleiben erhalten. Das native `FileManager.renameFile` übernimmt die Ordnerbewegung; fremde oder unerwartete Zwischenstände blockieren konservativ. Ein bereits vorhandener Zielordner wird auch dann nicht zusammengeführt, wenn er leer ist.

Der ausgeblendete technische Datenordner, standardmäßig `Writeller-Daten`, und seine `records`, `journal`, `assets` und Hashpfade bleiben sprachunabhängig an ihrem bisherigen Ort. So bleiben ältere Sicherungen gültig. Neue Sprachwechsel legen zusätzlich `language-changes/<Vorgang>/journal.json` mit Originalbytes an. Diese Sicherungen bleiben erhalten und gehören in die Vault-Sicherung.

Ein unterbrochener Sprachwechsel blockiert weitere Projektoperationen. **Unterbrochenen Vorgang wiederherstellen** prüft bekannte Vorher-/Nachherstände und stellt bei erfolgreicher Rücknahme auch die vorherigen Einstellungen wieder her. Nachträgliche fremde Änderungen werden nicht überschrieben; Konflikte müssen mit den erhaltenen Originalsicherungen geprüft werden.

## English

Since 0.3.0, the plugin is called **Novel Planner - by Writeller**. Its internal ID remains `writeller`, retaining existing installations, settings, command IDs and project identities.

Open **Settings → Novel Planner - by Writeller → Language**. **Automatic (Obsidian)** selects German for German Obsidian installations and English for every other language. **Deutsch** and **English** override detection. Automatic selection is checked again on the next plugin start after a host-language change.

The table above lists the translated structure folders. Existing folders receive a concrete preview before moving; **Cancel** leaves the preference and files unchanged. Markdown basenames, user-authored project/chapter titles, custom subfolders and independently configured root names are preserved. Ordinary unassigned notes and other files inside a structural folder move with it. Manuscript text and imported data values are not translated. New projects initially use the current UI language as their language code.

Local link targets and internal path mappings follow the new folders. Domain hashes, user YAML properties, accepted baselines and image bytes are preserved. Occupied target folders are never merged, including empty ones. Native folder operations and unknown intermediate edits are checked conservatively.

Hidden preservation data, including the existing `Writeller-Daten` root and its internal folders, keeps stable paths so previous recovery journals remain valid. Language changes keep their own original-byte backups under `language-changes`. Back up the entire vault, including these folders.

An interrupted change blocks further project operations until **Recover interrupted operation** resolves it. Recovery restores known states and previous preferences; foreign post-edits are retained as conflicts instead of overwritten.

## Vertrags- und Nachweisgrenze

Das öffentliche **Writeller Exchange 1.0.0**-Schema, Fachfelder, IDs und Hashregeln werden durch die Sprachwahl und den neuen Anzeigenamen nicht geändert. Andere Exchange-Adapter benötigen für dieses Update keine Vertragsänderung. Das ist keine erneute anwendungsseitige Kompatibilitätsprüfung. Die automatisierten Sprach-/Ordnerprüfungen verwenden synthetische Daten und kontrollierte Obsidian-APIs; native Desktop-/Mobile-Abnahme bleibt offen. [Prüfnachweis](verification-report.md).
