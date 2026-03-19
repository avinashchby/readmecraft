import { readFile } from 'fs/promises';
import fg from 'fast-glob';
import path from 'path';
import type { EnvVar } from '../types';

// Patterns per language: each returns capture group 1 as the var name
const JS_TS_PATTERN = /process\.env(?:\.([A-Z_][A-Z0-9_]*)|(?:\[['"]([A-Z_][A-Z0-9_]*)['"]]\]))/g;
const PYTHON_PATTERN =
  /os\.environ(?:\.get\(['"]([A-Z_][A-Z0-9_]*)['"]|\[['"]([A-Z_][A-Z0-9_]*)['"])|os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]/g;
const RUST_PATTERN = /(?:std::env|env)::var\(["']([A-Z_][A-Z0-9_]*)["']\)/g;
const GO_PATTERN = /os\.Getenv\(["']([A-Z_][A-Z0-9_]*)["']\)/g;

const SOURCE_GLOBS: Record<string, string> = {
  '**/*.ts': 'js_ts',
  '**/*.js': 'js_ts',
  '**/*.py': 'python',
  '**/*.rs': 'rust',
  '**/*.go': 'go',
};

const EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/__pycache__/**',
  '**/target/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.venv/**',
  '**/venv/**',
  '**/vendor/**',
];

/** Extract all var names from content using the appropriate regex. */
function extractFromContent(content: string, lang: string, source: string): EnvVar[] {
  const vars: EnvVar[] = [];

  const addMatch = (name: string) => {
    if (name) vars.push({ name, source });
  };

  if (lang === 'js_ts') {
    let m: RegExpExecArray | null;
    while ((m = JS_TS_PATTERN.exec(content)) !== null) {
      addMatch(m[1] ?? m[2] ?? '');
    }
    JS_TS_PATTERN.lastIndex = 0;
  } else if (lang === 'python') {
    let m: RegExpExecArray | null;
    while ((m = PYTHON_PATTERN.exec(content)) !== null) {
      addMatch(m[1] ?? m[2] ?? m[3] ?? '');
    }
    PYTHON_PATTERN.lastIndex = 0;
  } else if (lang === 'rust') {
    let m: RegExpExecArray | null;
    while ((m = RUST_PATTERN.exec(content)) !== null) {
      addMatch(m[1] ?? '');
    }
    RUST_PATTERN.lastIndex = 0;
  } else if (lang === 'go') {
    let m: RegExpExecArray | null;
    while ((m = GO_PATTERN.exec(content)) !== null) {
      addMatch(m[1] ?? '');
    }
    GO_PATTERN.lastIndex = 0;
  }

  return vars;
}

/** Parse .env.example into EnvVar entries. */
function parseEnvExample(content: string, source: string): EnvVar[] {
  const vars: EnvVar[] = [];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Strip inline comment
    const commentIdx = line.indexOf(' #');
    const withoutComment = commentIdx !== -1 ? line.slice(0, commentIdx) : line;
    const eqIdx = withoutComment.indexOf('=');
    if (eqIdx === -1) continue;

    const name = withoutComment.slice(0, eqIdx).trim();
    const defaultValue = withoutComment.slice(eqIdx + 1).trim() || undefined;

    if (/^[A-Z_][A-Z0-9_]*$/.test(name)) {
      vars.push({ name, source, defaultValue });
    }
  }

  return vars;
}

/**
 * Scans source files for environment variable usage and parses .env.example.
 * Returns a deduplicated list of EnvVar entries.
 */
export async function detectEnvVars(rootDir: string): Promise<EnvVar[]> {
  const seen = new Map<string, EnvVar>();

  const addVar = (ev: EnvVar) => {
    if (!seen.has(ev.name)) {
      seen.set(ev.name, ev);
    }
  };

  // Scan source files
  for (const [glob, lang] of Object.entries(SOURCE_GLOBS)) {
    const files = await fg(glob, { cwd: rootDir, ignore: EXCLUDE, dot: false, absolute: true });
    for (const file of files) {
      let content: string;
      try {
        content = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      const relSource = path.relative(rootDir, file);
      for (const ev of extractFromContent(content, lang, relSource)) {
        addVar(ev);
      }
    }
  }

  // Parse .env.example if present
  try {
    const envExample = await readFile(path.join(rootDir, '.env.example'), 'utf8');
    for (const ev of parseEnvExample(envExample, '.env.example')) {
      addVar(ev);
    }
  } catch {
    // File does not exist — skip silently
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Renders a list of EnvVar entries as a Markdown table.
 * Columns: Variable | Default | Source
 */
export function renderEnvVars(vars: EnvVar[]): string {
  if (vars.length === 0) return '_No environment variables detected._';

  const rows = vars.map((v) => {
    const name = `\`${v.name}\``;
    const def = v.defaultValue !== undefined ? `\`${v.defaultValue}\`` : '—';
    const source = v.source;
    return `| ${name} | ${def} | ${source} |`;
  });

  return [
    '| Variable | Default | Source |',
    '|----------|---------|--------|',
    ...rows,
  ].join('\n');
}
