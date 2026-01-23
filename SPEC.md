# P10-Export-FLEx Specification

## Problem Statement

When someone wants to translate a text using FLExTrans, the first step is to import it into FLEx. If that text is scripture, it would be nice if the user could from within Paratext run a command that would export a desired portion of scripture to FLEx. The key is remaining in Paratext.

### Current Workflow
1. Open FLExTools
2. Select the "Import from Paratext" module
3. Adjust settings (project, book, chapters, options)
4. Click OK

### Proposed Workflow
1. In Paratext 10, run "Export to FLEx" command
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
- Two-column responsive grid (stacks on narrow screens)
- Left column: Project selector, Book/Chapter range selector
- Right column: Content filter checkboxes ("Include in Export")
- Below: Preview toggle buttons (Formatted/USFM/USJ) and preview panel
- Status line showing loaded chapter(s)

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
# List available FLEx projects
FlexTextBridge.exe --list-projects

# Create text from USJ (stdin)
FlexTextBridge.exe --project "MyProject" --title "Mark 01" < scripture.json

# Create text from USFM file
FlexTextBridge.exe --project "MyProject" --title "Mark 01" --file scripture.sfm
```

**Output Format:**
```json
{
  "success": true,
  "textName": "Mark 01",
  "paragraphCount": 45,
  "projectPath": "C:\\ProgramData\\SIL\\FieldWorks\\Projects\\MyProject"
}
```

Or on error:
```json
{
  "success": false,
  "error": "Project 'MyProject' not found",
  "availableProjects": ["Project1", "Project2"]
}
```

## Core Feature: Writing System Tagging

The primary value of this tool over simple copy/paste is proper writing system assignment. Text imported into FLEx must distinguish:

| Content Type | Writing System | Examples |
|-------------|----------------|----------|
| Scripture text | Vernacular | "In the beginning God created..." |
| SFM markers | Analysis | `\v`, `\c`, `\p`, `\s` |
| Verse numbers | Analysis | `1`, `2`, `3` |
| Cross-references | Analysis | `\x`, `\xo 1:1`, `\xt Gen 1:1\x*` |
| Footnotes | Analysis | `\f`, `\fr 1:1`, `\ft ...` |
| Introduction | Analysis | `\imt`, `\is`, `\ip`, etc. |
| Remarks | Analysis | `\rem` |
| Figures | Analysis | `\fig` |

**Note:** All content types above (cross-references, footnotes, introduction, remarks, figures) are **excluded by default** in the extension UI. Users must explicitly enable each type to include it in the export.

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

## Configuration & Settings

### Extension Settings (persisted in Paranext)
- `flexExport.defaultFlexProject`: string - Last used FLEx project
- `flexExport.includeFootnotes`: boolean - Include footnotes (default: false)
- `flexExport.includeCrossRefs`: boolean - Include cross-references (default: false)
- `flexExport.includeIntro`: boolean - Include introduction markers (default: false)
- `flexExport.includeRemarks`: boolean - Include remarks (default: false)
- `flexExport.includeFigures`: boolean - Include figures (default: true)
- `flexExport.useFullBookName`: boolean - Use "Mark" vs "MRK" in title (default: true)
- `flexExport.overwriteExisting`: boolean - Overwrite if text exists (default: false)

### FLEx Project Discovery
1. Read registry: `HKLM\SOFTWARE\SIL\FieldWorks\9\ProjectsDir`
2. Enumerate subdirectories
3. Filter to valid `.fwdata` projects

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

### MVP Phase 1: Bridge CLI
**Goal:** Standalone tool that creates FLEx texts

**Deliverables:**
- [ ] C# console app with LibLCM NuGet reference
- [ ] `--list-projects` command working
- [ ] `--project --title` with stdin USJ creates text
- [ ] USFM output with Proper writing system tagging
 - Vernacular text must be tagged in FLEx with the default Vernacular Writing System of the Fieldworks project.
 - Tags, filenames, etc will be tagged in FLEx with the default Analysis Writing System of the Fieldworks Project 
- [ ] JSON output format

**Success Criteria:** Can run from command line to create a FLEx text

### MVP Phase 2: Integration
**Goal:** End-to-end workflow from Paranext to FLEx

**Deliverables:**
- [ ] Extension spawns bridge CLI via `createProcess.spawn()`
- [ ] Project picker dropdown (populated from `--list-projects`)
- [ ] Book picker (from PAPI)
- [ ] Export button triggers full flow
- [ ] If the first 3 letters of Flex's Default Vernacular does NOT match the language code fo the Paratext Project, a warning will be shown allowing the user to abort or continue.  
- [ ] Success/error toast notifications
- [ ] Settings persistence

**Success Criteria:** User can export a book to FLEx without leaving Paratext

### Future Enhancements
- "One text per chapter" option (currently exports range as single text)
- Overwrite confirmation dialog
- Open FLEx after export
- Linux/macOS support
- Persist content filter settings between sessions
- Additional localizations (Amharic, Khmer, Tamil, Telugu, Yoruba, etc.)

## Prerequisites

### User Machine
- Paratext 10 installed
- FieldWorks 9.x installed
- Windows (initially)

### Development Machine
- Node.js 18+
- .NET 8 SDK
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
