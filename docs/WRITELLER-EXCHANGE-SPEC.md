# Writeller Exchange Specification

Version des Vertrags: **1.0.0**, Stand **26. Oktober 2026**. Status: verbindlicher
Zielvertrag für die nachfolgende Implementierung; **noch kein in Writeller
implementiertes Dateiformat**. Die bestehende Writeller-Archivdatei ist ein
anderes Format. Dieses Dokument ist ohne Writeller-Quellcode verständlich.

## 1. Zweck und Geltungsbereich

Writeller Exchange transportiert genau einen aktuellen Schreibprojektstand
zwischen unabhängigen Programmen. Es setzt weder Obsidian noch einen Vault,
eine Datenbank, eine Installation, einen Benutzeraccount oder einen Dienst
voraus. Obsidian, Anytype und Notion sind mögliche Adapterziele, keine Teile
des Datenmodells. Für Anytype und Notion wird hier weder ein funktionierender
Adapter noch eine bestimmte API-Fähigkeit behauptet.

MUSS, DARF NICHT, SOLL und KANN bezeichnen normative Anforderungen. Ein
konformer v1-Adapter MUSS alle hier beschriebenen Datensätze lesen, erhalten,
validieren und wieder ausgeben können. Nicht jede Eigenschaft muss eine eigene
Bearbeitungsoberfläche erhalten. Unbearbeitete Daten dürfen als dokumentierte
Begleitdaten erhalten bleiben. Das ist von nativer Bearbeitbarkeit zu unterscheiden.

Der Vertrag beschreibt einen manuellen Snapshot-Austausch. Fehlende Objekte
sind **keine Löschbefehle**. v1 enthält weder automatische Synchronisation noch
Tombstones oder ausführbare Inhalte. Versionen, Undo, offene KI-Vorschläge,
Zugangsdaten, Lizenzdaten und App-Einstellungen gehören nicht zum Snapshot.

## 2. Dateihülle, Zeichenkodierung und Grenzen

Eine Datei `projekt.writeller-exchange.json` enthält ein UTF-8-JSON-Objekt.
Writer schreiben ohne BOM; Reader dürfen genau eine führende UTF-8-BOM
entfernen. MIME-Typ: `application/json`. Keine ZIP-Datei und keine externen
Begleitdateien sind zum Lesen erforderlich; gespeicherte Bilder sind Base64.

| Begrenzung | Verbindliches Maximum |
| --- | --- |
| Eingabedatei vor JSON-Parsing | 128 MiB = 134217728 Bytes |
| Datensätze ohne Projekt, einschließlich Beziehungen/Bilder | 10000 |
| JSON-Verschachtelung | 64 Ebenen, Wurzelobjekt zählt als 1 |
| Summe UTF-8 aller dekodierten Stringwerte außer `attachments[].data` | 25 MiB |
| Einzelner String außer Bilddaten | 8 MiB UTF-8 |
| Logische ID | 1–200 ASCII-Zeichen: `[A-Za-z0-9][A-Za-z0-9._:-]*` |
| Titel/Name | 1–500 Unicode-Codepoints; nicht nur Whitespace |
| Bilder | 256, je 2 MiB dekodiert, zusammen 64 MiB |
| Bilddimensionen | je 1–2400 Pixel, ein Bildframe |

Duplizierte JSON-Schlüssel, ungültiges UTF-8, unpaarige UTF-16-Surrogate,
NaN/Infinity, Zahlen außerhalb endlicher IEEE-754-Binary64-Werte und Integer
außerhalb ±9007199254740991 sind Fehler. Keine automatische Typkonvertierung
von Strings zu Zahlen, Booleschen Werten oder Datumswerten. Reader benötigen
eine Prüfung doppelter Schlüssel und der Tiefe; `JSON.parse` allein reicht
dafür nicht. Keine JSON-Kommentare oder abschließenden Kommas.

`null` und ein fehlender Wert sind verschieden. Alle in den Feldtabellen
aufgeführten Felder sind Pflichtfelder, **auch nullable Felder und leere
Arrays/Objekte**. Es gibt keine impliziten Defaults im Dateiformat.
Nicht dokumentierte Felder außerhalb `metadata`, `extensions` und `fields`
sind Fehler. Erweiterungen werden dadurch nicht versehentlich verworfen.

## 3. Primitive Datentypen

| Name | Bedeutung |
| --- | --- |
| `Id` | Opaque, groß-/kleinschreibungssensitive logische Kennung gemäß §2; niemals Pfad oder Anzeigename |
| `Hash` | Genau 64 kleine Hexzeichen, SHA-256 |
| `Instant` | Reales gregorianisches UTC-Datum `YYYY-MM-DDTHH:mm:ss.SSSSSSZ`, genau sechs Nachkommastellen (Mikrosekunden), Jahr 0001–9999, keine Schaltsekunde |
| `JsonObject` | Objekt mit beliebigen JSON-Werten; Zahlen-/Tiefen-/Größenregeln gelten rekursiv |
| `Status` | Nichtleerer String bis 100 Codepoints; bekannte Werte siehe unten |
| `Content` | `{ "format": "plain" oder "markdown", "text": String }`, keine weiteren Felder |
| `Origin` | `{ "system": String, "instanceId": Id, "objectId": Id }`, keine weiteren Felder |
| `Ref` | `{ "collection": Collection, "id": Id }`, keine weiteren Felder |

