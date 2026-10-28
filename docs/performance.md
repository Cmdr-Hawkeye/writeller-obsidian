# Performanceanalyse 0.3.1

## Befund

Das Anlegen einer Figur führte in 0.3.0 bereits vor Öffnen des Formulars zu zwei vollständigen Markdown-Leseläufen über den Vault. Planung, Commit und Ansichtsaktualisierung wiederholten solche Scans. `ProjectIndex.dirty` wurde zwar gesetzt, reduzierte die Arbeit aber nicht. Fokus-/Layout-Ereignisse rekonstruierten zudem das komplette Projekt, bevor auf unveränderte Darstellung geprüft wurde. Überlappende Aufrufe teilten diese Projektarbeit nicht.

`assertNoPending` lud sämtliche historischen Projektjournale mit ihren Vorher-/Nachher-/Pending-Sicherungen. Diese vollständige Recovery-Prüfung fand auch bei längst abgeschlossenen Vorgängen und bei normalen Ansichtsaktualisierungen statt. Damit wuchs die Anzahl gelesener Dateien mit jedem gespeicherten Vorgang. Erneute vollständige Bilddekodierung und fehlende Rückmeldung bei längerer Dateiarbeit verstärkten das Problem.

## Änderungen

- **Anzeigeindex:** Stat-/Ereignishinweise begrenzen Anzeige-Lesezugriffe auf geänderte Dateien. Ereignisse invalidieren auch dann, wenn Dateigröße und Zeitstempel gleich bleiben. Adapter ohne Versionshinweise verwenden den bisherigen vollständigen Leseweg.
- **Schreibgrenze:** `rebuild()` und `assertFresh()` lesen weiterhin echte Quellen. Anzeigehinweise sind keine Eigentums- oder Schreibfreigabe. Fremde Bearbeitung, neue Identitätsduplikate, geänderte Begleitdaten und belegte Ziele bleiben blockiert. Eine frische Prüfung wartet nötigenfalls eine hintbasierte Aktualisierung ab und liest danach selbst erneut.
- **Projektansicht:** Ein leichter Revisionsschlüssel umfasst Identitäten, aktuelle Notiz-/Begleit-/Bildversionen und Journalheader. Unveränderte Ansichten umgehen die komplette Snapshot-/Bildprüfung und behalten ihre DOM-Knoten. Eine Warteschlange führt parallele Aktualisierungen zusammen und berücksichtigt nachlaufende Änderungen.
- **Journalhistorie:** Abschlussmarker, Besitzer, Version und Grundstruktur bleiben geprüft. Abgeschlossene Sicherungsdateien werden bei Alltagsoperationen nicht immer wieder geöffnet. Explizite Wiederherstellung prüft weiterhin sämtliche Originalhashes und Pfade vor einem Schreibzugriff. Unvollständige und beschädigte Header blockieren; vor dem Commit wird der Pending-Status erneut geprüft.
- **Bilder:** Nach vollständiger Erstdekodierung kann ein begrenzter Cache aus Inhalts-Hash, MIME-Typ und Dimensionen die erneute Pixeldekodierung überspringen. Bytebudget, kanonisches Base64 und SHA-256 werden weiterhin bei jedem Aufruf geprüft. Geänderte Bytes oder Metadaten erhalten keine Freigabe durch einen alten Cacheeintrag. Es werden keine Bildpuffer aufbewahrt.
- **Rückmeldung:** Nach bestätigtem Formular erhält der Host vor der Schreibarbeit einen Zeichnungszeitpunkt. Ab 250 ms erscheint „Speichern…“ beziehungsweise „Saving…“; Erfolg und Fehler entfernen die Meldung. Die Arbeit selbst bleibt serialisiert und durch das Journal gesichert.

## Vergleich mit dem veröffentlichten Stand

Der Runner verwendet dieselbe tatsächliche Formular-, Controller- und View-Implementierung: einmal aus Commit `3005a1c` (0.3.0), einmal aus dem optimierten Quellstand. Er erzeugt 1.000 fremde Markdown-Dateien, 30 Figuren und 16 weitere gespeicherte Vorgänge. Gemessen wird bei bereits geöffneter Projektansicht mit warmem Anzeigeindex, nicht der erste Pluginstart. Das Formular wird im kontrollierten DOM ausgefüllt und bestätigt. Gezählt werden tatsächliche Aufrufe des Vault-Ports. Ursprüngliche Dateien und Journale werden nicht gelöscht.

| Benutzeraktion | Dateilesen 0.3.0 | Dateilesen 0.3.1 | Fremde Notizen vorher → nachher |
| --- | ---: | ---: | ---: |
| Figurenformular öffnen | 2.321 | 66 | 2.000 → 0 |
| Figur speichern einschließlich Ansicht | 5.672 | 1.332 | 5.000 → 1.000 |
| Fünf unveränderte Ansichtsaktualisierungen | 11.655 | 0 | 10.000 → 0 |

Damit entfallen in diesem Szenario rund **97 %** der Dateilesen beim Öffnen und **77 %** beim Speichern. Die historische Sicherungsprüfung sinkt jeweils auf **0 Backup-Lesezugriffe** im normalen Bedienweg. Der verbleibende vollständige Quelllauf beim Speichern ist bewusst erhalten. Diese Prozente beschreiben IO-Aufrufe, keine garantierte Beschleunigung in Sekunden.

Ein beispielhafter lokaler Lauf benötigte im speicherbasierten Fake ungefähr 69 → 37 ms für das Formular, 134 → 105 ms für Speichern und 278 → 13 ms für fünf unveränderte Aktualisierungen. Zeiten schwanken; Dateisystem, Synchronisation, Bilder und Vaultgröße wirken sich in echtem Obsidian anders aus. **Dies ist keine native Obsidian-/Geräte-Messung.** Rohberichte liegen unter `test-results/performance/` und sind absichtlich nicht im Quellcode-Git.

Jeder der folgenden PowerShell-Befehle ist eine einzelne Zeile:

```powershell
node scripts/performance.mjs ui-before 3005a1c
```

```powershell
node scripts/performance.mjs ui-after
```

Andere Größen lassen sich beispielsweise so messen:

```powershell
$env:PERF_NOTES='2000'; $env:PERF_HISTORY='32'; node scripts/performance.mjs large
```

## Regressionen und Grenzen

Neue Tests prüfen IO-Zahlen statt instabiler Laufzeitgrenzen: unveränderte und gezielt geänderte Dateien, gleiche Stat-Tokens, parallele Refreshes, frische Schreibprüfung, neue Duplikate, neue gewöhnliche Notizen, geänderte Begleitdaten, fehlende historische Backups, aktive Vorgänge nach einer Vorschau, beschädigte Header, Bildbytes/-dimensionen und Meldungsabbau bei Fehlern.

Die vollständigen bisherigen Vertrags-, Schreib-, Recovery- und Sprachwechseltests bleiben maßgeblich. Das öffentliche Writeller Exchange 1.0.0 und lokale Projektidentitäten sind unverändert. Fremde Dateisynchronisation bleibt außerhalb einer verteilten Transaktionsgarantie. Für eine native Abnahme sind insbesondere ein großer bestehender Vault, längere Journalhistorie, Bilder und sichtbare Reaktion während Dateiarbeit zu prüfen.
