# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

P10-Export-FLEx is a Paratext 10 extension that exports Scripture texts to FieldWorks Language Explorer (FLEx) for linguistic analysis. It replaces the workflow of using FLExTools' ImportFromParatext module by allowing users to export directly from within Paratext.

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

### Components

1. **Paranext Extension** (`/extension/`) - TypeScript
   - Gets scripture via PAPI (`platformScripture.USJ_Book` or `USFM_Book`)
   - Provides UI for project/book selection
   - Spawns FlexTextBridge CLI via `createProcess.spawn()`
   - Requires `elevatedPrivileges: ["createProcess"]` in manifest

2. **FlexTextBridge CLI** (`/bridge/`) - C# .NET
   - Standalone console app using LibLCM
   - Receives USJ/USFM via stdin or temp file
   - Creates texts in FLEx project with proper writing system tagging
   - Returns JSON result to stdout

### Key Dependencies

- **Paranext**: `@papi/core`, `@papi/backend` for extension APIs
- **LibLCM**: NuGet package `SIL.LCModel` for FLEx project access
- **platform-bible-utils**: USJ/USFM parsing utilities (already in paranext-core)

## Reference Repositories

Local copies (not committed):
- `D:/Github/paranext-core` - Paranext 10 source, extension patterns
- `D:/Github/liblcm` - LibLCM C# API
- `D:/Github/flexlibs` - Python/LibLCM bridge (reference for API usage)
- `D:/Github/FLExTrans` - ImportFromParatext.py logic to replicate

## Build Commands

### Extension (TypeScript)
```bash
cd extension
npm install
npm run build        # Build for production
npm run watch        # Development mode
npm run lint         # ESLint check
```

### Bridge CLI (C#)
```bash
cd bridge
dotnet restore
dotnet build
dotnet publish -c Release -r win-x64 --self-contained false
```

## Key Files

### Paranext Scripture API
- `paranext-core/extensions/src/platform-scripture/src/types/platform-scripture.d.ts`
  - `getBookUSFM(verseRef)`, `getBookUSX(verseRef)`, `getBookUSJ(verseRef)`

### FLExTrans Import Logic (reference)
- `FLExTrans/Dev/Modules/ImportFromParatext.py` - Main import logic
- `FLExTrans/Dev/Lib/ChapterSelection.py` - `splitSFMs()` function, text creation

### LibLCM Text Creation
- `flexlibs/flexlibs/code/TextsWords/TextOperations.py` - `Create()`, patterns
- `flexlibs/flexlibs/code/TextsWords/ParagraphOperations.py` - Paragraph creation
- `flexlibs/flexlibs/code/FLExInit.py` - LibLCM initialization pattern

## Implementation Notes

### Writing System Tagging
The core value of this tool is proper writing system assignment:
- **Vernacular WS**: Actual scripture text content
- **Analysis WS**: SFM markers (\v, \c, \p), verse references, footnote markers

See `ChapterSelection.py:splitSFMs()` for the regex-based approach used in FLExTrans.
With USJ format, this becomes simpler as content is already structured.

### FLEx Project Discovery
- Projects stored in `C:\ProgramData\SIL\FieldWorks\Projects\`
- Registry key: `SOFTWARE\SIL\FieldWorks\9` contains `ProjectsDir`
- Use LibLCM's project enumeration APIs

### Extension Manifest Requirements
```json
{
  "elevatedPrivileges": ["createProcess"],
  "activationEvents": ["onCommand:exportToFlex"]
}
```

## Development Phases

### Pre-MVP: Read Scripture
- [ ] Bootstrap extension with create-paranext-extension
- [ ] Get current project's book list via PAPI
- [ ] Read a book as USJ and display in WebView

### MVP Phase 1: Bridge CLI
- [ ] C# console app structure with LibLCM
- [ ] Discover FLEx projects
- [ ] Create text from USJ input
- [ ] Return JSON success/error

### MVP Phase 2: Full Integration
- [ ] Extension spawns bridge CLI
- [ ] Project selection UI
- [ ] Book/chapter selection
- [ ] Settings persistence

### Future
- Chapter range selection
- Overwrite handling
- Trigger FLEx to open the new text
- Localization support