`Origin.system` und `producer.system` sind öffentliche technische Bezeichner,
1–100 Zeichen `[a-z][a-z0-9.-]*`, z. B. `writeller`, `obsidian`, `anytype`,
`notion`, `synthetic`. `instanceId` ist eine zufällige lokale Kennung, keine
Gerätekennung, E-Mail oder externe Account-ID. `Origin.objectId` bezeichnet die
Objektkennung beim ursprünglichen Erzeuger. Die Herkunft wird bei Weitergabe
nicht durch den zuletzt exportierenden Adapter ersetzt.

Zeitwerte werden als Originalstrings erhalten. Millisekunden erzeugende APIs
ergänzen drei Nullen, z. B. `.123Z` → `.123000Z`. JavaScript-`Date` darf
eingehende Mikrosekunden nicht abschneiden; Vergleiche fester UTC-Strings sind
nach Kalenderprüfung lexikografisch möglich. Native Zeitwerte außerhalb des
Wertebereichs werden als nicht darstellbar gemeldet, nicht still gekürzt.

`Collection` ist genau einer dieser Werte: `project`, `chapters`, `scenes`,
`catalogItems`, `relationships`, `notes`, `researchItems`. Bilder werden über
ihren Hash referenziert, nicht über `Ref`. Eine Projekt-Ref muss die Projekt-ID
tragen. Alle anderen Refs müssen in der benannten Sammlung derselben Datei
auflösbar sein. Keine projektübergreifenden Refs in v1.

Bekannte Statuswerte: `idea`, `planned`, `outlined`, `drafting`, `needsRevision`,
`revised`, `reviewed`, `locked`, `archived`. Andere Werte sind gültig, werden
als unbekannt angezeigt und unverändert erhalten. `locked` ist Fachmetadatum,
keine Zugriffskontrolle des Dateiformats. Ein Adapter soll vor Bearbeitung
eines gesperrten Inhalts darauf hinweisen.

## 4. Oberstes Objekt

| Feld | Typ und Regeln |
| --- | --- |
| `format` | Literal `writeller.exchange` |
| `version` | Literal `1.0.0` für diesen Vertrag |
| `packageId` | `Id`; neu je Export, empfohlen UUID v4 |
| `exportedAt` | `Instant`; Information, keine Konfliktentscheidung |
| `producer` | Genau `{system: String, version: String, instanceId: Id}`; Version 1–100 Codepoints |
| `scope` | Genau `{projectId: Id, mode: "snapshot"}` |
| `project` | Genau ein Projektobjekt, siehe §6 |
| `chapters` | Array von Kapiteln |
| `scenes` | Array von Szenen |
| `catalogItems` | Array von Katalogobjekten |
| `relationships` | Array von Beziehungen |
| `notes` | Array von Notizen |
| `researchItems` | Array von Rechercheobjekten |
| `attachments` | Array von Bildern, siehe §9 |
| `extensions` | `JsonObject` mit Namensräumen gemäß §10 |

`scope.projectId == project.id`. Jedes `projectId` sämtlicher Unterobjekte und
Bilder muss identisch sein. Arrays enthalten den vollständigen aktuellen
Projektbestand ihres Exporteurs, einschließlich erhaltener, gerade unbenutzter
Bilder. Ein Empfänger darf lokal zusätzliche Objekte behalten. Die Datei
behauptet keine Vollständigkeit einer früheren entfernten Datenbank.

ID-Eindeutigkeit gilt je Sammlung. Identische ID-Strings in unterschiedlichen
Sammlungen sind zulässig; ihr Sammlungstyp gehört immer zum Schlüssel.
Innerhalb `catalogItems` ist die ID auch über verschiedene Katalogtypen hinweg
eindeutig. Arrayreihenfolge ist außer bei benutzerdefinierten JSON-Arrays kein
fachliches Sortierkriterium.

## 5. Gemeinsame Datensatzfelder und Identitäten

Alle Datensätze aus §6–8 enthalten zusätzlich diese Felder:

| Feld | Typ und Regeln |
| --- | --- |
| `id` | `Id`; stabil über Export, Umbenennen und Speicherortwechsel |
| `projectId` | `Id`; bei `project` selbst **nicht vorhanden** |
| `origin` | `Origin`; bei Erstellung vergeben, später unverändert |
| `baseHash` | `Hash` oder `null`; bekannte gemeinsame Austauschbasis gemäß §12 |
| `createdAt` | `Instant` |
| `updatedAt` | `Instant`, nicht vor `createdAt` |
| `metadata` | `JsonObject`, Fach-/Erhaltungsdaten; keine ausführbare Semantik |
| `extensions` | `JsonObject`, Namensräume gemäß §10 |

Primärer logischer Schlüssel: `(project.id, collection, id)`. Die Herkunft
bestätigt eine Zuordnung, ersetzt diesen Schlüssel aber nicht. Dateipfade,
Datei-IDs, Seitentitel, Notion-Page-IDs und Obsidian-TFile-Objekte sind nur
lokale Adapterzuordnungen. Gleichheit eines Namens erlaubt niemals ein Update.

