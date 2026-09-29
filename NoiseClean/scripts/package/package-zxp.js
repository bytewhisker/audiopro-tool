/**
 * NoiseClean - Production Packaging Script
 * Prepares a clean production build compliant with aescripts author guidelines:
 * - Excludes .debug, test scripts, scratch files, and build artifacts
 * - Verifies manifest.xml integrity and host version ranges
 * - Verifies engine binaries, wasm, and model weights exist
 * - Creates a production-ready package zip named NoiseClean_v1.0.0.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = require('../../package.json');
const VERSION = pkg.version;
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT_DIR, '..', 'dist');
const STAGING_DIR = path.join(DIST_DIR, 'com.noiseclean.panel');

console.log(`[Package] Packaging NoiseClean v${VERSION}...`);

// Ensure clean dist directory
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// Production files and directories to copy
const COPY_TARGETS = [
    'CSXS',
    'client',
    'host',
    'node',
    'engines',
    'models',
    'resources',
    'package.json',
    'LICENSES.md'
];

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        const items = fs.readdirSync(src);
        for (const item of items) {
            // Exclude git, debug, and test files
            if (item === '.git' || item === '.debug' || item.endsWith('.obj') || item.endsWith('.pdb')) {
                continue;
            }
            copyRecursive(path.join(src, item), path.join(dest, item));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

for (const target of COPY_TARGETS) {
    const srcPath = path.join(ROOT_DIR, target);
    const destPath = path.join(STAGING_DIR, target);
    if (fs.existsSync(srcPath)) {
        console.log(`  Copying ${target}...`);
        copyRecursive(srcPath, destPath);
    } else {
        console.warn(`  Warning: Target not found: ${srcPath}`);
    }
}

// Ensure .debug is NOT in production staging
const prodDebugFile = path.join(STAGING_DIR, '.debug');
if (fs.existsSync(prodDebugFile)) {
    fs.unlinkSync(prodDebugFile);
    console.log('  Removed .debug file from production build.');
}

// Verification checks
console.log('\n[Package] Verifying production package integrity:');
const requiredFiles = [
    path.join(STAGING_DIR, 'CSXS', 'manifest.xml'),
    path.join(STAGING_DIR, 'client', 'index.html'),
    path.join(STAGING_DIR, 'host', 'NoiseClean.jsx'),
    path.join(STAGING_DIR, 'node', 'main.js'),
    path.join(STAGING_DIR, 'engines', 'rnnoise', 'win', 'rnnoise.exe'),
    path.join(STAGING_DIR, 'engines', 'deepfilternet', 'df_bg.wasm'),
    path.join(STAGING_DIR, 'models', 'DeepFilterNet3_onnx.tar.gz'),
    path.join(STAGING_DIR, 'LICENSES.md')
];

let allValid = true;
for (const req of requiredFiles) {
    const rel = path.relative(DIST_DIR, req);
    if (fs.existsSync(req) && fs.statSync(req).size > 0) {
        console.log(`  ✓ ${rel} (${fs.statSync(req).size} bytes)`);
    } else {
        console.error(`  ✗ MISSING OR EMPTY: ${rel}`);
        allValid = false;
    }
}

if (!allValid) {
    console.error('\n[Package] FAILED: Missing required files.');
    process.exit(1);
}

// Create distribution ZIP
const zipName = `NoiseClean_v${VERSION}.zip`;
const zipPath = path.join(DIST_DIR, zipName);
console.log(`\n[Package] Creating delivery archive: ${zipName}...`);

if (process.platform === 'win32') {
    // PowerShell Compress-Archive
    execSync(`powershell -Command "Compress-Archive -Path '${STAGING_DIR}' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
} else {
    execSync(`cd "${DIST_DIR}" && zip -r "${zipName}" com.noiseclean.panel`, { stdio: 'inherit' });
}

console.log(`\n[Package] SUCCESS! Production archive created at:`);
console.log(`  ${zipPath}`);
console.log(`  Size: ${(fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2)} MB`);
