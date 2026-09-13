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

// Generate csv-manifest.json from public directory
const publicDir = path.resolve('public');
const csvFiles = fs.existsSync(publicDir)
  ? fs.readdirSync(publicDir).filter((file) => file.toLowerCase().endsWith('.csv'))
  : [];

const manifestData = csvFiles.map((file) => ({
  filename: file,
  className: path.basename(file, path.extname(file)),
}));

fs.writeFileSync(
  path.join(publicDir, 'csv-manifest.json'),
  JSON.stringify(manifestData, null, 2)
);
fs.writeFileSync(
  path.join(docsDir, 'csv-manifest.json'),
  JSON.stringify(manifestData, null, 2)
);

// Copy all CSV files from public to docs
for (const file of csvFiles) {
  fs.copyFileSync(path.join(publicDir, file), path.join(docsDir, file));
}

console.log(`✅ Successfully populated /docs with ${csvFiles.length} CSV classes for GitHub Pages`);
