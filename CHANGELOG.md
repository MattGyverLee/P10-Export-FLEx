# Changelog

All notable changes to P10-Export-FLEx are documented here.

## [0.2.0] — 2026-05-04

**Requires:** Paratext 10 Studio v0.3 or later. **Recommended:** v0.5.

### New features

- **Unified status strip** in FLEx Settings consolidates project-lock, sharing-disabled, verify-timeout, and resource-not-exportable messages with fully localized text.
- **Navigation context sync** — the Export panel now syncs the current book, chapter, and project when reopened (#14).
- **Chapter-only book selector** (`ChapterOnlyBookControl`) for cleaner book/chapter selection.
- **Localized book names** in the chapter selector.
- **Bridge error logging** — unhandled bridge failures are captured to a rotating daily log at `%LOCALAPPDATA%\SIL\P10-Export-FLEx\logs\` to aid diagnosis when stdout/stderr JSON doesn't make it back to the extension.

### Fixed

- Text name format: no project suffix; zero-padded chapter numbers (#5, #6).
- Psalms uses 3-digit chapter padding (#6).
- "Will be created as" hint updates after a successful export (#16).
- Export summary counts only scripture paragraphs (#16).
- Verse number removed from the chapter-range selector (#7).
- Long error messages wrap in the FLEx Settings box (#10).
- Consistent sans-serif font in the "Include in Export" section (#4).
- "Open in FLEx" button styled as the primary action in dark green (#12).
- FLEx sharing error message clarified (#9).
- FLEx project metadata read from `.fwdata` files instead of LCM, avoiding slow cache loads (#11, #13).
- Marker filtering matches FLExTrans import behavior: `\id` is always emitted; `\h` and `\toc` are toggled via a new Book Headers option (#15).
- USFM intro-marker regex now covers `imte` / `imte1` / `imte2` and `mte` / `mte1` / `mte2`.

### Internal

- FLExTrans team attribution footer added (#3).
- Deployment script supports multiple installation roots for Paratext and platform-bible.
- Removed unused safe-navigation-target logic from bridge and extension.
- Improved release-script output handling.

## [0.1.0] — Initial release

First public release of P10-Export-FLEx, a Paratext 10 extension that exports scripture texts directly into FieldWorks Language Explorer for linguistic analysis — replacing the older FLExTools `ImportFromParatext` workflow.

### Highlights

- **One-step export** from a Paratext project to a FLEx project, launched from the Paratext menu.
- **Project, book, and chapter-range selection** with content filters for footnotes, cross-references, and introduction material.
- **Writing-system tagging**: scripture content is tagged with the vernacular WS, while SFM markers and verse references are tagged with the analysis WS — preserving the value FLExTools' importer provided.
- **FLEx project discovery** via `LcmCache`, including locked-project and migration-needed handling.
- **FlexTextBridge CLI** — a standalone .NET console app that wraps LibLCM, spawned from the extension via Paranext's `createProcess` elevated privilege.
- **Localization and RTL** support throughout the WebView.
- **Settings persistence** for the most recent export configuration.
- **Open in FLEx** action to navigate to the newly created text.
- **Distribution**: `scripts/release.ps1` script and GitHub Actions workflow for building releases (bridge build runs locally on a machine with FieldWorks installed).

[0.2.0]: https://github.com/MattGyverLee/P10-Export-FLEx/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MattGyverLee/P10-Export-FLEx/releases/tag/v0.1.0
