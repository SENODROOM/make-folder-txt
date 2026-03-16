#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { version } = require("../package.json");
const { execSync } = require("child_process");

// ── config ────────────────────────────────────────────────────────────────────
const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".cache"]);
const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".txtignore"]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".lock",
]);

// ── helpers ───────────────────────────────────────────────────────────────────

function readTxtIgnore(rootDir) {
  const txtIgnorePath = path.join(rootDir, '.txtignore');
  const ignorePatterns = new Set();
  
  try {
    const content = fs.readFileSync(txtIgnorePath, 'utf8');
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    lines.forEach(line => ignorePatterns.add(line));
  } catch (err) {
    // .txtignore doesn't exist or can't be read - that's fine
  }
  
  return ignorePatterns;
}

function copyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      // Windows - use PowerShell for better handling of large content
      const tempFile = require('os').tmpdir() + '\\make-folder-txt-clipboard-temp.txt';
      require('fs').writeFileSync(tempFile, text, 'utf8');
      execSync(`powershell -Command "Get-Content '${tempFile}' | Set-Clipboard"`, { stdio: 'ignore' });
      require('fs').unlinkSync(tempFile);
    } else if (process.platform === 'darwin') {
      // macOS
      execSync(`echo ${JSON.stringify(text)} | pbcopy`, { stdio: 'ignore' });
    } else {
      // Linux (requires xclip or xsel)
      try {
        execSync(`echo ${JSON.stringify(text)} | xclip -selection clipboard`, { stdio: 'ignore' });
      } catch {
        try {
          execSync(`echo ${JSON.stringify(text)} | xsel --clipboard --input`, { stdio: 'ignore' });
        } catch {
          console.warn('⚠️  Could not copy to clipboard. Install xclip or xsel on Linux.');
          return false;
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('⚠️  Could not copy to clipboard: ' + err.message);
    return false;
  }
}

function collectFiles(
  dir,
  rootDir,
  ignoreDirs,
  ignoreFiles,
  onlyFolders,
  onlyFiles,
  options = {},
) {
  const {
    indent = "",
    lines = [],
    filePaths = [],
    inSelectedFolder = false,
    hasOnlyFilters = false,
    rootName = "",
    txtIgnore = new Set(),
    force = false,
    rootOnlyInclude = false,
  } = options;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { lines, filePaths, hasIncluded: false };
  }

  entries.sort((a, b) => {
    if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
    return a.isDirectory() ? -1 : 1;
  });

  entries.forEach((entry, idx) => {
    const isLast = idx === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childIndent = indent + (isLast ? "    " : "│   ");

    if (entry.isDirectory()) {
      if (!force && ignoreDirs.has(entry.name)) {
        if (!hasOnlyFilters) {
          lines.push(`${indent}${connector}${entry.name}/  [skipped]`);
        }
        return;
      }

      // Get relative path for .txtignore pattern matching
      const relPathForIgnore = path.relative(rootDir, path.join(dir, entry.name)).split(path.sep).join("/");
      
      // Check against .txtignore patterns (both dirname and relative path) unless force is enabled
      if (!force && (txtIgnore.has(entry.name) || txtIgnore.has(`${entry.name}/`) || txtIgnore.has(relPathForIgnore) || txtIgnore.has(`${relPathForIgnore}/`) || txtIgnore.has(`/${relPathForIgnore}/`))) {
        if (!hasOnlyFilters) {
          lines.push(`${indent}${connector}${entry.name}/  [skipped]`);
        }
        return;
      }

      const childPath = path.join(dir, entry.name);
      // When rootOnlyInclude is active, a folder only "counts" if it's directly under root
      const folderIsSelected = rootOnlyInclude
        ? (dir === rootDir && onlyFolders.has(entry.name))
        : onlyFolders.has(entry.name);

      const childInSelectedFolder = inSelectedFolder || folderIsSelected;
      const childLines = [];
      const childFiles = [];
      
      // If rootOnlyInclude is true, skip recursing into non-selected subdirectories
      let child;
      if (rootOnlyInclude && dir !== rootDir && !inSelectedFolder) {
        // Don't recurse unless already inside a selected folder
        child = { lines: [], filePaths: [], hasIncluded: false };
      } else {
        child = collectFiles(
          childPath,
          rootDir,
          ignoreDirs,
          ignoreFiles,
          onlyFolders,
          onlyFiles,
          {
            indent: childIndent,
            lines: childLines,
            filePaths: childFiles,
            inSelectedFolder: childInSelectedFolder,
            hasOnlyFilters,
            rootName,
            txtIgnore,
            force,
            rootOnlyInclude,
          },
        );
      }

      // Include the dir if: no filters active, or it's explicitly selected, or (non-root-only) a child matched
      const shouldIncludeDir = !hasOnlyFilters || 
        folderIsSelected || 
        (!rootOnlyInclude && child.hasIncluded);

      if (shouldIncludeDir) {
        lines.push(`${indent}${connector}${entry.name}/`);
        lines.push(...child.lines);
        filePaths.push(...child.filePaths);
      }
    } else {
      if (!force && ignoreFiles.has(entry.name)) return;

      // Get relative path for .txtignore pattern matching
      const relPathForIgnore = path.relative(rootDir, path.join(dir, entry.name)).split(path.sep).join("/");
      
      // Check against .txtignore patterns (both filename and relative path) unless force is enabled
      if (!force && (txtIgnore.has(entry.name) || txtIgnore.has(relPathForIgnore) || txtIgnore.has(`/${relPathForIgnore}`))) {
        return;
      }

      // Ignore .txt files that match the folder name (e.g., foldername.txt) unless force is enabled
      if (!force && entry.name.endsWith('.txt') && entry.name === `${rootName}.txt`) return;

      // Check if this file matches any of the onlyFiles patterns
      const shouldIncludeFile = !hasOnlyFilters || inSelectedFolder || 
        onlyFiles.has(entry.name) || 
        onlyFiles.has(relPathForIgnore) || 
        onlyFiles.has(`/${relPathForIgnore}`);
      
      if (!shouldIncludeFile) return;

      lines.push(`${indent}${connector}${entry.name}`);
      const relPath = "/" + path.relative(rootDir, path.join(dir, entry.name)).split(path.sep).join("/");
      filePaths.push({ abs: path.join(dir, entry.name), rel: relPath });
    }
  });

  return { lines, filePaths, hasIncluded: filePaths.length > 0 || lines.length > 0 };
}

