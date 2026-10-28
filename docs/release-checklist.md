# Releaseverfahren

Repository: [Cmdr-Hawkeye/writeller-obsidian](https://github.com/Cmdr-Hawkeye/writeller-obsidian). Releaseverfahren für **0.2.4**; ein öffentliches GitHub-Release und eine Community-Verzeichnisfreigabe sind getrennte Schritte.

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

Der Tag entspricht exakt der Manifestversion, ohne `v`. Als Assets werden `main.js`, `manifest.json` und `styles.css` angehängt; zusätzlich Plugin-ZIP, Prüfsummen und Lizenzhinweise für manuelle Installationen. Obsidian lädt diese zusätzlichen Dateien nicht herunter; das Review meldet sie als Empfehlung. Das Plugin-ZIP enthält die dokumentierten relativen Bilder und Anleitungen. Für reguläre Community-Releases Entwurf und Pre-release ausschalten sowie Latest aktivieren. Bei 0.2.3 wurde die frühere Vorabkennzeichnung entsprechend korrigiert.

`.github/workflows/release.yml` startet nur durch `workflow_dispatch`. `publish:false` bereitet Artefakte vor. `publish:true` veröffentlicht nach erfolgreichen Gates standardmäßig einen regulären Latest Release. Die separate Option `prerelease:true` kennzeichnet ausdrücklich gewünschte Testversionen als Vorabversion und setzt sie nicht als Latest. Normale Pushes starten ausschließlich die Windows-/Linux-Prüfung. [Aktuelle Actions](https://github.com/Cmdr-Hawkeye/writeller-obsidian/actions).

Ab 0.2.4 attestiert der Releaseworkflow die selbst gebauten Dateien `main.js`, `manifest.json` und `styles.css` vor der Veröffentlichung über `actions/attest@v4`. Dazu benötigt der Job `id-token: write`, `attestations: write` und für das Release `contents: write`. Ein lokal gebautes Asset erhält dadurch keinen nachträglich behaupteten Herkunftsnachweis. [GitHub-Anleitung](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

Nach erfolgreichem Workflow die veröffentlichten Assets erneut herunterladen und mit GitHub CLI prüfen. Beispiel für eine bereits heruntergeladene Datei (PowerShell, eine Zeile):

```powershell
gh attestation verify .\main.js --repo Cmdr-Hawkeye/writeller-obsidian
```

Die Prüfung für `manifest.json` und `styles.css` wiederholen und deren Hashes mit den geprüften Buildbytes vergleichen. Ein erfolgreicher Actions-Lauf ist keine bestandene Community-Prüfung.

Bei „No release matches your manifest version“ zuerst Manifestversion, exakt gleichnamigen Tag, hochgeladene Assets und Releasekennzeichnung prüfen. Anschließend im Community-Portal **Check for new releases** auslösen. Die Erkennung eines passenden Releases und die anschließende Prüfung/Freigabe des Eintrags sind getrennte Schritte.

## Noch offene Abnahmen

- Native Obsidian-API-/UI-Prüfung mit Fokus, Klicks, Exportmeldung, aktueller Ordner-/Properties-Darstellung, Editorpuffern, Linkanpassung und Wiederherstellung.
- Echte iOS-/Android-Geräte und erforderliche Obsidian-Version.
- Austauschtests bei Änderungen an Format oder Anwendung erneut ausführen; Implementierung und Tests von Exchange 1.0.0 in Writeller sind durch Benni am 27.10.2026 bestätigt.
- Vor einer Community-Einreichung Name/ID im aktuellen Verzeichnis, Einreichungsanforderungen und automatisiertes Review prüfen.

Für das isolierte native Testprofil entscheidet der Benutzer selbst über Obsidian-Vertrauensabfragen. DOM-/Fake-Tests werden nicht als Geräteprüfung bezeichnet. [Prüfnachweis](verification-report.md).

## Community-Verzeichnis

Erst nach entsprechender Abnahme über das [Community-Portal](https://community.obsidian.md) einreichen. Die [offizielle Anleitung](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) verlangt öffentlich zugänglichen Quellcode, Root-README, Lizenz, Manifest und Releaseassets. Dieses Repository ist noch kein bestätigter Verzeichniseintrag. Vor der Einreichung die aktuellen Regeln erneut prüfen.

## Lokales Update

Vault sichern, Plugin-Dateien aus `writeller-0.2.4.zip` in `.obsidian/plugins/writeller` ersetzen und das Plugin neu laden. Die Erweiterungsliste muss **0.2.4 · Benni** anzeigen. Bisherige Projektdateien werden nicht automatisch umbenannt. **Dateinamen vereinfachen** bietet eine Vorschau. Frühere Standard-Exportziele werden auf `Exporte` umgestellt; wirklich leere alte Wurzeln werden aufgeräumt. Reine Austausch-/Exportordner werden standardmäßig ausgeblendet und können über die technische Anzeigeeinstellung eingeblendet werden.
