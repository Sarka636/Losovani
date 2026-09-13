import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const docsDir = path.resolve('docs');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run vite build first.');
  process.exit(1);
}

// Clean and recreate docs directory
if (fs.existsSync(docsDir)) {
  fs.rmSync(docsDir, { recursive: true, force: true });
}
fs.mkdirSync(docsDir, { recursive: true });

// Copy dist files to docs
fs.cpSync(distDir, docsDir, { recursive: true });

// Copy index.html to 404.html for GitHub Pages SPA fallback
const indexPath = path.join(docsDir, 'index.html');
const notFoundPath = path.join(docsDir, '404.html');
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
}

// Create .nojekyll so GitHub Pages doesn't ignore files or mangle asset URLs
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

// Verify public/tridy.xlsx is in docs/
const publicXlsx = path.resolve('public/tridy.xlsx');
const docsXlsx = path.join(docsDir, 'tridy.xlsx');
if (fs.existsSync(publicXlsx) && !fs.existsSync(docsXlsx)) {
  fs.copyFileSync(publicXlsx, docsXlsx);
}

console.log('✅ Successfully populated /docs for GitHub Pages (Deploy from a branch -> /docs)');
