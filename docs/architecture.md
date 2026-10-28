# Architektur und Modulgrenzen

Die verbindliche Eingabe ist die unveränderte `WRITELLER-EXCHANGE-SPEC.md` 1.0.0. Schema und sechs synthetische Pakete sind unveränderte unabhängige Prüfartefakte. Es wurde ausschließlich das benannte Handoff-ZIP aus dem Writeller-Verzeichnis gelesen, kein Anwendungscode, keine Datenbank, kein interner Dienst und keine Installation.

```text
src/
  main.ts                 Zusammensetzung und registrierte Lebenszyklen
  domain/                 Datentypen, Diagnosecodes, Identität, Reihenfolge
  exchange/               begrenzter JSON-Parser, Schema, Semantik, JCS, Hash, Bilder
  projects/               lesbare Namen/Layout, Index, Snapshot, Umordnungsplan, Fork, Reparatur
  objects/                Datensatzfabrik, deutsche Objektbegriffe, Reihenfolge, Referenzen
  mapping/                YAML, Properties, CommonMark-Quellbereiche, Projektion, Annotationen
  transfer/               Konflikttabelle, Importplan, Dateiplan, Koordinator
  storage/                Vault-Port, v1-Zustände, sichere Pfade, Journal, Recovery
  obsidian/               Vault-/FileManager-Adapter, Ereignisse, reversible Darstellung
  ui/                     Schreibübersicht, Abschnitte, Formulare, Aktionen, Austausch, Prüfung
tests/
  unit/                   Vertrag, Felder, Grenzen, Konflikte, JCS
  integration/            austauschbarer API-Fake, Journal, Reparatur, Browserbundle
  helpers/                Fehler-/Absturz-injizierender Fake-Vault
  browser/                Testentry ohne DOM, Obsidian und Node
  ui/                     tatsächliche UI-Module im kontrollierten DOM-/Browser-Testhost
  desktop/                vorbereiteter echter API-Smokeharness
  fixtures/               unveränderte Handoff-Dateien und Sollhashes
scripts/                  Struktur, Browsertransforms, Lizenzen, Release, Reproduzierbarkeit
.github/workflows/        Windows-/Linux-Prüfung und manuell gestarteter Releaseworkflow
```

Neue Produktionsdateien maximal 300 Zeilen, `main.ts` maximal 150; CI erzwingt dies. Keine Dateiausnahmen. Das unveränderte JSON-Schema ist ausgenommen. Funktionen sollen etwa unter 50 Zeilen bleiben. Die ausführlichen Validierungs-/Snapshot-/Dateiplan-Orchestrierungen sind etwas länger, bleiben aber auf eine Aufgabe begrenzt; ihre Parser-, Bild-, Mapping- und Speicheralgorithmen liegen in separaten Modulen. Jede öffentliche Funktion hat TSDoc; Kommentare erläutern insbesondere Erhaltung, Konflikte, CAS und Recovery.

Die Domäne importiert weder Obsidian noch Node. `unknown` wird an JSON-/YAML-/Einstellungsgrenzen überprüft. Der Parser erkennt doppelte Schlüssel vor möglichem Verlust, prüft UTF-8, Tiefe und Stringbudgets und erzeugt Objekte ohne Prototype. Explizite Kernfelder werden anschließend mit Ajv Draft 2020-12 ohne Coercion, Defaults, Remoteauflösung oder dynamische Fremdschemas geprüft. Datumsstrings werden kalenderbasiert geprüft und niemals eingehend durch `Date` konvertiert.

Semantik prüft Besitz, sammlungsbezogene IDs, Refs, POV-Typ, Waldstruktur, Zeitintervalle, echte Markdown-Linkknoten, Bilder und Budgets. Die manuelle Konflikttabelle verwendet Fachhashes und verifizierte Basen, niemals Uhrzeiten. Erst ein final auflösbarer Graph kann einen Dateiplan bilden. Vor Commit werden Quellen, Identitätsinventar, Begleitdaten, Assets und einzelne Schreibvoraussetzungen erneut verglichen.

Das mitgelieferte Schema bleibt byteidentisch. Seit 0.2.4 erzeugt `scripts/generate-validators.mjs` statische Standalone-Validatoren in `.generated/`; der Ajv-Compiler wird nicht mehr im Plugin ausgeführt oder gebündelt. Der ignorierte erzeugte Code ist ein reproduzierbares Buildartefakt und wird vor Test/Build neu erstellt. TypeScript verwendet die kleine statische Deklaration in `validator-types.d.ts`. Der Kalenderprüfer wird zwischen Build und Laufzeit geteilt. Ausschließlich das Base64-Quartett-Regexp wird in der Buildkopie durch den etablierten linearen Zeichen-/Paddingfilter ersetzt, weil V8 sonst bei gültigen großen Bildern einen Regexp-Stackfehler auslösen kann. Die nachgeschaltete Prüfung erzwingt zusätzlich Länge, Padding, Padbits und vollständige Dekodierung; die akzeptierten Bildwerte werden nicht erweitert.

