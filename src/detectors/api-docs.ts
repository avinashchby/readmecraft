import { readFile } from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import type { ApiEntry, ProjectType } from '../types';

// ---------------------------------------------------------------------------
// Glob patterns per project type
// ---------------------------------------------------------------------------

/** Return fast-glob patterns for source files given a project type. */
function sourcePatternsFor(projectType: ProjectType): string[] {
  switch (projectType) {
    case 'node':
      return ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    case 'python':
      return ['**/__init__.py', '**/*.py'];
    case 'rust':
      return ['**/*.rs'];
    case 'go':
      return ['**/*.go'];
    default:
      return [];
  }
}

/** Directories that are never interesting for API extraction. */
const IGNORE_DIRS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/target/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/*.test.ts',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.spec.js',
  '**/*_test.go',
];

// ---------------------------------------------------------------------------
// JS / TS extraction
// ---------------------------------------------------------------------------

/**
 * Collect the JSDoc comment block (/** ... *\/) that ends immediately before
 * `lineIndex` (possibly with blank lines between).
 */
function extractJsDocBefore(lines: string[], lineIndex: number): string {
  // Walk backwards, skipping blank lines first
  let i = lineIndex - 1;
  while (i >= 0 && lines[i].trim() === '') i--;

  if (i < 0 || !lines[i].trim().endsWith('*/')) return '';

  // Collect the block going upward until we hit the /**
  const blockLines: string[] = [];
  while (i >= 0) {
    const trimmed = lines[i].trim();
    blockLines.unshift(trimmed);
    if (trimmed.startsWith('/**')) break;
    i--;
  }

  // Strip leading * markers and /** / */
  return blockLines
    .map((l) => l.replace(/^\/\*\*\s?/, '').replace(/^\*\/\s?$/, '').replace(/^\*\s?/, ''))
    .filter((l) => l !== '**' && l !== '')
    .join(' ')
    .trim();
}