Neue Adapterobjekte erhalten UUID-v4-IDs; vorhandene gültige opaque IDs bleiben
erhalten. Ein Writeller-Adapter darf alte lokale IDs beibehalten, wenn sie §2
erfüllen. Sonst vergibt er einmalig öffentliche IDs und speichert dauerhaft
ein Mapping; das fremde Programm erfährt keine interne Datenbank-ID.

Zwei Datensätze mit gleichem logischem Schlüssel, aber abweichender `origin`
sind ein Identitätskonflikt, auch bei gleichem Text. Keine automatische
Zusammenführung. Beim Import als **unabhängige Kopie** werden Projekt-ID,
alle Unterobjekt-IDs und alle typisierten Refs neu vergeben; Bildhashes bleiben
gleich, `projectId` der Bilder wird ersetzt. Die Kopie erhält neue Origins und
`baseHash: null`; alte Zuordnungen bleiben ausschließlich in
`extensions["org.writeller.fork"] = {"projectId": alteId}` am Projekt erhalten.
Opaque Metadaten werden nicht blind mit Stringersetzung umgeschrieben:
unbekannte mögliche ID-Verweise sind als ungeprüfte Altverweise zu melden.

## 6. Projekt, Kapitel und Szenen

### Projekt: zusätzliche Felder

| Feld | Typ |
| --- | --- |
| `title` | Titel gemäß §2 |
| `description` | String, Klartext |
| `projectType` | Nichtleerer String bis 100 Codepoints, z. B. `novel`, `nonfiction`, `screenplay`, `poetry`, `other`; offen |
| `genreOrTopic` | String, Klartext |
| `languageCode` | String 1–100 Codepoints, BCP-47-Bezeichnung oder `und`; keine Sprache aus Inhalten erraten |
| `status` | `Status` |
| `wordTarget` | Nichtnegative sichere Ganzzahl oder `null` |

### Kapitel: zusätzliche Felder

| Feld | Typ und Bedeutung |
| --- | --- |
| `partId` | `Id` oder `null`; opaque historische Gruppierungskennung, **keine Ref** |
| `title` | Titel |
| `summary` | String, Klartext |
| `orderIndex` | Endliche Zahl, Betrag höchstens 9007199254740991; negative und gebrochene Werte erlaubt |
| `status` | `Status` |

v1 kennt kein eigenständiges Teil-/Bandobjekt. `partId` bleibt erhalten und
wird als Gruppierungskennung angezeigt; daraus dürfen keine erfundenen
Teilobjekte oder Titel entstehen. Zusätzliche Strukturmodelle benötigen einen
zukünftigen Vertrag. Ein Projekt entspricht einem Schreibprojekt, nicht einer
impliziten Sammlung mehrerer Bücher.

### Szene: zusätzliche Felder

| Feld | Typ und Bedeutung |
| --- | --- |
| `chapterId` | `Id` eines Kapitels oder `null` |
| `parentSceneId` | `Id` einer Szene oder `null` |
| `title` | Titel |
| `summary` | String, Klartext |
| `content` | `Content`, Manuskriptinhalt |
| `authorIntent` | String, Klartext; keine ausführbare Anweisung an den Adapter |
| `povCharacterId` | `Id` eines Katalogobjekts vom Typ `character` oder `null` |
| `sceneType` | Nichtleerer String bis 100 Codepoints; Standard bei **Neuerstellung** `scene`, offen |
| `status` | `Status` |
| `orderIndex` | Zahl wie bei Kapiteln |
| `storyDateStart`, `storyDateEnd` | Je `Instant` oder `null`; falls beide gesetzt: Ende ≥ Anfang |
| `estimatedWordTarget` | Nichtnegative sichere Ganzzahl oder `null` |
| `tensionLevel` | Ganzzahl 0–100 oder `null`; unbekannte bestehende Skalen siehe unten |
| `emotionalTone`, `goal`, `conflict`, `outcome` | Je String oder `null`, Klartext |

`parentSceneId` bildet einen azyklischen Wald. Keine Selbstreferenz.
Eltern und Kinder müssen dasselbe `chapterId` haben, einschließlich `null`.
Kapitel werden nach `(orderIndex, id)` sortiert, Szenen innerhalb jedes
Geschwistersets ebenso; `id` wird in ASCII-Codepunktreihenfolge verglichen.
Die Manuskriptreihenfolge ist Tiefensuche, Elternszene vor ihren Kindern;
kapitellose Szenen folgen nach allen Kapiteln. Gleiche Indizes sind gültig und
verändern keine gespeicherten Zahlen. Ein Adapter kann zur Neusortierung neue
Indizes vergeben, muss diese Änderung aber als Bearbeitung behandeln.

`actualWordCount` ist nicht enthalten: Er ist abgeleitet und kann je Sprache
und Editor anders ausfallen. Keine Änderung allein wegen einer Neuberechnung.
Eine native Spannung außerhalb 0–100 wird nicht abgeschnitten: Export muss
sie nach Vorschau in `extensions["org.writeller.legacy"]` als
`{"tensionLevel": ursprünglicheZahl}` erhalten und das Kernfeld auf `null`
setzen; Wiederimport ohne Bearbeitung stellt den Originalwert wieder her.

## 7. Katalogobjekte, Notizen und Recherche

### Katalogobjekt: zusätzliche Felder

