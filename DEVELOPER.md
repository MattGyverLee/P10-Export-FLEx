# Developer guide

Setup, build, test, deploy, and release for P10-Export-FLEx.

## Prerequisites

- **Node.js 22.16.0** — use [Volta](https://docs.volta.sh/) to pin automatically.
- **.NET SDK 6.0+** — for building the bridge.
- **FieldWorks 9** — Windows-only; the bridge references DLLs from `C:\Program Files\SIL\FieldWorks 9` (or wherever FieldWorks is installed). Without it, you can build the TypeScript extension but not the bridge.
- **PowerShell** — required for the release script (`scripts/release.ps1`).
- **GitHub CLI (`gh`)** — required for publishing releases.
- **Git**.

## Clone

The extension expects `paranext-core` to live next to this repo so that relative imports in the bundle config resolve. The structure should be:

```
<workspace>/
├── P10-Export-FLEx/
└── paranext-core/
```

Clone both:

```bash
git clone https://github.com/MattGyverLee/P10-Export-FLEx.git
git clone https://github.com/paranext/paranext-core.git
cd P10-Export-FLEx
```

## Install dependencies

```bash
cd extension && npm install        # extension TypeScript deps
cd ../bridge/FlexTextBridge && dotnet restore   # bridge .NET deps
```

## Build

```bash
cd extension
npm run build              # development build (extension + bridge)
npm run build:production   # release-mode bundle, used by `npm run package`
npm run watch              # rebuild on file change
```

The bridge alone:

```bash
cd bridge/FlexTextBridge
dotnet build               # writes FlexTextBridge.exe to extension/dist/bridge/
```

## Run inside Paratext

`scripts/deploy.js` writes `extension/dist/` into the Paratext install. Both layouts are handled — Paratext 10 Studio (`paratext-10-studio`) and the newer `platform-bible` install root — so you can test against either without manual copies.

```bash
cd extension
npm run deploy             # build + copy dist/ to every install root that exists
```

After deploy, restart Paratext Studio. The extension appears under any Scripture editor's Project menu as **Export Chapter(s) to FLEx**.

If you want to develop against a local Paranext core instead:

```bash
npm run start              # runs paranext-core with --extensions <this dist/>
```

## Tests

```bash
npm test                   # 128 tests across 6 suites
npm run test:watch         # watch mode
npm run test:coverage      # generate coverage report
```

The test suite covers the bridge wrapper service, the welcome web-view, content-filtering rules, persistence, the chapter-only book selector, and a Modal interaction smoke test. There's no end-to-end harness for the bridge itself — bridge correctness is verified by running the extension against real FLEx projects.

## The bridge command surface

Each command is one class under `bridge/FlexTextBridge/Commands/`. The extension calls them by spawning `FlexTextBridge.exe` with flags and reading the JSON response from stdout (success) or stderr (failure).

| Flag | Class | Purpose |
| --- | --- | --- |
| `--list-projects` | `ListProjectsCommand` | Enumerate FLEx projects with their writing systems (read straight from `.fwdata` XML — no LCM cache load). |
| `--project-info --project <name>` | `ProjectInfoCommand` | Same shape as list-projects but for a single project. Kept for API symmetry. |
| `--check-text --project <name> --title <title>` | `CheckTextCommand` | Returns whether a text by that name already exists, plus the next available `(N)` suggestion. |
| `--verify-text --project <name> --guid <guid>` | `VerifyTextCommand` | Passive check that a newly-created text is accessible — used after export to gate the "Open in FLEx" button. |
| `--check-flex-status --project <name>` | `CheckFlexStatusCommand` | Detects whether FLEx is running and whether project sharing is enabled. |
| `--project <name> --title <title> [--vernacular-ws <code>] [--overwrite]` | `CreateTextCommand` | The actual export. Reads USJ JSON from stdin, writes a tagged FLEx text, returns the GUID. |
| `--log-dir <path>` | (any command) | Override the log directory. The extension passes `%LOCALAPPDATA%\SIL\P10-Export-FLEx\logs`. |

Run `FlexTextBridge.exe --help` for the full reference.

## Logs

The bridge writes a daily-rotating log when an unhandled exception escapes a command:

```
%LOCALAPPDATA%\SIL\P10-Export-FLEx\logs\bridge-YYYYMMDD.log
```

*Handled* error paths (project not found, text already exists, invalid GUID) don't write — the JSON response already conveys those. Only unexpected failures do. Logs older than 30 days are pruned automatically.

When debugging a bridge failure, the log entry contains the full stack trace and the command context (which project, which text title, etc.) — usually enough to locate the bug without running a debugger.

## Available scripts

### Extension

| Script | Description |
| --- | --- |
| `npm run build` | Webpack build + bridge build |
| `npm run build:production` | Production bundle |
| `npm run watch` | Rebuild on file change |
| `npm run deploy` | Build + copy `dist/` to every Paratext install root that exists |
| `npm run start` | Run paranext-core with this extension wired in (requires sibling `paranext-core/`) |
| `npm run start:production` | Same as `start` but with production bundle |
| `npm run package` | Build + zip for distribution → `extension/release/flex-export_<version>.zip` |
| `npm test` | Jest |
| `npm run test:watch` / `:coverage` | Variants |
| `npm run lint` / `lint-fix` | ESLint + stylelint |
| `npm run format` / `format:check` | Prettier |

### Bridge

| Script | Description |
| --- | --- |
| `npm run build:bridge` | `dotnet build` of just the .NET project |

### Repo root

| Script | Description |
| --- | --- |
| `scripts/release.ps1 -Version <X.Y.Z>` | Build, package, and publish a GitHub release with the zip attached. |

## Releasing

A release ships two artifacts: the version-bumped source tag (`vX.Y.Z`) and a zip published on GitHub Releases.

### Steps

1. **Bump the version** in `extension/package.json` and `extension/manifest.json` to `X.Y.Z`.
2. **Add a CHANGELOG entry** for `X.Y.Z` summarizing what shipped (see [CHANGELOG.md](./CHANGELOG.md) for format). Include the Paratext minimum / recommended version line.
3. **Commit and push** to `main`.
4. **Tag and push:**
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```
5. **Build the bridge in Release mode** (must be done on a machine with FieldWorks 9 — CI can't do this):
   ```bash
   cd bridge/FlexTextBridge
   dotnet build -c Release
   ```
6. **Run the release script:**
   ```powershell
   scripts/release.ps1 -Version X.Y.Z
   ```
   This builds the production bundle, zips it to `extension/release/flex-export_X.Y.Z.zip`, and creates the GitHub release with the zip attached. The release notes default to brief installation instructions; for substantive notes, edit the published release with `gh release edit vX.Y.Z --notes-file <file>` afterwards.

### Manual fallback

If the script fails, the equivalent commands are:

```bash
cd extension
npm run package
gh release create vX.Y.Z release/flex-export_X.Y.Z.zip --title "Release vX.Y.Z" --notes-file ../docs/release-notes-X.Y.Z.md
```

### What the GitHub Actions workflow does (and doesn't)

`.github/workflows/release.yml` is a manual-trigger workflow that builds the TypeScript extension and creates a release, but it **skips the bridge build** — CI runners don't have FieldWorks. Use the workflow for extension-only fixes; use `scripts/release.ps1` for any release that includes bridge changes.

## Troubleshooting

### Extension doesn't appear after deploy

- Confirm `extension/dist/` was populated (look for `main.js` and `bridge/FlexTextBridge.exe`).
- Confirm the deployed copy landed in the right install root (deploy logs the path).
- Restart Paratext Studio fully — closing the window doesn't fully unload the extension host.

### Bridge fails to load

- `dotnet --version` must report 6+.
- The bridge resolves FieldWorks DLLs from the registry (`HKLM\SOFTWARE\SIL\FieldWorks\9`) or from `C:\Program Files\SIL\FieldWorks 9`. If neither resolves, the assembly resolver in `Program.cs` returns null and the process crashes during static init. Check the bridge log; if it's empty, the crash happened before logging initialized.
- Test the CLI in isolation:
  ```bash
  cd bridge/FlexTextBridge
  dotnet run -- --list-projects
  ```

### Build errors

- Stale Node modules:
  ```bash
  cd extension
  rm -rf node_modules package-lock.json
  npm install
  ```
- Stale .NET artifacts:
  ```bash
  cd bridge/FlexTextBridge
  dotnet clean && dotnet restore
  ```
- Webpack import errors that look like missing types from `paranext-core` — check that the `paranext-core` clone is at the expected sibling path (see [Clone](#clone)).

## Architecture reference

[CLAUDE.md](./CLAUDE.md) has the architecture diagram, component descriptions, and pointers to the FLExTrans modules whose conventions we replicate.
