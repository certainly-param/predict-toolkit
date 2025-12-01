// Post-build script to fix file paths and ensure all files are in dist root
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

console.log('Fixing build output paths...\n');

// Function to find and move files recursively
function findAndMoveFiles(dir, targetDir, pattern) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findAndMoveFiles(fullPath, targetDir, pattern);
      // Try to remove empty directories
      try {
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      } catch {}
    } else if (pattern.test(item.name)) {
      const targetPath = path.join(targetDir, item.name);
      if (fullPath !== targetPath) {
        fs.copyFileSync(fullPath, targetPath);
        console.log(`✓ Moved ${item.name} to dist root`);
        fs.unlinkSync(fullPath);
      }
    }
  }
}

// Move popup.html from anywhere in dist to root (including index.html)
const htmlFiles = ['popup.html', 'index.html'];
for (const htmlFile of htmlFiles) {
  findAndMoveFiles(distDir, distDir, new RegExp(`^${htmlFile}$`, 'i'));
}

// If we found index.html, rename it to popup.html
const indexHtmlPath = path.join(distDir, 'index.html');
const popupHtmlPath = path.join(distDir, 'popup.html');
if (fs.existsSync(indexHtmlPath) && !fs.existsSync(popupHtmlPath)) {
  let htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
  // Update script reference to popup.js
  htmlContent = htmlContent.replace(/src="[^"]*popup\.tsx"/g, 'src="./popup.js"');
  htmlContent = htmlContent.replace(/src="\.\/popup\.tsx"/g, 'src="./popup.js"');
  fs.writeFileSync(popupHtmlPath, htmlContent);
  fs.unlinkSync(indexHtmlPath);
  console.log('✓ Renamed index.html to popup.html');
}

// Move popup.js from anywhere in dist to root
findAndMoveFiles(distDir, distDir, /^popup\.js$/i);

// Move content.js from anywhere in dist to root
findAndMoveFiles(distDir, distDir, /^content\.js$/i);

// Ensure manifest.json exists in dist root
const manifestSource = path.join(__dirname, 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestSource)) {
  fs.copyFileSync(manifestSource, manifestDest);
  console.log('✓ Ensured manifest.json in dist root');
}

// Ensure icons directory exists in dist root
const iconsSource = path.join(__dirname, 'icons');
const iconsDest = path.join(distDir, 'icons');
if (fs.existsSync(iconsSource)) {
  if (!fs.existsSync(iconsDest)) {
    fs.mkdirSync(iconsDest, { recursive: true });
  }
  const iconFiles = fs.readdirSync(iconsSource);
  for (const file of iconFiles) {
    const targetPath = path.join(iconsDest, file);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(path.join(iconsSource, file), targetPath);
      console.log(`✓ Copied icon: ${file}`);
    }
  }
}

// Clean up any nested src directories
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✓ Removed nested directory: ${path.relative(distDir, dirPath)}`);
    } catch (err) {
      // Ignore errors
    }
  }
}

const srcDir = path.join(distDir, 'src');
removeDir(srcDir);

// Verify final structure
console.log('\nFinal dist structure:');
const listFiles = (dir, prefix = '') => {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      console.log(`${prefix}${item.name}/`);
      listFiles(fullPath, prefix + '  ');
    } else {
      console.log(`${prefix}${item.name}`);
    }
  }
};
listFiles(distDir);

console.log('\n✓ Build paths fixed!');
