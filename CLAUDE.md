# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For developer setup, build, and deploy steps, see [DEVELOPER.md](./DEVELOPER.md). This file focuses on architecture and the things that aren't obvious from the source.

## Project Overview

P10-Export-FLEx is a Paratext 10 (Paranext) extension that exports Scripture texts to FieldWorks Language Explorer (FLEx) for linguistic analysis. It replaces the FLExTools `ImportFromParatext` workflow by exporting directly from inside Paratext.

The MVP is shipped. Current work is issue-driven refinement (formatting, content-filter toggles, USFM emission tweaks, UI polish) — see recent commits and `docs/`.

## Architecture

```
+------------------+     USJ JSON      +------------------+   LibLCM (FW9)  +-------------+
|  Paranext        | ----------------> |  FlexTextBridge  | --------------> |   FLEx      |
|  Extension (TS)  |    via stdin      |  CLI (.NET 4.8)  |   in-process    |  .fwdata    |
+------------------+                   +------------------+                 +-------------+
        |                                      |
        | PAPI (createProcess)                 | stdout: JSON result
        v                                      v
+------------------+                   +------------------+
| Scripture Data   |                   | Success/Error    |
| Provider         |                   | (errorCode set)  |
+------------------+                   +------------------+
```

USJ → USFM conversion happens **inside the bridge** (`UsjToUsfmConverter.cs`), not on the TS side. The bridge produces tagged segments classified as vernacular vs. analysis, then writes paragraphs into FLEx with the correct writing-system handle per segment. Filter toggles (footnotes, cross-refs, intro, remarks, figures, book headers) are passed through and honored by the converter.

## Components

### 1. Paranext Extension — `/extension/` (TypeScript + React)

- Entry: [extension/src/main.ts](extension/src/main.ts) — registers WebView provider and 7 papi commands.
- WebView: [extension/src/web-views/welcome.web-view.tsx](extension/src/web-views/welcome.web-view.tsx) — single-pane export UI (project + book/chapter range + FLEx project + WS + content toggles + preview).
- Bridge service: [extension/src/services/flex-bridge.service.ts](extension/src/services/flex-bridge.service.ts) — wraps `createProcess.spawn()` for the CLI.
- Manifest: [extension/manifest.json](extension/manifest.json) — `elevatedPrivileges: ["createProcess"]`, `activationEvents: []` (UI is reached via the project-top menu, not a command activation event).
- Menu hook: [extension/contributions/menus.json](extension/contributions/menus.json) — adds `flexExport.openExportDialog` to `defaultWebViewTopMenu` (group `platform.projectTop`).

Registered papi commands (all in `main.ts`):
- `flexExport.openExportDialog` — opens the WebView, auto-selects source project + scripture ref when invoked from a project pane.
- `flexExport.listFlexProjects`
- `flexExport.getFlexProjectInfo` (cached 5 min in `projectInfoCache`)
- `flexExport.checkTextName`
- `flexExport.checkFlexStatus`
- `flexExport.verifyText`
- `flexExport.exportToFlex`

### 2. FlexTextBridge CLI — `/bridge/FlexTextBridge/` (C# .NET Framework 4.8, x64)

