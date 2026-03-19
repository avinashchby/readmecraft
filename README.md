<!-- readmecraft:section:title -->
# readmecraft

[![language](https://img.shields.io/badge/language-JavaScript%2FTypeScript-yellow)](https://img.shields.io/badge/language-JavaScript%2FTypeScript-yellow) [![license](https://img.shields.io/badge/license-MIT-blue)](https://img.shields.io/badge/license-MIT-blue) [![version](https://img.shields.io/badge/version-0.1.0-green)](https://img.shields.io/badge/version-0.1.0-green) [![npm](https://img.shields.io/npm/v/readmecraft)](https://img.shields.io/npm/v/readmecraft)

<!-- readmecraft:end:title -->

<!-- readmecraft:section:description -->
## Description

Auto-generate beautiful, comprehensive README.md files by analyzing any codebase. Zero API calls — pure static analysis.

<!-- readmecraft:end:description -->

<!-- readmecraft:section:toc -->
## Table of Contents

- [Description](#description)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

<!-- readmecraft:end:toc -->

<!-- readmecraft:section:tech-stack -->
## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | 5.4.5 |
| Testing | jest | 29.7.0 |

<!-- readmecraft:end:tech-stack -->

<!-- readmecraft:section:installation -->
## Installation

```bash
npm install -g readmecraft
```

**Or clone and build from source:**

```bash
git clone https://github.com/user/readmecraft
cd readmecraft
npm install -g readmecraft
```

<!-- readmecraft:end:installation -->

<!-- readmecraft:section:usage -->
## Usage

### CLI Usage

```bash
readmecraft [options]
```

### Library Usage

```js
// CommonJS
const readmecraft = require('readmecraft');

// ES Module
import readmecraft from 'readmecraft';
```

<!-- readmecraft:end:usage -->

<!-- readmecraft:section:api-documentation -->
## API Documentation

### `analyzeProject`

```
function analyzeProject(rootDir: string): Promise<AnalysisResult> 
```

> Run all detectors against a project root and return aggregated results. */

### `detectEnvVars`

```
function detectEnvVars(rootDir: string): Promise<EnvVar[]> 
```

> Scans source files for environment variable usage and parses .env.example. Returns a deduplicated list of EnvVar entries.

### `detectInstallation`

```
function detectInstallation(rootDir: string, info: ProjectInfo): Promise<string> 
```

> Detects installation method for the project and generates markdown instructions. @param rootDir - Absolute path to the project root. @param info    - Aggregated project metadata. @returns Markdown string for the Installation section.

### `detectProjectInfo`

```
function detectProjectInfo(rootDir: string): Promise<ProjectInfo> 
```

> Detect project metadata by reading manifest files found in rootDir. Checks package.json, Cargo.toml, pyproject.toml, and go.mod in order, stopping at the first hit. Lock files are then checked to determine the package manager.

### `detectProjectTree`

```
function detectProjectTree(rootDir: string): Promise<string> 
```

> Generates an ASCII tree of the project directory up to 3 levels deep. Excludes common non-source directories like node_modules and .git.

### `detectScripts`

```
function detectScripts(rootDir: string): Promise<ScriptEntry[]> 
```

> Detects project scripts from package.json, pyproject.toml, Cargo.toml, and Makefile. Returns a merged, deduplicated list of ScriptEntry values.

### `detectUsage`

```
function detectUsage(rootDir: string, info: ProjectInfo): Promise<string> 
```

> Detects usage patterns for the project and generates markdown documentation. @param rootDir - Absolute path to the project root. @param info    - Aggregated project metadata. @returns Markdown string for the Usage section.

### `generateBadges`

```
function generateBadges(info: ProjectInfo): Badge[] 
```

> Generates an array of shields.io badges for the given project. Badges are produced in a stable order:   language → license → version → npm → GitHub CI

### `generateContributing`

```
function generateContributing(info: ProjectInfo): string 
```

> Generates a Contributing section for the README. Covers the standard fork → branch → commit → PR workflow and includes the project-specific install command.

### `generateLicense`

```
function generateLicense(info: ProjectInfo): string 
```

> Generates a License section for the README. References the LICENSE file in the repository and includes the license type when known.

### `renderApiDocs`

```
function renderApiDocs(entries: ApiEntry[]): string 
```

> Render an array of ApiEntry values as a Markdown string. Entries are sorted alphabetically by name and capped at 20. Each entry is formatted as: ### `name` ``` signature ``` > description

### `renderBadges`

```
function renderBadges(badges: Badge[]): string 
```

> Renders a list of badges as a single line of Markdown image links. Each badge becomes `[![{label}]({url})]({url})` and they are joined with spaces.

### `renderEnvVars`

```
function renderEnvVars(vars: EnvVar[]): string 
```

> Renders a list of EnvVar entries as a Markdown table. Columns: Variable | Default | Source

### `renderReadme`

```
function renderReadme(analysis: AnalysisResult, style: ReadmeStyle): string 
```

> Assemble a complete README.md string from an AnalysisResult. 'detailed' produces all sections; 'minimal' produces only the core set.

### `renderScripts`

```
function renderScripts(scripts: ScriptEntry[]): string 
```

> Renders a list of ScriptEntry values as a Markdown table. Columns: Command | Description

### `renderTechStack`

```
function renderTechStack(entries: TechStackEntry[]): string 
```

> Render a list of tech stack entries as a Markdown table. | Category | Technology | Version | |----------|-----------|---------|

### `updateReadme`

```
function updateReadme(existingContent: string, newContent: string): string 
```

> Merge an existing README with freshly generated content. Rules: - If the existing file has no readmecraft markers, append a warning comment   and return the new content unchanged. - For each section in the new content, preserve the existing version when   the existing section contains `<!-- custom -->`, otherwise use the new   auto-generated version. - Content before the first marker (preamble) and after the last marker   (postamble) from the existing file is preserved.

<!-- readmecraft:end:api-documentation -->

<!-- readmecraft:section:scripts -->
## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile / bundle for production |
| `npm run dev` | Start development server with watch mode |
| `npm run test` | Run test suite |
| `npm run lint` | Lint source files |
| `npm run prepublishOnly` | Build before publishing to npm |

<!-- readmecraft:end:scripts -->

<!-- readmecraft:section:project-structure -->
## Project Structure

```
readmecraft/
├── src/
│   ├── detectors/
│   │   ├── api-docs.test.ts
│   │   ├── api-docs.ts
│   │   ├── ci-cd.test.ts
│   │   ├── ci-cd.ts
│   │   ├── docker.test.ts
│   │   ├── docker.ts
│   │   ├── env-vars.test.ts
│   │   ├── env-vars.ts
│   │   ├── installation.test.ts
│   │   ├── installation.ts
│   │   └── ... and 10 more
│   ├── generators/
│   │   ├── badges.test.ts
│   │   ├── badges.ts
│   │   ├── renderer.test.ts
│   │   ├── renderer.ts
│   │   ├── sections.ts
│   │   ├── updater.test.ts
│   │   └── updater.ts
│   ├── analyzer.ts
│   ├── cli.ts
│   ├── index.ts
│   └── types.ts
├── .gitignore
├── jest.config.js
├── LICENSE
├── package-lock.json
├── package.json
└── tsconfig.json
```

<!-- readmecraft:end:project-structure -->

<!-- readmecraft:section:contributing -->
## Contributing

Contributions to readmecraft are welcome!

**Workflow:**

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Install dependencies:

   ```bash
   npm install
   ```

4. Make your changes and add tests where applicable
5. Commit using conventional commits: `git commit -m "feat: add my feature"`
6. Push to your fork: `git push origin feat/my-feature`
7. Open a Pull Request against the `main` branch

Please ensure your code passes linting and all tests before submitting.

<!-- readmecraft:end:contributing -->

<!-- readmecraft:section:license -->
## License

This project is licensed under the **MIT** license.

See the [LICENSE](LICENSE) file for the full license text.

<!-- readmecraft:end:license -->

---

<p align="center">Generated with ❤️ by <a href="https://github.com/readmecraft">readmecraft</a></p>
