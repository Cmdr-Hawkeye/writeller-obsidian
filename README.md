<p align="center"><img src="docs/assets/header.svg" alt="Writeller for Obsidian — Kapitel. Szenen. Deine Geschichte." width="100%"></p>

<p align="center"><a href="https://www.writeller.com">writeller.com</a> · <a href="https://github.com/Cmdr-Hawkeye/writeller-obsidian/releases">Download</a> · <a href="docs/handbuch.md">Handbuch</a> · <a href="README.en.md">English</a></p>

<p align="center"><a href="https://github.com/Cmdr-Hawkeye/writeller-obsidian/actions/workflows/check.yml"><img src="https://github.com/Cmdr-Hawkeye/writeller-obsidian/actions/workflows/check.yml/badge.svg" alt="Automatisierte Prüfung"></a> <a href="LICENSE">MIT-Lizenz</a> · Vorschau 0.2.2 · von Benni</p>

Dein Buch wächst in **normalen Markdown-Dateien**. Writeller bringt Kapitel, Szenen, Figuren, Orte und Ideen in eine gemeinsame Schreibübersicht in [Obsidian](https://obsidian.md). Du schreibst in deinen eigenen Notizen und behältst eine lesbare Ablage.

**Kostenlos. Lokal. Ohne Konto.** Das Plugin benötigt keine Writeller-Lizenz und führt keine Netzwerk-, Tracking- oder KI-Aufrufe aus.

![Schreibübersicht mit Manuskript links sowie Figuren, Orten und Gegenständen rechts](docs/assets/schreibuebersicht.png)

*Vorschau der tatsächlichen Oberflächenmodule im Browser-Testhost mit synthetischen Beispieldaten. Die Aufnahme ist kein nativer Obsidian- oder Geräteabnahmetest. [Herkunft der Bilder](docs/assets/README.md).*

## Vom ersten Kapitel zur Geschichte

- **Ein Schreibbereich:** Manuskript, Planung und Wortziel zusammen sehen.
- **Direkt hinzufügen:** Kapitel, Szene, Figur oder Ort wählen, verständliches Formular ausfüllen und losschreiben.
- **Lesbare Namen:** `Nebel am Hafen.md` statt einer Datei mit angehängten IDs.
- **Zusammengehöriges zusammen:** Kapitel und ihre Szenen liegen im selben Manuskriptordner.
- **Mehr als Manuskript:** Gegenstände, Ereignisse, Handlungsbögen, Recherche, Beziehungen und eigene Objektarten festhalten.
- **Bewusst austauschen:** Projektdateien mit Vorschau exportieren oder importieren und Konflikte selbst entscheiden.

## Installieren

Das Plugin ist eine **Vorschau** und noch nicht im Obsidian-Community-Verzeichnis gelistet. Die Oberfläche ist derzeit Deutsch. Voraussetzung: Obsidian **1.14.5 oder neuer**; echte Mobile-Geräte sind noch nicht abgenommen.

1. Den Vault sichern und das [Release 0.2.2](https://github.com/Cmdr-Hawkeye/writeller-obsidian/releases/tag/0.2.2) öffnen.
2. Unter **Assets** `writeller-0.2.2.zip` herunterladen und entpacken.
3. Den enthaltenen Ordner `writeller` nach `<Vault>/.obsidian/plugins/` kopieren. `main.js`, `manifest.json` und `styles.css` müssen direkt darin liegen.
4. Obsidian öffnen und **Einstellungen → Community-Erweiterungen → Writeller** aktivieren. Beim Update die Plugin-Dateien ersetzen und das Plugin neu laden.

Der Download ist das **Plugin-ZIP unter Assets**, nicht GitHubs automatisch erzeugtes Quellcode-Archiv. [Ausführliche Installations- und Updatehilfe](docs/faq.md).

## In drei Schritten anfangen

1. Das **Buchsymbol** anklicken oder **Writeller: Schreibprojekte öffnen** in der Befehlspalette wählen.
2. Ein **Schreibprojekt erstellen** und ihm einen Titel geben. Beschreibung und Wortziel sind optional.
3. **Kapitel hinzufügen**, darin eine **Szene hinzufügen** und in der geöffneten Markdown-Datei schreiben.

Figuren und Orte liegen rechts in der Übersicht. Ein Klick auf ihren Namen öffnet die entsprechende Notiz; das Menü daneben führt zu **Details bearbeiten**. Auch die Befehlspalette verwendet diese Schreibbegriffe.

<details>
<summary>Figurenformular und schmale Ansicht ansehen</summary>

<p><img src="docs/assets/figur-formular.png" alt="Formular mit Name, Kurzbeschreibung, Rolle und Motivation einer Figur" width="320"> <img src="docs/assets/schmale-ansicht.png" alt="Schreibübersicht in einem 390 Pixel breiten Browserfenster" width="320"></p>

Beide Aufnahmen stammen aus dem Browser-Testhost. Die schmale Ansicht belegt keine Ausführung auf einem Smartphone.

</details>

## Deine Dateien bleiben verständlich

```text
Schreibprojekte/
└─ Mein erstes Buch/
   ├─ Mein erstes Buch.md
   ├─ Manuskript/
   │  └─ 01 - Die Ankunft/
   │     ├─ Die Ankunft.md
   │     └─ 01 - Nebel am Hafen.md
   ├─ Figuren/Lina.md
   ├─ Orte/Alter Hafen.md
   └─ Notizen/Ideen zum Ende.md
```

Bei gleichnamigen Dateien wird nur bei Bedarf `(2)` ergänzt. Bisherige Projekte mit langen Hashnamen können über **Dateinamen vereinfachen** mit Vorschau neu geordnet werden.

Technische Begleitdaten und reine Exportordner werden beim Schreiben ausgeblendet. **Einstellungen → Writeller → Technische Informationen anzeigen** macht sie wieder sichtbar. Enthält ein Exportordner eigene Notizen, Bilder oder andere Dateien, bleibt er sichtbar. Die Dateien werden durch das Ausblenden nicht gelöscht. **Immer den vollständigen Vault einschließlich `Writeller-Daten` sichern.**

## Export und Writeller

**Exportieren** erstellt eine Datei wie `Exporte/Mein erstes Buch.writeller-exchange.json`. Vorher siehst du eine Vorschau; danach nennt eine Meldung den genauen Speicherort im aktuellen Vault. Bestehende Dateien werden nicht ersetzt. Importdateien kannst du in einen beliebigen Vault-Ordner kopieren und über **Projektdatei importieren** auswählen.

Der Austausch folgt dem offenen Vertrag **Writeller Exchange 1.0.0**. Laut mitgelieferter Spezifikation ist dieser Vertrag noch nicht in der Writeller-Anwendung implementiert. Ein funktionierender Austausch mit einer bestimmten Anwendungsversion wird deshalb nicht zugesichert. Das frühere Archiv `*.writeller.json` ist inkompatibel. [Austausch und Grenzen](docs/compatibility.md).

Mehr über Writeller: **[www.writeller.com](https://www.writeller.com)**.

## Hilfe, Entwicklung und Lizenz

| Gesucht | Hier geht es weiter |
| --- | --- |
| Bedienung und Details | [Handbuch](docs/handbuch.md) |
| Installation, Sprache, unsichtbare Ordner | [Häufige Fragen](docs/faq.md) |
| Änderungen | [Changelog](CHANGELOG.md) |
| Fehler oder Idee melden | [Issues](https://github.com/Cmdr-Hawkeye/writeller-obsidian/issues/new/choose) |
| Selbst beitragen | [CONTRIBUTING](CONTRIBUTING.md) |
| Architektur und Dateigrenzen | [Architektur](docs/architecture.md) |
| Tatsächliche Prüfungen und offene Geräteabnahme | [Prüfnachweis](docs/verification-report.md) |

Quellcode: **[MIT](LICENSE), © 2026 Benni**. Drittanbieter-Lizenzen: [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md). Dieses Repository enthält den eigenständigen Obsidian-Adapter; keinen proprietären Writeller-Anwendungscode. Keine Zugehörigkeit zum Obsidian-Hersteller wird behauptet.
