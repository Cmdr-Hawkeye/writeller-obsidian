# Lokales Datenlayout, Version 1

Dies ist ein eigener lokaler Vertrag, kein Bestandteil des plattformneutralen Exchange-Formats. Unbekannte Versionsnummern werden blockiert. Migrationstests prüfen v1-Laden, Besitz und die Ablehnung nicht implementierter Versionen.

Lokale JSON-Hüllen haben eigene Speicherbudgets: 512 MiB Datei, 72 Ebenen, 32 MiB Einzelstring und 256 MiB Stringwerte. Die zusätzlichen Ebenen und mehrfach erhaltenen Partnerrecords dürfen gültige Exchange-Daten nicht schon am öffentlichen 64-/25-MiB-Budget scheitern lassen. Jeder geplante Begleitdatensatz wird vor dem Schreiben erneut unter den lokalen Grenzen gelesen; das Plugin schreibt keine anschließend unlesbare Zustandsdatei. Sehr viele Partner mit großen Textständen können diese praktischen Speichergrenzen erreichen; der Vorgang blockiert dann vor den Zieländerungen.

```text
Schreibprojekte/Mein erstes Buch/Mein erstes Buch.md
Schreibprojekte/Mein erstes Buch/Manuskript/01 - Die Ankunft/Die Ankunft.md
Schreibprojekte/Mein erstes Buch/Manuskript/01 - Die Ankunft/01 - Nebel am Hafen.md
Schreibprojekte/Mein erstes Buch/Manuskript/Ohne Kapitel/...
Schreibprojekte/Mein erstes Buch/Figuren/...
Schreibprojekte/Mein erstes Buch/Orte/...
Schreibprojekte/Mein erstes Buch/Gegenstände/...
Schreibprojekte/Mein erstes Buch/Ereignisse/...
Schreibprojekte/Mein erstes Buch/Handlungsbögen/...
Schreibprojekte/Mein erstes Buch/Eigene Typen/...
Schreibprojekte/Mein erstes Buch/Beziehungen/...
Schreibprojekte/Mein erstes Buch/Notizen/...
Schreibprojekte/Mein erstes Buch/Recherche/...
Writeller-Daten/<sha256(project.id)>/
  state.json
  records/<collection>/<sha256(record.id)>.json
  assets/<bildhash>.png oder .jpg
  assets/originals/<bildhash>.png oder .jpg
  journal/<uuid>/journal.json
  journal/<uuid>/<index>-before.bin
  journal/<uuid>/<index>-after.bin
  journal/<uuid>/<index>-pending.bin
Exporte/Mein erstes Buch.writeller-exchange.json
```

Seit Plugin 0.2.0 enthalten neue Projekt-, Notiz- und Exportnamen keine Identitätshashes. `readableName` normalisiert Unicode, ersetzt ungültige Zeichen und begrenzt den Titelanteil auf 80 Zeichen. `NameAllocator` berücksichtigt bestehende Dateien und ihre Eltern case-/NFC-unabhängig; tatsächliche Kollisionen erhalten `(2)`, `(3)` usw. Kapitel und Szenen verwenden lesbare Reihenfolgenummern. Untergeordnete Szenen bekommen einen eigenen Unterordner. Bekannte Katalogtypen werden nach ihrem deutschen Begriff abgelegt; eigene Typen können einen erhaltenen Anzeigenamen tragen. Technische Projekt- und Recordpfade bleiben gehasht, damit opake IDs keine Pfade vorgeben.

Bestehende Pfadhinweise bleiben beim gewöhnlichen Speichern erhalten. **Dateinamen vereinfachen** beziehungsweise **Projektdateien lesbar ordnen** berechnet ein neues Layout und zeigt alle Umzüge vor der Bestätigung. Umbenennen ist eine Darstellungsänderung, keine neue Projektlinie. Eigene Properties, Fachidentitäten, Basen und Assets bleiben erhalten.

Ab 0.2.1 lautet das Standard-Exportziel `Exporte`. Frühere Standardnamen werden in den Einstellungen umgestellt; individuelle Pfade bleiben erhalten. Leere frühere Wurzeln werden beim Start über einen frischen nativen `TFolder.children`-Check in den lokalen Papierkorb verschoben. Nichtleere Ordner, selbst leere Unterordner sowie konfigurierte Projekt-/Datenwurzeln bleiben bestehen. Der Exportordner wird erst durch einen tatsächlichen Export erzeugt. Importdateien können in jedem gewöhnlichen Vault-Ordner liegen.

