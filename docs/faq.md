# Häufige Fragen

[Zur Startseite](../README.md) · [Handbuch](handbuch.md) · [Writeller](https://www.writeller.com)

## Wie installiere oder aktualisiere ich das Plugin?

Öffne [die Releases](https://github.com/Cmdr-Hawkeye/writeller-obsidian/releases) und lade unter **Assets** die Datei `writeller-<Version>.zip` herunter. Das automatisch angebotene Quellcode-Archiv enthält keinen fertigen Build. Entpacke den Ordner `writeller` nach `<Vault>/.obsidian/plugins/`. Darin müssen `main.js`, `manifest.json` und `styles.css` direkt liegen. Sichere den Vault vorher.

Aktiviere das Plugin in Obsidian unter **Einstellungen → Community-Erweiterungen**. Beim Update ersetze die Plugin-Dateien und lade das Plugin neu. Die dort angezeigte Versionsnummer muss zum Download passen. Zeigt Obsidian weiterhin 0.2.0, ist noch der ältere Build geladen. Eigene Vault-Dateien und `data.json` mit den Einstellungen müssen für ein Update nicht entfernt werden.

## Wo starte ich ein Schreibprojekt?

Über das Buchsymbol oder **Writeller: Schreibprojekte öffnen**. Lege ein Projekt an und füge Kapitel und Szenen hinzu. Figuren, Orte und Ideen findest du im Planungsbereich. Alle Titel öffnen echte Markdown-Dateien. Du benötigst keine technische Objekt-ID.

## Warum sehe ich „Writeller Austausch“ oder „Exporte“ nicht mehr?

Obsidian zeigt Austausch-JSON-Dateien im normalen Dateibaum üblicherweise nicht als Notizen. Dadurch kann ihr Ordner leer wirken, obwohl er Exportdateien enthält. Ab 0.2.2 blendet das Plugin alte Austauschordner und das aktuelle Exportziel aus, solange sie leer sind oder ausschließlich Exchange-Dateien enthalten. Eigene Markdown-Notizen, Bilder und unbekannte Dateien verhindern die Ausblendung.

**Einstellungen → Writeller → Technische Informationen anzeigen** macht die Ordner wieder sichtbar. Im Dateimanager und in Sicherungen bleiben alle Dateien vorhanden. Alte wirklich leere Standardordner werden zusätzlich beim Start in den lokalen Papierkorb verschoben. Ordner mit Inhalten oder Unterordnern werden nicht entfernt.

## Wo finde ich meinen Export zum Weitergeben?

Standardmäßig unter `Exporte/<Projekttitel>.writeller-exchange.json` im aktuellen Vault. Nach dem Speichern zeigt eine zwölf Sekunden sichtbare Meldung den genauen Pfad. Öffne diesen Ordner im Dateimanager deines Betriebssystems. Eine bestehende Datei wird nicht überschrieben; ein weiterer Export kann beispielsweise `(2)` im Namen tragen.

Das Plugin verwendet denselben Vault-Dateiweg auf Desktop und Mobile. Ein nativer „Speichern unter“-Dialog ist derzeit nicht eingebaut. Importdateien können in jedem normalen Vault-Ordner liegen; ein eigener Importordner ist nicht erforderlich.

## Kann die Beschreibung in der Erweiterungsliste automatisch Deutsch oder Englisch sein?

Für diesen Text bietet Obsidians `manifest.json` derzeit nur **ein statisches Feld `description`** und keine sprachabhängigen Varianten. Deshalb ist die kurze Beschreibung zweisprachig. Der Anzeigename des Autors ist **Benni**, der Autorenlink führt zu **[writeller.com](https://www.writeller.com)**. [Offizielle Manifest-Dokumentation](https://docs.obsidian.md/Reference/Manifest).

Die eigentliche Plugin-Oberfläche ist derzeit Deutsch. Die GitHub-Startseite enthält Deutsch und Englisch direkt auf derselben Seite; die englische Fassung erklärt die wichtigsten Begriffe. Eine vollständig nach Obsidian-Sprache umschaltende Oberfläche ist in dieser Version nicht implementiert.

## Wozu gibt es `records`, `journal` und `state.json`?

`records` erhält vollständige Projektdatensätze und Angaben, die Markdown allein nicht ausdrückt. `journal` enthält Originale und geplante Änderungen, damit unterbrochene Vorgänge geprüft und wiederhergestellt werden können. `state.json` hält die Zuordnungen und Austauschstände. Diese Begleitdaten werden beim Schreiben ausgeblendet, bleiben aber wichtig. **Den gesamten Vault sichern und `Writeller-Daten` nicht löschen.** [Datenlayout](data-layout.md).

## Funktioniert der Austausch schon mit der Writeller-Anwendung?

Ja. **Writeller Exchange 1.0.0 ist in Writeller implementiert und getestet.** Projekte können über dieses Format manuell mit dem Obsidian-Plugin ausgetauscht werden. Diesen aktuellen Stand hat Benni am 27.10.2026 bestätigt. Verwende die Datei mit der Endung `.writeller-exchange.json`; das frühere Projektarchiv `*.writeller.json` ist ein anderes Format und wird nicht importiert. [Kompatibilität](compatibility.md).

## Muss ich für das Plugin bezahlen oder ein Konto anlegen?

Nein. Das Plugin benötigt weder Konto noch Writeller-Lizenz. Es ruft keine KI-Dienste auf und sendet keine Texte an einen Server. Eine Exchange-Datei enthält die exportierten Texte und Bilder im Klartext; du entscheidest, wohin du sie weitergibst.

## Sind die Screenshots echte Obsidian-Aufnahmen?

Die Repository-Bilder zeigen die tatsächlichen Produktionsmodule in einem Browser-Testhost mit einem kontrollierten Obsidian-API-Ersatz. Die Daten sind synthetisch. Sie sind keine Aufnahmen aus einem persönlichen Vault und belegen keine native Desktop-/Mobile-Abnahme. [Bildnachweis](assets/README.md) und [Prüfnachweis](verification-report.md).

## Wo melde ich einen Fehler?

Über [GitHub Issues](https://github.com/Cmdr-Hawkeye/writeller-obsidian/issues/new/choose). Nenne Plugin-Version, Obsidian-Version, Betriebssystem, Schritte und erwartetes Verhalten. Verwende möglichst ein kleines synthetisches Testprojekt. Manuskripte, private Exportdateien, Journale oder Zugangsdaten gehören nicht in eine öffentliche Fehlermeldung.
