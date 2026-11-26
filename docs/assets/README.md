# Herkunft der Repository-Bilder

Die ursprünglichen PNG-Dateien `figur-formular.png` und `schmale-ansicht.png` wurden am 27.10.2026 mit den Produktions-UI-Modulen von Version 0.2.2 erzeugt. Die zusätzliche Aufnahme `notiz-uebernehmen.png` stammt vom selben Tag aus Version 0.2.3. `npm run test:ui` bündelt `tests/ui/preview.ts` mit dem kontrollierten Obsidian-API-Ersatz aus `tests/helpers/obsidian-ui.ts` und nimmt die Browseransicht mit einem vorhandenen Chromium-Browser auf.

| Datei | Gezeigter Stand |
| --- | --- |
| `werkbank.png` | 0.3.3, 26.11.2026: Ansicht **Werkbank** in Obsidian, englische Oberfläche |
| `storyboard.png` | 0.3.3, 26.11.2026: Ansicht **Storyboard** in Obsidian, englische Oberfläche |
| `figur-formular.png` | Produktionsformular zum Anlegen einer Figur in einem 390 Pixel breiten Fenster |
| `schmale-ansicht.png` | Produktionsübersicht in einem 390 Pixel breiten Fenster |
| `notiz-uebernehmen.png` | 0.2.3: gewöhnliche Markdown-Datei ohne Writeller-Metadaten wird zur bewussten Übernahme als Figur angeboten |
| `header.svg` | eigens erstellter typografischer Repository-Header; kein nachgebildetes offizielles Markenlogo |

`werkbank.png` und `storyboard.png` sind Aufnahmen von Benni aus Obsidian mit Plugin 0.3.3 in einem separaten Test-Vault mit Testdaten. Sie wurden als WebP bereitgestellt, nach PNG umgewandelt und nur rechts (leerer Gliederungsbereich) und unten (leere Fläche) auf 1765 × 720 Pixel beschnitten. Sie zeigen das Aussehen, sind aber keine vollständige native Abnahme.

Die übrigen Aufnahmen zeigen **keine native Obsidian-Ausführung und keinen echten Smartphone-Test**. Explorer und Host-Theme im Test sind kontrollierte Hilfen; Texte, Formulare und Schreibübersicht stammen aus dem Plugin. Es wurden keine persönlichen Vault-Inhalte verwendet. Diese Browser-Aufnahmen wurden aus `test-results/ui/` unverändert übernommen. Bei einer bewussten Aktualisierung müssen Bilder und dieser Nachweis zusammen aktualisiert werden.

Die Bilddateien und der Header gehören zum MIT-lizenzierten Repository. Es wurden keine Screenshots, Grafiken oder Quelltexte anderer Plugins übernommen.
