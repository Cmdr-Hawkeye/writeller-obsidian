# Prüfungen und Nachweisgrenzen

`npm run check` führt TypeScript mit strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes, ESLint, Struktur-/Runtimeimportregeln, Byteidentität der neun übernommenen Handoff-Prüfartefakte, Vitest und den Browserbuild aus. `test-results/vitest.json` ist der maschinenlesbare lokale Bericht. Die Releasevorbereitung legt keine Live-Veröffentlichung an.

## Automatisierte Vertragsprüfung

Vier gültige Paketdateien akzeptiert, zwei ungültige mit `PROJECT_MISMATCH` beziehungsweise `MISSING_REFERENCE` abgewiesen. Alle gelieferten Paket- und Datensatzhashes werden mit `expected-results.json` verglichen. Die Original-Fixtures und das Schema wurden nicht als Implementierungsvorlage umgeschrieben. Unbearbeiteter Roundtrip erhält Fachhashes und Bildbytes; eine gezielte Textbearbeitung betrifft ausschließlich den erklärbar geänderten Datensatz einschließlich seines Annotations-Prüfhinweises.

Die parametrisierten Feldtests entfernen jedes Pflichtfeld jedes Datensatzes einzeln. Weitere Gruppen prüfen unbekannte Kernfelder, Versionen, Kalender und Mikrosekunden, Typ-/Nullwerte, freie verschachtelte Werte einschließlich `__proto__`, Duplicate-Keys, UTF-8, Surrogate, sichere Zahlen, JCS-Zahlen-/UTF-16-Sortiervektoren, CRLF und Emoji. Grenztests decken Byte-, Tiefen- und Stringbudgets ab. SHA-256 und Original-Hashvektoren prüfen die konkrete Kryptografie.

Graphmutationen prüfen Projektbesitz, doppelte IDs, Szenenzyklen, Kapitelbezüge, POV-Typ, typisierte Beziehungsendpunkte, Notiz-/Rechercheziele, echte/literale Markdown-Tokens und Asset-Layout. PNG/JPEG werden vollständig dekodiert; Base64, Padbits, Hash, Maße, kaputte Header und PNG-CRC werden geprüft. Der Standard-CRC32-Vektor ist unabhängig. Neue und unbenutzte Assets bleiben erhalten; geänderte Bytes bekommen nach expliziter Aufnahme neue Hash-IDs und erhaltene Originale.

Das **tatsächliche Browserbundle** der Austauschlogik wird in einem Kontext ohne `Buffer`, `process`, `require`, Obsidian und DOM ausgeführt. Netzwerkfunktionen sind durch Zähler/Fehler ersetzt. Fixture-/PNG-/JPEG-Prüfung und sichere Projektion externer Bild-/HTML-Inhalte laufen dort ohne Request. Zusätzlich prüft der Build unerwartete Externals und übrig gebliebene Node-/Netzwerkaufrufe. Dies beweist keine beliebige Obsidian-Drittpluginumgebung.

## Automatisierter Vault-Port-Fake

`FakeVault` modelliert sichtbare Dateien, exklusive Anlage, synchrone Text-CAS, relative Linkauflösung, Trash und injizierte Fehler. Die Integrationen testen:

- vollständigen Import/Export und No-op-Reimport ohne neue Dateien oder unnötiges Journal;
- zwei Projekte mit identischen Namen und sammlungsbezogenen ID-Strings, fremden Ordnerinhalt, Umzüge, Neustart mit anderen Einstellungen und Dateiduplikate;
- lokale Erstellung aller Sammlungen, generische Fremdtypen und typgetreue Erhaltung;
- bekannte/unbekannte/veraltete Basen, lokale/entfernte/beidseitige Änderungen, Origin-Konflikte, gelöschte Objekte und Paket-ID-Wiederverwendung;
- letzte 20 ausgegebene Hashes, getrennte Producer-Partner und keine Empfangsbestätigung durch Export;
- v1-Zustandsdecoder und Ablehnung unbekannter Versionen, fehlende/defekte Begleitdaten und Reparatur aus Original;
- Projektforks, POV-geschützte Typwechsel, Objekttransfer und Assetwechsel;
- Änderungen zwischen Vorschau und Commit sowie manipulierte Sidecarpfade;
- injizierte Fehler an jedem physischen Schreibschritt und Prozessabbruch unmittelbar nach eigener Zieländerung bzw. vor Commitbestätigung;
- Neustart-Recovery, Pendingzustand, beschädigte Backups, fremde Nachbearbeitung und idempotentes Rückrollen.

