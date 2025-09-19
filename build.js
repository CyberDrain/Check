import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist', { recursive: true });

// Copy static files
const staticFiles = [
  'manifest.json',
  'blocked.html',
  'popup/popup.html',
  'popup/popup.css',
  'options/options.html', 
  'options/options.css',
  'styles/content.css',
  'config/branding.json',
  'config/managed_schema.json',
  'rules/detection-rules.json',
  'images'
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(item => {
      copyRecursive(path.join(src, item), path.join(dest, item));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

staticFiles.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(__dirname, 'dist', file);
  
  if (fs.existsSync(srcPath)) {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`Warning: ${file} does not exist`);
  }
});

// Compile TypeScript
console.log('Compiling TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript compilation completed');
  
  // Move compiled files from src/ structure to root structure in dist
  const compiledSrcPath = path.join(__dirname, 'dist', 'src');
  const distPath = path.join(__dirname, 'dist');
  
  if (fs.existsSync(compiledSrcPath)) {
    // Move scripts from dist/src/scripts to dist/scripts
    const srcScriptsPath = path.join(compiledSrcPath, 'scripts');
    const destScriptsPath = path.join(distPath, 'scripts');
    
    if (fs.existsSync(srcScriptsPath)) {
      if (fs.existsSync(destScriptsPath)) {
        fs.rmSync(destScriptsPath, { recursive: true });
      }
      fs.renameSync(srcScriptsPath, destScriptsPath);
      console.log('Moved compiled scripts to scripts/');
    }
    
    // Move popup.js from dist/src/ to dist/popup/
    const srcPopupPath = path.join(compiledSrcPath, 'popup.js');
    const destPopupDir = path.join(distPath, 'popup');
    const destPopupPath = path.join(destPopupDir, 'popup.js');
    
    if (fs.existsSync(srcPopupPath)) {
      fs.mkdirSync(destPopupDir, { recursive: true });
      fs.renameSync(srcPopupPath, destPopupPath);
      console.log('Moved compiled popup.js to popup/');
    }
    
    // Move options.js from dist/src/ to dist/options/
    const srcOptionsPath = path.join(compiledSrcPath, 'options.js');
    const destOptionsDir = path.join(distPath, 'options');
    const destOptionsPath = path.join(destOptionsDir, 'options.js');
    
    if (fs.existsSync(srcOptionsPath)) {
      fs.mkdirSync(destOptionsDir, { recursive: true });
      fs.renameSync(srcOptionsPath, destOptionsPath);
      console.log('Moved compiled options.js to options/');
    }
    
    // Move modules and utils to scripts/ (since they're imported by main scripts)
    const srcModulesPath = path.join(compiledSrcPath, 'modules');
    const srcUtilsPath = path.join(compiledSrcPath, 'utils');
    const srcTypesPath = path.join(compiledSrcPath, 'types');
    
    if (fs.existsSync(srcModulesPath)) {
      const destModulesPath = path.join(destScriptsPath, 'modules');
      fs.mkdirSync(destModulesPath, { recursive: true });
      copyRecursive(srcModulesPath, destModulesPath);
      console.log('Moved compiled modules to scripts/modules/');
    }
    
    if (fs.existsSync(srcUtilsPath)) {
      const destUtilsPath = path.join(destScriptsPath, 'utils');
      fs.mkdirSync(destUtilsPath, { recursive: true });
      copyRecursive(srcUtilsPath, destUtilsPath);
      console.log('Moved compiled utils to scripts/utils/');
    }
    
    // Move types to shared location (needed for imports)
    if (fs.existsSync(srcTypesPath)) {
      const destTypesPath = path.join(destScriptsPath, 'types');
      fs.mkdirSync(destTypesPath, { recursive: true });
      copyRecursive(srcTypesPath, destTypesPath);
      console.log('Moved compiled types to scripts/types/');
      
      // Also copy types to popup and options directories for local imports
      const popupTypesPath = path.join(destPopupDir, 'types');
      const optionsTypesPath = path.join(destOptionsDir, 'types');
      
      fs.mkdirSync(popupTypesPath, { recursive: true });
      copyRecursive(srcTypesPath, popupTypesPath);
      console.log('Copied types to popup/types/');
      
      fs.mkdirSync(optionsTypesPath, { recursive: true });
      copyRecursive(srcTypesPath, optionsTypesPath);
      console.log('Copied types to options/types/');
    }
    
    // Fix import paths in all compiled JavaScript files to use correct relative paths
    const fixImportPaths = (filePath, baseDir) => {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Fix imports from ../modules/ and ../utils/ to use relative paths
        content = content.replace(
          /import\s+(.+)\s+from\s+['"]\.\.\/(modules|utils)\/([^'"]+)['"]/g,
          (match, importClause, dir, file) => {
            // Calculate relative path from current file to target
            if (baseDir === 'scripts') {
              return `import ${importClause} from './${dir}/${file}.js'`;
            } else if (baseDir === 'modules' || baseDir === 'utils') {
              return `import ${importClause} from '../${dir}/${file}.js'`;
            }
            return match;
          }
        );
        
        fs.writeFileSync(filePath, content);
      }
    };
    
    // Fix content scripts to remove module syntax (export statements)
    const fixContentScript = (filePath) => {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove export statements that TypeScript adds
        content = content.replace(/export\s*\{\s*\};?\s*$/gm, '');
        content = content.replace(/export\s*\{\s*\};?\s*\n?/g, '');
        
        fs.writeFileSync(filePath, content);
      }
    };
    
    // Fix background.js
    fixImportPaths(path.join(destScriptsPath, 'background.js'), 'scripts');
    
    // Fix all module files
    if (fs.existsSync(path.join(destScriptsPath, 'modules'))) {
      fs.readdirSync(path.join(destScriptsPath, 'modules')).forEach(file => {
        if (file.endsWith('.js')) {
          fixImportPaths(path.join(destScriptsPath, 'modules', file), 'modules');
        }
      });
    }
    
    // Fix all util files
    if (fs.existsSync(path.join(destScriptsPath, 'utils'))) {
      fs.readdirSync(path.join(destScriptsPath, 'utils')).forEach(file => {
        if (file.endsWith('.js')) {
          fixImportPaths(path.join(destScriptsPath, 'utils', file), 'utils');
        }
      });
    }
    
    // Fix content.js and blocked.js if they exist
    ['content.js', 'blocked.js'].forEach(fileName => {
      const filePath = path.join(destScriptsPath, fileName);
      fixImportPaths(filePath, 'scripts');
      fixContentScript(filePath); // Remove export statements for content scripts
    });
    
    console.log('Fixed import paths and removed export statements in all compiled JavaScript files');
    
    // Clean up the src directory in dist
    fs.rmSync(compiledSrcPath, { recursive: true, force: true });
  }
  
} catch (error) {
  console.error('TypeScript compilation failed:', error.message);
  process.exit(1);
}

// Update manifest to point to compiled files
const manifestPath = path.join(__dirname, 'dist', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update background script path
if (manifest.background && manifest.background.service_worker) {
  manifest.background.service_worker = manifest.background.service_worker.replace(
    'scripts/background.js',
    'scripts/background.js'
  );
}

// Update content scripts paths
if (manifest.content_scripts) {
  manifest.content_scripts = manifest.content_scripts.map(script => ({
    ...script,
    js: script.js?.map(file => 
      file.replace('scripts/', 'scripts/')
    )
  }));
}

// Update web accessible resources
if (manifest.web_accessible_resources) {
  manifest.web_accessible_resources = manifest.web_accessible_resources.map(resource => ({
    ...resource,
    resources: resource.resources?.map(res => 
      res.replace('scripts/', 'scripts/')
    )
  }));
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Updated manifest.json');

console.log('Build completed successfully!');