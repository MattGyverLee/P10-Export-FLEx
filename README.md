# P10-Export-FLEx

A Paratext 10 extension that exports Scripture texts to FieldWorks Language Explorer (FLEx) for linguistic analysis.

## Overview

P10-Export-FLEx replaces the workflow of using FLExTools' ImportFromParatext module by allowing users to export directly from within Paratext. The extension consists of two components:

- **Paranext Extension** (TypeScript) - Provides UI and scripture access within Paratext
- **FlexTextBridge CLI** (C# .NET) - Handles FLEx project integration and text creation

## For Developers

See [DEVELOPER.md](./DEVELOPER.md) for setup, building, and local testing instructions.

## Distribution & Releases

### Creating a Release

This repository uses a manual release workflow to distribute compiled plugins:

1. Go to your repo → **Actions** tab
2. Click **Manual Release** workflow on the left
3. Click **Run workflow** (dropdown button)
4. Enter the version number (e.g., `0.1.0`)
5. Click **Run workflow**

The workflow will:
- Build the extension and bridge CLI in Release mode
- Create a distributable zip package (`flex-export_X.X.X.zip`)
- Upload it to GitHub Releases with installation instructions

### Installing from GitHub Releases

End users can install the extension by:

1. Download the latest `flex-export_*.zip` from [GitHub Releases](../../releases)
2. Extract the zip to:
   ```
   %LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export
   ```
3. Restart Paratext Studio

The extension will be available in your Paratext menu.

## Project Structure

```
P10-Export-FLEx/
├── extension/              # TypeScript extension
│   ├── src/
│   │   ├── main.ts        # Extension entry point
│   │   └── web-views/     # React UI components
│   ├── scripts/
│   │   └── deploy.js      # Deployment script
│   ├── manifest.json      # Extension configuration
│   └── package.json       # Node.js dependencies
│
└── bridge/                 # C# .NET bridge
    └── FlexTextBridge/
        ├── Services/      # FLEx project interaction
        └── *.csproj       # .NET project file
```

## License

MIT
