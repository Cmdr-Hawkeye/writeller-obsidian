# Änderungen

## 0.3.1 — 28.10.2026

- Performance: unveränderte Ansichten lesen keine Notiz-/Begleitdateien erneut und rekonstruieren das Projekt nicht bei jedem Fokus-/Layout-Ereignis. Überlappende Aktualisierungen werden zusammengeführt.
- Metadatenhinweise und gezielte Dateiereignisse aktualisieren den Anzeigeindex inkrementell; identischer gelesener Quelltext kann seine geprüfte YAML-Auswertung wiederverwenden. Vor jedem Schreiben werden die Quellen weiterhin vollständig frisch gelesen und gegen Vorschau und Begleitdaten geprüft.
- Abgeschlossene Journale werden bei gewöhnlichen Projektoperationen anhand ihrer Abschluss-/Besitzmetadaten geprüft; ihre historischen Sicherungsbytes werden erst bei ausdrücklicher Wiederherstellung vollständig validiert. Aktuelle Quellen und unvollständige Journale bleiben geschützt, auch wenn ein offener Vorgang erst nach der Vorschau hinzugekommen ist.
- Vollständig geprüfte Bilder müssen nach erneuter Hash- und Metadatenprüfung nicht bei jedem Aufruf nochmals dekodiert werden. Der begrenzte Cache hält ausschließlich Schlüssel.
- Nach Formularbestätigung kann Obsidian zuerst zeichnen; längeres Speichern zeigt eine vorübergehende, auch bei Fehlern entfernte Aktivitätsmeldung. Unveränderte Editorpuffer werden nicht unnötig gespeichert.
- Reproduzierbarer Vergleich mit 0.3.0, neue IO-/Cache-/Konflikt-/Bildtests und dokumentierte Nachweisgrenzen.

## 0.3.0 — 28.10.2026

- Neuer Anzeigename **Novel Planner - by Writeller**. Plugin-ID `writeller`, Befehls-IDs und bestehende Projektidentitäten bleiben erhalten.
- Deutsch und Englisch für Oberfläche, Formulare, Befehle und Meldungen. Automatische Auswahl über die Obsidian-Sprache; jederzeit durch Deutsch oder English überschreibbar.
- Strukturordner folgen nach konkreter Vorschau der Sprache. Notizdateinamen, eigene Titel, Kapitelordner und benutzerdefinierte Wurzeln bleiben erhalten. Erkennung gewöhnlicher Notizen versteht beide Ordnersprachen.
- Gesicherter Ordnerwechsel über native FileManager-Operationen mit Frische-/Kollisionsprüfung, dauerhaften Originalen und Wiederherstellung. Zielordner werden nicht still zusammengeführt. Technische Erhaltungsdaten behalten stabile Pfade.
- Modulare Übersetzungskataloge mit Prüfung sämtlicher statischer Texte und Platzhalter; dynamische Objekt-/Statusnamen aktualisieren sich ohne Neustart. Bereits offene Projektansichten folgen dem Wechsel.
- Deutsche und englische Anleitung, neue englische Browser-Vorschau und Regressionen für Hin-/Rückwechsel, Fachhashes, gewöhnliche Dateien, Abbruch, Speicherfehler und Recovery.

## 0.2.4 — 28.10.2026

- Community-Review: native, durchsuchbare Einstellungsdefinitionen ersetzen manuelle HTML-Überschriften; Einstellungen werden vor Speicherung validiert und bei Fehlern zurückgesetzt.
- Ajv erzeugt statische Validatoren im Build. Kein Schema-Compiler und keine dynamische Codeausführung mehr in der Plugin-Laufzeit; unveränderter öffentlicher Vertrag und sämtliche bisherigen Erhaltungsprüfungen bleiben bestehen.
- Sichtbarkeit technischer Ordner/Properties verwendet gezielte reversible Klassen ohne `:has` oder dynamische Stylesheets. Native DOM-Helfer, gebundene Aktionsaufrufe und sichere Zeichenprüfungen ersetzen die gemeldeten Muster.
- Dateioperationen respektieren die Obsidian-Löschpräferenz über `FileManager.trashFile`. Gesicherte Journalstände und Frischeprüfungen bleiben erhalten.
- Der offizielle Obsidian-Linter ist in der lokalen Prüfung und CI eingebunden; die englische Satzschreibungsregel wird für die deutsche Oberfläche ausdrücklich nicht angewandt.
- GitHub Actions baut und attestiert `main.js`, `manifest.json` und `styles.css`. Zusätzliche ZIP-, Lizenz- und Prüfsummendownloads bleiben für manuelle Installationen verfügbar.
- Die README beginnt mit dem Manifestnamen „Writeller“ und beschreibt den erforderlichen lokalen Vault-Zugriff.

