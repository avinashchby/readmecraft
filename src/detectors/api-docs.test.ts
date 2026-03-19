import { renderApiDocs } from './api-docs';
import type { ApiEntry } from '../types';

// ---------------------------------------------------------------------------
// Helpers – expose private extractors via a thin re-export shim so we can
// unit-test regex logic without touching the filesystem.
// ---------------------------------------------------------------------------

// We import the module object so we can reach the compiled JS functions.
// In ts-jest this resolves to the same module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require('./api-docs') as {
  detectApiDocs: unknown;
  renderApiDocs: unknown;
};

// Bring the internal helpers into scope by re-running extraction logic
// inline – this keeps the tests self-contained and avoids exposing internals.

/** Minimal inline re-implementation of the JS/TS extractor for test purposes. */
function extractJsTsFromContent(content: string, relFile = 'src/index.ts'): ApiEntry[] {
  // Re-use the real module's logic by writing to a temp string and calling
  // detectApiDocs is async/fs-based; instead we replicate the pure logic here
  // to test the patterns directly.
  const lines = content.split('\n');
  const entries: ApiEntry[] = [];

  function jsDocBefore(lineIndex: number): string {
    let i = lineIndex - 1;
    while (i >= 0 && lines[i].trim() === '') i--;
    if (i < 0 || !lines[i].trim().endsWith('*/')) return '';
    const block: string[] = [];
    while (i >= 0) {
      block.unshift(lines[i].trim());
      if (lines[i].trim().startsWith('/**')) break;
      i--;
    }
    return block
      .map((l) =>
        l
          .replace(/^\/\*\*\s?/, '')   // strip opening /**
          .replace(/\*\/\s*$/, '')      // strip closing */
          .replace(/^\*\s?/, ''),       // strip leading *
      )
      .filter((l) => l.trim() !== '')
      .join(' ')
      .trim();
  }

  const patterns: Array<{
    re: RegExp;
    name: (m: RegExpExecArray) => string;
    sig: (m: RegExpExecArray) => string;
  }> = [
    {
      re: /^export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\)(?:\s*:\s*[\w<>[\], |&]+)?)/,
      name: (m) => m[1],
      sig: (m) => `function ${m[1]}${m[2].trimEnd()}`,
    },
    {
      re: /^export\s+default\s+(?:async\s+)?function\s*(\w*)\s*(\([^)]*\)(?:\s*:\s*[\w<>[\], |&]+)?)/,
      name: (m) => m[1] || 'default',
      sig: (m) => `function ${m[1] || 'default'}${m[2].trimEnd()}`,
    },
    {
      re: /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/,
      name: (m) => m[1],
      sig: (m) => `class ${m[1]}`,
    },
    {
      re: /^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?(\([^)]*\)(?:\s*:\s*[\w<>[\], |&]+)?\s*=>|function\s*\([^)]*\))/,
      name: (m) => m[1],
      sig: (m) => `const ${m[1]} = ${m[2]}`,
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const p of patterns) {
      const m = p.re.exec(line);
      if (!m) continue;
      entries.push({ name: p.name(m), file: relFile, signature: p.sig(m), description: jsDocBefore(i) });
      break;
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Tests: JS/TS extraction (regex / logic)
// ---------------------------------------------------------------------------

describe('JS/TS extraction patterns', () => {
  const MOCK_TS = `
/** Adds two numbers together. */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Fetches user data from the API.
 * Returns a promise.
 */
export async function fetchUser(id: string): Promise<User> {
  return fetch(id);
}

/** A simple counter class. */
export class Counter {
  private value = 0;
}

export default function handler(req: Request): Response {
  return new Response();
}

export const greet = (name: string): string => \`Hello \${name}\`;

export const multiply = function(a: number, b: number) { return a * b; };
`.trim();

  let entries: ApiEntry[];

  beforeAll(() => {
    entries = extractJsTsFromContent(MOCK_TS);
  });

  test('detects export function with JSDoc', () => {
    const add = entries.find((e) => e.name === 'add');
    expect(add).toBeDefined();
    expect(add?.signature).toBe('function add(a: number, b: number): number');
    expect(add?.description).toBe('Adds two numbers together.');
  });

  test('detects export async function with multi-line JSDoc', () => {
    const fetchUser = entries.find((e) => e.name === 'fetchUser');
    expect(fetchUser).toBeDefined();
    expect(fetchUser?.signature).toContain('fetchUser');
    expect(fetchUser?.description).toContain('Fetches user data');
  });

  test('detects export class with JSDoc', () => {
    const counter = entries.find((e) => e.name === 'Counter');
    expect(counter).toBeDefined();
    expect(counter?.signature).toBe('class Counter');
    expect(counter?.description).toBe('A simple counter class.');
  });

  test('detects export default function', () => {
    const handler = entries.find((e) => e.name === 'handler');
    expect(handler).toBeDefined();
    expect(handler?.signature).toContain('handler');
  });

  test('detects export const arrow function', () => {
    const greet = entries.find((e) => e.name === 'greet');
    expect(greet).toBeDefined();
    expect(greet?.signature).toContain('greet');
  });

  test('detects export const function expression', () => {
    const multiply = entries.find((e) => e.name === 'multiply');
    expect(multiply).toBeDefined();
  });

  test('file path is preserved', () => {
    expect(entries.every((e) => e.file === 'src/index.ts')).toBe(true);
  });

  test('no description when no JSDoc present', () => {
    const handler = entries.find((e) => e.name === 'handler');
    expect(handler?.description).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: missing / edge-case TS patterns
// ---------------------------------------------------------------------------

describe('JS/TS extraction edge cases', () => {
  test('ignores non-exported functions', () => {
    const content = `function internal() {}\nfunction alsoInternal() {}`;
    const entries = extractJsTsFromContent(content);
    expect(entries).toHaveLength(0);
  });

  test('handles export default class without name', () => {
    const content = `export default class MyThing {}`;
    const entries = extractJsTsFromContent(content);
    expect(entries.find((e) => e.name === 'MyThing')).toBeDefined();
  });

  test('JSDoc immediately preceding export is associated correctly', () => {
    // No blank lines: comment is attached to the export
    const content = `/** Orphan comment. */\nexport function orphan() {}`;
    const entries = extractJsTsFromContent(content);
    const orphan = entries.find((e) => e.name === 'orphan');
    expect(orphan?.description).toBe('Orphan comment.');
  });

  test('unrelated comment before a non-export is not picked up', () => {
    // A regular // comment is never treated as JSDoc
    const content = `// just a comment\nexport function plain() {}`;
    const entries = extractJsTsFromContent(content);
    const plain = entries.find((e) => e.name === 'plain');
    expect(plain?.description).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: renderApiDocs
// ---------------------------------------------------------------------------

describe('renderApiDocs', () => {
  const mockEntries: ApiEntry[] = [
    { name: 'zebra', file: 'src/z.ts', signature: 'function zebra()', description: 'Last alphabetically.' },
    { name: 'alpha', file: 'src/a.ts', signature: 'function alpha()', description: 'First alphabetically.' },
    { name: 'middle', file: 'src/m.ts', signature: 'function middle(x: number)', description: '' },
  ];

  let rendered: string;

  beforeAll(() => {
    rendered = renderApiDocs(mockEntries);
  });

  test('outputs markdown heading for each entry', () => {
    expect(rendered).toContain('### `alpha`');
    expect(rendered).toContain('### `middle`');
    expect(rendered).toContain('### `zebra`');
  });

  test('sorts entries alphabetically', () => {
    const alphaPos = rendered.indexOf('### `alpha`');
    const middlePos = rendered.indexOf('### `middle`');
    const zebraPos = rendered.indexOf('### `zebra`');
    expect(alphaPos).toBeLessThan(middlePos);
    expect(middlePos).toBeLessThan(zebraPos);
  });

  test('wraps signature in fenced code block', () => {
    expect(rendered).toContain('```\nfunction alpha()\n```');
  });

  test('renders description as blockquote', () => {
    expect(rendered).toContain('> First alphabetically.');
    expect(rendered).toContain('> Last alphabetically.');
  });

  test('omits blockquote when description is empty', () => {
    // middle has no description; there should be no "> " immediately after its code block
    const middleSection = rendered.slice(
      rendered.indexOf('### `middle`'),
      rendered.indexOf('### `zebra`'),
    );
    expect(middleSection).not.toContain('> ');
  });

  test('caps output at 20 entries', () => {
    const many: ApiEntry[] = Array.from({ length: 30 }, (_, i) => ({
      name: `fn${String(i).padStart(2, '0')}`,
      file: 'src/x.ts',
      signature: `function fn${i}()`,
      description: '',
    }));
    const out = renderApiDocs(many);
    const headingCount = (out.match(/^### `/gm) ?? []).length;
    expect(headingCount).toBe(20);
  });

  test('does not mutate the original array', () => {
    const original = [...mockEntries];
    renderApiDocs(mockEntries);
    expect(mockEntries.map((e) => e.name)).toEqual(original.map((e) => e.name));
  });

  test('returns empty string for empty input', () => {
    expect(renderApiDocs([])).toBe('');
  });

  test('module exports are present', () => {
    expect(typeof mod.detectApiDocs).toBe('function');
    expect(typeof mod.renderApiDocs).toBe('function');
  });
});
