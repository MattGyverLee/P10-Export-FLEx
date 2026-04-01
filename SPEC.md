# P10-Export-FLEx Specification

## Problem Statement

When someone wants to translate a text using FLExTrans, the first step is to import it into FLEx. If that text is scripture, it would be nice if the user could from within Paratext run a command that would export a desired portion of scripture to FLEx. The key is remaining in Paratext.

### Current Workflow (Only supports Paratext 9)
1. Open FLExTools
2. Select the "Import from Paratext" module
3. Adjust settings (project, book, chapters, options)
4. Click OK

### Proposed Workflow
1. In Paratext 10, run "Export to FLEx..." command
2. Select target FLEx project (if not already associated)
3. Choose book/chapters
4. Click Export

## Architecture

```
+------------------+     USJ/USFM      +------------------+     LibLCM      +-------------+
|  Paranext        | ----------------> |  FlexTextBridge  | --------------> |   FLEx      |
|  Extension (TS)  |   stdin/args      |  CLI (.NET)      |   C# API        |   Project   |
+------------------+                   +------------------+                 +-------------+
        |                                      |
        | PAPI                                 | stdout (JSON result)
        v                                      v
+------------------+                   +------------------+
| Scripture Data   |                   | Success/Error    |
| Provider         |                   | Response         |
+------------------+                   +------------------+
```

### Component 1: Paranext Extension (TypeScript)

**Location:** `/extension/`

**Responsibilities:**
- Register command "Export to FLEx" in Paranext
- Get scripture data via PAPI (`platformScripture.USJ_Chapter` for each chapter in range)
- Display UI for:
  - Paratext project selection (filtered to editable projects only, excluding resources)
  - Book and chapter range selection using BookChapterControl component
  - Content filter options (disabled by default):
    - Footnotes (\f)
    - Cross References (\x and \r paragraphs)
    - Introduction markers (only for chapter 1)
    - Remarks (\rem)
  - Content filter options (enabled by default):
    - Figures (\fig)
  - Preview tabs: Formatted, USFM, and USJ views
    - Respects project RTL text direction
    - Uses project's default font and size
  - UI automatically mirrors for RTL interface languages (Arabic, Hebrew, etc.)
- Spawn FlexTextBridge CLI and pass scripture data
- Display success/error feedback to user
- Persist settings between sessions

**UI Layout:**
Three inline settings boxes that wrap on narrow screens:

1. **Paratext Settings Box**
   - Paratext project selector (ComboBox)
   - Book/Chapter range selector (BookChapterControl + end chapter ComboBox)

2. **Include in Export Box**
   - Footnotes checkbox (default: off)
   - Cross References checkbox (default: off)
   - Introduction checkbox (default: off, disabled unless chapter 1)
   - Remarks checkbox (default: off)
   - Figures checkbox (default: on)

3. **FLEx Settings Box**
   - FLEx project selector (ComboBox)
   - Writing system selector (shown only when multiple vernacular WS exist)
   - Text name input (auto-generated: `{Book} {Chapter(s)} - {ProjectCode}`)
   - Expected name hint (shown when text exists and will be renamed)
   - Overwrite toggle (Switch)
   - Export button with status message
   - "Open in FLEx" button (after successful export)

4. **Scripture Preview Panel**
   - View mode buttons: Formatted, USFM, USJ
   - Preview area with RTL support
   - Status line showing loaded chapter(s)

**Modals:**
- Overwrite confirmation dialog
- Rename confirmation dialog (when text exists)

**Manifest Requirements:**
```json
{
  "name": "flex-export",
  "version": "0.1.0",
  "elevatedPrivileges": ["createProcess"],
  "activationEvents": ["onCommand:flexExport.exportToFlex"]
}
```

### Component 2: FlexTextBridge CLI (C# .NET)

**Location:** `/bridge/`

**Responsibilities:**
- Discover available FLEx projects on the system
- Open FLEx project via LibLCM (read/write mode)
- Parse incoming USJ/USFM scripture data
- Create FLEx text with proper structure:
  - Text name from book/chapter info
  - Paragraphs split on newlines
  - Writing system tagging (vernacular vs analysis)
- Handle overwrite scenarios
- Return JSON result to stdout

