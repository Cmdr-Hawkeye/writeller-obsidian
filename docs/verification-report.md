# Lokaler Abschlussnachweis

Prüfstand: **28.10.2026**, Version **0.2.4**, Windows / Node **22.13.1**, npm **10.9.2**. Dieser Bericht dokumentiert lokale Prüfungen des Plugin-Updates. Öffentliche Releases und Live-CI sind unter [GitHub](https://github.com/Cmdr-Hawkeye/writeller-obsidian) gesondert nachvollziehbar. Keine native Obsidian-Abnahme dieser Version.

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Abhängigkeiten | offizieller Obsidian-Linter 0.4.2 ergänzt; dessen Obsidian-Typen auf die bereits verwendete 1.14.4-Version vereinheitlicht |
| `npm run check` | erfolgreich: Typen, ESLint, Modulgrenzen, Handoff-Integrität, Tests, Browserbuild |
| Obsidian-Linter | empfohlene Regeln aktiv, null Warnungen; englische Sentence-Case-Regel für deutsche Oberfläche begründet deaktiviert |
| Vitest | **16 Dateien, 489 Tests bestanden**, keine fehlgeschlagenen Tests |
| Einstellungen | native durchsuchbare Definitionen; Ordnerwechsel tatsächlich verwendet, Überlappung/Fehltyp abgewiesen, Speicherfehler zurückgenommen |
| Native neue Markdown-Notizen | erkannt bei unverändertem verwaltetem Index; passende Typ-/Kapitelvorschläge ohne automatische Eigentumszuweisung |
| Übernahme gewöhnlicher Dateien | Text einschließlich CRLF, eigene verschachtelte YAML-Werte und Pfad erhalten; als Figur vollständig exportiert; Abbruch unverändert |
| Projektgrenzen und Export | verschobene/verschachtelte/geteilte Wurzeln und fremde Identitäten geprüft; ausdrückliche Entscheidung vor Auslassen gewöhnlicher Notizen |
| Frischeprüfung bei Übernahme | zwischen Planung und Commit nachbearbeitete gewöhnliche Datei bleibt erhalten; veralteter Plan blockiert |
| Klick-Regression | unveränderter Refresh erhält Buttonknoten, Fokus und aufgeklappte Gruppen; echte Änderungen werden aktualisiert |
| Export-Rückmeldung | tatsächlicher Vault-Pfad erst nach Commit, einschließlich `(2)` bei Kollision; Abbruch ohne Export/Erfolgsmeldung |
| Exportordner | frühere Standards auf `Exporte` umgestellt; individuelle Ziele und konfigurierte Wurzeln geschützt; nur wirklich leere alte Ordner aufgeräumt |
| JSON-Ordner in der Oberfläche | alte/aktuelle Exchange-Wurzeln mit vorhandenen JSON-Dateien ausgeblendet; Notizen, Bilder und unbekannte Dateien bleiben sichtbar |
| Autorenangaben | Manifest und MIT nennen Benni; Autorenlink führt zu writeller.com; Manifestbeschreibung ist kurz und zweisprachig |
| Neue Schreibablage | lesbare Titel, Namenskollisionen, Unicode/Windows-Namen, Kapitel und Szenen geprüft |
| Bestehende Hashpfade | ausdrücklicher Umordnungsplan; Texte, Fachhashes, Origins, Basen und Bildbytes erhalten |
| Umbenennungs-Recovery | injizierte Fehler und Neustart im Fake; fremde Nachbearbeitung bleibt erhalten |
| Produktions-UI im DOM-Testhost | Formulare, Kontext, Validierung/Abbruch, echte Notizpfade, lesbare Ansicht und Befehle geprüft |
| Browser-Oberfläche | **10 Smokechecks bestanden**, einschließlich gewöhnlicher Notiz → Figur → Export und schmaler Übernahmeansicht; externe Requests **0** |
| Technische Ausblendung | auf geprüften Test-DOM begrenzt, eigene Properties sichtbar, Einstellung/Entladen stellen Darstellung wieder her |
| Vertragsdateien | 4 gültige akzeptiert; 2 ungültige mit gelieferten Codes abgewiesen |
| Handoff-Byteidentität | 9 übernommene Prüfartefakte entsprechen den Original-SHA256SUMS |
| Fach-/Pakethashes | sämtliche gelieferten unabhängigen Sollwerte stimmen |
| Writeller-Anwendung | Exchange 1.0.0 implementiert und getestet; am 27.10.2026 von Benni bestätigt |
| Roundtrip | Fachhashes sämtlicher Sammlungen und vollständige Bildbytes erhalten |
| Konflikte und Journal | vorhandene Import-/Export-/Recovery-Prüfungen weiterhin bestanden |
| Austauschlogik im Browser | erzeugtes Bundle ohne Node/DOM/Obsidian, dynamische Codeerzeugung deaktiviert; Netzwerkzähler 0 |
| Abhängigkeitsscan | `npm audit` und `npm audit --omit=dev`: **0 bekannte Schwachstellen** zum Prüfzeitpunkt |
| Lizenzliste | **47 transitive Runtime-Pakete** mit Lizenztexten erfasst |
| Reproduzierbarer Build | zwei aufeinanderfolgende Builds byteidentisch |
| Release-ZIP | Inhalt, alle SHA-256-Summen und wiederholte ZIP-Erzeugung geprüft |
| Dateigrenzen | alle Produktionsdateien ≤300 Zeilen; main.ts ≤150; keine Dateiausnahmen |

Bundle-SHA-256: `f3020aad3dccd46822466b4c9bd680ba40754c88459d0d3d8cd4aba0d3fde21a`.

Artefakte: `release/0.2.4/main.js`, `manifest.json`, `styles.css`, `writeller-0.2.4.zip`, `SHA256SUMS.txt`, deutsch-/englische README, Handbuch, Screenshots mit Herkunftsnachweis, MIT-Lizenz, Drittanbieterhinweise, maschinenlesbare Lizenzliste und `release-status.json`. Rohberichte: `test-results/vitest.json` und `test-results/ui/report.json`. Die Screenshots `desktop.png`, `mobile.png` und `mobile-form.png` unter `test-results/ui/` sind **Browser-Vorschauen mit kontrolliertem Obsidian-API-Ersatz**, keine native Geräteausführung.

Generierte Release-/Testdateien sind absichtlich nicht im Quellcode-Git enthalten. `npm run release:prepare` erzeugt die lokalen Releaseartefakte erneut; `npm run test:ui` erzeugt die Browser-Vorschauen mit einem vorhandenen Chromium-Browser.

## Tatsächlich offene Abnahmen

Die native Desktop-API-/UI-Abnahme von **0.2.4** bleibt offen. Die frühere isolierte 0.1.0-Vorbereitung hatte Obsidian **1.14.5** geladen und endete vor Ausführung der Testplugins an der Vertrauensabfrage. Dieser frühere Versuch ist kein Erfolgsnachweis für die neue Version. Im aktuellen Prüfablauf wurde kein persönlicher Obsidian-Vault verändert und keine Host-Vertrauenseinstellung betätigt.

Im echten Obsidian sind insbesondere Fokus/Tastatur, die Properties- und Dateibaumdarstellung mit aktuellen Themes, Editorpuffer und die native automatische Linkanpassung bei lesbaren Umbenennungen zu prüfen. Unbekannte Zwischenstände werden konservativ blockiert und behalten ihre Originalsicherung. DOM-/Fake-Prüfungen ersetzen diese Hostprüfung nicht.

Echte iOS-/Android-Geräteabnahme bleibt offen. Der aktuelle Implementierungs- und Teststand des anwendungsseitigen Writeller Exchange ist oben mit Benni als Quelle dokumentiert. Der Community-Eintrag liegt laut bereitgestelltem Portal-Screenshot als Entwurf vor; die automatisierte Prüfung von 0.2.3 ist fehlgeschlagen. Die erneute Prüfung von 0.2.4 und die Freigabe sind gesonderte Schritte. Benni ist als Autor und in der MIT-Nennung gesetzt, der Autorenlink ist writeller.com. Der Publish-Readiness-Gate prüft diese Werte ohne verbliebene Platzhalter. GitHub-CI startet bei Push auf Windows und Linux; ihr tatsächlicher Status steht in [Actions](https://github.com/Cmdr-Hawkeye/writeller-obsidian/actions). Die lokale Releasevorbereitung veröffentlicht selbst nichts.