- Entry: [bridge/FlexTextBridge/Program.cs](bridge/FlexTextBridge/Program.cs) — argv parsing, dispatches to a `Commands/*` class.
- Commands: `ListProjectsCommand`, `ProjectInfoCommand`, `CheckTextCommand`, `VerifyTextCommand`, `CheckFlexStatusCommand`, `CreateTextCommand` (default mode when `--project` and `--title` are given).
- Services: `FlexProjectService` (project discovery + LCM cache), `TextCreationService` (LibLCM text/paragraph writes with WS handles), `UsjToUsfmConverter` (USJ → tagged segments + content filtering), `ProcessDetectionService` (is FLEx running?).
- Result contract: every command writes a JSON object to stdout. On non-zero exit, the bridge service tries to parse stderr as JSON; if that fails, it rejects with stderr text.
- All results carry `success: bool` and, on failure, `errorCode` from the codes in [extension/src/services/flex-bridge.service.ts:86](extension/src/services/flex-bridge.service.ts#L86) (`PROJECT_NOT_FOUND`, `PROJECT_LOCKED`, `PROJECT_NEEDS_MIGRATION`, `INVALID_USJ`, `TEXT_EXISTS`, `WRITE_FAILED`, `TEXT_NOT_FOUND`, `TEXT_NOT_ACCESSIBLE`, `UNKNOWN_ERROR`).

#### Bridge command reference

```
FlexTextBridge --list-projects
FlexTextBridge --project-info       --project <name>
FlexTextBridge --check-text         --project <name> --title <title>
FlexTextBridge --verify-text        --project <name> --guid <guid>
FlexTextBridge --check-flex-status  --project <name>
FlexTextBridge --project <name> --title <title> [--vernacular-ws <code>] [--overwrite]  < scripture.json
```

The default (create-text) mode reads USJ JSON from **stdin**, all other commands take only argv.

#### FieldWorks DLL resolution

The bridge is compiled against FW9 assemblies but does not ship them. At runtime it resolves them from the local FieldWorks 9 install:

1. Registry: `HKLM\SOFTWARE\SIL\FieldWorks\9` → `RootCodeDir`.
2. Fallback: `C:\Program Files\SIL\FieldWorks 9`, then `C:\Program Files (x86)\SIL\FieldWorks 9`.
3. `AppDomain.AssemblyResolve` loads `<dir>\<AssemblyName>.dll` on demand.

Build references use the same path via the `FieldWorksDir` MSBuild property in [bridge/FlexTextBridge/FlexTextBridge.csproj](bridge/FlexTextBridge/FlexTextBridge.csproj). Build output is written directly to `extension/dist/bridge/` so the extension picks it up without a copy step.

## Build & Test

Full setup is in [DEVELOPER.md](./DEVELOPER.md). Quick reference:

```bash
cd extension
npm run build         # webpack + dotnet build (Release)
npm run watch         # build once + webpack --watch
npm run deploy        # build, then copy dist/ to local Paratext install(s)
npm run test          # Jest
npm run lint
npm run package       # production zip into release/
```

`scripts/deploy.js` deploys to **both** `paratext-10-studio` and `platform-bible` install roots under `%LOCALAPPDATA%\Programs\` if either is present, so testing across the legacy and new install layouts doesn't require manual copying.

Tests live under [extension/src/__tests__/](extension/src/__tests__/) with `__mocks__/` for `@papi/*`, `platform-bible-react`, `platform-bible-utils`, and `@sillsdev/scripture`.

## Reference Repositories

Local checkouts (not committed). Paths reflect the layout this repo is wired to.

- `D:/Github/_Projects/_PTX/paranextPlugin/paranext-core/` — Paranext source. Resolved as a `file:` dep for `papi-dts`, `platform-bible-react`, `platform-bible-utils`.
- `D:/Github/liblcm/` — LibLCM C# source.
- `D:/Github/flexlibs/` — Python/LibLCM bridge (reference for LCM API usage).
- `D:/Github/FLExTrans/` — original `ImportFromParatext.py` flow this tool replaces.

## Implementation Notes

### Writing-system tagging (the core value)

Each USFM/USJ segment is tagged as either vernacular or analysis before being written into FLEx, so FLEx parses scripture content with the right WS:

- **Vernacular WS** — actual scripture text (verse content, section heading content, paragraph body text).
- **Analysis WS** — markers (`\v`, `\c`, `\p`, etc.), verse/chapter numbers, footnote/cross-ref/figure markers.

Segmentation logic is in [bridge/FlexTextBridge/Services/UsjToUsfmConverter.cs](bridge/FlexTextBridge/Services/UsjToUsfmConverter.cs) — see the `ParagraphMarkers`, `IntroMarkers`, and section-heading sets at the top of the file. With USJ as input the structure is already parsed, so segmentation is cleaner than the FLExTrans `splitSFMs()` regex approach.

The vernacular WS handle defaults to `cache.DefaultVernWs`. A user-selected WS code (passed via `--vernacular-ws`) is resolved through `WritingSystemManager.Get(code)` and falls back to the default if unknown.

### Content filtering

The export UI exposes per-project toggles for footnotes, cross-references, introduction, remarks, figures, and book headers (`\h`/`\toc`). The `\id` line is **always** emitted regardless of toggles (commit `777461e`). Toggles flow into `UsjToUsfmConverter` and are applied during USJ traversal — filtered content never reaches the LCM write path.

### Chapter padding

Psalms uses 3-digit chapter padding in generated text titles (e.g. `Psalms 119`); all other books use 2-digit padding (`Mark 03`). See commit `500eb64`.

### Text-name suggestion

When a duplicate text name exists, the bridge's `--check-text` returns a suggestion of `<title> (N)` where `N = max(existing N) + 1`. This is intentional — do **not** "fix" it to fill gaps. See `memory/feedback_text_name_suggestion.md`.

### FLEx project discovery

- Projects live under `C:\ProgramData\SIL\FieldWorks\Projects\` by default.
- The `ProjectsDir` location can be overridden via the FieldWorks 9 registry hive.
- `FlexProjectService` enumerates `.fwdata` files and reads the WS arrays directly from XML, which is why both `--list-projects` and `--project-info` populate `vernacularWritingSystems` / `analysisWritingSystems` (issues #11, #13).

### "Is FLEx running?" detection

`ProcessDetectionService` reports whether FLEx is running and whether project sharing is enabled, so the UI can warn the user before attempting a write that LCM would block. Used by `flexExport.checkFlexStatus`.

### Project info caching

`main.ts` keeps an in-memory `projectInfoCache` (5 min TTL) keyed by project name. This avoids repeated slow `LcmCache.CreateCacheFromExistingData` calls when the user toggles between FLEx projects in the dropdown.

### Bridge IPC contract

- All commands write JSON to stdout and exit 0 on success.
- On failure the bridge writes a JSON error object to stderr and exits non-zero. The TS service tries `JSON.parse(stderr)` first and falls back to a string error.
- The create-text mode is the only command that consumes stdin; everything else reads only argv.

### Platform support

Windows-only (FieldWorks 9 is Windows-only). `FlexBridgeService.isSupported()` checks `createProcess.osData.platform === "win32"` and short-circuits with a friendly error elsewhere. The extension still loads on other platforms but every bridge call returns `success: false`.

## Project Layout

```
P10-Export-FLEx/
├── extension/                          # Paranext extension
│   ├── src/
│   │   ├── main.ts                     # papi command + WebView registration
│   │   ├── services/
│   │   │   └── flex-bridge.service.ts  # spawns CLI, parses JSON results
│   │   ├── web-views/
│   │   │   ├── welcome.web-view.tsx    # main UI
│   │   │   └── components/
│   │   │       └── ChapterOnlyBookControl.tsx
│   │   ├── types/flex-export.d.ts
│   │   └── __tests__/                  # Jest, with @papi/* mocks
│   ├── contributions/                  # menus, settings, projectSettings, localizedStrings, themes
│   ├── manifest.json
│   ├── scripts/deploy.js               # local install copy (both PT install roots)
│   └── package.json
├── bridge/FlexTextBridge/              # C# CLI, output → extension/dist/bridge/
│   ├── Program.cs                      # argv dispatcher
│   ├── Commands/                       # one file per --flag command
│   ├── Services/                       # FlexProjectService, TextCreationService,
│   │                                   # UsjToUsfmConverter, ProcessDetectionService
│   ├── Models/                         # CommandResult, ProjectInfo, UsjTypes
│   └── FlexTextBridge.csproj           # net48, x64, FW9 refs via $(FieldWorksDir)
├── docs/                               # design notes, issue references
├── scripts/release.ps1                 # GitHub release helper
├── DEVELOPER.md                        # setup / build / deploy
├── SPEC.md                             # design spec
└── README.md                           # end-user install + release flow
```