| Feld | Typ und Bedeutung |
| --- | --- |
| `type` | Nichtleerer String bis 100 Codepoints |
| `name` | Titel-/Namensregel gemäß §2 |
| `summary` | String, Klartext |
| `status` | `Status` |
| `fields` | `JsonObject`, Werte einschließlich Arrays, Objekten, Zahlen, Bool und `null` unverändert erhalten |

Bekannte Typen: `character`, `location`, `object`, `timelineEvent`, `arc`.
Weitere Typen bleiben gültig und werden generisch behandelt. Neue eigene Typen
nutzen `custom:<namespace>.<name>`, z. B. `custom:example.organization`.
Eine Organisation ist somit kein vorgeschriebener weiterer Kerntyp.
Typdefinitionen sind in v1 keine separaten Datensätze; optional beschreibende
Schemas in `extensions` dürfen die Validierung des Kernformats nicht ändern.

Bekannte freiwillige Charakterfelder, jeweils üblicherweise String:
`roleFunction`, `age`, `appearance`, `personality`, `motivation`, `fear`,
`secret`, `background`, `goal`, `conflict`, `arc`, `voice`, `relationshipNotes`.
`fields.arc` ist Freitext, keine Ref auf ein Arc-Objekt. Andere Werttypen sind
nicht zu Strings zu degradieren. Katalogzusammenfassungen sind kein Ersatz
für die getrennten Felder. Ein freier zusätzlicher Markdown-Notizkörper kann
als Notiz mit `target` auf das Katalogobjekt transportiert werden.

### Notiz: zusätzliche Felder

| Feld | Typ und Bedeutung |
| --- | --- |
| `target` | `Ref` oder `null` |
| `title` | Titel |
| `content` | `Content` |
| `source` | String, z. B. `manual`, `ai`; Herkunftsangabe, keine Berechtigung |
| `sourceSuggestionId` | `Id` oder `null`; opaque Herkunftskennung, keine aufzulösende Ref |

Eine bereits vom Menschen übernommene KI-Notiz ist normaler Projektinhalt.
Die zugehörige KI-Antwort muss nicht mitgeschickt werden. Der Adapter nutzt
weder diese Kennung noch `source`, um interne Dienste abzufragen.

### Rechercheobjekt: zusätzliche Felder

| Feld | Typ und Bedeutung |
| --- | --- |
| `kind` | Einer von `link`, `file`, `image`, `pdf`, `webNote`, `source` |
| `target` | `Ref` oder `null` |
| `title` | Titel |
| `uri` | String, auch leer; Verweis, kein Auftrag zum Lesen/Herunterladen |
| `content` | `Content` |
| `source` | String, Quellenbeschreibung |
| `tags` | Array von Strings; Reihenfolge und Duplikate bleiben erhalten |

`uri` kann eine HTTPS-URL, ein relativer Dateiverweis oder ein historischer
lokaler Pfad sein. Vertrauliche Pfade sind vor Export in der Vorschau kenntlich
zu machen; Weglassen nur nach ausdrücklicher Auswahl mit Verlustbericht.
Recherchedateien, PDFs und ursprüngliche Bildquellen werden **nicht** eingebettet.
Ein `image`-Rechercheobjekt ist nicht automatisch ein gespeichertes Manuskriptbild.

## 8. Beziehungen

Zusätzlich zu §5 enthält jede Beziehung:

| Feld | Typ und Bedeutung |
| --- | --- |
| `source`, `target` | Je `Ref` |
| `relationshipType` | Nichtleerer String bis 100 Codepoints, offene fachliche Bezeichnung |
| `label`, `description` | Je String oder `null` |
| `strength` | Endliche Zahl mit Betrag ≤ 9007199254740991 oder `null`; keine automatische Normierung |
| `direction` | `directed` oder `undirected` |
| `validFromStoryTime`, `validToStoryTime` | Je `Instant` oder `null`; Ende ≥ Anfang, falls beide gesetzt |

Beziehungen haben eigene stabile IDs und sind kein Nebenprodukt von Wiki-Links.
Mehrere Beziehungen zwischen denselben Endpunkten sind erlaubt. Bei
`undirected` bleiben die gespeicherten Endpunkte trotzdem erhalten.
Beziehungs-Refs auf Beziehungen sind in v1 **nicht erlaubt**; Notizen und
Recherche dürfen dagegen eine Beziehung als `target` referenzieren.

Die bekannte Beziehung `appearsIn` verwendet aus Kompatibilitätsgründen
`source = Szene`, `target = Katalogobjekt`: gemeint ist, dass das Katalogobjekt
in dieser Szene vorkommt. Der Name ist kein Anlass, die Richtung umzudrehen.
Andere Beziehungsnamen haben keine implizite technische Wirkung.

## 9. Texte, Links und Bilder

`plain` bedeutet wörtlichen Text. Markdown-Zeichen, HTML und URLs darin dürfen
nicht unbemerkt als neue Formatierung oder eingebettete Ressource interpretiert
werden. `markdown` verwendet [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/)
als Textsyntax. Pipe-Tabellen, Obsidian-Callouts, Wikilinks, Fußnoten und andere
Erweiterungen bleiben als Zeichenketten erhalten, sind aber keine garantierte
plattformneutrale Darstellung. Vorschau meldet solche Erweiterungen.

Eine zusätzlich zulässige Layoutmarkierung ist exakt:

```html
<div align="center">
Text eines Absatzes.
</div>
```

