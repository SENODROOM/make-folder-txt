# make-folder-txt

Generate a single `.txt` file containing the **full folder structure** and **contents of every file** in your project — perfect for sharing codebases with AI tools or teammates.

Automatically ignores `node_modules`, `.git`, `dist`, `build`, and binary files.

---

## Installation

```bash
npm install -g make-folder-txt
```

---

## Usage

```bash
make-folder-txt <folder-path> [output-file.txt]
```

### Examples

```bash
# Basic — output saved as <folder-name>.txt in current directory
make-folder-txt "C:\Web Development\my-project"

# Custom output file name
make-folder-txt "C:\Web Development\my-project" my-output.txt

# On Mac/Linux
make-folder-txt /home/user/my-project
```

---

## Output Format

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
│   ├── index.js
│   └── utils.js
├── node_modules/  [skipped]
├── package.json
└── README.md

Total files: 4

================================================================================
FILE CONTENTS
================================================================================

--------------------------------------------------------------------------------
FILE: /src/index.js
--------------------------------------------------------------------------------
... file content here ...

================================================================================
END OF FOLDER: my-project
================================================================================
```

---

## What Gets Skipped

| Type | Details |
|------|---------|
| Folders | `node_modules`, `.git`, `.next`, `dist`, `build`, `.cache` |
| Binary files | Images, fonts, zips, executables, media |
| Large files | Any file over 500 KB |
| System files | `.DS_Store`, `Thumbs.db`, `desktop.ini` |

---

## License

MIT