/** Extract ApiEntry items from JS/TS file content. */
function extractJsTsEntries(content: string, relFile: string): ApiEntry[] {
  const lines = content.split('\n');
  const entries: ApiEntry[] = [];

  // Patterns that indicate an exported symbol on a single line
  const exportPatterns: Array<{ re: RegExp; sigCapture: (m: RegExpExecArray) => string; nameCapture: (m: RegExpExecArray) => string }> = [
    {
      // export function foo(...) or export async function foo(...)
      re: /^export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\)(?:\s*:\s*[\w<>[\], |&]+)?)/,
      nameCapture: (m) => m[1],
      sigCapture: (m) => `function ${m[1]}${m[2]}`,
    },
    {
      // export default function foo(...) or export default function(...)
      re: /^export\s+default\s+(?:async\s+)?function\s*(\w*)\s*(\([^)]*\)(?:\s*:\s*[\w<>[\], |&]+)?)/,
      nameCapture: (m) => m[1] || 'default',
      sigCapture: (m) => `function ${m[1] || 'default'}${m[2]}`,
    },
    {
      // export class Foo or export default class Foo
      re: /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/,
      nameCapture: (m) => m[1],
      sigCapture: (m) => `class ${m[1]}`,
    },
    {
      // export const foo = (...) =>  or  export const foo = function(...)
      re: /^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?(\([^)]*\)(?:\s*:\s*[\w<>[\], |&]+)?\s*=>|function\s*\([^)]*\))/,
      nameCapture: (m) => m[1],
      sigCapture: (m) => `const ${m[1]} = ${m[2]}`,
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const { re, nameCapture, sigCapture } of exportPatterns) {
      const m = re.exec(line);
      if (!m) continue;

      const name = nameCapture(m);
      const signature = sigCapture(m);
      const description = extractJsDocBefore(lines, i);

      entries.push({ name, file: relFile, signature, description });
      break; // only one pattern can match per line
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Python extraction
// ---------------------------------------------------------------------------

/**
 * Extract the first docstring after a `def` or `class` line.
 * Looks for triple-quoted strings on the next non-empty line.
 */
function extractPythonDocstring(lines: string[], defLineIndex: number): string {
  let i = defLineIndex + 1;
  // Skip the function body opening line if it ends with ':'
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return '';

  const firstBodyLine = lines[i].trim();
  const tripleDouble = firstBodyLine.startsWith('"""');
  const tripleSingle = firstBodyLine.startsWith("'''");
  if (!tripleDouble && !tripleSingle) return '';

  const delim = tripleDouble ? '"""' : "'''";

  // Single-line docstring: """text"""
  const inner = firstBodyLine.slice(3);
  const closeIdx = inner.indexOf(delim);
  if (closeIdx !== -1) return inner.slice(0, closeIdx).trim();

  // Multi-line docstring
  const parts: string[] = [inner];
  i++;
  while (i < lines.length) {
    const l = lines[i];
    const end = l.indexOf(delim);
    if (end !== -1) {
      parts.push(l.slice(0, end));
      break;
    }
    parts.push(l.trim());
    i++;
  }
  return parts.join(' ').trim();
}

/** Extract ApiEntry items from Python file content. */
function extractPythonEntries(content: string, relFile: string): ApiEntry[] {
  const lines = content.split('\n');
  const entries: ApiEntry[] = [];

  // Only care about top-level defs/classes (no indentation)
  const defRe = /^(def|class)\s+(\w+)\s*(\([^)]*\))?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = defRe.exec(line);
    if (!m) continue;

    const kind = m[1];
    const name = m[2];
    const params = m[3] ?? '';
    const signature = kind === 'def' ? `def ${name}${params}` : `class ${name}${params}`;
    const description = extractPythonDocstring(lines, i);

    entries.push({ name, file: relFile, signature, description });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Rust extraction
// ---------------------------------------------------------------------------

/**
 * Collect consecutive `/// ` doc-comment lines ending just before lineIndex,
 * ignoring blank lines.
 */
function extractRustDocBefore(lines: string[], lineIndex: number): string {
  let i = lineIndex - 1;
  while (i >= 0 && lines[i].trim() === '') i--;

  const docLines: string[] = [];
  while (i >= 0 && lines[i].trim().startsWith('///')) {
    docLines.unshift(lines[i].trim().replace(/^\/\/\/\s?/, ''));
    i--;
  }
  return docLines.join(' ').trim();
}

/** Extract ApiEntry items from Rust file content. */
function extractRustEntries(content: string, relFile: string): ApiEntry[] {
  const lines = content.split('\n');
  const entries: ApiEntry[] = [];

  // pub fn, pub async fn, pub struct, pub enum, pub trait
  const pubRe = /^(?:\s*)pub\s+(?:async\s+)?(?:(fn)\s+(\w+)\s*(\([^)]*\)(?:\s*->\s*[\w<>[\], &]+)?)|(?:struct|enum|trait)\s+(\w+))/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = pubRe.exec(line);
    if (!m) continue;

    let name: string;
    let signature: string;

    if (m[1] === 'fn') {
      // function variant
      name = m[2];
      signature = `pub fn ${m[2]}${m[3] ?? '()'}`;
    } else if (m[4]) {
      // struct/enum/trait variant — captured by the last group
      name = m[4];
      signature = line.trim().replace(/\s*\{.*$/, '').replace(/\s*;$/, '');
    } else {
      continue;
    }

    const description = extractRustDocBefore(lines, i);
    entries.push({ name, file: relFile, signature, description });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Go extraction
// ---------------------------------------------------------------------------

/**
 * Collect consecutive `// ` comment lines ending just before lineIndex,
 * ignoring blank lines.
 */
function extractGoCommentBefore(lines: string[], lineIndex: number): string {
  let i = lineIndex - 1;
  while (i >= 0 && lines[i].trim() === '') i--;

  const commentLines: string[] = [];
  while (i >= 0 && lines[i].trim().startsWith('//')) {
    commentLines.unshift(lines[i].trim().replace(/^\/\/\s?/, ''));
    i--;
  }
  return commentLines.join(' ').trim();
}

/** Extract ApiEntry items from Go file content. Only exported (capitalised) names. */
function extractGoEntries(content: string, relFile: string): ApiEntry[] {
  const lines = content.split('\n');
  const entries: ApiEntry[] = [];

  // func FuncName(...) or func (recv Type) MethodName(...)
  const funcRe = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Z]\w*)\s*(\([^)]*\)(?:\s*[\w*()[\], ]+)?)/;
  // type TypeName struct|interface|...
  const typeRe = /^type\s+([A-Z]\w+)\s+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = funcRe.exec(line);
    if (fm) {
      const name = fm[1];
      const signature = `func ${name}${fm[2]}`;
      const description = extractGoCommentBefore(lines, i);
      entries.push({ name, file: relFile, signature, description });
      continue;
    }

    const tm = typeRe.exec(line);
    if (tm) {
      const name = tm[1];
      const signature = line.trim().replace(/\s*\{.*$/, '');
      const description = extractGoCommentBefore(lines, i);
      entries.push({ name, file: relFile, signature, description });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/** Dispatch content to the correct language extractor. */
function extractEntries(
  content: string,
  relFile: string,
  projectType: ProjectType,
): ApiEntry[] {
  switch (projectType) {
    case 'node':
      return extractJsTsEntries(content, relFile);
    case 'python':
      return extractPythonEntries(content, relFile);
    case 'rust':
      return extractRustEntries(content, relFile);
    case 'go':
      return extractGoEntries(content, relFile);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan source files under rootDir and extract exported functions, classes,
 * and their documentation comments.
 *
 * Returns one ApiEntry per symbol found.
 */
export async function detectApiDocs(
  rootDir: string,
  projectType: ProjectType,
): Promise<ApiEntry[]> {
  const patterns = sourcePatternsFor(projectType);
  if (patterns.length === 0) return [];

  const files = await fg(patterns, {
    cwd: rootDir,
    ignore: IGNORE_DIRS,
    absolute: false,
    onlyFiles: true,
  });

  const results: ApiEntry[] = [];

  await Promise.all(
    files.map(async (relFile) => {
      const absFile = path.join(rootDir, relFile);
      let content: string;
      try {
        content = await readFile(absFile, 'utf8');
      } catch {
        return;
      }
      const entries = extractEntries(content, relFile, projectType);
      results.push(...entries);
    }),
  );

  return results;
}

/**
 * Render an array of ApiEntry values as a Markdown string.
 *
 * Entries are sorted alphabetically by name and capped at 20.
 * Each entry is formatted as:
 *
 * ### `name`
 * ```
 * signature
 * ```
 * > description
 */
export function renderApiDocs(entries: ApiEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const capped = sorted.slice(0, 20);

  return capped
    .map((entry) => {
      const lines: string[] = [];
      lines.push(`### \`${entry.name}\``);
      lines.push('');
      lines.push('```');
      lines.push(entry.signature);
      lines.push('```');
      if (entry.description) {
        lines.push('');
        lines.push(`> ${entry.description}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}
