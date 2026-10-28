# Writeller for Obsidian

Schreibprojekte mit Kapiteln, Szenen, Figuren, Orten und Ideen in normalen Markdown-Dateien organisieren. Die Schreibübersicht führt zu deinen Notizen und zeigt Manuskript, Planung und Wortziel zusammen. Kostenlos nutzbar, ohne Konto, Writeller-Lizenz, Tracking, KI-Aufrufe oder Netzwerkzugriff des Plugins. [Writeller](https://www.writeller.com).

**Entwicklungsstand 0.3.1:** Schreiboberfläche mit lesbarer Ablage, stabilen Bedienelementen bei unveränderten Hintergrundaktualisierungen und auffindbaren Exporten. Automatisierte Vertrags-, Speicher- und Oberflächentests sowie ein Browser-Testhost sind geprüft. Die native Obsidian-Abnahme dieser Version und echte Mobile-Gerätetests sind noch offen. Dieser Prüfnachweis ersetzt keine Community-Prüfung. Der manuelle Austausch folgt exakt **Writeller Exchange 1.0.0**, das in Writeller implementiert und getestet ist; Benni hat diesen aktuellen Stand am 27.10.2026 bestätigt. Das bisherige Archiv `*.writeller.json` / `writeller.project.v5` ist ein anderes Format und bleibt inkompatibel.

## Installation und erster Start

Der Anzeigename ist **Novel Planner - by Writeller**; die interne ID `writeller` bleibt erhalten. **Sprache → Automatisch (Obsidian)** wählt Deutsch bei deutscher Obsidian-Oberfläche und sonst Englisch. Die Auswahl **Deutsch** oder **English** überschreibt dies. Strukturordner folgen nach konkreter Vorschau der Sprache. Eigene Titel, Kapitelordner, benutzerdefinierte Wurzeln und sämtliche `.md`-Dateinamen bleiben erhalten. Technische Sicherungsdaten behalten stabile Pfade. [Details und Wiederherstellung](languages.md).

1. Vault sichern. Aus `release/0.3.1/writeller-0.3.1.zip` den Ordner `writeller` nach `<Vault>/.obsidian/plugins/` kopieren. Bei einem Update die Plugin-Dateien ersetzen, eigene Vault-Dateien behalten. Mindestversion: **1.14.5**.
2. Novel Planner - by Writeller in Obsidian aktivieren beziehungsweise neu laden. Über das Buchsymbol oder **Novel Planner - by Writeller: Schreibprojekte öffnen** die Übersicht öffnen.
3. **Schreibprojekt erstellen** wählen, Titel und bei Bedarf Beschreibung und Wortziel eingeben. Das Formular legt das Projekt an und öffnet die Übersicht.
4. **Kapitel hinzufügen**, **Szene hinzufügen**, **Figur hinzufügen** oder **Ort hinzufügen** wählen. Die Formulare fragen nach verständlichen Angaben; Szenen können direkt einem Kapitel zugeordnet werden. Anschließend öffnet sich die echte Markdown-Datei zum Schreiben.

Gegenstände, Ereignisse, Handlungsbögen, Notizen, Recherche, Beziehungen und eigene Objektarten sind ebenfalls verfügbar. Die Befehlspalette verwendet dieselben Begriffe. In der Übersicht öffnen die Titel die Dateien; das Zeilenmenü bietet Details und bei Kapiteln/Szenen das Verschieben in der Reihenfolge. **Weiterschreiben** öffnet die letzte Szene der Manuskriptreihenfolge. Der Wortzähler ist eine Orientierung für den aktuellen Szenentext.

## Lesbare Dateien

```text
Schreibprojekte/Mein erstes Buch/
  Mein erstes Buch.md
  Manuskript/01 - Die Ankunft/
    Die Ankunft.md
    01 - Nebel am Hafen.md
  Figuren/Lina.md
  Orte/Alter Hafen.md
  Gegenstände/Kompass.md
  Notizen/Ideen zum Ende.md
```

Namen enthalten keine angehängten IDs oder Hashes. Nur bei tatsächlichen Namenskollisionen wird `(2)`, `(3)` usw. ergänzt. Ungültige Dateizeichen werden ersetzt. Szenen ohne Kapitel liegen unter `Manuskript/Ohne Kapitel`. Eigene Objektarten bekommen eine lesbare Untergruppe in `Eigene Typen`.

Bestehende Projekte werden **nicht automatisch umbenannt**. Bei den bisherigen Hashnamen bietet die Übersicht **Dateinamen vereinfachen** an. Alternativ: **Projektdateien lesbar ordnen** in der Palette. Die Vorschau nennt die Umzüge; erst **Übernehmen** startet sie. Texte, Identitäten, Austauschbasen und Bildbytes bleiben erhalten. Auch nach Titel- oder Reihenfolgeänderungen lässt sich die Ablage darüber bewusst neu ordnen.

Dateinamen und Ordner bestimmen keine bestehende Zugehörigkeit. Interne Eigenschaften verbinden die Notizen weiterhin mit dem richtigen Projekt. Eigene Obsidian-Properties bleiben erhalten. Eine normale Dateikopie übernimmt auch die Identität; für ein unabhängiges Schreibprojekt **Projekt kopieren** verwenden. Eine vorhandene gewöhnliche Notiz lässt sich über **Diese Notiz einem Schreibprojekt zuordnen** aufnehmen.

Ab 0.2.3 erkennt die Übersicht auch gewöhnliche Markdown-Dateien im tatsächlichen Projektordner. Sie erscheinen unter **Noch nicht im Schreibprojekt**, mit einem Vorschlag wie **Als Figur übernehmen**. Ein bestätigtes Formular ergänzt Identität und Begleitdaten, erhält aber Text, eigene Properties und Dateipfad. **Andere Notizart…** lässt den Vorschlag ändern. Unter einem erkannten Kapitel wird die Kapitelzuordnung vorgeschlagen; `Ohne Kapitel` bleibt ausdrücklich unzugeordnet. Bei gemeinsam genutzten Projektordnern ist der Projekttitel im Formular zu prüfen. Es erfolgt keine stille Umdeutung vorhandener Projektobjekte.

Vor dem Export wird auf noch nicht zugeordnete Dateien hingewiesen. Du kannst zuerst die Übersicht öffnen oder ausdrücklich nur bereits zugeordnete Notizen exportieren. Native Projektordner-Menüs bieten passende Writeller-Aktionen zum sofort verwalteten Anlegen. Änderungen einer gewöhnlichen Datei zwischen Übernahmeplanung und Schreiben blockieren einen veralteten Plan und bleiben erhalten.

## Details und technische Daten

**Details bearbeiten** zeigt Titel, Status und passende Angaben wie Kapitelzuordnung, Wortziel, Figurenrolle oder Recherchequelle. Beziehungen erhalten eine eigene Notiz mit lesbaren Verweisen und auswählbaren Beziehungspartnern. Die technischen IDs erscheinen in den Formularen nicht. Unbekannte und verschachtelte Austauschfelder bleiben im Hintergrund erhalten.

`Writeller-Daten` sowie leere oder ausschließlich mit Exchange-Dateien gefüllte Exportordner sind für den Schreiballtag standardmäßig im Dateibaum ausgeblendet. Ein Ordner mit eigenen Markdown-Notizen, Bildern oder unbekannten Dateien bleibt sichtbar. Die technischen `writeller-*`-Eigenschaften verwalteter Notizen werden ebenfalls in der normalen Properties-Ansicht ausgeblendet. Eigene Properties bleiben sichtbar. Im Markdown-Quelltext sind die technischen Angaben weiterhin vorhanden. Unter **Einstellungen → Writeller → Technische Informationen anzeigen** lassen sich Ordner, Properties und zusätzliche Werkzeuge wieder einblenden. Bei deaktiviertem Plugin entfällt diese Darstellungseinstellung.

Die Daten werden weiterhin lokal im Vault gespeichert:

- `records` erhält vollständige Datensätze einschließlich Angaben, die Markdown allein nicht ausdrückt.
- `journal` sichert Originale und Schreibvorgänge für die Wiederherstellung nach Unterbrechungen.
- `state.json` hält Projektzuordnungen und Austauschstände; `assets` enthält aufgenommene Bilder.

**Notizen und Begleitdaten immer gemeinsam sichern. Den Datenordner nicht löschen.** Ohne vollständige Begleitdaten bleibt Text bearbeitbar, ein verlustarmer Export ist jedoch blockiert. Wiederherstellung benötigt eine passende ursprüngliche Exchange-Datei. Die Projektbeschreibung enthält einen validierten Verweis auf die Begleitdaten; dadurch bleiben Projekte auch ohne die Plugin-Einstellungen auffindbar. [Datenlayout](data-layout.md).

## Manueller Import und Export

Eine `.writeller-exchange.json` in einen normalen Vault-Ordner kopieren und **Projektdatei importieren** wählen. Das Plugin prüft die Datei, zeigt das Vorhaben und fragt bei Konflikten nach einer Entscheidung. Namen oder Zeitstempel entscheiden keine Konflikte. Fehlende Objekte löschen nichts automatisch. Ein unabhängiges Projekt bekommt neue Identitäten.

**Exportieren** in der Projektübersicht prüft aktuelle Dateien und zeigt eine Vorschau. Die Ausgabe liegt standardmäßig unter `Exporte/Mein erstes Buch.writeller-exchange.json`; vorhandene Dateien werden nicht ersetzt. Nach erfolgreichem Speichern zeigt eine Meldung für zwölf Sekunden den genauen Pfad innerhalb des aktuellen Vaults, einschließlich einer eventuell ergänzten Kollisionsnummer. Bei mehreren Austauschpartnern wird die verwendete Vergleichsbasis ausdrücklich gewählt. Export ist keine Empfangsbestätigung. Desktop und Mobile verwenden denselben Vault-Dateiweg; ein externer Speichern-Dialog oder OS-Teilen ist nicht implementiert.

`Exporte` wird erst beim tatsächlichen Export angelegt. Frühere Standardordner wie `Writeller-Austausch` oder `Writeller Exchange` werden für neue Exporte auf `Exporte` umgestellt; selbst gewählte andere Ziele bleiben erhalten. Beim Plugin-Start werden diese früheren Wurzeln nur entfernt, wenn sie wirklich leer sind und keinem konfigurierten Projekt-/Datenpfad dienen. Bestehende Dateien und selbst leere Unterordner bleiben erhalten. Für Importe wird kein zusätzlicher Ablageordner benötigt.

Austauschdateien und Journale enthalten private Texte und Bildbytes im Klartext. Recherchelinks werden erhalten, aber vom Plugin nicht geöffnet oder heruntergeladen. Die Oberfläche unterstützt Deutsch und Englisch; Ordner für neue Projekte, Austausch und technische Daten sind einstellbar.

## Texte, Bilder und Erhaltung

Plaintext bleibt exakter Quelltext. Markdown wird erst durch eine bewusste Formatänderung als Markdown gespeichert. Logische `entity:`-Links werden auf Projektdateien abgebildet und beim Rückexport über deren Identität aufgelöst. Fremde oder unverwaltete Linkziele und Block-/Heading-Ziele benötigen eine ausdrückliche Zuordnung. Unveränderte Projektionen liefern den exakten Originaltext einschließlich Zeilenenden zurück.

Externe Bilder, aktives HTML und gefährliche URI-Schemata werden als inaktiver Quelltext dargestellt; das Original bleibt erhalten. Bearbeitete geschützte Ansichten und komplexe Linkzuordnungen können den technischen JSON-Editor erfordern. Annotationen bleiben nach Textänderungen als Prüfhinweise erhalten; alte Offsets werden nicht angewandt. Tabellen, Callouts und andere Erweiterungen bleiben Quelltext, ihre Darstellung in anderen Anwendungen ist nicht zugesichert.

**Bild hinzufügen** übernimmt eine ausdrücklich ausgewählte lokale PNG-/JPEG-Datei ohne Skalierung oder Neukodierung. Bildbytes, Hash, Maße und vollständige Dekodierung werden geprüft. Extern geänderte Bilder benötigen eine passende Original-Exchange-Datei, damit frühere Bytes erhalten bleiben. SVGs, Animationen, PDFs und sonstige Binäranhänge werden nicht unterstützt.

Vertragsgrenzen: 128 MiB Datei, 10000 Datensätze ohne Projekt einschließlich Bilder, 64 JSON-Ebenen, 25 MiB Stringwerte ohne Bilddaten, 8 MiB Einzelstring, 256 Bilder, 2 MiB je Bild / 64 MiB insgesamt und höchstens 2400 × 2400 Pixel. [Unveränderter Austauschvertrag](WRITELLER-EXCHANGE-SPEC.md).

## Unterbrochene Vorgänge

Vor Mehrdateiänderungen werden Originale und geplante Stände lokal gesichert. Bei einem unvollständigen Vorgang wird **Unterbrochenen Vorgang wiederherstellen** angeboten. Die Wiederherstellung verändert nur bekannte eigene Schreibstände; fremde Nachbearbeitung bleibt erhalten und wird als Konflikt gemeldet. Originale bleiben gesichert.

Obsidian bietet keine Mehrdateitransaktion. Property- und Textänderungen sowie native Linkanpassungen bei Umbenennungen können Zwischenstände erzeugen, die einen manuellen Vergleich mit der Originalsicherung benötigen. Andere Synchronisationsprogramme bieten keine gemeinsame Sperre. Journale ersetzen keine regelmäßige Vault-Sicherung.

## Entwicklung und Prüfung

Node **22.13.1** oder kompatibel. Jeweils eine PowerShell-Zeile:

```powershell
npm ci
```

```powershell
npm run check
```

```powershell
npm run test:ui
```

```powershell
npm run release:prepare
```

`check` umfasst Typprüfung, ESLint, Dateigrenzen, Handoff-Integrität, Tests und Browserbuild. `test:ui` prüft die tatsächlichen Oberflächenmodule in einem Browser-Testhost mit kontrolliertem Obsidian-API-Ersatz; es ist keine native Geräteabnahme. Ein installiertes Chrome/Edge oder `UI_BROWSER` ist dafür erforderlich. `release:prepare` erzeugt nur lokale Dateien.

[Architektur](architecture.md), [Tests](testing.md), [Kompatibilität](compatibility.md), [Prüfnachweis](verification-report.md), [Releasecheck](release-checklist.md).

Quellcode-Lizenz: MIT, © 2026 **Benni**. Der Autorenlink führt zu [writeller.com](https://www.writeller.com). [Drittanbieter-Lizenzen](../THIRD-PARTY-NOTICES.md) gehören zum Paket. Das Plugin enthält keinen proprietären Writeller-Anwendungscode. Die statische Plugin-Beschreibung ist zweisprachig; die Oberfläche unterstützt Deutsch und Englisch. [Sprachhinweis](faq.md).