`align` darf `left`, `center`, `right`, `justify` sein. Keine weiteren Attribute,
keine Verschachtelung dieser Wrapper. Diese kleinen Wrapper sind Daten für
Absatzausrichtung. Andere HTML-Inhalte sind wörtlich zu erhalten, aber niemals
als unkontrolliertes HTML auszuführen. Empfänger dürfen Inhalt in einer sicheren
Quelltextansicht darstellen. Pixelgleiche Vorschau ist kein Konformitätskriterium.

Logische Links im Markdown haben die Form
`[Anzeigename](entity:catalogItems/character-lina)`.
Nach `entity:` steht die Sammlung gemäß §3, `/` und genau eine ID.
Weil IDs nur sichere ASCII-Zeichen enthalten, werden sie hier nicht URL-kodiert.
Die Syntax wird nur in echten Markdown-Linkknoten interpretiert, nicht in
Codeblöcken, Inlinecode oder literalen Beispielen. Linkziele müssen im Snapshot
auflösbar sein. Anzeigenamen sind keine Identitäten. Ein Umbenennen darf den
Anzeigenamen ändern, nicht das logische Ziel.

Ein Manuskriptbild steht als eigener Absatz:

```text
![Skizze](asset:SHA256?width=70&align=center)
```

`SHA256` ist durch einen echten Hash zu ersetzen; `width` ist eine Ganzzahl
10–100 Prozent, `align` genau `left`, `center` oder `right`, Parameterreihenfolge
wie gezeigt. Alttext folgt CommonMark-Escaping und ist normaler Text, keine
URL-Kodierung. Layout gehört zum Vorkommen, nicht zum Bild. Abweichende
Asset-URIs in echten Bildknoten sind Validierungsfehler. `plain`-Inhalte
enthalten keine semantischen `asset:`-/`entity:`-Referenzen.

Jedes Element von `attachments` hat **genau** diese Felder:

| Feld | Typ und Bedeutung |
| --- | --- |
| `id` | `Hash`, SHA-256 der dekodierten Bildbytes |
| `projectId` | Projekt-ID |
| `mimeType` | `image/png` oder `image/jpeg` |
| `width`, `height` | Ganzzahlen gemäß §2, müssen dem Bildheader entsprechen |
| `data` | Standard-Base64 nach RFC 4648, mit erforderlichem Padding, ohne Whitespace, kein Data-URI |

Hash, Dateisignatur, MIME, Dimensionen und vollständige Dekodierbarkeit sind
vor Speicherung und Darstellung zu prüfen. Keine animierten Bilder, SVG,
HTML oder ausführbaren Anhänge. Vor dem Pixeldekodieren Headergrenzen prüfen.
Export vorhandener Bilder darf deren Bytes nicht neu kodieren. Neue Bilder
werden vor Aufnahme ausdrücklich auf diese Grenzen vorbereitet; nicht still
skalieren oder verlustbehaftet konvertieren. Vorhandene Dateinamen sind nicht
Teil des Datensatzes; sichere lokale Namen werden aus Hash und MIME erzeugt.

Externe Bilder dürfen weder beim Import noch in einer Vorschau automatisch
abgerufen werden. Referenz auf ein nicht mitgeliefertes Asset ist ein Fehler.
Ungenutzte mitgelieferte Assets sind gültig und bleiben erhalten.

## 10. Erweiterungen und verlustarme Erhaltung

`extensions` nutzt Namensraumschlüssel wie `org.example.feature` (mindestens
zwei mit Punkten getrennte Segmente, je `[a-z][a-z0-9-]*`). Werte sind beliebige
JSON-Werte. Unbekannte Namensräume, Katalogtypen, Statuswerte und `metadata`
werden unverändert erhalten; keine Netzwerkabfrage nach einem Schema.
Fremde Erweiterungen erhalten keine Schreibrechte und erzeugen keinen Code.

Öffentliche optionale Namensräume dieses Vertrags:

| Namensraum / Ort | Vollständige bekannte Bedeutung |
| --- | --- |
| `org.writeller.policy` am Projekt | Objekt mit optionalen Bool-Feldern `aiEnabled`, `cloudSyncEnabled`, `noAiNoCloud`; weitere Felder bleiben opaque |
| `org.writeller.policy` an Szene | Objekt mit optionalem Bool-Feld `aiAssistAllowed`; weitere Felder opaque |
| `org.writeller.legacy` | Erhaltungsobjekt; optional `tensionLevel: number`, `entityType: string`, `status: string`; native Sonderwerte, kein Code |
| `org.writeller.fork` am Projekt | `{projectId: Id}` des kopierten Ursprungsprojekts; kein Importziel |
| `org.writeller.text-review` an Szene | `{basisHash: Hash, annotations: JsonValue}`; alte Annotationen nach Textänderung, ausschließlich zur manuellen Prüfung |

AI-/Cloud-Flags sind transportierte Absichten. Ein Import darf dadurch keinen
Netzwerkdienst aktivieren oder eine lokal deaktivierte Schutzregel lockern.
Bei neuen Projekten ohne Policy gilt als sichere lokale Voreinstellung:
KI aus, Cloud aus. Der Adapter muss gegebenenfalls eine strengere lokale
Policy beibehalten und den Unterschied anzeigen.

