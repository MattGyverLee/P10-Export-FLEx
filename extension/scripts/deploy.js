const fs = require('fs');
const path = require('path');

const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) {
  console.error('LOCALAPPDATA environment variable not set');
  process.exit(1);
}

// Paratext 10 Studio (legacy) and platform-bible (new install layout shipped
// from v10.5+) live side-by-side on disk; deploy to whichever ones are
// present so testing across versions doesn't require manual copies.
const installRoots = [
  path.join(localAppData, 'Programs', 'paratext-10-studio'),
  path.join(localAppData, 'Programs', 'platform-bible'),
];
const sourceDir = path.join(__dirname, '..', 'dist');

let deployedAny = false;
for (const root of installRoots) {
  if (!fs.existsSync(root)) continue;
  const targetDir = path.join(root, 'resources', 'extensions', 'flex-export');

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    console.log('[DONE] Removed existing extension folder:', targetDir);
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log('[DONE] Deployed extension to:', targetDir);
  deployedAny = true;
}

if (!deployedAny) {
  console.error('[ERROR] No Paratext install found at any of:', installRoots.join(', '));
  process.exit(1);
}
