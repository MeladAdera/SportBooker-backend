const fs = require('fs');
const path = require('path');

// Get the current directory (sportbooker)
const PROJECT_PATH = process.cwd();
const OUTPUT_FILE = path.join(PROJECT_PATH, 'FOLDER_STRUCTURE.txt');

// Folders to ignore
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.vscode',
  '.idea',
  '.cursor'
];

const stats = {
  totalFiles: 0,
  totalDirectories: 0
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileInfo(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch (error) {
    return 0;
  }
}

function scanDirectory(dirPath, depth = 0, prefix = '') {
  let result = [];
  
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    // Filter and sort items
    const validItems = items
      .filter(item => {
        // Skip ignored directories
        if (item.isDirectory() && IGNORE_DIRS.includes(item.name)) {
          return false;
        }
        // Include everything else
        return true;
      })
      .sort((a, b) => {
        // Directories first, then files
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
    
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const fullPath = path.join(dirPath, item.name);
      const isLast = i === validItems.length - 1;
      
      // Create tree structure
      const connector = isLast ? '└── ' : '├── ';
      let linePrefix = prefix;
      
      if (depth > 0) {
        linePrefix = prefix + (isLast ? '    ' : '│   ');
      }
      
      if (item.isDirectory()) {
        stats.totalDirectories++;
        result.push(`${prefix}${connector}📁 ${item.name}/`);
        
        // Recursively scan subdirectories
        const subItems = scanDirectory(fullPath, depth + 1, linePrefix);
        result = result.concat(subItems);
      } else {
        stats.totalFiles++;
        const size = getFileInfo(fullPath);
        result.push(`${prefix}${connector}📄 ${item.name} (${formatFileSize(size)})`);
      }
    }
  } catch (error) {
    result.push(`${prefix}└── [Error: ${error.message}]`);
  }
  
  return result;
}

function generateStructure() {
  console.log('\n🔍 Scanning sportbooker folder...\n');
  console.log(`📂 Location: ${PROJECT_PATH}\n`);
  
  // Reset stats
  stats.totalFiles = 0;
  stats.totalDirectories = 0;
  
  // Generate structure
  let outputLines = [];
  
  // Header
  outputLines.push('='.repeat(60));
  outputLines.push('📁 SPORTBOOKER STRUCTURE');
  outputLines.push('='.repeat(60));
  outputLines.push(`Generated: ${new Date().toLocaleString()}`);
  outputLines.push(`Location: ${PROJECT_PATH}`);
  outputLines.push('='.repeat(60));
  outputLines.push('');
  outputLines.push('📂 ROOT DIRECTORY:');
  outputLines.push('.');
  
  // Scan the directory
  const structure = scanDirectory(PROJECT_PATH, 0, '');
  outputLines = outputLines.concat(structure);
  
  // Summary
  outputLines.push('');
  outputLines.push('='.repeat(60));
  outputLines.push('📊 SUMMARY');
  outputLines.push('='.repeat(60));
  outputLines.push(`Total Directories: ${stats.totalDirectories}`);
  outputLines.push(`Total Files: ${stats.totalFiles}`);
  outputLines.push('='.repeat(60));
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'));
  
  // Show preview in console
  console.log('📋 STRUCTURE PREVIEW:');
  console.log('─'.repeat(40));
  
  // Show first 30 lines of the structure
  structure.slice(0, 30).forEach(line => {
    console.log(line);
  });
  
  if (structure.length > 30) {
    console.log(`... and ${structure.length - 30} more items`);
  }
  
  console.log('─'.repeat(40));
  console.log(`\n✅ Complete structure saved to: ${OUTPUT_FILE}`);
  console.log(`📊 Found: ${stats.totalDirectories} directories, ${stats.totalFiles} files`);
}

// Run it
console.log(`
🚀 SPORTBOOKER FOLDER SCANNER
==============================
This will scan ALL files and folders in your current directory
==============================
`);

generateStructure();
