import { readFile } from 'fs/promises';
import path from 'path';
import type { ScriptEntry } from '../types';

/** Auto-descriptions for common Node.js script names. */
const NODE_SCRIPT_DESCRIPTIONS: Record<string, string> = {
  test: 'Run test suite',
  build: 'Compile / bundle for production',
  dev: 'Start development server with watch mode',
  start: 'Start the application',
  lint: 'Lint source files',
  format: 'Auto-format source files',
  clean: 'Remove build artifacts',
  prepare: 'Prepare package (runs before publish)',
  prepublishOnly: 'Build before publishing to npm',
  typecheck: 'Run TypeScript type checking',
  check: 'Run all checks (lint + typecheck)',
};

/** Standard cargo subcommands with descriptions. */
const CARGO_COMMANDS: ScriptEntry[] = [
  { name: 'cargo build', command: 'cargo build', description: 'Compile the project' },
  { name: 'cargo test', command: 'cargo test', description: 'Run all tests' },
  { name: 'cargo run', command: 'cargo run', description: 'Build and run the binary' },
  { name: 'cargo clippy', command: 'cargo clippy', description: 'Run the Clippy linter' },
];

/** Read a file relative to rootDir, return null if missing. */
async function readFileOpt(rootDir: string, filename: string): Promise<string | null> {
  try {
    return await readFile(path.join(rootDir, filename), 'utf8');
  } catch {
    return null;
  }
}

/** Extract scripts from package.json. */
function parsePackageJsonScripts(content: string): ScriptEntry[] {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const scripts = pkg['scripts'];
  if (!scripts || typeof scripts !== 'object') return [];

  return Object.entries(scripts as Record<string, unknown>)
    .filter(([, cmd]) => typeof cmd === 'string')
    .map(([name, cmd]) => ({
      name: `npm run ${name}`,
      command: cmd as string,
      description: NODE_SCRIPT_DESCRIPTIONS[name] ?? '',
    }));
}

/**
 * Isolate a TOML section block starting at [sectionName].
 * Ends at the next top-level section header.
 */
function extractTomlSection(content: string, sectionName: string): string {
  const start = new RegExp(`^\\[${sectionName}\\]`, 'm');
  const startMatch = start.exec(content);
  if (!startMatch) return '';

  const afterHeader = content.slice(startMatch.index + startMatch[0].length);
  const nextSection = /^\[(?!\[)/m.exec(afterHeader);
  return nextSection ? afterHeader.slice(0, nextSection.index) : afterHeader;
}

/** Extract scripts from pyproject.toml ([project.scripts] or [tool.poetry.scripts]). */
function parsePyprojectScripts(content: string): ScriptEntry[] {
  const section =
    extractTomlSection(content, 'project\\.scripts') ||
    extractTomlSection(content, 'tool\\.poetry\\.scripts');

  if (!section) return [];

  const entries: ScriptEntry[] = [];
  const pattern = /^(\w[\w-]*)\s*=\s*["']([^"']*)["']/gm;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(section)) !== null) {
    entries.push({ name: m[1], command: m[1], description: '' });
  }

  return entries;
}

/** Parse Makefile targets (lines of the form `target_name:`). */
function parseMakefileTargets(content: string): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  const pattern = /^([a-zA-Z_][a-zA-Z0-9_-]*):/gm;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(content)) !== null) {
    const name = m[1];
    // Skip internal/phony-style names that start with a dot or are .PHONY
    if (name.startsWith('.')) continue;
    entries.push({ name: `make ${name}`, command: `make ${name}`, description: '' });
  }

  return entries;
}

/**
 * Detects project scripts from package.json, pyproject.toml, Cargo.toml, and Makefile.
 * Returns a merged, deduplicated list of ScriptEntry values.
 */
export async function detectScripts(rootDir: string): Promise<ScriptEntry[]> {
  const results: ScriptEntry[] = [];

  // Node.js
  const pkgJson = await readFileOpt(rootDir, 'package.json');
  if (pkgJson) results.push(...parsePackageJsonScripts(pkgJson));

  // Python
  const pyproject = await readFileOpt(rootDir, 'pyproject.toml');
  if (pyproject) results.push(...parsePyprojectScripts(pyproject));

  // Rust — presence of Cargo.toml is enough to infer cargo commands
  const cargoToml = await readFileOpt(rootDir, 'Cargo.toml');
  if (cargoToml) results.push(...CARGO_COMMANDS);

  // Makefile
  const makefile =
    (await readFileOpt(rootDir, 'Makefile')) ?? (await readFileOpt(rootDir, 'makefile'));
  if (makefile) results.push(...parseMakefileTargets(makefile));

  // Deduplicate by name (first occurrence wins)
  const seen = new Set<string>();
  return results.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

/**
 * Renders a list of ScriptEntry values as a Markdown table.
 * Columns: Command | Description
 */
export function renderScripts(scripts: ScriptEntry[]): string {
  if (scripts.length === 0) return '_No scripts detected._';

  const rows = scripts.map((s) => `| \`${s.name}\` | ${s.description || s.command} |`);

  return ['| Command | Description |', '|---------|-------------|', ...rows].join('\n');
}
