# P10-Export-FLEx

A Paratext 10 extension that exports Scripture texts to FieldWorks Language Explorer (FLEx) for linguistic analysis.

## Overview

P10-Export-FLEx replaces the workflow of using FLExTools' ImportFromParatext module by allowing users to export directly from within Paratext. The extension consists of two components:

- **Paranext Extension** (TypeScript) - Provides UI and scripture access within Paratext
- **FlexTextBridge CLI** (C# .NET) - Handles FLEx project integration and text creation

## Developer Setup

### Prerequisites

- Node.js 22.16.0 (use [volta](https://docs.volta.sh/) for automatic version management)
- .NET 6 or later (for the bridge CLI)
- Git

### Cloning the Repository

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/P10-Export-FLEx.git
   cd P10-Export-FLEx
   ```

2. Clone paranext-core (required for extension development):
   ```bash
   # Clone to the same parent directory
   cd ..
   git clone https://github.com/yourusername/paranext-core.git

   # Your directory structure should look like:
   # /path/to/repos/
   #   ├── P10-Export-FLEx/
   #   └── paranext-core/
   ```

### Installing Dependencies

#### Extension

```bash
cd extension
npm install
```

#### Bridge CLI

```bash
cd bridge/FlexTextBridge
dotnet restore
```

### Building the Project

Build both the extension and bridge:

```bash
cd extension
npm run build
```

This command will:
1. Build the TypeScript extension code
2. Build the C# bridge CLI

For development with auto-rebuild on file changes:

```bash
npm run watch
```

For production builds:

```bash
npm run build:production
```

## Installing into Paratext

The plugin is deployed to Paratext's extension directory at:
```
%LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export
```

### Automated Deployment

After building, deploy the extension with a single command:

```bash
cd extension
npm run deploy
```

This script will:
1. Build the extension and bridge CLI
2. Remove any existing extension installation
3. Copy the compiled extension (`dist/` folder) to Paratext's extensions directory
4. Make it available in Paratext on the next restart

### Manual Installation

If you need to manually install the extension:

1. Ensure the extension is built:
   ```bash
   cd extension
   npm run build
   ```

2. The deployment script copies these files from `extension/dist/`:
   - All bundled extension code
   - Compiled manifests and configuration
   - The compiled FlexTextBridge CLI executable

3. Create the target directory if it doesn't exist:
   ```bash
   mkdir "%LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export"
   ```

4. Copy the entire `extension/dist/` folder contents to that directory

5. Restart Paratext Studio to load the extension

## Available Scripts

### Extension Development

- `npm run build` - Build extension and bridge CLI
- `npm run build:production` - Production build with optimizations
- `npm run watch` - Watch mode with auto-rebuild
- `npm run deploy` - Build and deploy to Paratext
- `npm run lint` - Run ESLint and stylelint
- `npm run lint-fix` - Fix linting issues
- `npm run test` - Run Jest tests
- `npm run test:watch` - Watch mode for tests
- `npm run start` - Start development environment with paranext-core
- `npm run package` - Create distributable zip file

### Bridge CLI

- `npm run build:bridge` - Build just the C# CLI

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

## Troubleshooting

### Extension not appearing in Paratext

- Verify the extension was built: Check that `extension/dist/` contains files
- Verify the deployment: Check that files exist in `%LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export`
- Restart Paratext Studio completely
- Check Paratext logs for any extension loading errors

### Bridge CLI issues

- Ensure .NET 6+ is installed: `dotnet --version`
- Verify the CLI built: Check that `extension/dist/` contains the FlexTextBridge executable
- Test the CLI directly:
  ```bash
  cd bridge/FlexTextBridge
  dotnet run -- --help
  ```

### Build failures

- Clear node_modules and reinstall:
  ```bash
  cd extension
  rm -r node_modules package-lock.json
  npm install
  ```
- Clear .NET build artifacts:
  ```bash
  cd bridge/FlexTextBridge
  dotnet clean
  dotnet restore
  ```

## Architecture Reference

See the [CLAUDE.md](./CLAUDE.md) file for detailed architecture documentation, component descriptions, and development phase plans.

## License

MIT
