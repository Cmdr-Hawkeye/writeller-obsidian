# Mitwirken

Fehlerberichte, verständlichere Bedienung, Tests und Dokumentationsverbesserungen sind willkommen. Bitte größere Änderungen zuerst in einem [Issue](https://github.com/Cmdr-Hawkeye/writeller-obsidian/issues/new/choose) beschreiben. Ein Test mit synthetischen Daten ist hilfreicher als ein privates Manuskript.

## Lokal entwickeln

Node 22.13.1 oder kompatibel. Jede Zeile ist ein eigenständiger PowerShell-Befehl:

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
npm run dev
```

Der optionale UI-Test verwendet vorhandenes Chrome/Edge. Alternativ `UI_BROWSER` auf einen vorhandenen Chromium-Browser setzen. Er startet weder Obsidian noch einen persönlichen Vault. Native Änderungen zuerst in einem gesicherten synthetischen Test-Vault prüfen. Das Plugin aktiviert keine anderen Erweiterungen und trifft keine Vertrauensentscheidung für den Benutzer.

## Modulgrenzen

`main.ts` komponiert die Dienste. Domäne und Austauschlogik benötigen weder Obsidian noch Node. `VaultPort` trennt den Speicheradapter; die Oberfläche benutzt native Obsidian-Views, -Modals und Themevariablen. Produktionsdateien dürfen höchstens 300 Zeilen haben, `main.ts` höchstens 150. Wiederverwendbare Funktionen erhalten TSDoc; Kommentare erklären Entscheidungen und Erhaltungsregeln. [Architektur](docs/architecture.md).

Keine impliziten Manuskriptänderungen, stillen Konfliktentscheidungen oder Netzwerkaufrufe ergänzen. Austausch-, Identitäts- und Wiederherstellungsänderungen brauchen aussagekräftige Regressionstests. Die neun übernommenen Vertrags-/Fixtureartefakte bleiben byteidentisch. Öffentliche Plugin-Beschreibung und Dokumentation müssen tatsächlichen Funktionsumfang und Nachweisgrenzen wiedergeben.

## Pull Requests

Beschreibe das konkrete Problem, das neue Verhalten und die passenden Prüfungen. Bei Oberflächenänderungen eine Aufnahme mit synthetischen Daten beifügen und angeben, ob sie aus Obsidian oder dem Browser-Testhost stammt. Ein bestandener Fake-Test ist kein Geräteabnahmetest.

Benutzeroberfläche und primäre Dokumentation sind derzeit Deutsch; englische Ergänzungen sind möglich. Mit einem Beitrag erklärst du dich damit einverstanden, ihn unter der [MIT-Lizenz](LICENSE) dieses Projekts bereitzustellen. Lizenzen und Herkunft fremder Abhängigkeiten müssen erhalten bleiben.

## Aufbau der Dokumentation

Die klare Trennung aus Einstieg, Beispielen, Referenz und Beitragsregeln orientiert sich an [Templater](https://github.com/SilentVoid13/Templater) und [Dataview](https://github.com/blacksmithgu/obsidian-dataview). Texte, Grafiken und Code wurden eigenständig erstellt. Informationen zur zugehörigen Schreibanwendung: [writeller.com](https://www.writeller.com).
