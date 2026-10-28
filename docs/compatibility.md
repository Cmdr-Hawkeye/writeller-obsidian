# Kompatibilität und Darstellungsgrenzen

Stand: 27.10.2026. Unterstützter Austauschvertrag: exakt **Writeller Exchange 1.0.0**, UTF-8 ohne Writer-BOM, `.writeller-exchange.json`, ein Projekt pro Datei. Andere Versionen werden vor Schreibzugriff abgelehnt. Alle sieben Datensatzarten sowie PNG-/JPEG-Assets werden validiert, erhalten und wieder ausgegeben. Unbekannte Typen, Statuswerte und namensräumliche Erweiterungen sind Erhaltungsdaten.

**Writeller Exchange 1.0.0 ist in der Writeller-Anwendung implementiert und getestet.** Benni hat den aktualisierten Implementierungs- und Teststand am 27.10.2026 bestätigt. Projekte lassen sich über Exchange-Dateien manuell zwischen Writeller und diesem Plugin austauschen. Die Vertragskonformität des Plugins wird zusätzlich unabhängig anhand synthetischer Daten, fremd erzeugter Sollhashes und vollständiger Bildbytes getestet. Es gibt keine Laufzeitabhängigkeit von Writeller.

Die unveränderte mitgelieferte Spezifikation ist ein archiviertes Handoff-Prüfartefakt. Ihre historische Aussage zur damals noch offenen Anwendungsimplementierung ist durch den oben dokumentierten aktuellen Stand überholt; Schema und neun unabhängige Prüfartefakte bleiben byteidentisch. Das bisherige Archiv `*.writeller.json` mit Kennung `writeller.project.v5` ist ein anderes Format und wird weiterhin nicht gelesen oder geschrieben.

## Obsidian und Plattformen

`minAppVersion: 1.14.5`, `isDesktopOnly: false`. Am 27.10.2026 zeigte das [offizielle Changelog](https://obsidian.md/changelog/) 1.14.5 als öffentliche Desktopversion, 1.15.0 als Catalyst. Die offizielle Typabhängigkeit ist 1.14.4. Eine niedrigere Mindestversion wird mangels Geräteabnahme nicht behauptet. Laut [Einreichungsanforderungen](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins) soll bei unbekannter Mindestversion die aktuelle stabile Version gewählt werden. `processFrontMatter` allein seit 1.4.4 ist keine Gesamtkompatibilitätsaussage.

Das Bundle zielt auf Browser-APIs und enthält keine Node-/Electron-Imports. Web Crypto und moderne ECMAScript-APIs müssen verfügbar sein. Ein unabhängiger Browserbundle-Test läuft ohne Node, DOM und Obsidian. Das ist ein Laufzeitportabilitätsnachweis für die Austauschlogik, **keine** Geräteabnahme.

Der vorbereitete echte Desktop-Smokeharness liegt in `tests/desktop/harness.ts`. Ein früherer isolierter Versuch für 0.1.0 endete an der Vertrauensabfrage. Für **0.2.4 sind native Desktop-API-/UI-Tests offen**. Automatisierte DOM-Tests und Screenshots im Browser-Testhost verwenden einen kontrollierten Obsidian-API-Ersatz; sie belegen keine Ausführung im echten Obsidian. Der persönliche Vault wurde in diesen Prüfungen nicht verändert. iOS-/Android-Geräte wurden nicht getestet. Mobile Transportfähigkeit setzt eine die Manifest-Mindestversion erfüllende App voraus; die Verfügbarkeit einer solchen mobilen Version wird hier nicht behauptet.

Die Schreibübersicht verwendet native Views und Themevariablen. Technische Ordner und Eigenschaften werden über begrenzte, reversible Darstellungsregeln ausgeblendet; Dateien werden nicht verborgen gespeichert oder gelöscht. Diese Selektoren und die automatische native Linkanpassung bei Umbenennungen müssen im jeweiligen Obsidian-Host und Theme geprüft werden. Ein fremder oder nicht eindeutig bekannter Zwischenstand blockiert konservativ, statt Originale zu überschreiben. Bestehende 0.1.0-Projekte bleiben mit ihren bisherigen Identitäten lesbar; neue Pfade werden erst nach ausdrücklicher Vorschau und Bestätigung übernommen.

## Erhaltung statt automatischer Konvertierung

| Inhalt | Verhalten |
| --- | --- |
| Plaintext | exakte Zeichenkette, Format bleibt plain; Markdown-Vorschau kann Zeichen interpretieren |
| CommonMark | Quellbereiche echter Linkknoten, keine Ersetzung in Inline-/Blockcode |
| interne Links | `entity:` ↔ lokale verwaltete Identität desselben Projekts |
| Wikilinks | unbearbeitet exakt erhalten; bearbeitete echte lokale Wikilinks über MetadataCache zurückführen |
| unverwaltete/fremde Ziele | blockieren; explizite Zuordnung, Quelltextkonvertierung oder Klartextentscheidung erforderlich |
| Block-/Heading-Ziele | keine automatische Umdeutung; sichtbare Entscheidung erforderlich |
| Tabellen, Callouts, Fußnoten | Quelltext bleibt, Darstellung in anderen Adaptern ungarantiert |
| erlaubte Ausrichtungswrapper | nicht verschachteltes `<div align="...">`; Mapping erhält Quellbereiche |
| übriges HTML / externe Bilder | inert eingezäunter Quelltext, Original separat erhalten, Warnung |
| Assetlayout | width 10–100 %, align left/center/right je Vorkommen; mehrdeutige Wiederholung blockiert |
| Annotationen nach Edit | vollständiges Array in `org.writeller.text-review`; alte Offsets nicht anwenden |
| native Fremdmetadaten | typgetreu im vollständigen JSON; keine vorgetäuschte Kalender-/Karten-/Publishing-Bedienung |

Neue lokale Bilder werden ausdrücklich aufgenommen und niemals automatisch skaliert. Originaldateien bleiben byteidentisch. Geänderte Assets benötigen eine passende Originaldatei, damit alte Bytes erhalten werden können. Mehrdeutige Vorkommen können durch vollständige `asset:`-URIs im JSON-Editor zugeordnet werden. Änderungen einer geschützten oder erzeugten Ansicht lassen sich im JSON-Editor ausdrücklich neu bestimmen; die bisherige Notiz wird im Journal gesichert.

Fremde Cloud-Dateisynchronisation ist keine globale Sperre. Das lokale Journal erkennt eigene bekannte Nachherstände; jeder andere Zwischenstand wird als Recovery-Konflikt erhalten. Während eines nicht atomaren Frontmatter-Zwischenschritts ist gegebenenfalls ein manueller Vergleich mit der Originalsicherung nötig.

## Offizielle Quellen für spätere Einreichung

Geprüft am 27.10.2026: [Community-Portal-Einreichung](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin), [Entwicklerrichtlinien](https://docs.obsidian.md/community-directory/developer-policies), [Anforderungen](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins), [Manifest](https://docs.obsidian.md/Reference/Manifest), [Vault](https://docs.obsidian.md/Plugins/Vault), [API-Typen](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts). Vor einer Einreichung erneut prüfen. Name und ID `Writeller` / `writeller` sind geplant; Verfügbarkeit und Herausgeberautorisierung wurden nicht bestätigt.