**CLI Interface:**
```bash
# List available FLEx projects (returns basic project info)
FlexTextBridge.exe --list-projects

# Get detailed project info including all writing systems
FlexTextBridge.exe --project-info --project "MyProject"

# Create text from USJ (stdin)
FlexTextBridge.exe --project "MyProject" --title "Mark 01" < scripture.json

# Create text with specific writing system
FlexTextBridge.exe --project "MyProject" --title "Mark 01" --vernacular-ws "xyz" < scripture.json

# Overwrite existing text
FlexTextBridge.exe --project "MyProject" --title "Mark 01" --overwrite < scripture.json

# Check if text name exists and get suggested alternative
FlexTextBridge.exe --check-text --project "MyProject" --title "Mark 01"

# Check if FLEx is running with project sharing enabled
FlexTextBridge.exe --check-flex-status --project "MyProject"

# Get safe navigation target (for redirecting FLEx away from text being overwritten)
FlexTextBridge.exe --get-safe-target --project "MyProject" --title "Mark 01"

# Verify text exists and is accessible by GUID
FlexTextBridge.exe --verify-text --project "MyProject" --guid "12345678-1234-1234-1234-123456789abc"
```

**Output Format (Success):**
```json
{
  "success": true,
  "textName": "Mark 01",
  "textGuid": "12345678-1234-1234-1234-123456789abc",
  "paragraphCount": 45,
  "projectPath": "C:\\ProgramData\\SIL\\FieldWorks\\Projects\\MyProject",
  "vernacularWs": "xyz"
}
```

**Output Format (Error):**
```json
{
  "success": false,
  "error": "Project 'MyProject' is locked (in use by another application)",
  "errorCode": "PROJECT_LOCKED"
}
```

**Error Codes:**
| Code | Description | User Action |
|------|-------------|-------------|
| `PROJECT_NOT_FOUND` | FLEx project doesn't exist | Check project name |
| `PROJECT_LOCKED` | Project in use without sharing | Enable Project Sharing or close FLEx |
| `PROJECT_NEEDS_MIGRATION` | Project needs FLEx upgrade | Open project in FLEx first |
| `TEXT_EXISTS` | Text already exists | Use --overwrite or choose different name |
| `TEXT_NOT_FOUND` | GUID not found after creation | Internal error |
| `TEXT_NOT_ACCESSIBLE` | Text exists but can't be accessed | Internal error |
| `INVALID_USJ` | Malformed scripture data | Check USJ format |
| `WRITE_FAILED` | Failed to write to project | Check permissions |
| `UNKNOWN_ERROR` | Unexpected error | Check error message |

## Core Feature: Writing System Tagging

The primary value of this tool over simple copy/paste is proper writing system assignment. Text imported into FLEx must distinguish vernacular content (translated scripture) from analysis content (markers, references, metadata).

**See [SFMClass.md](SFMClass.md) for complete USFM marker classification.**

### Summary of Writing System Assignment

| Content Type | Writing System | Examples |
|-------------|----------------|----------|
| Scripture text | Vernacular | "In the beginning God created..." |
| All SFM markers | Analysis | `\v`, `\c`, `\p`, `\s`, `\f`, `\x` |
| Chapter/verse numbers | Analysis | `\c 1`, `\v 1` |
| Section heading **content** | Vernacular | "Jesus Heals the Blind" |
| Reference marker **content** | Analysis | "Matt 5:1-12" (from `\r`, `\sr`, `\mr`) |
| Footnote text (`\ft`) | Vernacular | Explanatory text is translated |
| Footnote quotation (`\fq`, `\fqa`) | Vernacular | Quoted scripture is translated |
| Footnote keyword (`\fk`) | Vernacular | Keywords are from scripture |
| Footnote reference (`\fr`) | Analysis | "1:1" is a reference |
| Cross-ref targets (`\xt`) | Analysis | "Gen 1:1; Ps 33:6" |
| Cross-ref keyword (`\xk`, `\xq`) | Vernacular | Keywords/quotes from text |
| Figure captions | Vernacular | Captions are translated |
| Figure attributes (src, ref) | Analysis | File paths and references |