JCS verwendet `canonicalize`, einschließlich ECMAScript-Zahlendarstellung und UTF-16-Schlüsselsortierung gemäß RFC 8785. Unabhängige RFC-Zahlen-/Sortiervektoren, SHA-Vektoren und die mitgelieferten Paket-/Datensatzhashes prüfen die Ergebnisse. SHA-256 und zufällige UUIDs verwenden Web Crypto. Es gibt keinen schwachen Fallback; fehlen sichere APIs, ist der Host nicht unterstützt.

## Laufzeitabhängigkeiten

| Bibliothek | Zweck | Lizenz / Browser und Mobile |
| --- | --- | --- |
| ajv 8.20.0 | Draft-2020-12-Compiler beim Build, statische Validatoren im Plugin | MIT; nur benötigte Runtime-Helfer gebündelt |
| canonicalize 2.1.0 | RFC-8785-Kanonisierung | Apache-2.0; gebündeltes reines JavaScript |
| mdast-util-from-markdown 2.0.2 | CommonMark-Knoten mit Quellbereichen | MIT; gebündelt |
| yaml 2.9.1 | YAML 1.2 Core und typgetreue Properties | ISC; Browserentry, Aliase für verwaltete Notizen deaktiviert |
| fast-png 6.4.0 | vollständige PNG-/Adam7-Pixeldekodierung | MIT; gebündelt, kein Browserbild-Request |
| pako 2.1.0 | begrenzte PNG-Inflation vor vollständiger Dekodierung | MIT/Zlib; Browser-JavaScript |
| jpeg-js 0.4.4 | vollständige JPEG-Pixeldekodierung | BSD-3-Clause; ausschließlich Decoderentry |

Versionen und transitive Lizenzen: `package-lock.json`, `docs/dependency-licenses.json` und `THIRD-PARTY-NOTICES.md`. Build-/Testwerkzeuge und ZIP-Erzeuger sind ausschließlich Entwicklungsabhängigkeiten. `obsidian` bleibt als einzige Laufzeitreferenz extern.

Zwei kleine Buildanpassungen sind absichtlich zentral in `scripts/browser-libraries.mjs`: Der JPEG-Decoder verliert seinen unbenutzten XHR-Lader und den Node-Buffer-Allocationszweig; eine Änderung der erwarteten Upstreamstruktur lässt den Build scheitern. Die Markdown-Entity-Dekodierung verwendet die reine Datentabellenvariante statt des Browserentrys mit `innerHTML`. Lizenztexte bleiben erhalten. Das finale Browserbundle wird auf Netzwerk-/Node-Aufrufe und unerwartete Externals geprüft und ohne `Buffer`, `process`, `require`, Obsidian oder DOM ausgeführt.

PNG-Chunks werden vor Dekodierung auf Framing und CRC geprüft. Animationen, unbekannte kritische Chunks und Mehrfach-IHDR werden abgelehnt. Erwartete Scanlinegröße einschließlich Adam7 begrenzt die Inflation. Nicht benötigte komprimierte ancillary Metadaten werden nur aus der temporären Decoderansicht entfernt; die exportierten Originalbytes bleiben unverändert. JPEG prüft Header vor Speicherallokation und begrenzt Dekodierressourcen.

## Schreibmodell und Grenzen

Alle Änderungen haben einen konkreten Dateiplan. Das Journal enthält dauerhafte Vorher-/Stagingdateien und geprüfte Hashes vor der ersten Zieländerung. `state.json` wird, wenn betroffen, mit `pendingJournal` geschrieben und nach den Zieldateien bestätigt. Ein Absturz lässt sich auch ohne Fortschrittsmarker an den Hashes erkennen. Empfangsbasen werden erst durch den vollständigen Commit wirksam. Neue Dateien kollidieren exklusiv; Binärassets werden niemals überschrieben.

Bestehende Texte verwenden `Vault.process` mit synchronem Vergleich. Propertyänderungen verwenden zuvor `FileManager.processFrontMatter` mit eigenem Propertyvergleich und vollständigem Quelltextvergleich davor/danach. Das ist ausdrücklich keine atomare Kombination mit dem zweiten Körper-/Textschritt. Eine Unterbrechung im Property-Zwischenschritt kann einen konservativen Recovery-Konflikt auslösen, dessen gesicherte Originale manuell zu vergleichen sind. Es wird kein fremder Zwischenstand geraten oder überschrieben. Beim Rücknehmen neu erzeugter Dateien nutzt der Adapter FileManager.trashFile gemäß der Löschpräferenz des Nutzers; zwischen Hashprüfung und Entfernen gibt es keine verteilte Dateisperre. Fremde Cloud-Dateisynchronisation bleibt außerhalb der lokalen Garantien.

