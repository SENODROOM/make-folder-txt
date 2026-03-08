#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { version } = require("../package.json");

// ── config ────────────────────────────────────────────────────────────────────
const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".cache"]);
const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".lock",
]);

// ── helpers ───────────────────────────────────────────────────────────────────

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
      if (ignoreDirs.has(entry.name)) {
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
      if (ignoreFiles.has(entry.name)) return;

      const shouldIncludeFile = !hasOnlyFilters || inSelectedFolder || onlyFiles.has(entry.name);
      if (!shouldIncludeFile) return;

      lines.push(`${indent}${connector}${entry.name}`);
      const relPath = "/" + path.relative(rootDir, path.join(dir, entry.name)).split(path.sep).join("/");
      filePaths.push({ abs: path.join(dir, entry.name), rel: relPath });
    }
  });

  return { lines, filePaths, hasIncluded: filePaths.length > 0 || lines.length > 0 };
}

function readContent(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (BINARY_EXTS.has(ext)) return "[binary / skipped]";
  try {
    const stat = fs.statSync(absPath);
    if (stat.size > 500 * 1024) {
      return `[file too large: ${(stat.size / 1024).toFixed(1)} KB – skipped]`;
    }
    return fs.readFileSync(absPath, "utf8");
  } catch (err) {
    return `[could not read file: ${err.message}]`;
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("-v") || args.includes("--version")) {
  console.log(`v${version}`);
  console.log("Built by Muhammad Saad Amin");
  process.exit(0);
}

const ignoreDirs = new Set(IGNORE_DIRS);
const ignoreFiles = new Set(IGNORE_FILES);
const onlyFolders = new Set();
const onlyFiles = new Set();
let outputArg = null;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--ignore-folder") {
    let consumed = 0;
    while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
      ignoreDirs.add(args[i + 1]);
      i += 1;
      consumed += 1;
    }
    if (consumed === 0) {
      console.error("Error: --ignore-folder requires at least one folder name.");
      process.exit(1);
    }
    continue;
  }

  if (arg.startsWith("--ignore-folder=")) {
    const value = arg.slice("--ignore-folder=".length);
    if (!value) {
      console.error("Error: --ignore-folder requires a folder name.");
      process.exit(1);
    }
    ignoreDirs.add(value);
    continue;
  }

  if (arg === "--ignore-file") {
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

  if (arg.startsWith("--ignore-file=")) {
    const value = arg.slice("--ignore-file=".length);
    if (!value) {
      console.error("Error: --ignore-file requires a file name.");
      process.exit(1);
    }
    ignoreFiles.add(value);
    continue;
  }

  if (arg === "--only-folder") {
    let consumed = 0;
    while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
      onlyFolders.add(args[i + 1]);
      i += 1;
      consumed += 1;
    }
    if (consumed === 0) {
      console.error("Error: --only-folder requires at least one folder name.");
      process.exit(1);
    }
    continue;
  }

  if (arg.startsWith("--only-folder=")) {
    const value = arg.slice("--only-folder=".length);
    if (!value) {
      console.error("Error: --only-folder requires a folder name.");
      process.exit(1);
    }
    onlyFolders.add(value);
    continue;
  }

  if (arg === "--only-file") {
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

  if (arg.startsWith("--only-file=")) {
    const value = arg.slice("--only-file=".length);
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

const folderPath = process.cwd();

const rootName = path.basename(folderPath);

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
  { hasOnlyFilters },
);

// ── build output ──────────────────────────────────────────────────────────────
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
  out.push(readContent(abs));
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
console.log(`🗂️   Files  : ${filePaths.length}\n`);
