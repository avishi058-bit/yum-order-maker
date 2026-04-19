#!/usr/bin/env node
/**
 * Build script for the Electron Kiosk wrapper.
 *
 * Usage (from project root):
 *   node electron/build.cjs            # current platform
 *   node electron/build.cjs win32      # Windows x64
 *   node electron/build.cjs darwin     # macOS x64
 *   node electron/build.cjs linux      # Linux x64
 *
 * Output: ./electron-release/הבקתה-Kiosk-<platform>-x64/
 */

const { spawnSync } = require('child_process');
const path = require('path');

const platform = process.argv[2] || process.platform;
const root = path.resolve(__dirname, '..');

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: true, ...opts });
  if (r.status !== 0) {
    console.error(`Command failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

// 1) Make sure deps are installed
run('npm', ['install', '--save-dev', 'electron', '@electron/packager']);

// 2) Package
run('npx', [
  '@electron/packager',
  '.',
  'הבקתה-Kiosk',
  `--platform=${platform}`,
  '--arch=x64',
  '--out=electron-release',
  '--overwrite',
  '--prune=true',
  '--ignore=^/src',
  '--ignore=^/public',
  '--ignore=^/supabase',
  '--ignore=^/electron-release',
  '--ignore=^/dist',
  '--ignore=^/.lovable',
  '--ignore=^/test',
]);

console.log('\n✅ Build complete. Output: electron-release/');
