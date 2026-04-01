# Developer Guide

This guide covers development setup, building, and local testing of P10-Export-FLEx.

## Prerequisites

- Node.js 22.16.0 (use [volta](https://docs.volta.sh/) for automatic version management)
- .NET 6 or later (for the bridge CLI)
- Git

## Cloning the Repository

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

## Installing Dependencies

### Extension

```bash
cd extension
npm install
```

### Bridge CLI

```bash
cd bridge/FlexTextBridge
dotnet restore
```

## Building the Project

### Full Build

Build both the extension and bridge:

```bash
cd extension
npm run build
```

This command will:
1. Build the TypeScript extension code
2. Build the C# bridge CLI

### Development Mode

For development with auto-rebuild on file changes:

```bash
npm run watch
```

### Production Build

For production builds with optimizations:

```bash
npm run build:production
```

## Local Testing in Paratext

### Automated Deployment

After building, deploy the extension to your local Paratext installation:

```bash
cd extension
npm run deploy
```

This script will:
1. Build the extension and bridge CLI
2. Remove any existing extension installation
3. Copy the compiled extension (`dist/` folder) to Paratext's extension directory
4. Make it available in Paratext on the next restart

The plugin is deployed to: `%LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export`

### Manual Installation

If you need to manually install the extension:

1. Ensure the extension is built:
   ```bash
   cd extension
   npm run build
   ```

2. Create the target directory if it doesn't exist:
   ```bash
   mkdir "%LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export"
   ```

3. Copy the entire `extension/dist/` folder contents to that directory

4. Restart Paratext Studio to load the extension

## Available Scripts

### Extension Development

- `npm run build` - Build extension and bridge CLI
- `npm run build:production` - Production build with optimizations
- `npm run watch` - Watch mode with auto-rebuild
- `npm run deploy` - Build and deploy to local Paratext installation
- `npm run lint` - Run ESLint and stylelint
- `npm run lint-fix` - Fix linting issues
- `npm run test` - Run Jest tests
- `npm run test:watch` - Watch mode for tests
- `npm run test:coverage` - Generate test coverage report
- `npm run start` - Start development environment with paranext-core
- `npm run package` - Create distributable zip file

### Bridge CLI

- `npm run build:bridge` - Build just the C# CLI

## Creating a Release

### Prerequisites
- Windows with FieldWorks 9 installed
- GitHub CLI: https://cli.github.com
- Node.js 22.16.0+

### Release Steps

**1. Build the bridge locally** (Windows with FieldWorks 9):
```bash
cd bridge/FlexTextBridge
dotnet build -c Release
```

**2. Build and release using the script:**
```bash
./scripts/release.ps1 -Version 0.1.0
```

This script will:
- Build the extension
- Verify the bridge executable exists
- Create a GitHub release with the zip file uploaded

Alternatively, do it manually:
```bash
cd extension
npm run package
gh release create v0.1.0 release/flex-export_0.1.0.zip --title "Release v0.1.0" --notes "See README.md for installation"
```

**Note:** The bridge CLI requires FieldWorks 9 (Windows only). The compiled `FlexTextBridge.exe` must be built locally and included in `extension/dist/bridge/` before creating a release.

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