Ab 0.2.2 werden erkannte alte Austauschwurzeln und das konfigurierte Exportziel standardmäßig auch dann im Dateibaum ausgeblendet, wenn sie ausschließlich Exchange-JSON-Dateien enthalten. Eigene Notizen, Bilder und unbekannte Dateien verhindern diese Ausblendung. Das ist eine reversible CSS-Darstellung und kein Entfernen von Exporten. Die technische Anzeigeeinstellung macht diese Ordner wieder sichtbar; auch bei deaktiviertem Plugin sind sie normal vorhanden.

`Writeller-Daten` bleibt ein gewöhnlicher Vault-Ordner und wird über offizielle APIs gelesen und geschrieben. Das Plugin blendet seine erkannten eigenen Datenwurzeln standardmäßig nur im Dateibaum aus. Technische `writeller-*`-Properties sind in verwalteten Notizansichten ebenfalls ausgeblendet. Die Einstellung **Technische Informationen anzeigen** hebt beides auf; beim Deaktivieren werden die temporären Styles und Klassen entfernt. Im Quelltext und auf dem Datenträger bleiben alle Angaben vorhanden. Wurzeln mit verwalteten Inhaltsnotizen werden nicht ausgeblendet.

Normale Notizen tragen `writeller-schema`, `writeller-project-id`, `writeller-id`, `writeller-collection`, `writeller-title` und passende fachliche Properties. Bei Projekten gilt `writeller-id == writeller-project-id`; das Manifest trägt zusätzlich `writeller-state-path`. Dieser Pfad muss vaultrelativ sein und auf den Hashordner derselben Projekt-ID zeigen. Die Zustandsdatei muss denselben Besitz bestätigen. Fremde Notizen im gleichen Ordner bleiben fremd; ein Umzug außerhalb des Projektordners ändert den Besitz nicht.

## state.json

| Feld | Bedeutung |
| --- | --- |
| stateVersion | exakt 1 |
| projectId | logische Projektidentität |
| localInstanceId | zufällige lokale Exportinstanz, keine Geräte-/Accountkennung |
| manifestPath | aktueller lokaler Hinweis auf das Projektmanifest |
| records | Array `{collection,id,notePath,sidecarPath}`; Schlüssel ist Sammlung plus ID innerhalb des Projekts |
| packages | Array `{id,hash}`; verhindert gleiche Paket-ID mit anderem Inhalt |
| locallyDeleted | Array bekannter `collection/id`-Schlüssel; fehlende Notizen werden beim aktuellen Snapshot erkannt |
| pendingJournal | Vorgangs-ID während Zustandsbestätigung, sonst null; Journalscan funktioniert auch bei fehlender Datei |
| assets | Array `{id,path,mimeType,width,height}`; keine Base64-Wiederholung je Notiz |
| extensions | vollständige obere Exchange-Erweiterungen |

`records` darf Hinweise auf lokal gelöschte Notizen behalten. Solche Datensätze gelangen nicht automatisch in den Export. Beim erneuten Import wird eine Wiederherstellung entschieden. Umzüge aktualisieren Hinweise; die Notizidentität bleibt Wahrheit. Alle Begleit-/Assetpfade werden erneut gegen Projekt und Hash geprüft. Keine fremde Zustandsdatei kann einen anderen Datenordner vereinnahmen.

## Begleitdatensatz

Jede `records/...json` enthält exakt das Erhaltungskonzept `{stateVersion:1,collection,id,record,lastAcceptedRecord,knownHashes,peerBaselines,projection}`. `record` ist ein vollständiger aktueller öffentlicher Datensatz. `lastAcceptedRecord` ist die lokale Komfortreferenz auf den zuletzt akzeptierten fremden Stand oder null. `knownHashes` enthält `{accepted: Hash|null, exported: Hash[]}` mit höchstens den letzten 20 unterschiedlichen ausgegebenen Hashes. Eine bestätigte fremde Basis bleibt zusätzlich erhalten.

