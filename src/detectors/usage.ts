import { readFile, access, readdir } from 'fs/promises';
import * as path from 'path';
import { ProjectInfo } from '../types';

/** Checks if a file exists at the given path. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Reads and parses a JSON file, returning null on any error. */
async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Reads a file's text, returning null on any error. */
async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Node.js helpers
// ---------------------------------------------------------------------------

/**
 * Generates CLI usage examples from the package.json "bin" field.
 * The bin field can be a string (single binary) or a map of name→path.
 */
function buildNodeBinUsage(bin: unknown, projectName: string): string {
  const lines: string[] = ['### CLI Usage', '', '```bash'];

  if (typeof bin === 'string') {
    lines.push(`${projectName} [options]`);
  } else if (typeof bin === 'object' && bin !== null) {
    for (const cmd of Object.keys(bin as Record<string, string>)) {
      lines.push(`${cmd} [options]`);
    }
  }

  lines.push('```');
  return lines.join('\n');
}

/**
 * Generates import examples from the package.json "main"/"exports" field.
 * Produces both CommonJS require and ES Module import snippets.
 */
function buildNodeImportUsage(info: ProjectInfo): string {
  const lines: string[] = [
    '### Library Usage',
    '',
    '```js',
    `// CommonJS`,
    `const ${info.name} = require('${info.name}');`,
    '',
    `// ES Module`,
    `import ${info.name} from '${info.name}';`,
    '```',
  ];
  return lines.join('\n');
}