## 0.2.3 — 27.10.2026

- Über Obsidian angelegte Markdown-Dateien im Projektordner werden in der Schreibübersicht als noch nicht zugeordnet angezeigt. Eine passende Notizart wird vorgeschlagen und einmal ausdrücklich bestätigt.
- Text, eigene YAML-Eigenschaften und Dateipfad bleiben beim Übernehmen erhalten; Projektidentität und Begleitdaten werden ergänzt. Nachträgliche Änderungen blockieren veraltete Schreibpläne.
- Vor einem Export wird auf unzugeordnete Dateien hingewiesen; Auslassen erfordert eine ausdrückliche Wahl.
- Native Ordner- und Dateimenüs bieten passende Erstellungs- und Übernahmeaktionen.
- Kapitelvorschläge berücksichtigen verwaltete Kapitel. Szenen unter `Ohne Kapitel` werden nicht automatisch dem letzten Kapitel zugeordnet. Fremde und verschachtelte Projekte bleiben getrennt.

## Dokumentation — 27.10.2026

- GitHub-Release 0.2.3 ist als regulärer Latest Release veröffentlicht. Der manuelle Workflow erzeugt reguläre Releases als Standard; Vorabversionen benötigen eine ausdrückliche Option.
- Die GitHub-Startseite enthält Deutsch und Englisch auf derselben Seite, mit Sprunglinks zur jeweiligen Sprache.
- Der Austauschstatus ist aktualisiert: Writeller Exchange 1.0.0 ist in Writeller implementiert und getestet; am 27.10.2026 von Benni bestätigt.

## 0.2.2 — 27.10.2026

- Alte Austauschordner und aktuelle Exportziele werden auch dann ausgeblendet, wenn sie ausschließlich Exchange-JSON-Dateien enthalten. Eigene Notizen, Bilder und unbekannte Dateien verhindern die Ausblendung.
- Die Einstellung für technische Informationen blendet diese Ordner wieder ein. Dateien bleiben auf dem Datenträger erhalten.
- Autor in der Erweiterungsliste: **Benni**. Autorenlink: **writeller.com**. Kurze zweisprachige Beschreibung im statischen Manifest.
- Öffentlich vorbereiteter Repository-Auftritt mit deutscher Startseite, englischer Kurzfassung, Handbuch, FAQ, Beitragsregeln, Issuevorlagen und gekennzeichneten Browser-Vorschauen.

## 0.2.1 — 27.10.2026

- Unveränderte Aktualisierungen behalten Buttons, Tastaturfokus und aufgeklappte Gruppen bei. Ein Klick geht bei einem solchen Refresh zwischen Drücken und Loslassen nicht mehr verloren.
- Erfolgreiche Exporte nennen für zwölf Sekunden ihren tatsächlichen Vault-Pfad.
- Neuer Standardordner **Exporte**. Frühere Standardziele werden umgestellt; wirklich leere alte Wurzeln aufgeräumt.

## 0.2.0 — 27.10.2026

- Neue Schreibübersicht für Manuskript, Planung und Wortziel.
- Verständliche Formulare und direkte Befehle für Kapitel, Szenen, Figuren, Orte und weitere Notizarten.
- Lesbare Projekt-, Notiz- und Exportnamen ohne angehängte IDs; Namenskollisionen erhalten `(2)` usw.
- Vorschau und Originalsicherung vor bewusster Umordnung älterer Hashpfade.
- Technische Daten und Properties in der normalen Oberfläche ausgeblendet.

## 0.1.0 — 27.10.2026

- Eigenständiger Obsidian-Adapter für lokale Markdown-Schreibprojekte.
- Manueller Import/Export nach Writeller Exchange 1.0.0 mit Vertragsprüfung, Erhaltung vollständiger Datensätze, Konfliktentscheidungen und Wiederherstellungsjournal.

Die Vorschauversionen sind keine Community-Verzeichnisfreigabe. Native Geräteabnahme und anwendungsseitige Austauschtests sind im [Prüfnachweis](docs/verification-report.md) getrennt dokumentiert.
