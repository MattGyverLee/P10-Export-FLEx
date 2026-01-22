const fs = require('fs');
const path = require('path');

const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) {
  console.error('LOCALAPPDATA environment variable not set');
  process.exit(1);
}

const targetDir = path.join(localAppData, 'Programs', 'paratext-10-studio', 'resources', 'extensions', 'flex-export');
const sourceDir = path.join(__dirname, '..', 'dist');

// Remove existing
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log('[DONE] Removed existing extension folder');
}

// Copy dist folder
fs.cpSync(sourceDir, targetDir, { recursive: true });
console.log('[DONE] Deployed extension to:', targetDir);