`peerBaselines` enthält `{system,instanceId,acceptedRecord,acceptedHash}` je zuletzt exportierendem Partner. Dieser Schlüssel ist der Producer, nicht die immutable Origin des Objekts. Schema, Besitz, Hash und Origin jeder Basis werden vor Verwendung geprüft. Ein Export verändert diese Empfangsbasen nicht. Ohne Partnerbasis wird `baseHash:null` ausgegeben. Eine ausdrücklich gewählte neue Origin-Linie erhält neue getrennte Basen; alte lokale Daten bleiben in der Journal-Vorhersicherung.

`projection` ist null oder `{body,links,protected}`. `body` ist der zuletzt erzeugte Quelltext, `links` enthält `{localPath,originalUrl,image}` je Link-/Assetvorkommen; Layoutparameter bleiben Teil der jeweiligen `originalUrl`. `protected` kennzeichnet inerten Quelltext für externe Bilder/HTML. Unveränderte Projektionen verwenden den Originalinhalt aus `record`, einschließlich aller Zeichen und Zeilenenden. Ein bearbeiteter Inhalt mit mehreren unterschiedlichen Layouts desselben Assets verlangt explizite Vorkommenszuordnung.

`metadata`, `fields`, Origins, `partId`, Policy, Mikrosekunden und sämtliche unbekannten Erweiterungen bleiben in den vollständigen Records erhalten. Freie Objektkeys werden als Daten behandelt. Eigene Obsidian-Properties werden nicht in diese Datensätze importiert. Reparatur benötigt ein vollständiges, passendes Importoriginal; ohne Erhaltungsdaten wird kein verlustarmer Export angeboten.

## Journal

`journalVersion:1`, Vorgangs-ID, Projekt-ID, Status `prepared|committed|rolledBack|recoveryConflict` und Einträge mit Zielpfad, Binärflag, Vorher-/Nachherhash, optionalem Pendinghash sowie gesicherten Datenpfaden. Sämtliche Backups werden vor der ersten Recovery-Änderung vollständig gehasht. Ein beschädigtes Journal blockiert. Teilweise Stagingordner ohne `journal.json` haben keine Zielschreibberechtigung und sind keine vorbereiteten Vorgänge.

Wiederherstellung arbeitet rückwärts: aktueller Vorherhash → nichts tun; aktueller eigener Nachher-/Pendinghash → gesichertes Original wiederherstellen bzw. neu erzeugte Datei in lokale Trash bewegen; jeder andere Stand → Konflikt und fremde Bearbeitung erhalten. Wiederholte Recovery ist idempotent. Originale, Stagingdaten und Journale werden nicht automatisch gelöscht. Sie benötigen lokalen Speicher und sollen mit dem Vault gesichert werden.

Bei geänderten Bilddateien erhält das bewusst aufgenommene Bild eine neue Hash-ID. Alte Originalbytes werden unter `assets/originals` erhalten; die extern veränderte Quelldatei wird nicht überschrieben. Das Original kommt aus einer ausgewählten passenden Exchange-Datei. Alle fachlich gespeicherten Assetdateien werden vor Export neu gehasht.

## Journal für lesbare Umbenennungen

`journalVersion:1, kind:"layout"` ergänzt den lokalen Journalvertrag um geprüfte Umzüge und Vorher-/Nachheränderungen. Alle Originalnotizen und betroffenen Begleitdaten werden vor dem ersten Umzug gesichert. `FileManager.renameFile` führt native Umbenennungen aus. Die Wiederherstellung prüft zunächst sämtliche Sicherungen und deren Projektzugehörigkeit; nur bekannte eigene Dateistände werden zurückgenommen.

Obsidian kann während des Umbenennens Links selbst aktualisieren. Nur bekannte Vorher- und geplante Nachherstände dürfen anschließend überschrieben werden. Abweichende native Zwischenstände oder fremde Nachbearbeitung führen konservativ zu `recoveryConflict`; die Originale bleiben zum Vergleich erhalten. Nach vollständigem Commit werden ausschließlich leere alte Strukturordner aufgeräumt. Fremde Notizen werden nicht gelöscht. Für diesen Journaltyp gilt dieselbe Neustart-Erkennung wie für Importe.
