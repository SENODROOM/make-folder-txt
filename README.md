<div align="center">

# 📁 make-folder-txt

**Instantly dump your entire project into a single, readable `.txt` file.**

[![npm version](https://img.shields.io/npm/v/make-folder-txt?color=crimson&style=flat-square)](https://www.npmjs.com/package/make-folder-txt)
[![npm downloads](https://img.shields.io/npm/dm/make-folder-txt?color=orange&style=flat-square)](https://www.npmjs.com/package/make-folder-txt)
[![license](https://img.shields.io/npm/l/make-folder-txt?color=blue&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/make-folder-txt?color=green&style=flat-square)](https://nodejs.org)

Perfect for sharing your codebase with **AI tools**, **teammates**, or **code reviewers** — without zipping files or giving repo access.

[Installation](#-installation) · [Usage](#-usage) · [Help](#-get-help) · [Copy to Clipboard](#-copy-to-clipboard) · [Force Include Everything](#-force-include-everything) · [File Size Control](#-file-size-control) · [Output Splitting](#-output-splitting) · [Output Format](#-output-format) · [What Gets Skipped](#-what-gets-skipped) · [Contributing](#-contributing)

</div>

---

## ✨ Why make-folder-txt?

Ever needed to share your entire project with ChatGPT, Claude, or a teammate — but copy-pasting every file one by one is painful? **make-folder-txt** solves that in one command.

- ✅ Run it from any project directory — no arguments needed
- ✅ Built-in help system with `--help` flag
- ✅ File size control with `--skip-large` and `--no-skip`
- ✅ Output splitting by folders, files, or size
- ✅ Copy to clipboard with `--copy` flag
- ✅ Force include everything with `--force` flag
- ✅ Generates a clean folder tree + every file's content
- ✅ `.txtignore` support (works like `.gitignore`)
- ✅ Automatically skips `node_modules`, binaries, and junk files
- ✅ Zero dependencies — pure Node.js
- ✅ Works on Windows, macOS, and Linux

---

## 📦 Installation

Install globally once, use anywhere:

```bash
npm install -g make-folder-txt
```

---

## 🚀 Usage

Navigate into your project folder and run:

```bash
cd my-project
make-folder-txt
```

That's it. A `my-project.txt` file will be created in the same directory.

### 📖 Get Help

```bash
make-folder-txt --help      # Show all options and examples
make-folder-txt -h          # Short version of help
make-folder-txt --version   # Show version info
make-folder-txt -v          # Short version of version
```

### 📋 Copy to Clipboard

```bash
make-folder-txt --copy      # Generate output and copy to clipboard
make-folder-txt --copy --ignore-folder node_modules  # Copy filtered output
```

The `--copy` flag automatically copies the generated output to your system clipboard, making it easy to paste directly into AI tools, emails, or documents. Works on Windows, macOS, and Linux (requires `xclip` or `xsel` on Linux).

### 🔥 Force Include Everything

```bash
make-folder-txt --force      # Include everything (overrides all ignore patterns)
make-folder-txt --force --copy  # Include everything and copy to clipboard
```

The `--force` flag overrides all ignore patterns and includes:
- `node_modules` and other ignored folders
- Binary files (images, executables, etc.)
- Large files (no 500 KB limit)
- Files in `.txtignore`
- System files and other normally skipped content

Use this when you need a complete, unfiltered dump of your entire project.

### 📏 File Size Control

```bash
make-folder-txt --skip-large 400KB     # Skip files larger than 400KB
make-folder-txt --skip-large 5GB       # Skip files larger than 5GB
make-folder-txt --skip-large 1.5MB     # Skip files larger than 1.5MB
make-folder-txt --no-skip               # Include all files regardless of size
```

**Default behavior**: Files larger than 500KB are skipped by default.

**Supported size units**:
- **B** - Bytes
- **KB** - Kilobytes (1024 bytes)
- **MB** - Megabytes (1024 KB)
- **GB** - Gigabytes (1024 MB)
- **TB** - Terabytes (1024 GB)

**Examples:**
```bash
# More restrictive - skip anything over 100KB
make-folder-txt --skip-large 100KB

# More permissive - allow files up to 10MB
make-folder-txt --skip-large 10MB

# Include everything - no size limits
make-folder-txt --no-skip

# Combine with other options
make-folder-txt --skip-large 2MB --ignore-folder node_modules
```

**Size format**: Accepts decimal numbers (e.g., `1.5MB`, `0.5GB`) and various units.

### 📂 Output Splitting

```bash
make-folder-txt --split-method folder    # Split by folders
make-folder-txt --split-method file      # Split by files  
make-folder-txt --split-method size --split-size 5MB  # Split by file size
```

**Split Methods:**
- **`folder`** - Creates separate files for each folder
- **`file`** - Creates separate files for each individual file
- **`size`** - Splits output when content exceeds specified size

**Examples:**
```bash
# Split by folders - creates folder-name.txt for each folder
make-folder-txt --split-method folder

# Split by files - creates filename.txt for each file
make-folder-txt --split-method file

# Split by size - creates part-1.txt, part-2.txt, etc.
make-folder-txt --split-method size --split-size 5MB

# Combine with other options
make-folder-txt --split-method size --split-size 2MB --ignore-folder node_modules
```

**Output Files:**
- **Folder method**: `projectname-foldername.txt`
- **File method**: `projectname-filename.txt`  
- **Size method**: `projectname-part-1.txt`, `projectname-part-2.txt`, etc.

**Note**: Splitting is not compatible with `--copy` flag.

Ignore specific folders/files by name:

```bash
make-folder-txt --ignore-folder examples extensions docs
make-folder-txt -ifo examples extensions docs  # shorthand
make-folder-txt --ignore-folder examples extensions "docs and explaination"
make-folder-txt --ignore-folder examples extensions docs --ignore-file LICENSE
make-folder-txt --ignore-file .env .env.local secrets.txt
make-folder-txt -ifi .env .env.local secrets.txt  # shorthand
```

Use a `.txtignore` file (works like `.gitignore`):

```bash
# Create a .txtignore file in your project root
echo "node_modules/" > .txtignore
echo "*.log" >> .txtignore
echo ".env" >> .txtignore
echo "coverage/" >> .txtignore

# The tool will automatically read and respect .txtignore patterns
make-folder-txt
```

The `.txtignore` file supports:
- File and folder names (one per line)
- Wildcard patterns (`*.log`, `temp-*`)
- Comments (lines starting with `#`)
- Folder patterns with trailing slash (`docs/`)

Include only specific folders/files by name (everything else is ignored):

```bash
make-folder-txt --only-folder src docs
make-folder-txt -ofo src docs  # shorthand
make-folder-txt --only-file package.json README.md
make-folder-txt -ofi package.json README.md  # shorthand
make-folder-txt --only-folder src --only-file package.json
```

---

## 🎯 Real World Examples

**Sharing with an AI tool (ChatGPT, Claude, etc.):**

```bash
cd "C:\Web Development\my-app\backend"
make-folder-txt
# → backend.txt created, ready to paste into any AI chat
```

**On macOS / Linux:**

```bash
cd /home/user/projects/my-app
make-folder-txt
# → my-app.txt created
```

---

## 📄 Output Format

The generated `.txt` file is structured in two clear sections:

```
================================================================================
START OF FOLDER: my-project
================================================================================

================================================================================
PROJECT STRUCTURE
================================================================================
Root: C:\Web Development\my-project

my-project/
├── src/
│   ├── controllers/
│   │   └── userController.js
│   ├── models/
│   │   └── User.js
│   └── index.js
├── node_modules/  [skipped]
├── package.json
└── README.md

Total files: 5

================================================================================
FILE CONTENTS
================================================================================

--------------------------------------------------------------------------------
FILE: /src/index.js
--------------------------------------------------------------------------------
const express = require('express');
...

--------------------------------------------------------------------------------
FILE: /package.json
--------------------------------------------------------------------------------
{
  "name": "my-project",
  ...
}

================================================================================
END OF FOLDER: my-project
================================================================================
```

---

## 🚫 What Gets Skipped

The tool is smart about what it ignores so your output stays clean and readable.

| Category        | Details                                                        |
| --------------- | -------------------------------------------------------------- |
| 📁 Folders      | `node_modules`, `.git`, `.next`, `dist`, `build`, `.cache`     |
| 🖼️ Binary files | Images (`.png`, `.jpg`, `.gif`...), fonts, videos, executables |
| 📦 Archives     | `.zip`, `.tar`, `.gz`, `.rar`, `.7z`                           |
| 🔤 Font files   | `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf`                      |
| 📋 Lock files   | `package-lock.json`, `yarn.lock`                               |
| 📏 Large files  | Any file over **500 KB**                                       |
| 🗑️ System files | `.DS_Store`, `Thumbs.db`, `desktop.ini`                        |
| 📄 Output file  | The generated `foldername.txt` file (to avoid infinite loops)   |
| 📝 .txtignore   | Any files/folders specified in `.txtignore` file               |

Binary and skipped files are noted in the output as `[binary / skipped]` so you always know what was omitted.

---

## 🛠️ Requirements

- **Node.js** v14.0.0 or higher
- No other dependencies

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 👤 Author

**Muhammad Saad Amin**

---

## 📝 License

This project is licensed under the **MIT License** — feel free to use it in personal and commercial projects.

---

<div align="center">

If this tool saved you time, consider giving it a ⭐ on npm!

</div>
