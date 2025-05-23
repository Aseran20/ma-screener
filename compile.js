const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create dist directory if it doesn't exist
const distElectronPath = path.join(__dirname, 'dist', 'electron');
if (!fs.existsSync(distElectronPath)) {
  fs.mkdirSync(distElectronPath, { recursive: true });
}

console.log('Compiling TypeScript files for Electron...');
try {
  // Run TypeScript compiler with proper config
  execSync('npx tsc -p tsconfig.node.json', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful!');
  
  // Copy necessary files
  const dataDir = path.join(__dirname, 'data');
  const distDataDir = path.join(__dirname, 'dist', 'data');
  
  if (!fs.existsSync(distDataDir)) {
    fs.mkdirSync(distDataDir, { recursive: true });
  }
  
  // Copy data files if they exist
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (file.endsWith('.xlsx')) {
        const src = path.join(dataDir, file);
        const dest = path.join(distDataDir, file);
        fs.copyFileSync(src, dest);
        console.log(`Copied data file: ${file}`);
      }
    }
  }
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Error during build:', error.message);
  process.exit(1);
}