/** Extracts top-level export names from a TypeScript/JavaScript source file. */
function extractExportNames(source: string): string[] {
  const exportRegex = /^export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/gm;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/** Builds a named-import example block from a list of export names. */
function buildNamedImportBlock(names: string[], packageName: string): string {
  if (names.length === 0) return '';
  const importList = names.slice(0, 5).join(', ');
  return [
    '',
    '```ts',
    `import { ${importList} } from '${packageName}';`,
    '```',
  ].join('\n');
}

async function detectNodeUsage(rootDir: string, info: ProjectInfo): Promise<string> {
  const pkgJson = await readJson(path.join(rootDir, 'package.json'));
  const sections: string[] = [];

  if (pkgJson == null) return '';

  const bin = pkgJson['bin'];
  const hasMain = 'main' in pkgJson || 'exports' in pkgJson;

  if (bin != null) {
    sections.push(buildNodeBinUsage(bin, info.name));
  }

  if (hasMain) {
    sections.push(buildNodeImportUsage(info));

    // Try to extract named exports from canonical entry points.
    for (const entryCandidate of ['src/index.ts', 'src/main.ts']) {
      const source = await readText(path.join(rootDir, entryCandidate));
      if (source == null) continue;
      const names = extractExportNames(source);
      if (names.length > 0) {
        sections.push(buildNamedImportBlock(names, info.name));
      }
      break;
    }
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Python helpers
// ---------------------------------------------------------------------------

/** Parses [project.scripts] entries from a raw pyproject.toml string. */
function parsePyprojectScripts(raw: string): string[] {
  const scriptSection = raw.match(/\[project\.scripts\]([\s\S]*?)(?=\[|$)/);
  if (scriptSection == null) return [];
  const entries = scriptSection[1].matchAll(/(\w[\w-]*)\s*=/g);
  return Array.from(entries).map(m => m[1]);
}

async function detectPythonUsage(rootDir: string, info: ProjectInfo): Promise<string> {
  const sections: string[] = [];

  // CLI via __main__.py
  if (await fileExists(path.join(rootDir, '__main__.py'))) {
    sections.push(['### CLI Usage', '', '```bash', `python -m ${info.name} [options]`, '```'].join('\n'));
  }

  // CLI via cli.py
  if (await fileExists(path.join(rootDir, 'cli.py'))) {
    sections.push(['### CLI Usage', '', '```bash', `python cli.py [options]`, '```'].join('\n'));
  }

  // pyproject.toml [project.scripts]
  const pyproject = await readText(path.join(rootDir, 'pyproject.toml'));
  if (pyproject != null) {
    const scripts = parsePyprojectScripts(pyproject);
    if (scripts.length > 0) {
      const cmds = scripts.map(s => `${s} [options]`).join('\n');
      sections.push(['### CLI Usage', '', '```bash', cmds, '```'].join('\n'));
    }
  }

  // Library usage fallback
  if (sections.length === 0) {
    sections.push([
      '### Library Usage',
      '',
      '```python',
      `import ${info.name.replace(/-/g, '_')}`,
      '```',
    ].join('\n'));
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Rust helpers
// ---------------------------------------------------------------------------

async function detectRustUsage(rootDir: string, info: ProjectInfo): Promise<string> {
  const sections: string[] = [];
  const cargoToml = await readJson(path.join(rootDir, 'Cargo.toml'));

  // Explicit [[bin]] entries take precedence.
  const binEntries =
    cargoToml != null && Array.isArray((cargoToml as Record<string, unknown>)['bin'])
      ? (cargoToml as Record<string, { name?: string }[]>)['bin']
      : [];

  if (binEntries.length > 0) {
    const cmds = binEntries
      .filter(b => b.name != null)
      .map(b => `${b.name} [options]`)
      .join('\n');
    sections.push(['### CLI Usage', '', '```bash', cmds, '```'].join('\n'));
  } else if (await fileExists(path.join(rootDir, 'src', 'main.rs'))) {
    sections.push([
      '### CLI Usage',
      '',
      '```bash',
      `${info.name} [options]`,
      '```',
    ].join('\n'));
  }

  // Library usage when src/lib.rs is present.
  if (await fileExists(path.join(rootDir, 'src', 'lib.rs'))) {
    sections.push([
      '### Library Usage',
      '',
      '```rust',
      `use ${info.name.replace(/-/g, '_')}::*;`,
      '```',
    ].join('\n'));
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Go helpers
// ---------------------------------------------------------------------------

async function detectGoUsage(rootDir: string, info: ProjectInfo): Promise<string> {
  const sections: string[] = [];

  // Check cmd/ directory for sub-commands.
  const cmdDir = path.join(rootDir, 'cmd');
  if (await fileExists(cmdDir)) {
    try {
      const entries = await readdir(cmdDir, { withFileTypes: true });
      const cmds = entries.filter(e => e.isDirectory()).map(e => e.name);
      if (cmds.length > 0) {
        const usageLines = cmds.map(c => `${c} [options]`).join('\n');
        sections.push(['### CLI Usage', '', '```bash', usageLines, '```'].join('\n'));
      }
    } catch {
      // readdir failure is non-fatal; continue.
    }
  }

  // Fallback: top-level main.go.
  if (sections.length === 0 && await fileExists(path.join(rootDir, 'main.go'))) {
    sections.push([
      '### CLI Usage',
      '',
      '```bash',
      `${info.name} [options]`,
      '```',
    ].join('\n'));
  }

  // Library import example when there is no cmd/ and no main.go.
  if (sections.length === 0) {
    const module = info.repository || `github.com/user/${info.name}`;
    sections.push([
      '### Library Usage',
      '',
      '```go',
      `import "${module}"`,
      '```',
    ].join('\n'));
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects usage patterns for the project and generates markdown documentation.
 *
 * @param rootDir - Absolute path to the project root.
 * @param info    - Aggregated project metadata.
 * @returns Markdown string for the Usage section.
 */
export async function detectUsage(rootDir: string, info: ProjectInfo): Promise<string> {
  switch (info.projectType) {
    case 'node':
      return detectNodeUsage(rootDir, info);
    case 'python':
      return detectPythonUsage(rootDir, info);
    case 'rust':
      return detectRustUsage(rootDir, info);
    case 'go':
      return detectGoUsage(rootDir, info);
    default:
      return '';
  }
}
