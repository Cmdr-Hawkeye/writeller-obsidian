# Releaseverfahren

Repository: [Cmdr-Hawkeye/writeller-obsidian](https://github.com/Cmdr-Hawkeye/writeller-obsidian). Version **0.2.3** ist eine Vorschau; ein öffentliches GitHub-Repository und eine Community-Verzeichnisfreigabe sind getrennte Schritte.

## Lokale technische Gates

- `npm ci` aus dem Lockfile.
- `npm run check`: Typen, Lint, Modulgrenzen, Handoff-Integrität, lokale Dokumentationslinks, Tests und Build.
- `npm run test:ui`: zehn Prüfungen im Browser-Testhost, einschließlich gewöhnlicher Notiz → Figur → Export; Bilder ausdrücklich als Vorschau mit API-Ersatz kennzeichnen.
- `npm audit` und `npm run audit:dependencies`.
- `npm run licenses`: Drittanbieterhinweise und maschinenlesbare Lizenzliste.
- `node scripts/reproducible.mjs`: zweimal identische Bundlebytes.
- `node scripts/release.mjs --publish-ready`: Versionen, Autorenlink und Copyrightnennung prüfen; ZIP und SHA-256-Summen erzeugen.
- `node scripts/verify-release.mjs`: Inhalte, sämtliche Prüfsummen und reproduzierbares ZIP prüfen.

Die lokalen Skripte veröffentlichen nichts. `release-status.json` beschreibt diese lokale Vorbereitung; der tatsächliche öffentliche Release steht auf GitHub.

## Herausgeberangaben

Der Anzeigename **Benni**, die MIT-Nennung **© 2026 Benni** und der Autorenlink **https://www.writeller.com** sind in den Root-Dateien gesetzt. GitHub-Kontoname und sichtbarer Plugin-Autor dürfen unterschiedlich sein. Optionale Umgebungsvariablen `RELEASE_AUTHOR`, `RELEASE_AUTHOR_URL` und `RELEASE_COPYRIGHT_HOLDER` können Releasewerte überschreiben. Der Copyrightstandard wird aus `LICENSE` gelesen. `fundingUrl` ist nicht gesetzt.

Eine sprachabhängige Manifest-Beschreibung ist in der aktuellen offiziellen Obsidian-Schnittstelle nicht definiert; der Text ist deshalb kurz und zweisprachig. Die Plugin-Oberfläche bleibt Deutsch. [Manifest-Dokumentation](https://docs.obsidian.md/Reference/Manifest).

## GitHub-Release

Der Tag entspricht exakt der Manifestversion, ohne `v`. Als Assets werden mindestens `main.js`, `manifest.json` und `styles.css` angehängt; zusätzlich Plugin-ZIP, Prüfsummen und Lizenzhinweise. Die Vorschau wird als **Pre-release** gekennzeichnet. Das Plugin-ZIP enthält die dokumentierten relativen Bilder und Anleitungen.

`.github/workflows/release.yml` startet nur durch `workflow_dispatch`. `publish:false` bereitet Artefakte vor. `publish:true` veröffentlicht nach erfolgreichen Gates; der Workflow kennzeichnet den Release derzeit ausdrücklich als Vorschau. Normale Pushes starten ausschließlich die Windows-/Linux-Prüfung. [Aktuelle Actions](https://github.com/Cmdr-Hawkeye/writeller-obsidian/actions).

## Noch offene Abnahmen

- Native Obsidian-API-/UI-Prüfung mit Fokus, Klicks, Exportmeldung, aktueller Ordner-/Properties-Darstellung, Editorpuffern, Linkanpassung und Wiederherstellung.
- Echte iOS-/Android-Geräte und erforderliche Obsidian-Version.
- Austauschtests bei Änderungen an Format oder Anwendung erneut ausführen; Implementierung und Tests von Exchange 1.0.0 in Writeller sind durch Benni am 27.10.2026 bestätigt.
- Vor einer Community-Einreichung Name/ID im aktuellen Verzeichnis, Einreichungsanforderungen und automatisiertes Review prüfen.

Für das isolierte native Testprofil entscheidet der Benutzer selbst über Obsidian-Vertrauensabfragen. DOM-/Fake-Tests werden nicht als Geräteprüfung bezeichnet. [Prüfnachweis](verification-report.md).

## Community-Verzeichnis

Erst nach entsprechender Abnahme über das [Community-Portal](https://community.obsidian.md) einreichen. Die [offizielle Anleitung](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) verlangt öffentlich zugänglichen Quellcode, Root-README, Lizenz, Manifest und Releaseassets. Dieses Repository ist noch kein bestätigter Verzeichniseintrag. Vor der Einreichung die aktuellen Regeln erneut prüfen.

## Lokales Update

Vault sichern, Plugin-Dateien aus `writeller-0.2.3.zip` in `.obsidian/plugins/writeller` ersetzen und das Plugin neu laden. Die Erweiterungsliste muss **0.2.3 · Benni** anzeigen. Bisherige Projektdateien werden nicht automatisch umbenannt. **Dateinamen vereinfachen** bietet eine Vorschau. Frühere Standard-Exportziele werden auf `Exporte` umgestellt; wirklich leere alte Wurzeln werden aufgeräumt. Reine Austausch-/Exportordner werden standardmäßig ausgeblendet und können über die technische Anzeigeeinstellung eingeblendet werden.