Die Oberfläche rendert importierte Inhalte nur als Text in Dialogen. Notizprojektionen neutralisieren aktive externe Embeds vor Speicherung. Das Plugin aktiviert weder KI noch Cloudzugriffe, auch wenn transportierte Policy-Flags dies erlauben würden. Alle dauerhaften Ereignisse werden registriert und beim Entladen entfernt.

## Schreiboberfläche und lesbare Ablage ab 0.2.0

`project-view.ts` komponiert eine native `ItemView`; `project-sections.ts` rendert Manuskript und Planung. `writing-commands.ts` führt alltägliche Aktionen aus, `writing-fields.ts` bildet verständliche Detailfelder ab, `form.ts` kapselt native Eingaben und Abbruch. `commands.ts` registriert Begriffe wie Kapitel, Szene und Figur; technische Werkzeuge sind nur bei Bedarf oder aktivierter Einstellung verfügbar. Die Oberfläche besitzt keine zweite Projektdatenbank. Ausgewählte Projekt-ID und Wortzähler sind reine Darstellungshinweise.

`names.ts` und `note-layout.ts` erzeugen kollisionsfreie lesbare Dateipfade. Identität bleibt in den validierten Notizeigenschaften und Begleitdatensätzen. Der Index baut neue Notiz-/Problemarrays vollständig auf und tauscht sie atomar aus; parallele Aufrufe teilen einen laufenden Scan. Native Umbenennungen laufen über den separaten `organize-plan.ts` und `layout-journal.ts`; sie verändern keine fachlichen IDs. Roh-JSON bleibt als erweitertes Erhaltungswerkzeug verfügbar.

`presentation.ts` und `visibility.ts` setzen ausschließlich temporäre, eigene Klassen auf geprüfte Ordner- und Metadatenelemente. Die statischen Plugin-Styles blenden diese Klassen aus; seit 0.2.4 sind weder `:has` noch dynamische Stylesheets nötig. Eigene Properties, Vault-Dateien und Markdown-Quelltext bleiben erhalten. Einstellung und Entladen entfernen alle eigenen Klassen. Native DOM-Selektoren bleiben eine im echten Obsidian und seinen Themes zu prüfende Darstellungsabhängigkeit. `events.ts` bündelt abbrechbare Aktualisierungen; während eines eigenen Schreibvorgangs wird keine halbfertige Ansicht erzeugt.

Ab 0.2.1 rendert `project-view.ts` erst nach vollständiger Snapshot-Prüfung und nur bei geändertem Projekt-/Quellfingerprint oder geänderter Darstellungseinstellung. Unveränderte Fokus-/Cache-Ereignisse erhalten dieselben Buttonknoten, Tastaturfokus und aufgeklappten Gruppen. Dadurch geht ein zwischen `pointerdown` und `click` begonnener Klick bei bloßem Refresh nicht verloren. `export-location.ts` kapselt die Umstellung früherer Standardnamen auf `Exporte` und das optionale Aufräumen wirklich leerer alter Wurzeln. Die Export-Erfolgsmeldung folgt erst nach dem Journal-Commit und nennt den tatsächlich zugeteilten Vault-Pfad.

Ab 0.2.3 liefert `projects/note-discovery.ts` ausschließlich Aufnahmevorschläge für bisher unverwaltete Markdown-Dateien unter tatsächlichen Manifestwurzeln. Vorhandene Identitäten werden ausgeschlossen; verschachtelte Projekte verwenden die nächste Wurzel, gemeinsam genutzte Wurzeln benötigen ausdrücklichen Projektkontext. Ein Manifest auf Vault-Ebene erfasst nicht pauschal sämtliche Vault-Notizen. `ui/unassigned-notes.ts` rendert die Vorschläge und die bewusste Export-Auslassentscheidung. `obsidian/file-menu.ts` kapselt passende native Menüs. Gewöhnliche Dateipfade gehen in den Darstellungsschlüssel ein, damit neue Notizen auch bei unverändertem verwaltetem Index erscheinen. Erst die bestätigte Aufnahme schreibt Identität und Begleitdaten über den bestehenden Journalweg. Der ursprüngliche Inhalt wird zusätzlich als Commit-Voraussetzung geprüft; betroffene offene Editorpuffer werden vor dieser Prüfung gespeichert.