**Key Patterns:**
1. All SFM markers (`\xxx`) are always Analysis
2. Scripture text content is always Vernacular
3. Heading content is Vernacular (the marker `\s` is analysis, but "Jesus Heals" is vernacular)
4. Reference content is Analysis (verse/chapter numbers, cross-reference targets)
5. Footnote explanatory text is Vernacular (translated content)

**Note:** Cross-references, footnotes, introduction, and remarks are **excluded by default** in the extension UI. Figures are included by default. Users can toggle each content type.

### Implementation with USJ

USJ (Unified Scripture JSON) already structures content by type:

```json
{
  "type": "verse",
  "marker": "v",
  "number": "1",
  "content": ["In the beginning God created the heavens and the earth."]
}
```

This eliminates the need for regex parsing - we can walk the USJ tree and tag each node appropriately.

## Data Flow

### Safe Navigation Workflow (Overwrite with FLEx Open)

When FLEx is running with project sharing enabled and the user wants to overwrite an existing text:

1. **Check FLEx Status** (`--check-flex-status`)
   - Detect if FLEx is running
   - Check if project sharing is enabled (required for concurrent access)

2. **If FLEx is open WITHOUT sharing** → Error
   - User must close FLEx or enable Project Sharing (Edit > Project Properties > Sharing)

3. **If FLEx is open WITH sharing** → Safe Redirect Workflow:
   a. Get safe navigation target (`--get-safe-target`)
      - Finds another text in the project (not the one being overwritten)
      - Returns GUID and tool name (e.g., `interlinearEdit`)

   b. Navigate FLEx away using deep link:
      ```
      silfw://localhost/link?database%3d{project}%26tool%3d{tool}%26guid%3d{guid}%26tag%3d
      ```

   c. Wait for navigation to complete (2 seconds)

   d. Delete existing text and create new one

   e. Verify new text is accessible (`--verify-text`)
      - Retries up to 5 times with 500ms delay
      - Ensures text is fully committed before navigation

   f. Navigate back to Texts tool, then to specific text:
      ```
      silfw://localhost/link?database%3d{project}%26tool%3dinterlinearEdit%26guid%3d{newGuid}%26tag%3d
      ```

This workflow prevents "deleted object" errors that occur when FLEx tries to display a text that was just replaced.

### Scripture Retrieval (Extension)

```typescript
// Get project data provider for current project
const pdp = await papi.projectDataProviders.get(
  'platformScripture.USJ_Chapter',
  projectId
);

// Get chapters in range as USJ (one at a time)
for (let ch = startChapter; ch <= endChapter; ch++) {
  const ref = { book: 'MRK', chapterNum: ch, verseNum: 1 };
  const chapterUsj = await pdp.getChapterUSJ(ref);
  chapters.push(chapterUsj);
}
```

### Text Creation (Bridge)

```csharp
// Initialize LibLCM (same pattern as flexlibs)
FwRegistryHelper.Initialize();
FwUtils.InitializeIcu();
Sldr.Initialize(true);

// Open project
var cache = LcmCache.CreateCacheFromExistingData(projectId, ...);

// Create text
var textFactory = cache.ServiceLocator.GetService<ITextFactory>();
var text = textFactory.Create();
text.Name.set_String(cache.DefaultAnalWs, TsStringUtils.MakeString(title, cache.DefaultAnalWs));

// Create paragraphs with proper WS tagging
foreach (var para in paragraphs) {
    var stPara = stParaFactory.Create();
    var bldr = TsStringUtils.MakeStrBldr();

    foreach (var segment in para.Segments) {
        var ws = segment.IsVernacular ? cache.DefaultVernWs : cache.DefaultAnalWs;
        bldr.ReplaceTsString(bldr.Length, bldr.Length,
            TsStringUtils.MakeString(segment.Text, ws));
    }

    stPara.Contents = bldr.GetString();
    text.ContentsOA.ParagraphsOS.Add(stPara);
}
```

## Registered Commands (Extension)

The extension registers the following commands via PAPI:

| Command | Description |
|---------|-------------|
| `flexExport.openExportDialog` | Opens the export WebView (optionally from a WebView menu) |
| `flexExport.listFlexProjects` | Returns available FLEx projects as `FlexProjectInfo[]` |
| `flexExport.getFlexProjectInfo` | Gets detailed project info with all writing systems (cached) |
| `flexExport.preloadFlexProjectInfo` | Background cache warming for multiple projects |
| `flexExport.checkTextName` | Checks if text exists, suggests unique alternative |
| `flexExport.checkFlexStatus` | Returns `{ isRunning, sharingEnabled }` |
| `flexExport.getSafeNavigationTarget` | Gets GUID to navigate away from target text |
| `flexExport.verifyText` | Verifies text is accessible by GUID |
| `flexExport.navigateFlex` | Opens deep link URL to navigate FLEx |
| `flexExport.exportToFlex` | Creates text in FLEx project from USJ data |

## Configuration & Settings

### WebView State (persisted per Paratext project)

Settings are stored using flat WebView state keys with the pattern `settingName-projectId`:

| Key Pattern | Type | Default | Description |
|-------------|------|---------|-------------|
| `flexProjectName-{projectId}` | string | "" | Target FLEx project name |
| `writingSystemCode-{projectId}` | string | "" | Selected vernacular writing system |
| `includeFootnotes-{projectId}` | boolean | false | Include footnotes in export |
| `includeCrossRefs-{projectId}` | boolean | false | Include cross-references |
| `includeIntro-{projectId}` | boolean | false | Include introduction markers |
| `includeRemarks-{projectId}` | boolean | false | Include remarks (\rem) |
| `includeFigures-{projectId}` | boolean | true | Include figures (\fig) |
| `overwriteEnabled` | boolean | false | Overwrite existing texts (global, not per-project) |

**Settings are saved only after successful export**, not on every change. This prevents partial settings from being persisted when the user changes options but doesn't complete an export.

### Project Info Cache

To avoid slow LCM cache loads when switching between FLEx projects, project details are cached in memory:
- **TTL:** 5 minutes
- **Preloading:** When FLEx projects list is fetched, background preloading starts
- **Cache key:** FLEx project name

