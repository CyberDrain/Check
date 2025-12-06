#!/usr/bin/env node

/**
 * Build script for creating browser-specific extension packages
 * Supports both Chrome and Firefox builds with appropriate manifest files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const browser = args.find(arg => arg === 'chrome' || arg === 'firefox') || 'chrome';

console.log(`Building extension for ${browser}...`);

// Paths
const manifestPath = path.join(rootDir, 'manifest.json');
const firefoxManifestPath = path.join(rootDir, 'manifest.firefox.json');
const manifestBackupPath = path.join(rootDir, 'manifest.chrome.json');

try {
  if (browser === 'firefox') {
    // For Firefox build
    console.log('Configuring for Firefox...');
    
    // Backup original manifest as Chrome version if not already done
    if (!fs.existsSync(manifestBackupPath)) {
      console.log('Backing up Chrome manifest...');
      fs.copyFileSync(manifestPath, manifestBackupPath);
    }
    
    // Copy Firefox manifest
    console.log('Copying Firefox manifest...');
    fs.copyFileSync(firefoxManifestPath, manifestPath);
    
    console.log('✓ Firefox build configured');
    console.log('');
    console.log('Firefox-specific changes:');
    console.log('  - Using background.scripts instead of service_worker');
    console.log('  - Removed file:/// protocol from content_scripts');
    console.log('  - Changed options_page to options_ui');
    console.log('  - Added browser_specific_settings with gecko ID');
    console.log('  - Removed identity.email permission (not needed in Firefox)');
    console.log('');
    console.log('Test the extension:');
    console.log('  1. Open Firefox');
    console.log('  2. Go to about:debugging#/runtime/this-firefox');
    console.log('  3. Click "Load Temporary Add-on"');
    console.log('  4. Select manifest.json from this directory');
    
  } else {
    // For Chrome build
    console.log('Configuring for Chrome...');
    
    // Restore Chrome manifest if backup exists
    if (fs.existsSync(manifestBackupPath)) {
      console.log('Restoring Chrome manifest...');
      fs.copyFileSync(manifestBackupPath, manifestPath);
      console.log('✓ Chrome build configured');
    } else {
      console.log('✓ Already using Chrome manifest');
    }
    
    console.log('');
    console.log('Note: To restore to the original manifest from version control,');
    console.log('      use: git checkout manifest.json');
    console.log('');
    console.log('Test the extension:');
    console.log('  1. Open Chrome/Edge');
    console.log('  2. Go to chrome://extensions or edge://extensions');
    console.log('  3. Enable Developer mode');
    console.log('  4. Click "Load unpacked"');
    console.log('  5. Select this directory');
  }
  
  console.log('');
  console.log('Note: The extension uses scripts/browser-polyfill.js to handle');
  console.log('      API differences between Chrome and Firefox automatically.');
  
} catch (error) {
  console.error('Error during build:', error);
  process.exit(1);
}