Native optionale `metadata.annotations` an Szenen hat, sofern erkannt,
Arrayeinträge `{id, sceneId, startOffset, endOffset, selectedText, comment,
resolved, createdAt, updatedAt}`. IDs und Zeiten wie oben, Offsets sind
nichtnegative **UTF-16-Codeeinheiten**, Ende exklusiv, `resolved` ist Bool,
Textfelder sind Strings. Offsets beziehen sich auf die ursprüngliche native
Textzeichenkette, einschließlich ihrer Formatmarkierungen. Im Austausch sind
sie **opaque**, keine sofort anzuwendenden Positionen. Wenn Text oder Projektion
geändert wurde, darf der Empfänger sie nicht blind positionieren. Er erhält
das vollständige Originalarray in `org.writeller.text-review` mit `basisHash`
= SHA-256 UTF-8 des ursprünglichen nativen Textes und entfernt es nur aus der
aktiven `metadata.annotations`-Position. Vorschau muss diese Verschiebung
anzeigen; Originaldaten bleiben als Begleitdaten erhalten. Unbearbeitete
Roundtrips stellen die ursprüngliche Zeichenkette und Annotationen wieder her.

Weitere freie Metadaten, z. B. Karten, Boardpositionen, Veröffentlichungsdaten,
eigene Attribute und Gruppierungen, sind JSON-Erhaltungsdaten. Ihre Bedeutung
ist zum Durchreichen nicht erforderlich. Sie sind keine garantierten nativen
Funktionen eines fremden Editors. Falls ein Adapter einen solchen Datensatz
nicht sicher erhalten kann, muss er den Vorgang blockieren oder eine explizite
verlustbehaftete Kopie mit Bericht anbieten. Kein stilles Weglassen.

## 11. Versionsvertrag und Validierung

Writer schreiben `1.0.0`. Reader akzeptieren zunächst genau `1.0.0`.
Andere Versionen, auch vermeintlich kompatible Minorversionen, werden vor
Schreibzugriff als `UNSUPPORTED_VERSION` abgewiesen. Neue optionale Fähigkeiten
sollen bevorzugt namensräumliche Erweiterungen nutzen; neue Kernfelder oder
Sammlungen benötigen eine veröffentlichte Folgespezifikation, Schema und
Kompatibilitätstests. Keine Interpretation einer zukünftigen Version als alte.

Prüfreihenfolge: Bytebudget → UTF-8/JSON-Schlüssel/Tiefe → exakte Hülle/Version
→ Feldtypen und Werte → Anzahl/Größen → Projektbesitz/ID-Eindeutigkeit → Refs
und azyklische Hierarchie → Markdown-Ziele → Bilder → lokale Kollisionen und
Konflikte → Vorschau → erneute Prüfung lokaler Schreibvoraussetzungen → Commit.
Ein JSON Schema ist hilfreich, ersetzt die semantischen Prüfungen nicht.

Ein Adapter muss einen maschinenlesbaren Fehler mindestens als
`{code, severity, pointer, message}` ausgeben können. `pointer` ist ein JSON
Pointer in die Datei, z. B. `/scenes/0/chapterId`. Keine Manuskripttexte oder
lokalen Pfade in Standardlogs. Die Benutzeroberfläche kann die betroffene
Auswahl lokal mit Titel anzeigen.

Verbindliche Codes: `INVALID_JSON`, `LIMIT_EXCEEDED`, `INVALID_FIELD`,
`UNSUPPORTED_VERSION`, `PROJECT_MISMATCH`, `DUPLICATE_ID`, `MISSING_REFERENCE`,
`HIERARCHY_CYCLE`, `INVALID_ASSET`, `IDENTITY_CONFLICT`, `CONTENT_CONFLICT`,
`LOCAL_CHANGED`, `STATE_MISSING`, `UNSUPPORTED_REPRESENTATION`,
`ANNOTATIONS_NEED_REVIEW`. Strukturfehler sind `error`, Darstellungsabweichungen
können `warning` sein. Kein Schreiben bei einem Fehler.

## 12. Hashes, Austauschbasis und Wiederholbarkeit

