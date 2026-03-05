#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

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

function collectFiles(dir, rootDir, indent = "", lines = [], filePaths = []) {
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
      if (IGNORE_DIRS.has(entry.name)) {
        lines.push(`${indent}${connector}${entry.name}/  [skipped]`);
        return;
      }
      lines.push(`${indent}${connector}${entry.name}/`);
      collectFiles(path.join(dir, entry.name), rootDir, childIndent, lines, filePaths);
    } else {
      if (IGNORE_FILES.has(entry.name)) return;
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

const folderPath = process.cwd();

const rootName = path.basename(folderPath);

const outputFile = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(process.cwd(), `${rootName}.txt`);

console.log(`\n📂  Scanning: ${folderPath}`);

const { lines: treeLines, filePaths } = collectFiles(folderPath, folderPath);

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