function parseFileSize(sizeStr) {
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {
    console.error(`Error: Invalid size format "${sizeStr}". Use format like "500KB", "2MB", "1GB".`);
    process.exit(1);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return Math.floor(value * units[unit]);
}

function readContent(absPath, force = false, maxFileSize = 500 * 1024) {
  const ext = path.extname(absPath).toLowerCase();
  if (!force && BINARY_EXTS.has(ext)) return "[binary / skipped]";
  try {
    const stat = fs.statSync(absPath);
    if (!force && stat.size > maxFileSize) {
      const sizeStr = stat.size < 1024 ? `${stat.size} B` : 
                     stat.size < 1024 * 1024 ? `${(stat.size / 1024).toFixed(1)} KB` :
                     stat.size < 1024 * 1024 * 1024 ? `${(stat.size / (1024 * 1024)).toFixed(1)} MB` :
                     `${(stat.size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      return `[file too large: ${sizeStr} – skipped]`;
    }
    return fs.readFileSync(absPath, "utf8");
  } catch (err) {
    return `[could not read file: ${err.message}]`;
  }
}

function splitByFolders(treeLines, filePaths, rootName, effectiveMaxSize, forceFlag) {
  const folders = new Map();
  
  // Group files by folder
  filePaths.forEach(({ abs, rel }) => {
    const folderPath = path.dirname(rel);
    const folderKey = folderPath === '/' ? rootName : folderPath.slice(1);
    
    if (!folders.has(folderKey)) {
      folders.set(folderKey, []);
    }
    folders.get(folderKey).push({ abs, rel });
  });
  
  const results = [];
  
  folders.forEach((files, folderName) => {
    const out = [];
    const divider = "=".repeat(80);
    const subDivider = "-".repeat(80);
    
    out.push(divider);
    out.push(`START OF FOLDER: ${folderName}`);
    out.push(divider);
    out.push("");
    
    // Add folder structure (only this folder's structure)
    const folderTreeLines = treeLines.filter(line => 
      line.includes(folderName + '/') || line === `${rootName}/`
    );
    
    out.push(divider);
    out.push("PROJECT STRUCTURE");
    out.push(divider);
    out.push(`Root: ${folderPath}\n`);
    out.push(`${rootName}/`);
    folderTreeLines.forEach(l => out.push(l));
    out.push("");
    out.push(`Total files in this folder: ${files.length}`);
    out.push("");
    
    out.push(divider);
    out.push("FILE CONTENTS");
    out.push(divider);
    
    files.forEach(({ abs, rel }) => {
      out.push("");
      out.push(subDivider);
      out.push(`FILE: ${rel}`);
      out.push(subDivider);
      out.push(readContent(abs, forceFlag, effectiveMaxSize));
    });
    
    out.push("");
    out.push(divider);
    out.push(`END OF FOLDER: ${folderName}`);
    out.push(divider);
    
    const fileName = `${rootName}-${folderName.replace(/[\/\\]/g, '-')}.txt`;
    const filePath = path.join(process.cwd(), fileName);
    
    fs.writeFileSync(filePath, out.join("\n"), "utf8");
    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);
    
    results.push({
      file: filePath,
      size: sizeKB,
      files: files.length,
      folder: folderName
    });
  });
  
  return results;
}

function splitByFiles(filePaths, rootName, effectiveMaxSize, forceFlag) {
  const results = [];
  
  filePaths.forEach(({ abs, rel }) => {
    const out = [];
    const divider = "=".repeat(80);
    const subDivider = "-".repeat(80);
    const fileName = path.basename(rel, path.extname(rel));
    
    out.push(divider);
    out.push(`FILE: ${rel}`);
    out.push(divider);
    out.push("");
    
    out.push(divider);
    out.push("FILE CONTENTS");
    out.push(divider);
    out.push(readContent(abs, forceFlag, effectiveMaxSize));
    
    out.push("");
    out.push(divider);
    out.push(`END OF FILE: ${rel}`);
    out.push(divider);
    
    const outputFileName = `${rootName}-${fileName}.txt`;
    const filePath = path.join(process.cwd(), outputFileName);
    
    fs.writeFileSync(filePath, out.join("\n"), "utf8");
    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);
    
    results.push({
      file: filePath,
      size: sizeKB,
      files: 1,
      fileName: fileName
    });
  });
  
  return results;
}

function splitBySize(treeLines, filePaths, rootName, splitSize, effectiveMaxSize, forceFlag) {
  const results = [];
  let currentPart = 1;
  let currentSize = 0;
  let currentFiles = [];
  
  const divider = "=".repeat(80);
  const subDivider = "-".repeat(80);
  
  // Start with header
  let out = [];
  out.push(divider);
  out.push(`START OF FOLDER: ${rootName} (Part ${currentPart})`);
  out.push(divider);
  out.push("");
  
  out.push(divider);
  out.push("PROJECT STRUCTURE");
  out.push(divider);
  out.push(`Root: ${folderPath}\n`);
  out.push(`${rootName}/`);
  treeLines.forEach(l => out.push(l));
  out.push("");
  out.push(`Total files: ${filePaths.length}`);
  out.push("");
  
  out.push(divider);
  out.push("FILE CONTENTS");
  out.push(divider);
  
  filePaths.forEach(({ abs, rel }) => {
    const content = readContent(abs, forceFlag, effectiveMaxSize);
    const fileContent = [
      "",
      subDivider,
      `FILE: ${rel}`,
      subDivider,
      content
    ];
    
    const contentSize = fileContent.join("\n").length;
    
    // Check if adding this file would exceed the split size
    if (currentSize + contentSize > splitSize && currentFiles.length > 0) {
      // Finish current part
      out.push("");
      out.push(divider);
      out.push(`END OF FOLDER: ${rootName} (Part ${currentPart})`);
      out.push(divider);
      
      // Write current part
      const fileName = `${rootName}-part-${currentPart}.txt`;
      const filePath = path.join(process.cwd(), fileName);
      fs.writeFileSync(filePath, out.join("\n"), "utf8");
      const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);
      
      results.push({
        file: filePath,
        size: sizeKB,
        files: currentFiles.length,
        part: currentPart
      });
      
      // Start new part
      currentPart++;
      currentSize = 0;
      currentFiles = [];
      
      out = [];
      out.push(divider);
      out.push(`START OF FOLDER: ${rootName} (Part ${currentPart})`);
      out.push(divider);
      out.push("");
      
      out.push(divider);
      out.push("PROJECT STRUCTURE");
      out.push(divider);
      out.push(`Root: ${folderPath}\n`);
      out.push(`${rootName}/`);
      treeLines.forEach(l => out.push(l));
      out.push("");
      out.push(`Total files: ${filePaths.length}`);
      out.push("");
      
      out.push(divider);
      out.push("FILE CONTENTS");
      out.push(divider);
    }
    
    // Add file to current part
    out.push(...fileContent);
    currentSize += contentSize;
    currentFiles.push(rel);
  });
  
  // Write final part
  out.push("");
  out.push(divider);
  out.push(`END OF FOLDER: ${rootName} (Part ${currentPart})`);
  out.push(divider);
  
  const fileName = `${rootName}-part-${currentPart}.txt`;
  const filePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(filePath, out.join("\n"), "utf8");
  const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);
  
  results.push({
    file: filePath,
    size: sizeKB,
    files: currentFiles.length,
    part: currentPart
  });
  
  return results;
}

// ── configuration ────────────────────────────────────────────────────────────────

function createInteractiveConfig() {
  const readline = require('readline');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n🔧 make-folder-txt Configuration Setup');
  console.log('=====================================\n');

  return new Promise((resolve) => {
    const config = {
      maxFileSize: '500KB',
      splitMethod: 'none',
      splitSize: '5MB',
      copyToClipboard: false
    };

    let currentStep = 0;
    const questions = [
      {
        key: 'maxFileSize',
        question: 'Maximum file size to include (e.g., 500KB, 2MB, 1GB): ',
        default: '500KB',
        validate: (value) => {
          if (!value.trim()) return true;
          const validUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
          const match = value.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
          if (!match) return 'Please enter a valid size (e.g., 500KB, 2MB, 1GB)';
          if (!validUnits.includes(match[2].toUpperCase())) return `Invalid unit. Use: ${validUnits.join(', ')}`;
          return true;
        }
      },
      {
        key: 'splitMethod',
        question: 'Split output method (none, folder, file, size): ',
        default: 'none',
        validate: (value) => {
          const validMethods = ['none', 'folder', 'file', 'size'];
          if (!validMethods.includes(value.toLowerCase())) return `Please choose: ${validMethods.join(', ')}`;
          return true;
        }
      },
      {
        key: 'splitSize',
        question: 'Split size when using size method (e.g., 5MB, 10MB): ',
        default: '5MB',
        ask: () => config.splitMethod === 'size',
        validate: (value) => {
          if (!value.trim()) return true;
          const validUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
          const match = value.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
          if (!match) return 'Please enter a valid size (e.g., 5MB, 10MB)';
          if (!validUnits.includes(match[2].toUpperCase())) return `Invalid unit. Use: ${validUnits.join(', ')}`;
          return true;
        }
      },
      {
        key: 'copyToClipboard',
        question: 'Copy to clipboard automatically? (y/n): ',
        default: 'n',
        validate: (value) => {
          const answer = value.toLowerCase();
          if (!['y', 'n', 'yes', 'no'].includes(answer)) return 'Please enter y/n or yes/no';
          return true;
        },
        transform: (value) => ['y', 'yes'].includes(value.toLowerCase())
      },
      {
        key: 'addToTxtIgnore',
        question: 'Add ignore patterns to .txtignore file? (y/n): ',
        default: 'n',
        validate: (value) => {
          const answer = value.toLowerCase();
          if (!['y', 'n', 'yes', 'no'].includes(answer)) return 'Please enter y/n or yes/no';
          return true;
        },
        transform: (value) => ['y', 'yes'].includes(value.toLowerCase())
      },
      {
        key: 'ignoreFolders',
        question: 'Ignore folders (comma-separated, or press Enter to skip): ',
        default: '',
        ask: () => config.addToTxtIgnore,
        transform: (value) => {
          if (!value || value.trim() === '') return [];
          return value.split(',').map(f => f.trim()).filter(f => f);
        }
      },
      {
        key: 'ignoreFiles',
        question: 'Ignore files (comma-separated, or press Enter to skip): ',
        default: '',
        ask: () => config.addToTxtIgnore,
        transform: (value) => {
          if (!value || value.trim() === '') return [];
          return value.split(',').map(f => f.trim()).filter(f => f);
        }
      }
    ];

    function askQuestion() {
      if (currentStep >= questions.length) {
        // Save configuration
        saveConfig();
        return;
      }

      const q = questions[currentStep];
      
      // Skip if conditional ask returns false
      if (q.ask && !q.ask()) {
        currentStep++;
        askQuestion();
        return;
      }

      const defaultValue = typeof q.default === 'function' ? q.default() : q.default;
      rl.question(q.question + (defaultValue ? `(${defaultValue}) ` : ''), (answer) => {
        const value = answer.trim() || defaultValue;
        
        // Validate input
        if (q.validate) {
          const validation = q.validate(value);
          if (validation !== true) {
            console.log(`❌ ${validation}`);
            askQuestion();
            return;
          }
        }

        // Transform value if needed
        if (q.transform) {
          config[q.key] = q.transform(value);
        } else {
          config[q.key] = value;
        }

        currentStep++;
        askQuestion();
      });
    }

    function saveConfig() {
      try {
        // Create .txtconfig file with proper formatting
        const configPath = path.join(process.cwd(), '.txtconfig');
        const configContent = `{
  "maxFileSize": "${config.maxFileSize}",
  "splitMethod": "${config.splitMethod}",
  "splitSize": "${config.splitSize}",
  "copyToClipboard": ${config.copyToClipboard}
}`;

        fs.writeFileSync(configPath, configContent);

        // Update .txtignore if user wants to add ignore patterns
        if (config.addToTxtIgnore && (config.ignoreFolders.length > 0 || config.ignoreFiles.length > 0)) {
          const ignorePath = path.join(process.cwd(), '.txtignore');
          let ignoreContent = '';
          
          // Read existing content if file exists
          if (fs.existsSync(ignorePath)) {
            ignoreContent = fs.readFileSync(ignorePath, 'utf8');
            if (!ignoreContent.endsWith('\n')) ignoreContent += '\n';
          }

          // Add new ignore patterns
          const newPatterns = [
            ...config.ignoreFolders.map(f => f.endsWith('/') ? f : `${f}/`),
            ...config.ignoreFiles
          ];

          if (newPatterns.length > 0) {
            ignoreContent += '\n# Added by make-folder-txt config\n';
            ignoreContent += newPatterns.join('\n') + '\n';
            fs.writeFileSync(ignorePath, ignoreContent);
          }
        }

        console.log('\n✅ Configuration saved successfully!');
        console.log(`📄 Config file: ${configPath}`);
        if (config.addToTxtIgnore && (config.ignoreFolders.length > 0 || config.ignoreFiles.length > 0)) {
          console.log(`📝 Ignore patterns added to .txtignore`);
        }
        console.log('\n💡 Your settings will now be used automatically!');
        console.log('🔄 Run --delete-config to reset to defaults');

      } catch (err) {
        console.error('❌ Error saving configuration:', err.message);
      } finally {
        rl.close();
        resolve();
      }
    }

    askQuestion();
  });
}

function loadConfig() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const configPath = path.join(process.cwd(), '.txtconfig');
    if (!fs.existsSync(configPath)) {
      console.error('❌ .txtconfig file not found. Run --make-config first.');
      process.exit(1);
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (err) {
    console.error('❌ Error loading configuration:', err.message);
    process.exit(1);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("-v") || args.includes("--version")) {
    console.log(`v${version}`);
    console.log("Built by Muhammad Saad Amin");
    process.exit(0);
  }

  if (args.includes("--make-config")) {
    await createInteractiveConfig();
    process.exit(0);
  }

  if (args.includes("--delete-config")) {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), '.txtconfig');
      
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log('✅ Configuration file deleted successfully!');
        console.log('🔄 Tool will now use default settings');
      } else {
        console.log('ℹ️  No configuration file found - already using defaults');
      }
    } catch (err) {
      console.error('❌ Error deleting configuration:', err.message);
    }
    process.exit(0);
  }

  // Auto-use config if it exists and no other flags are provided
  const configPath = path.join(process.cwd(), '.txtconfig');
  const hasConfig = fs.existsSync(configPath);
  const hasOtherFlags = args.length > 0 && !args.includes('--help') && !args.includes('-h') && !args.includes('--version') && !args.includes('-v');
  
  if (hasConfig && !hasOtherFlags) {
    const config = loadConfig();
    
    // Apply config to command line arguments
    const newArgs = [];
    
    // Add max file size if not default
    if (config.maxFileSize !== '500KB') {
      newArgs.push('--skip-large', config.maxFileSize);
    }
    
    // Add split method if not none
    if (config.splitMethod !== 'none') {
      newArgs.push('--split-method', config.splitMethod);
      if (config.splitMethod === 'size') {
        newArgs.push('--split-size', config.splitSize);
      }
    }
    
    // Add copy to clipboard if true
    if (config.copyToClipboard) {
      newArgs.push('--copy');
    }
    
    // Replace args with config-based args
    args.splice(0, args.length, ...newArgs);
    console.log('🔧 Using saved configuration (use --delete-config to reset to defaults)');
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(` 
\x1b[33mmake-folder-txt\x1b[0m
Dump an entire project folder into a single readable .txt file.

\x1b[33mUSAGE\x1b[0m
  make-folder-txt [options]

\x1b[33mOPTIONS\x1b[0m
  --ignore-folder, -ifo <names...>    Ignore specific folders by name
  --ignore-file, -ifi <names...>      Ignore specific files by name
  --only-folder, -ofo <names...>      Include only specific folders
  --only-file, -ofi <names...>        Include only specific files
  --skip-large <size>                 Skip files larger than specified size (default: 500KB)
  --no-skip                           Include all files regardless of size
  --split-method <method>             Split output: folder, file, or size
  --split-size <size>                 Split output when size exceeds limit (requires --split-method size)
  --copy                              Copy output to clipboard
  --force                             Include everything (overrides all ignore patterns)
  --make-config                       Create interactive configuration
  --delete-config                     Delete configuration and reset to defaults
  --help, -h                          Show this help message
  --version, -v                       Show version information

\x1b[33mEXAMPLES\x1b[0m
  make-folder-txt
  make-folder-txt --copy
  make-folder-txt --force
  make-folder-txt --skip-large 400KB
  make-folder-txt --skip-large 5GB
  make-folder-txt --no-skip
  make-folder-txt --split-method folder
  make-folder-txt --split-method file
  make-folder-txt --split-method size --split-size 5MB
  make-folder-txt --ignore-folder node_modules dist
  make-folder-txt -ifo node_modules dist
  make-folder-txt --ignore-file .env .env.local
  make-folder-txt -ifi .env .env.local
  make-folder-txt --only-folder src docs
  make-folder-txt -ofo src docs
  make-folder-txt --only-file package.json README.md
  make-folder-txt -ofi package.json README.md
  make-folder-txt --make-config
  make-folder-txt --delete-config

\x1b[33m.TXTIGNORE FILE\x1b[0m
  Create a .txtignore file in your project root to specify files/folders to ignore.
  Works like .gitignore - supports file names, path patterns, and comments.

  Example .txtignore:
    node_modules/
    *.log
    .env
    coverage/
    LICENSE
`);
      process.exit(0);
    }

    const ignoreDirs = new Set(IGNORE_DIRS);
    const ignoreFiles = new Set(IGNORE_FILES);
    const onlyFolders = new Set();
    const onlyFiles = new Set();
    let outputArg = null;
    let copyToClipboardFlag = false;
    let forceFlag = false;
    let maxFileSize = 500 * 1024; // Default 500KB
    let noSkipFlag = false;
    let splitMethod = null; // 'folder', 'file', 'size'
    let splitSize = null; // size in bytes
    let rootOnlyInclude = false; // For /include flag

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--copy") {
        copyToClipboardFlag = true;
        continue;
      }

      if (arg === "--force") {
        forceFlag = true;
        continue;
      }

      if (arg === "--no-skip") {
        noSkipFlag = true;
        continue;
      }

      if (arg === "--skip-large") {
        if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
          console.error("Error: --skip-large requires a size value (e.g., 400KB, 5GB).");
          process.exit(1);
        }
        maxFileSize = parseFileSize(args[i + 1]);
        i += 1;
        continue;
      }

      if (arg.startsWith("--skip-large=")) {
        const value = arg.slice("--skip-large=".length);
        if (!value) {
          console.error("Error: --skip-large requires a size value (e.g., 400KB, 5GB).");
          process.exit(1);
        }
        maxFileSize = parseFileSize(value);
        continue;
      }

      if (arg === "--split-method") {
        if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
          console.error("Error: --split-method requires a method (folder, file, or size).");
          process.exit(1);
        }
        const method = args[i + 1].toLowerCase();
        if (!['folder', 'file', 'size'].includes(method)) {
          console.error("Error: --split-method must be one of: folder, file, size");
          process.exit(1);
        }
        splitMethod = method;
        i += 1;
        continue;
      }

      if (arg.startsWith("--split-method=")) {
        const value = arg.slice("--split-method=".length);
        if (!value) {
          console.error("Error: --split-method requires a method (folder, file, or size).");
          process.exit(1);
        }
        const method = value.toLowerCase();
        if (!['folder', 'file', 'size'].includes(method)) {
          console.error("Error: --split-method must be one of: folder, file, size");
          process.exit(1);
        }
        splitMethod = method;
        continue;
      }

      if (arg === "--split-size") {
        if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
          console.error("Error: --split-size requires a size value (e.g., 5MB, 10MB).");
          process.exit(1);
        }
        splitSize = parseFileSize(args[i + 1]);
        i += 1;
        continue;
      }

      if (arg.startsWith("--split-size=")) {
        const value = arg.slice("--split-size=".length);
        if (!value) {
          console.error("Error: --split-size requires a size value (e.g., 5MB, 10MB).");
          process.exit(1);
        }
        splitSize = parseFileSize(value);
        continue;
      }

      if (arg === "--ignore-folder" || arg === "-ifo") {
        let consumed = 0;
        while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          let folderName = args[i + 1];
          
          // Check for /folder syntax (root-only include)
          if (folderName.startsWith("/")) {
            const cleanFolderName = folderName.slice(1); // Remove leading /
            onlyFolders.add(cleanFolderName);
            rootOnlyInclude = true;
            i += 1;
            consumed += 1;
          } else {
            // Normal folder path (could be nested like folder/subfolder)
            onlyFolders.add(folderName);
            i += 1;
            consumed += 1;
          }
        }
        if (consumed === 0) {
          console.error("Error: --ignore-folder requires at least one folder name.");
          process.exit(1);
        }
        continue;
      }

      if (arg.startsWith("--ignore-folder=") || arg.startsWith("-ifo=")) {
        const value = arg.startsWith("--ignore-folder=") 
          ? arg.slice("--ignore-folder=".length)
          : arg.slice("-ifo=".length);
        if (!value) {
          console.error("Error: --ignore-folder requires a folder name.");
          process.exit(1);
        }
        
        // Check for /folder syntax (root-only include)
        if (value.startsWith("/")) {
          const cleanFolderName = value.slice(1); // Remove leading /
          onlyFolders.add(cleanFolderName);
          rootOnlyInclude = true;
        } else {
          // Normal folder path (could be nested like folder/subfolder)
          onlyFolders.add(value);
        }
        continue;
      }

      if (arg === "--ignore-file" || arg === "-ifi") {
        let consumed = 0;
        while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          ignoreFiles.add(args[i + 1]);
          i += 1;
          consumed += 1;
        }
        if (consumed === 0) {
          console.error("Error: --ignore-file requires at least one file name.");
          process.exit(1);
        }
        continue;
      }

      if (arg.startsWith("--ignore-file=") || arg.startsWith("-ifi=")) {
        const value = arg.startsWith("--ignore-file=") 
          ? arg.slice("--ignore-file=".length)
          : arg.slice("-ifi=".length);
        if (!value) {
          console.error("Error: --ignore-file requires a file name.");
          process.exit(1);
        }
        ignoreFiles.add(value);
        continue;
      }

      if (arg === "--only-folder" || arg === "-ofo") {
        let consumed = 0;
        while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          let folderName = args[i + 1];
          folderName = folderName.replace(/\\/g, '/'); // Convert backslashes to forward slashes
          // Detect leading / as root-only signal (same as --only-file behavior)
          if (folderName.startsWith("/")) {
            rootOnlyInclude = true;
          }
          folderName = folderName.replace(/^\.?\//, ''); // Remove leading ./ or /
          folderName = folderName.replace(/\/+$/, ''); // Remove trailing slashes
          onlyFolders.add(folderName);
          i += 1;
          consumed += 1;
        }
        if (consumed === 0) {
          console.error("Error: --only-folder requires at least one folder name.");
          process.exit(1);
        }
        continue;
      }

      if (arg.startsWith("--only-folder=") || arg.startsWith("-ofo=")) {
        const value = arg.startsWith("--only-folder=") 
          ? arg.slice("--only-folder=".length)
          : arg.slice("-ofo=".length);
        if (!value) {
          console.error("Error: --only-folder requires a folder name.");
          process.exit(1);
        }
        let folderName = value;
        folderName = folderName.replace(/\\/g, '/'); // Convert backslashes to forward slashes
        // Detect leading / as root-only signal
        if (folderName.startsWith("/")) {
          rootOnlyInclude = true;
        }
        folderName = folderName.replace(/^\.?\//, ''); // Remove leading ./ or /
        folderName = folderName.replace(/\/+$/, ''); // Remove trailing slashes
        onlyFolders.add(folderName);
        continue;
      }

      if (arg === "--only-file" || arg === "-ofi") {
        let consumed = 0;
        while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          let fileName = args[i + 1];
          
          // Check for /file syntax (root-only include)
          if (fileName.startsWith("/")) {
            const cleanFileName = fileName.slice(1); // Remove leading /
            onlyFiles.add(cleanFileName);
            rootOnlyInclude = true;
            i += 1;
            consumed += 1;
          } else {
            // Normal file path (could be nested like folder/file.ext)
            onlyFiles.add(fileName);
            i += 1;
            consumed += 1;
          }
        }
        if (consumed === 0) {
          console.error("Error: --only-file requires at least one file name.");
          process.exit(1);
        }
        continue;
      }

      if (arg.startsWith("--only-file=") || arg.startsWith("-ofi=")) {
        const value = arg.startsWith("--only-file=") 
          ? arg.slice("--only-file=".length)
          : arg.slice("-ofi=".length);
        if (!value) {
          console.error("Error: --only-file requires a file name.");
          process.exit(1);
        }
        
        // Check for /file syntax (root-only include)
        if (value.startsWith("/")) {
          const cleanFileName = value.slice(1); // Remove leading /
          onlyFiles.add(cleanFileName);
          rootOnlyInclude = true;
        } else {
          // Normal file path (could be nested like folder/file.ext)
          onlyFiles.add(value);
        }
        continue;
      }

      // Unknown argument
      console.error(`Error: Unknown option "${arg}"`);
      console.error("Use --help for available options.");
      process.exit(1);
    }

    // Validate split options
    if (splitMethod === 'size' && !splitSize) {
      console.error("Error: --split-method size requires --split-size to be specified");
      process.exit(1);
    }

    if (splitSize && splitMethod !== 'size') {
      console.error("Error: --split-size can only be used with --split-method size");
      process.exit(1);
    }

    // ── config ────────────────────────────────────────────────────────────────────────

    const folderPath = process.cwd();
    const rootName = path.basename(folderPath);
    const txtIgnore = readTxtIgnore(folderPath);

    // ── build tree & collect file paths ───────────────────────────────────────────────

    const { lines: treeLines, filePaths } = collectFiles(
      folderPath,
      folderPath,
      ignoreDirs,
      ignoreFiles,
      onlyFolders,
      onlyFiles,
      { 
        rootName, 
        txtIgnore, 
        force: forceFlag,
        hasOnlyFilters: onlyFolders.size > 0 || onlyFiles.size > 0,
        rootOnlyInclude
      }
    );

    // ── build output filename ───────────────────────────────────────────────────────────

    let outputFile = outputArg || path.join(folderPath, `${rootName}.txt`);

    // ── handle output splitting ─────────────────────────────────────────────────────────

    const effectiveMaxSize = noSkipFlag ? Infinity : maxFileSize;

    if (splitMethod) {
      console.log(`🔧 Splitting output by: ${splitMethod}`);
      
      let results;
      
      if (splitMethod === 'folder') {
        results = splitByFolders(treeLines, filePaths, rootName, effectiveMaxSize, forceFlag);
      } else if (splitMethod === 'file') {
        results = splitByFiles(filePaths, rootName, effectiveMaxSize, forceFlag);
      } else if (splitMethod === 'size') {
        results = splitBySize(treeLines, filePaths, rootName, splitSize, effectiveMaxSize, forceFlag);
      }
      
      console.log(`✅  Done! Created ${results.length} split files:`);
      console.log('');
      
      results.forEach((result, index) => {
        if (splitMethod === 'folder') {
          console.log(`📁  Folder: ${result.folder}`);
        } else if (splitMethod === 'file') {
          console.log(`📄  File: ${result.fileName}`);
        } else if (splitMethod === 'size') {
          console.log(`📦  Part ${result.part}`);
        }
        console.log(`📄  Output : ${result.file}`);
        console.log(`📊  Size   : ${result.size} KB`);
        console.log(`🗂️   Files  : ${result.files}`);
        console.log('');
      });
      
      if (copyToClipboardFlag) {
        console.log('⚠️  --copy flag is not compatible with splitting - clipboard copy skipped');
      }
      
      process.exit(0);
    }

    // ── build output (no splitting) ───────────────────────────────────────────────────
    const out = [];
    const divider    = "=".repeat(80);
    const subDivider = "-".repeat(80);

    out.push(divider);
    out.push(`START OF FOLDER: ${rootName}`);
    out.push(divider);
    out.push("");

    out.push(divider);
    out.push("PROJECT STRUCTURE");
    out.push(divider);
    out.push(`Root: ${folderPath}\n`);

    out.push(`${rootName}/`);
    treeLines.forEach(l => out.push(l));
    out.push("");
    out.push(`Total files: ${filePaths.length}`);
    out.push("");

    out.push(divider);
    out.push("FILE CONTENTS");
    out.push(divider);

    filePaths.forEach(({ abs, rel }) => {
      out.push("");
      out.push(subDivider);
      out.push(`FILE: ${rel}`);
      out.push(subDivider);
      out.push(readContent(abs, forceFlag, effectiveMaxSize));
    });

    out.push("");
    out.push(divider);
    out.push(`END OF FOLDER: ${rootName}`);
    out.push(divider);

    fs.writeFileSync(outputFile, out.join("\n"), "utf8");

    const sizeKB = (fs.statSync(outputFile).size / 1024).toFixed(1);
    console.log(`✅  Done!`);
    console.log(`📄  Output : ${outputFile}`);
    console.log(`📊  Size   : ${sizeKB} KB`);
    console.log(`🗂️   Files  : ${filePaths.length}`);

    if (copyToClipboardFlag) {
      const content = fs.readFileSync(outputFile, 'utf8');
      const success = copyToClipboard(content);
      if (success) {
        console.log(`📋  Copied to clipboard!`);
      }
    }

    console.log('');
}

// Run the main function
main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});