Ein Datensatzhash ist SHA-256 über UTF-8 der kanonischen JSON-Darstellung nach
[RFC 8785 / JCS](https://www.rfc-editor.org/rfc/rfc8785), nachdem ausschließlich
die **obersten Datensatzfelder** `baseHash`, `createdAt`, `updatedAt` entfernt
wurden. Alle anderen Felder einschließlich IDs, `origin`, `metadata` und
`extensions` gehören dazu. Verschachtelte gleichnamige Felder werden nicht
entfernt. Keine Unicode-, Whitespace- oder Zeilenenden-Normalisierung des
Textinhalts. Arrayreihenfolgen innerhalb von Feldern bleiben relevant.
Negative Null wird gemäß JCS kanonisiert. Keine eigene ad-hoc-JSON-Sortierung
als Ersatz für JCS-Zahlenformatierung. Attachmenthash ist sein `id`.

Eine gemeinsame Basis ist ein vollständiger Datensatzstand, den der Exporteur
zuletzt vom Austauschpartner akzeptiert hat. Er berechnet dessen Hash und
sendet diesen beim späteren Export als `baseHash`. Ohne bekannte Basis ist
`baseHash: null`. Ein Export allein bestätigt **nicht**, dass die Gegenseite
ihn empfangen hat. Deshalb setzt der Exporteur seinen eigenen Stand nicht
einfach als neue Empfangsbasis. Für unabhängig arbeitende Partner werden
Basen getrennt lokal gespeichert; ein Export wählt genau einen Partner oder
verwendet `null`, wenn keiner bekannt ist. Keine automatische Multi-Master-Engine.

Der Empfänger speichert Hashes seiner ausgegebenen und akzeptierten Stände
zusammen mit Schlüssel und Origin. Er darf `baseHash` nur als bekannte Basis
verwenden, wenn er diesen Hash für diesen Schlüssel/Origin tatsächlich kennt.
Ein Hash ist Integritäts-/Vergleichshilfe, **keine Signatur** und kein Nachweis
eines vertrauenswürdigen Absenders. Namen und Zeitstempel sind keine Basen.

Sei `I` der Hash des eingehenden Datensatzes, `L` der aktuelle lokale
Austauschdatensatzhash und `B` die verifizierbare eingehende Basis:

| Situation | Verbindliches Standardverhalten |
| --- | --- |
| Noch kein lokales Objekt, Schlüssel nie lokal gelöscht | Neu anlegen nach Vorschau |
| `I == L` und Origin gleich | Keine fachliche Änderung, keine doppelte Datei, kein unnötiger Undo-Eintrag |
| `B` bekannt und `L == B` | Eingehende Änderung nach bestätigtem Importplan übernehmen |
| `B` bekannt und `I == B` | Lokale Änderung erhalten |
| Beide geändert, Basis unbekannt oder ID/Origin widersprüchlich | Konflikt, kein automatisches Überschreiben |
| Schlüssel lokal seit früherem Austausch gelöscht | Wiederherstellungskonflikt; keine stille Wiederanlage |
| Objekt fehlt in neuem Snapshot | Lokales Objekt erhalten; keine Löschung ableiten |

Konfliktentscheidungen: lokal behalten, eingehend ausdrücklich übernehmen,
manuell vereinigen oder gesamtes Projekt als unabhängige Kopie importieren.
Keine automatische Objektduplikation als Konfliktlösung. Manuelle Vereinigung
erzeugt neue `updatedAt` und einen neuen fachlichen Hash; `createdAt` bleibt.
Bei unterschiedlichen Erstellzeiten für denselben bestätigten Schlüssel
bleibt die bekannte lokale Erstellzeit, mit Hinweis. Nur zeitliche Abweichungen
bei gleichem Hash sind keine Textänderung.

Ein Paket erhält einen separaten SHA-256 über die **gesamte** JCS-Hülle.
Gleiche `packageId` mit anderem Pakethash ist ein Fehler `IDENTITY_CONFLICT`.
Wiederholter Import derselben `packageId` darf lokale zwischenzeitliche
Bearbeitungen nicht rückgängig machen: erneuter Plan nach obiger Tabelle.
Bekannte Basishashes dürfen begrenzt aufbewahrt werden (mindestens letzter
akzeptierter Stand und die letzten 20 ausgegebenen Hashes je Schlüssel).
Nach Verwerfen einer Basis fällt ein Update konservativ auf Konflikt zurück.

Plan und Commit müssen lokale Fingerprints vergleichen. Änderungen nach der
Vorschau führen zu `LOCAL_CHANGED` und neuer Vorschau. Das gilt auch für
Dateiumbenennungen, neue Duplikat-IDs und Änderungen der Zuordnungstabellen.
Registry, fachliche Datensätze und erhaltene Fremddaten werden gemeinsam oder
mit wiederherstellbarem Journal geschrieben. Erst nach vollständigem Erfolg
wird eine Empfangsbasis fortgeschrieben.

## 13. Projektkopien, Verschieben und lokale Zustände

Eine normale Vault-/Dateisicherung bewahrt IDs und ist dieselbe logische
Projektlinie. Zwei weiterbearbeitete Sicherungskopien können daher Konflikte
erzeugen; Hashvergleich erkennt diese, ein Gerätezeitstempel löst sie nicht.
Eine bewusst unabhängige Kopie muss die Fork-Regeln aus §5 anwenden.

Umbenennen und Verschieben einer Datei ändern weder Projekt-ID noch Objekt-ID.
Das Verschieben in einen fremden Projektordner ändert den Besitz nicht.
Ein expliziter Projekttransfer ist in v1 eine Kopie mit neuer Objekt-ID und
neuer Origin im Zielprojekt; eingehende und ausgehende Beziehungen werden
vorher geprüft und nicht automatisch projektübergreifend umgebogen. Eine
Quelllöschung ist ein separater lokaler, bestätigter Vorgang.

Adapterzustand darf nicht allein in einer flüchtigen Plugin-Konfiguration
liegen. Notiz-/Objektmetadaten tragen Identitäten; versionierte portable
Begleitdaten tragen unbekannte Felder, Basen und Origins. Gehen Begleitdaten
verloren, sind Basen unbekannt. Wiederherstellbarer Kerninhalt darf weiter
bearbeitet werden; ein als verlustarm bezeichneter Reexport muss mit
`STATE_MISSING` blockieren, bis fehlende Daten rekonstruiert oder der Export
ausdrücklich als neue, verlustbehaftete Kopie bestätigt wurde.

## 14. Vollständiges minimales synthetisches Beispiel

Die folgenden Namen und IDs sind frei erfunden. Diese Datei ist ein gültiges
Projekt mit einer Szene; leere Sammlungen sind absichtlich ausgeschrieben.

```json
{
  "format": "writeller.exchange",
  "version": "1.0.0",
  "packageId": "package-minimal-001",
  "exportedAt": "2026-10-26T10:00:00.000000Z",
  "producer": {"system": "synthetic", "version": "1.0.0", "instanceId": "fixture-origin"},
  "scope": {"projectId": "project-hafen", "mode": "snapshot"},
  "project": {
    "id": "project-hafen",
    "origin": {"system": "synthetic", "instanceId": "fixture-origin", "objectId": "project-hafen"},
    "baseHash": null,
    "createdAt": "2026-10-26T09:00:00.000000Z",
    "updatedAt": "2026-10-26T09:00:00.000000Z",
    "metadata": {}, "extensions": {},
    "title": "Der stille Hafen", "description": "Synthetischer Kurzroman.",
    "projectType": "novel", "genreOrTopic": "Abenteuer", "languageCode": "de",
    "status": "planned", "wordTarget": 50000
  },
  "chapters": [],
  "scenes": [{
    "id": "scene-ankunft", "projectId": "project-hafen",
    "origin": {"system": "synthetic", "instanceId": "fixture-origin", "objectId": "scene-ankunft"},
    "baseHash": null,
    "createdAt": "2026-10-26T09:00:00.000000Z", "updatedAt": "2026-10-26T09:00:00.000000Z",
    "metadata": {}, "extensions": {},
    "chapterId": null, "parentSceneId": null, "title": "Ankunft",
    "summary": "Lina erreicht den Hafen.",
    "content": {"format": "plain", "text": "Der Nebel lag über dem Wasser.\n\nLina wartete."},
    "authorIntent": "Eine offene Frage etablieren.", "povCharacterId": null,
    "sceneType": "scene", "status": "drafting", "orderIndex": 0,
    "storyDateStart": null, "storyDateEnd": null, "estimatedWordTarget": 800,
    "tensionLevel": 35, "emotionalTone": "gespannt", "goal": "Ankommen",
    "conflict": "Das Boot fehlt.", "outcome": null
  }],
  "catalogItems": [], "relationships": [], "notes": [], "researchItems": [],
  "attachments": [], "extensions": {}
}
```

## 15. Mitgelieferte Konformitätsdateien und Abnahme

Im Begleitordner `fixtures/` befinden sich vollständig synthetische Dateien:

| Datei | Erwartetes Ergebnis |
| --- | --- |
| `minimal.writeller-exchange.json` | Exaktes Beispiel aus §14; Import, Export und No-op-Reimport |
| `harbor.writeller-exchange.json` | Alle Sammlungen, zwei Kapitel, Szenenhierarchie, sämtliche fünf bekannten Katalogtypen, eigener Typ, Bild mit Layout, Annotation, Unicode, freie Felder und Refs; gültig |
| `forest.writeller-exchange.json` | Zweites Projekt mit denselben Objektbezeichnungen und absichtlich denselben sammlungsbezogenen ID-Strings; anderer Projektbesitz und andere Origins; gültig, strikt getrennt |
| `harbor-edited.writeller-exchange.json` | Geänderte Szene, korrekter `baseHash` zur Hafendatei, neuer Producer, neue Paket-ID; Update bei unverändertem Empfänger |
| `invalid-project.writeller-exchange.json` | Einzelne Szene mit fremder `projectId`; `PROJECT_MISMATCH`, keinerlei Schreiben |
| `invalid-reference.writeller-exchange.json` | Nicht existierendes Kapitelziel; `MISSING_REFERENCE`, keinerlei Schreiben |
| `expected-results.json` | Paket-/Datensatzhashes und erwartete Fehler zur unabhängigen Prüfung |

`writeller-exchange.schema.json` beschreibt die strukturelle Ebene nach JSON
Schema Draft 2020-12. Die Tabellen und semantischen Regeln dieses Dokuments
bleiben zusätzlich verbindlich. Der Prompt plus dieses Dokument genügt zur
Neuimplementierung; Schema und Fixtures sind praktische, unabhängige
Prüfartefakte und enthalten keinen proprietären Anwendungscode.

Weitere Pflichtfälle aus synthetischen Mutationen: doppelte Schlüssel/IDs,
Hüllenversion `2.0.0`, Selbst-/Mehrknotenzirkel, falscher POV-Typ, Ref in anderes
Projekt, echte und literale Linktokens, CRLF/LF, Emoji vor Annotation,
SHA-/Base64-/Bildheaderfehler, unbekannter Typ/Status/Namensraum, Grenzgrößen,
lokale und entfernte Textänderung, fehlende Begleitdaten, ID-Duplikate durch
Dateikopie, Abbruch mitten im Schreiben und nach Neustart.

Unbearbeiteter Roundtrip muss die fachlichen Datensatzhashes und sämtliche
Bildbytes erhalten. Exportzeit, Paket-ID, Producer und `baseHash` dürfen sich
ändern. Nach einer gezielten Szenenänderung dürfen nur die bewusst bearbeiteten
Datensätze und dokumentierten Erhaltungs-/Prüfhinweise abweichen. Kein anderer
Projektbestand darf verändert oder mitexportiert werden. Diese Konformität
ist mit synthetischen Daten ohne Writeller ausführbar.