### FLEx Project Discovery
1. Read registry: `HKLM\SOFTWARE\SIL\FieldWorks\9\ProjectsDir`
2. Default: `C:\ProgramData\SIL\FieldWorks\Projects\`
3. Enumerate subdirectories containing `.fwdata` files
4. Each project opened via LibLCM `LcmCache.CreateCacheFromExistingData()`

## Development Phases

### Pre-MVP: Prove Scripture Access (COMPLETED)
**Goal:** Demonstrate we can read scripture from Paranext PAPI

**Deliverables:**
- [x] Bootstrapped extension (via create-paranext-extension)
- [x] Menu item "Export Chapter(s) to FLEx..." in Project menu of all WebViews
- [x] WebView panel showing:
  - Project selector (ComboBox filtering to editable projects)
  - Book/chapter range selector (BookChapterControl + end chapter ComboBox)
  - Content filter checkboxes (footnotes, cross-refs, intro, remarks, figures)
  - Scripture preview in three views: Formatted, USFM, USJ

**Implementation Notes:**
- Uses `platformScripture.USJ_Chapter` to fetch chapters individually
- Filters projects using `platform.isEditable` setting to exclude downloaded resources (temporarily disabled for testing)
- When opened from a project WebView, auto-selects that project and current chapter
- BookChapterControl shows reference with verse (e.g., "Matthew 20:1") - verse cannot be hidden
- Content filters are all disabled by default (content is excluded unless checked)
- Introduction filter only available when starting chapter is 1
- Detects project's `platform.textDirection` for RTL scripture preview
- Detects `platform.interfaceLanguage` for RTL UI layout
- Attempts to read project's `DefaultFont` and `DefaultFontSize` for preview styling

**Success Criteria:** Can display any chapter range's content in the WebView with filtering

### Pre-MVP Bonus: Internationalization (COMPLETED)
**Goal:** Support multiple UI languages

**Deliverables:**
- [x] All UI strings externalized to localizedStrings.json
- [x] Localized to 15 languages: English, Spanish, French, Portuguese, German, Indonesian, Russian, Chinese (Simplified & Traditional), Turkish, Vietnamese, Arabic, Hindi, Swahili, Korean
- [x] RTL UI layout support for Arabic and Hebrew interface languages
- [x] Project text direction detection for scripture previews
- [x] Project font and size applied to previews

### MVP Phase 1: Bridge CLI (COMPLETED)
**Goal:** Standalone tool that creates FLEx texts

**Deliverables:**
- [x] C# console app with LibLCM NuGet reference
- [x] `--list-projects` command working
- [x] `--project-info` command returns all writing systems for a project
- [x] `--project --title` with stdin USJ creates text
- [x] USFM output with Proper writing system tagging (see SFMClass.md for full marker classification)
 - Vernacular text must be tagged in FLEx with the default Vernacular Writing System of the Fieldworks project.
 - Tags, filenames, etc will be tagged in FLEx with the default Analysis Writing System of the Fieldworks Project
 - Section headings (\s, \s1, etc.) content is vernacular; marker is analysis
 - Reference markers (\sr, \r, \mr) content is analysis (they contain references)
 - Footnote text (\ft, \fq, \fk) is vernacular; reference (\fr) is analysis
 - Figure captions are vernacular
- [x] JSON output format with error codes
- [x] `--overwrite` flag for replacing existing texts
- [x] `--vernacular-ws` option for selecting non-default writing system
- [x] `--check-text` command to check if text exists and suggest unique name
- [x] `--check-flex-status` to check if FLEx is running with sharing enabled
- [x] `--get-safe-target` to find safe navigation target for overwrite workflow
- [x] `--verify-text` to verify text accessibility by GUID after creation

**Success Criteria:** Can run from command line to create a FLEx text - ACHIEVED

### MVP Phase 2: Integration (COMPLETED)
**Goal:** End-to-end workflow from Paranext to FLEx

**Deliverables:**
- [x] Extension spawns bridge CLI via `createProcess.spawn()`
- [x] FLEx Project picker dropdown (populated from `--list-projects`)
- [x] Writing system selector when multiple vernacular WS exist in project
- [x] Paratext project picker (filtered to editable projects)
- [x] Book/chapter range picker (from PAPI via BookChapterControl)
- [x] Export button triggers full flow
- [x] Auto-generated text name: `{BookName} {Chapter(s)} - {ProjectCode}`
- [x] Text name collision handling with unique suggestions (appends (2), (3), etc.)
- [x] Overwrite toggle with confirmation dialog
- [x] Success/error notifications with detailed messages
- [x] Settings persistence per Paratext project (saved after successful export)
- [x] "Open in FLEx" button after successful export
- [x] Deep link navigation to exported text in FLEx interlinear view
- [x] Safe redirect workflow when FLEx is open with project sharing enabled
- [x] Text verification before navigation to prevent "deleted object" errors
- [x] Project info caching (5-minute TTL) to avoid slow LCM cache loads
- [x] Background project preloading when FLEx projects list is fetched

**Success Criteria:** User can export a book to FLEx without leaving Paratext - ACHIEVED

### Post-MVP Features (COMPLETED)
- [x] Overwrite confirmation dialog
- [x] Navigate FLEx to exported text (when FLEx is open with sharing)
- [x] Persist content filter settings between sessions (per Paratext project)
- [x] Writing system selection for projects with multiple vernacular WS
- [x] Rename suggestion when text already exists

### Future Enhancements (NOT YET IMPLEMENTED)
- [ ] Improve FLEx Remote control/persistence
- [ ] Test closing tags/footnotes
- [ ] "One text per chapter" option (currently exports range as single text)
- [ ] Better Confirmation of success
- [ ] Writing system mismatch warning (compare FLEx vernacular WS with Paratext language code)
- [ ] Linux/macOS support (requires cross-platform LibLCM)
- [ ] Additional localizations (Amharic, Khmer, Tamil, Telugu, Yoruba, etc.)

## Prerequisites

### User Machine
- Paratext 10 installed
- FieldWorks 9.x installed
- Windows (initially)
- .NET 4.8 Runtime

### Development Machine
- Node.js 18+
- .NET 4.8 SDK
- Paratext 10 (for testing)
- FieldWorks 9.x (for testing)

## Non-Goals (Explicit Exclusions)

- **Cluster projects**: No multi-project import (simplifies MVP)
- **Python dependency**: Bridge is pure C#, no FlexTools/Python required
- **Paratext 9 support**: P10 only
- **Bidirectional sync**: Export only, no import from FLEx
- **Plugin marketplace**: Sideload distribution only (for now)

## References

### Existing Implementation (FLExTrans)
- `ImportFromParatext.py` - Main import logic
- `ChapterSelection.py` - `splitSFMs()` regex, UI, text creation

### APIs
- Paranext PAPI: `platformScripture.USJ_Book`, `USFM_Book`
- LibLCM: `ITextFactory`, `IStTextFactory`, `TsStringUtils`

### Documentation
- [Paranext Extension Guide](https://github.com/paranext/paranext-core/wiki)
- [LibLCM NuGet](https://www.nuget.org/packages/SIL.LCModel)
- [USJ Format](https://docs.usfm.bible/usj/)

### Related Repositories
- [Paratext Extension Bootstrap](https://github.com/beniza/create-paranext-extension)
 - Locally D:\Github\paranextPlugin\create-paranetxt-extension
- [FLExTrans](https://github.com/rmlockwood/FLExTrans)
 - Locally D:\Github\FLExTrans
- [libLCM](https://github.com/sillsdev/liblcm)
 - Locally D:\Github\liblcm
- [Paranext-Core](https://github.com/paranext/paranext-core)
 - Locally D:\Github\paranext-core
- [Paranext-extemsion-template](https://github.com/paranext/paranext-extension-template)

## Files Reference

### Extension (TypeScript)

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Extension metadata, privileges |
| `extension/src/main.ts` | Extension activation, command registration |
| `extension/src/web-views/welcome.web-view.tsx` | Main export UI (1750+ lines) |
| `extension/src/services/flex-bridge.service.ts` | FlexTextBridge CLI wrapper |
| `extension/contributions/menus.json` | Menu item definitions |
| `extension/contributions/localizedStrings.json` | UI string translations (15 languages) |
| `extension/contributions/settings.json` | Extension settings schema |

### Bridge CLI (C#)

| File | Purpose |
|------|---------|
| `bridge/FlexTextBridge/Program.cs` | CLI entry point, argument parsing |
| `bridge/FlexTextBridge/Commands/ListProjectsCommand.cs` | --list-projects implementation |
| `bridge/FlexTextBridge/Commands/ProjectInfoCommand.cs` | --project-info implementation |
| `bridge/FlexTextBridge/Commands/CreateTextCommand.cs` | Text creation from USJ |
| `bridge/FlexTextBridge/Commands/CheckTextCommand.cs` | --check-text implementation |
| `bridge/FlexTextBridge/Commands/CheckFlexStatusCommand.cs` | --check-flex-status implementation |
| `bridge/FlexTextBridge/Commands/SafeTargetCommand.cs` | --get-safe-target implementation |
| `bridge/FlexTextBridge/Commands/VerifyTextCommand.cs` | --verify-text implementation |
| `bridge/FlexTextBridge/Services/FlexProjectService.cs` | FLEx project discovery and opening |
| `bridge/FlexTextBridge/Services/TextCreationService.cs` | LibLCM text/paragraph creation |
| `bridge/FlexTextBridge/Services/UsjToUsfmConverter.cs` | USJ to tagged USFM segments |
| `bridge/FlexTextBridge/Models/` | Data models (UsjDocument, results) |

### Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project context for AI assistance |
| `Spec.md` | This specification document |
| `SFMClass.md` | USFM marker writing system classification |
| `Discussion.md` | Original requirements discussion |

### Tests

| File | Purpose |
|------|---------|
| `extension/src/__tests__/` | Jest test suites |
| `extension/jest.config.js` | Jest configuration |
| `bridge/FlexTextBridge.Tests/` | NUnit test project |

## Build & Deploy

### Extension
```bash
cd extension
npm install
npm run build        # Production build
npm run watch        # Development mode with hot reload
npm run lint         # ESLint check
npm run test         # Run Jest tests (112 tests)
npm run deploy       # Deploy to Paranext extensions folder
```

### Bridge CLI
```bash
cd bridge
dotnet restore
dotnet build
dotnet publish -c Release -r win-x64 --self-contained false
```

The published bridge executable is automatically copied to `extension/assets/bridge/` during the extension build process.
