# Writeller 0.2.4

[Deutsch](#deutsch) · [English](#english) · [writeller.com](https://www.writeller.com)

## Deutsch

**Korrekturen aus der automatisierten Community-Prüfung von 0.2.3.**

- Einstellungen verwenden die native, durchsuchbare Obsidian-API mit standardisierten Überschriften und Ordnerauswahl. Ungültige oder überlappende Pfade werden weiterhin abgewiesen.
- Die Exchange-Schemaprüfung wird beim Build vorübersetzt. Das Plugin benötigt dafür zur Laufzeit weder `eval` noch `new Function`; die Vertragsdateien bleiben unverändert.
- Technische Ordner und Properties werden über rücknehmbare Klassen ausgeblendet. Der breite CSS-Selektor `:has` und dynamische Stylesheets entfallen.
- Native DOM-Helfer, sichere Callback-Bindung, Web-Crypto-Zugriffe und Zeichenprüfungen entsprechen den verwendeten Obsidian-Lintregeln. Dateioperationen beachten jetzt die Löschpräferenz aus Obsidian.
- Der offizielle Obsidian-Linter ist Teil der lokalen Prüfung und der CI. Der README-Titel entspricht dem Manifestnamen **Writeller**.
- GitHub Actions baut das Release und attestiert die Herkunft von `main.js`, `manifest.json` und `styles.css` vor dem Hochladen.

**Bewusst beibehalten:** Der lokale Vault-Index erkennt verwaltete Projekte und gewöhnliche Notizen innerhalb ihrer Grenzen. Das Review kann die dafür nötige Dateiauflistung weiterhin als Empfehlung melden. ZIP, Prüfsummen und Lizenzhinweise bleiben zusätzliche Downloads für manuelle Installationen; Obsidian installiert nur die Plugin-Dateien. Diese beiden Empfehlungen sind vom behobenen Source-Code-Fehler zu unterscheiden.

**Installation:** `writeller-0.2.4.zip` unter **Assets** herunterladen, Plugin-Dateien in `<Vault>/.obsidian/plugins/writeller/` ersetzen und das Plugin neu laden. Mindestversion: Obsidian 1.14.5. Bestehende Projekte und die bewusste Übernahme gewöhnlicher Notizen bleiben erhalten.

**Prüfung:** 489 Tests in 16 Dateien und zehn Browser-Oberflächenchecks bestanden. Der Vertragstest läuft mit deaktivierter dynamischer Codeerzeugung. Native Desktop-/Mobile-Abnahme und die erneute Community-Prüfung bleiben gesonderte Schritte; dieses Release ist keine Community-Freigabe.

## English

**Corrections following the automated Community review of 0.2.3.**

- Settings use Obsidian's native searchable API, including standard headings and folder controls. Invalid or overlapping paths are still rejected.
- Exchange schema validators are compiled during the build. The plugin needs neither `eval` nor `new Function` for validation at runtime; the contract artifacts remain unchanged.
- Reversible classes hide technical folders and properties. Broad CSS `:has` selectors and dynamic stylesheets have been removed.
- Native DOM helpers, bound callbacks, Web Crypto access and character checks follow the configured Obsidian lint rules. File removal now respects Obsidian's user preference.
- The official Obsidian linter runs locally and in CI. The README title now matches the manifest name, **Writeller**.
- GitHub Actions builds the release and attests the provenance of `main.js`, `manifest.json` and `styles.css` before upload.

**Intentionally retained:** The local vault index discovers managed projects and ordinary notes within project boundaries. The review may continue to flag the required file enumeration as a recommendation. The ZIP, checksums and license notices remain extra downloads for manual installation; Obsidian installs only the plugin files. These recommendations are separate from the corrected source-code error.

**Installation:** Download `writeller-0.2.4.zip` from **Assets**, replace the plugin files in `<vault>/.obsidian/plugins/writeller/` and reload the plugin. Minimum version: Obsidian 1.14.5. Existing projects and explicit adoption of ordinary notes remain supported. The plugin UI is currently German.

**Validation:** 489 tests across 16 files and ten browser UI smoke checks passed. The contract test runs with dynamic code generation disabled. Native desktop/mobile acceptance and the new Community review remain separate steps; this release does not imply Community approval.

Writeller Exchange 1.0.0 is implemented and tested in Writeller, as confirmed by Benni on 27 October 2026. / Writeller Exchange 1.0.0 ist in Writeller implementiert und getestet, bestätigt durch Benni am 27.10.2026.

[README](https://github.com/Cmdr-Hawkeye/writeller-obsidian) · [Changelog](https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/CHANGELOG.md)
