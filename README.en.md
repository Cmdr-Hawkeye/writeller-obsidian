# Novel Planner - by Writeller

**Chapters, scenes, characters and places. Your writing project in ordinary Markdown files.**

[Deutsch](README.md#deutsch) · [Both languages](README.md) · [Download](https://github.com/Cmdr-Hawkeye/writeller-obsidian/releases) · [writeller.com](https://www.writeller.com)

![Writing workspace with a manuscript and planning notes](docs/assets/schreibuebersicht-en.png)

*Screenshot of the production UI modules in a browser test host with synthetic project data and an explicit Obsidian API substitute. This is not a native Obsidian or mobile-device acceptance test. The interface supports English and German.*

## What you can do

- Create chapters and scenes, then write in real Markdown notes.
- Keep characters, locations, objects, events, story arcs, research and ideas together.
- Use readable filenames and chapter folders without appended identity hashes.
- Set a word target and see an approximate count of your scene text.
- Add relationships and your own catalog types.
- Import or export project files manually with a preview and explicit conflict decisions.

The plugin is free to use and requires no account or Writeller license. It makes no network, tracking or AI calls. Technical preservation data stays in your vault.

## Install the preview

The following steps describe manual installation from the GitHub release. Minimum version: **Obsidian 1.14.5**. Actual mobile-device acceptance tests are still pending.

1. Back up your vault and open [release 0.3.1](https://github.com/Cmdr-Hawkeye/writeller-obsidian/releases/tag/0.3.1).
2. Download `writeller-0.3.1.zip` from **Assets** and extract it.
3. Copy its `writeller` directory to `<vault>/.obsidian/plugins/`. `main.js`, `manifest.json` and `styles.css` must be directly inside that directory.
4. Enable Novel Planner - by Writeller in Obsidian's Community plugins settings. For updates, replace the plugin files and reload the plugin.

GitHub's automatic “Source code” archive is not the installable plugin ZIP.

## Start writing

Click the **book icon**, choose **Create writing project**, and enter a title. Use **Add chapter**, **Add Scene**, **Add Character** or **Add Location** to build your project. Titles in the overview open the actual Markdown notes.

```text
Writing Projects/My first book/
  My first book.md
  Manuscript/01 - Arrival/01 - Fog in the harbor.md
  Characters/Lina.md
  Locations/Old harbor.md
```

The interface and structural folders follow your language preference: **Automatic (Obsidian)** chooses German for German Obsidian installations and English otherwise. You can select **Deutsch** or **English** in the plugin settings. Folder changes show a preview; Markdown file names, user titles and project identities are preserved. Custom root names and hidden recovery-data paths remain stable. [Language and folder details](docs/languages.md). Obsidian's manifest description is one static bilingual field. [Manifest documentation](https://docs.obsidian.md/Reference/Manifest).

## Create notes directly in Obsidian

You can also use Obsidian's ordinary **New note** action. Markdown files inside a project folder appear under **Not yet in the writing project**. For example, a file in `Characters` offers **Adopt as Character**. Confirm the form once; existing text, user properties and the file path are preserved. The note then becomes part of the project and its exports. **Another note type…** lets you choose another type.

Before exporting, the plugin points out unassigned files so you can review them first or explicitly export only the already assigned notes. Folder context menus also offer direct typed creation, such as **Novel Planner: Add Character**.

## Where are exports and technical files?

Exports go to `Exports/<title>.writeller-exchange.json`. A twelve-second message shows the exact vault-relative path after a successful save. Existing files are never replaced. Import files can be placed in any ordinary vault folder.

The normal explorer view hides technical data and folders containing only exchange exports. Enable **Show technical information** in Novel Planner settings to reveal them. A folder containing ordinary notes, images or other files remains visible. **Back up the entire vault, including `Writeller-Daten`; hiding a folder does not remove its files.**

The adapter follows **Writeller Exchange 1.0.0**. The contract is implemented and tested in Writeller, enabling manual project exchange between Writeller and this Obsidian plugin. Legacy `*.writeller.json` archives use a different format and remain incompatible. See the [compatibility notes](docs/compatibility.md) and [verification report](docs/verification-report.md) for details.

## Help and contributing

To find existing or moved projects, the plugin inventories vault file paths and reads Markdown files to check their identity metadata. This includes local reads of unassigned notes; they are not changed automatically. Exchange files and project images are read after selection or through validated project mappings. These local Obsidian API operations support project separation, recovery and complete exports. No contents are transmitted.

Since 0.2.4, schema validators are generated at build time; the plugin does not dynamically execute generated code at runtime. GitHub Actions builds and attests the three installable release files. Additional ZIP, license and checksum files support manual installation; Obsidian downloads only `main.js`, `manifest.json` and `styles.css`.

[German handbook](docs/handbuch.md) · [FAQ](docs/faq.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/Cmdr-Hawkeye/writeller-obsidian/issues/new/choose) · [Contributing](CONTRIBUTING.md)

Written in TypeScript; Node 22 is used for development. Run `npm ci`, then `npm run check`. The optional `npm run test:ui` uses an already installed Chromium browser or a path supplied through `UI_BROWSER`.

**[MIT license](LICENSE), © 2026 Benni.** [Third-party notices](THIRD-PARTY-NOTICES.md). No proprietary Writeller application code is included. This project is not affiliated with the Obsidian manufacturer.
