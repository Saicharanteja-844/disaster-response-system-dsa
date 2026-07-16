const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';
const outputName = isWin ? 'DisasterSystem.exe' : 'DisasterSystem';
const outputPath = path.join(__dirname, outputName);

const sourceFiles = [
    'backend/src/main.cpp',
    'backend/src/algorithms.cpp',
    'backend/src/data.cpp',
    'backend/src/graph.cpp'
].map(f => path.join(__dirname, f));

// Verify that source files exist
for (const file of sourceFiles) {
    if (!fs.existsSync(file)) {
        console.error(`Error: Source file not found: ${file}`);
        process.exit(1);
    }
}

console.log(`Starting C++ build process for target: ${outputName}`);

let hasGxx = false;
try {
    execSync('g++ --version', { stdio: 'ignore' });
    hasGxx = true;
} catch (e) {
    // g++ is not available
}

if (hasGxx) {
    const compileCmd = `g++ -O3 ${sourceFiles.map(f => `"${f}"`).join(' ')} -o "${outputPath}"`;
    console.log(`Running build command: ${compileCmd}`);
    try {
        execSync(compileCmd, { stdio: 'inherit' });
        console.log(`Compilation successful! Built: ${outputName}`);
    } catch (err) {
        console.error('Compilation failed:', err);
        process.exit(1);
    }
} else {
    if (isWin) {
        console.warn('g++ compiler was not found on your Windows system.');
        console.warn('Skipping compilation and using pre-compiled DisasterSystem.exe if present.');
        if (fs.existsSync(outputPath)) {
            console.log('Pre-compiled DisasterSystem.exe exists.');
        } else {
            console.error('Error: DisasterSystem.exe not found and cannot compile.');
            process.exit(1);
        }
    } else {
        console.error('Error: g++ compiler not found in the environment. Cannot compile C++ engine.');
        process.exit(1);
    }
}
