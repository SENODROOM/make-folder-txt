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
      // Windows
      execSync(`echo ${JSON.stringify(text).replace(/"/g, '""')} | clip`, { stdio: 'ignore' });
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
    console.warn('⚠️  Could not copy to clipboard:', err.message);
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
      const childInSelectedFolder = inSelectedFolder || onlyFolders.has(entry.name);
      const childLines = [];
      const childFiles = [];
      const child = collectFiles(
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
        },
      );

      const explicitlySelectedFolder = hasOnlyFilters && onlyFolders.has(entry.name);
      const shouldIncludeDir = !hasOnlyFilters || child.hasIncluded || explicitlySelectedFolder;

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

      const shouldIncludeFile = !hasOnlyFilters || inSelectedFolder || onlyFiles.has(entry.name);
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

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("-v") || args.includes("--version")) {
  console.log(`v${version}`);
  console.log("Built by Muhammad Saad Amin");
  process.exit(0);
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
      // Normalize the folder name: remove backslashes, trailing slashes, and leading ./
      let folderName = args[i + 1];
      folderName = folderName.replace(/\\/g, '/'); // Convert backslashes to forward slashes
      folderName = folderName.replace(/^\.?\//, ''); // Remove leading ./ or /
      folderName = folderName.replace(/\/+$/, ''); // Remove trailing slashes
      ignoreDirs.add(folderName);
      i += 1;
      consumed += 1;
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
    // Normalize the folder name
    let folderName = value;
    folderName = folderName.replace(/\\/g, '/'); // Convert backslashes to forward slashes
    folderName = folderName.replace(/^\.?\//, ''); // Remove leading ./ or /
    folderName = folderName.replace(/\/+$/, ''); // Remove trailing slashes
    ignoreDirs.add(folderName);
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
      // Normalize the folder name
      let folderName = args[i + 1];
      folderName = folderName.replace(/\\/g, '/'); // Convert backslashes to forward slashes
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
    // Normalize the folder name
    let folderName = value;
    folderName = folderName.replace(/\\/g, '/'); // Convert backslashes to forward slashes
    folderName = folderName.replace(/^\.?\//, ''); // Remove leading ./ or /
    folderName = folderName.replace(/\/+$/, ''); // Remove trailing slashes
    onlyFolders.add(folderName);
    continue;
  }

  if (arg === "--only-file" || arg === "-ofi") {
    let consumed = 0;
    while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
      onlyFiles.add(args[i + 1]);
      i += 1;
      consumed += 1;
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
    onlyFiles.add(value);
    continue;
  }

  if (arg.startsWith("-")) {
    console.error(`Error: Unknown option "${arg}".`);
    process.exit(1);
  }

  if (!outputArg) {
    outputArg = arg;
    continue;
  }

  console.error(`Error: Unexpected argument "${arg}".`);
  process.exit(1);
}

// Validate split options
if (splitMethod === 'size' && !splitSize) {
  console.error("Error: --split-method size requires --split-size to be specified.");
  process.exit(1);
}

if (splitSize && splitMethod !== 'size') {
  console.error("Error: --split-size can only be used with --split-method size.");
  process.exit(1);
}

const folderPath = process.cwd();
const rootName = path.basename(folderPath);

// Read .txtignore file if it exists
const txtIgnore = readTxtIgnore(folderPath);

const outputFile = outputArg
  ? path.resolve(outputArg)
  : path.join(process.cwd(), `${rootName}.txt`);

console.log(`\n📂  Scanning: ${folderPath}`);

const hasOnlyFilters = onlyFolders.size > 0 || onlyFiles.size > 0;
const { lines: treeLines, filePaths } = collectFiles(
  folderPath,
  folderPath,
  ignoreDirs,
  ignoreFiles,
  onlyFolders,
  onlyFiles,
  { hasOnlyFilters, rootName, txtIgnore, force: forceFlag },
);

// ── handle splitting ──────────────────────────────────────────────────────────────
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
const effectiveMaxSize = noSkipFlag ? Infinity : maxFileSize;
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