Fake-Vault-Ergebnisse sind **keine echte Obsidian-, Betriebssystem- oder Mobile-Ausführung**.

Die zusätzlichen Layouttests prüfen lesbare Namen einschließlich Unicode und Windows-Sonderfällen, gleichnamige Dateien, Kapitel-/Szenenablage, bestehende verschobene Projekte und die ausdrückliche Migration früherer Hashpfade. Bei Migration bleiben alle gelieferten Fachhashes, Empfangsbasen und Bildbytes erhalten. Fehler, Neustart-Recovery und fremde Nachbearbeitung werden injiziert. Reihenfolgeänderungen betreffen nur die ausgewählte Geschwistergruppe.

## Automatisierte Oberflächenprüfung ab 0.2.0

`tests/ui/writing.test.ts` verwendet die Produktionsmodule mit `happy-dom` und einem ausdrücklich kontrollierten Ersatz der benötigten Obsidian-APIs. Geprüft werden reale Projekt-/Kapitel-/Szenenformulare, Validierung und Abbruch ohne Schreiben, Kontextauswahl, geöffnete Markdown-Pfade, lesbare Projektübersicht, verständliche Befehle und technische Ausblendung einschließlich Rücknahme. Komplexe fremde Felder bleiben bei einfachen Detailänderungen erhalten.

`npm run test:ui` bündelt dieselben UI-Module für einen lokalen Testhost und startet vorhandenes Chrome oder Edge im Headless-Modus. Ein anderer vorhandener Browserpfad kann über `UI_BROWSER` gesetzt werden. Es werden kein persönliches Browserprofil, Konto oder Obsidian-Vault verwendet. Acht Prüfungen decken lesbare Übersicht, versteckte alte/aktuelle Exportordner mit vorhandenen JSON-Dateien, einen einzelnen Klick trotz Refresh zwischen Mouse-down/-up, Figuren-/Kapitelanlage, eine 390-Pixel-Ansicht ohne horizontalen Überlauf, Formularabbruch und die reversible Properties-Darstellung ab. Externe Requests werden gesondert gezählt. Screenshots und `report.json` liegen unter `test-results/ui/`. Browser und Server werden anschließend geschlossen.

Die Regressionstests für 0.2.1 prüfen erhaltene Buttonidentität, Fokus und aufgeklappte Gruppen bei unveränderten parallelen Refreshes; tatsächliche Projektänderungen werden weiterhin angezeigt. Exporttests prüfen erfolgreiche Pfadmeldungen einschließlich Namenskollisionen, Abbruch ohne Dateianlage, die Umstellung früherer Standards, individuelle Ziele und geschützte Projektwurzeln. Ein gezielter Test des nativen Adaptercodes mit kontrolliertem API-Ersatz prüft, dass Ordner mit Unterordnern unangetastet bleiben und nur wirklich leere Ordner in den lokalen Papierkorb gelangen.

Zusätzliche Prüfungen ab 0.2.3 erfassen gewöhnliche Obsidian-Notizen: Typ-/Kapitelvorschläge, verschobene und verschachtelte Projekte, gemeinsam genutzte Ordner, fremde vorhandene Identitäten und den Ausschluss einer pauschalen Vault-Aufnahme. UI-Regressionen prüfen Erkennung bei unverändertem verwaltetem Index, bestätigte Übernahme mit exaktem Text/YAML-Erhalt und anschließendem Export, Abbruch, ausdrückliches Auslassen, native Menüeinträge, Szenen ohne Kapitel und Schutz vor nachträglichen Änderungen. Zwei weitere Browserchecks zeigen eine neue gewöhnliche Markdown-Datei sowie deren bewusste Übernahme und Export über die tatsächliche Oberfläche. Insgesamt bestehen zehn Browserchecks, einschließlich schmaler Übernahmeansicht ohne horizontalen Überlauf.

