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

function collectFiles(dir, rootDir, ignoreDirs, ignoreFiles, indent = "", lines = [], filePaths = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { lines, filePaths };
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
        lines.push(`${indent}${connector}${entry.name}/  [skipped]`);
        return;
      }
      lines.push(`${indent}${connector}${entry.name}/`);
      collectFiles(path.join(dir, entry.name), rootDir, ignoreDirs, ignoreFiles, childIndent, lines, filePaths);
    } else {
      if (ignoreFiles.has(entry.name)) return;
      lines.push(`${indent}${connector}${entry.name}`);
      const relPath = "/" + path.relative(rootDir, path.join(dir, entry.name)).split(path.sep).join("/");
      filePaths.push({ abs: path.join(dir, entry.name), rel: relPath });
    }
  });

  return { lines, filePaths };
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
let outputArg = null;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--ignore-folder" || arg.startsWith("--ignore-folder=")) {
    const value = arg.startsWith("--ignore-folder=")
      ? arg.slice("--ignore-folder=".length)
      : args[i + 1];
    if (!value || value.startsWith("-")) {
      console.error("Error: --ignore-folder requires a folder name.");
      process.exit(1);
    }
    if (!arg.includes("=")) i += 1;
    ignoreDirs.add(value);
    continue;
  }

  if (arg === "--ignore-file" || arg.startsWith("--ignore-file=")) {
    const value = arg.startsWith("--ignore-file=")
      ? arg.slice("--ignore-file=".length)
      : args[i + 1];
    if (!value || value.startsWith("-")) {
      console.error("Error: --ignore-file requires a file name.");
      process.exit(1);
    }
    if (!arg.includes("=")) i += 1;
    ignoreFiles.add(value);
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

const { lines: treeLines, filePaths } = collectFiles(folderPath, folderPath, ignoreDirs, ignoreFiles);

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
