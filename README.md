# readmecraft

Generate a complete, structured README.md for any codebase in seconds — no AI API calls required.

## Quick Start

```bash
npx @avinashchby/readmecraft
```

## What It Does

Most projects skip writing a README because it is tedious to maintain. readmecraft fixes that by statically analyzing your project's manifest files, source code, directory layout, and configuration to produce a well-structured README.md automatically. It detects the language, package manager, scripts, environment variables, API exports, Docker setup, and CI/CD pipelines, then assembles them into a consistent Markdown document. On subsequent runs, `--update` mode re-generates only the auto-managed sections while leaving any section you have marked `<!-- custom -->` completely untouched.

## Features

- Zero API calls — pure static analysis, works offline
- Multi-language support: Node.js, Python, Rust, and Go projects
- Package manager detection: npm, yarn, pnpm, bun, pip, uv, poetry, cargo, and go modules
- Auto-generated shields.io badges for language, license, version, npm, and GitHub Actions CI
- Scans source files for exported functions and JSDoc/docstring comments to build an API reference
- Detects `.env.example` and `process.env` usage to produce an Environment Variables table
- Smart `--update` mode that merges freshly generated content with hand-written custom sections
- Two output styles: `detailed` (all sections + table of contents) and `minimal` (title, description, install, usage, license)

## Usage

Generate a README for the current directory:

```bash
npx @avinashchby/readmecraft
```

Preview the output without writing a file:

```bash
npx @avinashchby/readmecraft --preview
```

Generate a minimal README (no TOC, no API docs, no scripts table):

```bash
npx @avinashchby/readmecraft --style minimal
```

Re-run on a project that already has a readmecraft README, preserving custom sections:

```bash
npx @avinashchby/readmecraft --update
```

Output only the badge line (useful for pasting into an existing README):

```bash
npx @avinashchby/readmecraft --badges
```

Analyze a different directory and write the result to a custom path:

```bash
npx @avinashchby/readmecraft ../my-other-project -o docs/README.md
```

## Example Output

Running `readmecraft` on a Node.js project produces a file like this:

```
# my-app

[![language](https://img.shields.io/badge/language-JavaScript%2FTypeScript-yellow)](...) [![license](...)](...) [![version](...)](#) [![npm](https://img.shields.io/npm/v/my-app)](...)

## Description
...

## Table of Contents
- [Description](#description)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Tech Stack
| Category   | Technology | Version |
|------------|------------|---------|
| Language   | TypeScript | 5.x     |
| Testing    | jest       | 29.x    |

## Installation
\`\`\`bash
npm install my-app
\`\`\`

## Environment Variables
| Variable    | Default | Source        |
|-------------|---------|---------------|
| DATABASE_URL |        | src/db.ts     |
| PORT        | 3000    | .env.example  |

## Scripts
| Command          | Description                        |
|------------------|------------------------------------|
| `npm run build`  | Compile / bundle for production    |
| `npm run test`   | Run test suite                     |
```

Each section is wrapped in HTML comment markers (`<!-- readmecraft:section:id -->`) so `--update` can surgically replace only the stale parts.

## Installation

```bash
npm install -g @avinashchby/readmecraft
# or
npx @avinashchby/readmecraft
```

Requires Node.js >= 18.

## License

MIT