Diese Screenshots zeigen eine **Browser-Vorschau mit API-Ersatz**, keine native Obsidian- oder Smartphone-Ausführung. Insbesondere Theme-/DOM-Kompatibilität, native Linkänderungen durch `renameFile`, Tastaturfokus und echte Editorpuffer müssen zusätzlich im Zielhost geprüft werden.

## Tatsächliche Desktop-/Geräteabnahme

Das Skript `scripts/prepare-smoke.mjs` bereitet ausschließlich `.smoke/Writeller-Testvault` und ein separates Profil vor. `scripts/desktop-smoke.mjs` baut einen separaten, nicht auszuliefernden Testharness. Der persönliche Vault wird nicht gelesen oder geändert. Der frühere isolierte Test für 0.1.0 hat Obsidian **1.14.5** geladen, endete jedoch vor der Vertrauensabfrage; kein erfolgreicher `SMOKE-ERGEBNIS.json` wurde erzeugt. **Für 0.2.3 liegt kein nativer API-/UI-Abnahmelauf vor.**

Für die anschließende Abnahme entscheidet der Benutzer selbst über die Vertrauensabfrage dieses selbst erzeugten Test-Vaults. Danach kann der vorbereitete Harness folgende echten APIs prüfen: Vault.create/createBinary/read/readBinary/process, FileManager.processFrontMatter/renameFile und MetadataCache-Auflösung, vollständiger Exchange-Roundtrip, Projekttrennung, lokale Erstellung und Aufnahme einer gewöhnlichen Notiz mit eigener Property. Ein echter Bericht wird in `SMOKE-ERGEBNIS.json` im Test-Vault abgelegt; nur `passed:true` belegt diesen Lauf.

Nach `npm run build`, `node scripts/prepare-smoke.mjs` und `node scripts/desktop-smoke.mjs` lässt sich das separate Profil aus dem Repositoryverzeichnis mit einer PowerShell-Zeile interaktiv öffnen:

```powershell
Start-Process -FilePath "$env:ProgramFiles\Obsidian\Obsidian.exe" -ArgumentList ('--user-data-dir="' + (Join-Path (Get-Location) '.smoke\profile') + '"')
```

Noch nativ ausführen und protokollieren: Buchsymbol und Projektansicht, Fokus/Tastatur/Leerzustände, aktuelle Themes und Properties-Selektoren, lesbares Umordnen einschließlich automatischer Linkanpassung, aktive Editoränderungen während offener Vorschau, langsamer MetadataCache, Properties-Zwischenabbruch, lokale Trash-Interaktion, OS-Dateinamenskollisionen, iOS-/Android-Transport und UI. Die gemeinsame Vault-Dateiauswahl ist implementiert; keine externe Dateipicker-/OS-Teilen-Integration wird behauptet.

Die Implementierung und Tests von Writeller Exchange 1.0.0 in der Writeller-Anwendung hat Benni am 27.10.2026 bestätigt. Diese anwendungsseitige Bestätigung ergänzt die hier dokumentierten unabhängigen Plugin-Vertragsprüfungen. Die Community-Katalogprüfung und die oben genannten nativen Geräteabnahmen bleiben gesonderte offene Schritte.

## Zusätzliche Releaseprüfungen

`npm audit` prüft den gesamten installierten Baum; `npm run audit:dependencies` den Laufzeitbaum. `npm run licenses` sammelt Runtime-Lizenztexte aus dem Lockfile. `node scripts/reproducible.mjs` baut zweimal und vergleicht die exakten Bundlebytes. Das ZIP verwendet feste Dateizeiten und Reihenfolge; `SHA256SUMS.txt` erlaubt die Artefaktprüfung. GitHub-CI läuft auf Windows und Linux mit `npm ci`. Eine lokal erstellte Workflowdatei ist noch kein auf GitHub ausgeführter CI-Lauf.
