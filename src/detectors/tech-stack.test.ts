import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectTechStack, renderTechStack } from './tech-stack';
import { TechStackEntry } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary directory for each test. */
async function makeTmpDir(): Promise<string> {
  const dir = join(tmpdir(), `readmecraft-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeJson(dir: string, name: string, data: unknown): Promise<void> {
  await writeFile(join(dir, name), JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// detectTechStack — package.json
// ---------------------------------------------------------------------------

describe('detectTechStack — package.json', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('detects TypeScript language when typescript is in devDependencies', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: { react: '^18.2.0' },
      devDependencies: { typescript: '^5.0.0' },
    });

    const entries = await detectTechStack(dir);
    const ts = entries.find((e) => e.technology === 'TypeScript');

    expect(ts).toBeDefined();
    expect(ts?.category).toBe('Language');
    expect(ts?.version).toBe('5.0.0');
  });

  test('detects React framework from dependencies', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: { react: '^18.2.0' },
      devDependencies: { typescript: '^5.0.0' },
    });

    const entries = await detectTechStack(dir);
    const react = entries.find((e) => e.technology === 'react');

    expect(react).toBeDefined();
    expect(react?.category).toBe('Framework');
    expect(react?.version).toBe('18.2.0');
  });

  test('detects React + TypeScript together and deduplicates', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: { react: '^18.2.0' },
      devDependencies: { typescript: '^5.0.0', jest: '^29.0.0' },
    });

    const entries = await detectTechStack(dir);
    const technologies = entries.map((e) => e.technology);

    // No duplicates.
    const unique = new Set(technologies.map((t) => t.toLowerCase()));
    expect(unique.size).toBe(technologies.length);

    expect(technologies).toContain('TypeScript');
    expect(technologies).toContain('react');
    expect(technologies).toContain('jest');
  });

  test('falls back to JavaScript when typescript is absent', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: { express: '^4.18.0' },
      devDependencies: {},
    });

    const entries = await detectTechStack(dir);
    const lang = entries.find((e) => e.category === 'Language');

    expect(lang?.technology).toBe('JavaScript');
    expect(lang?.version).toBeUndefined();
  });

  test('detects database packages', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: { prisma: '^5.0.0', pg: '^8.11.0' },
      devDependencies: {},
    });

    const entries = await detectTechStack(dir);
    const dbEntries = entries.filter((e) => e.category === 'Database');
    const names = dbEntries.map((e) => e.technology);

    expect(names).toContain('prisma');
    expect(names).toContain('pg');
  });

  test('detects build tools', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: {},
      devDependencies: { vite: '^5.0.0', esbuild: '^0.20.0' },
    });

    const entries = await detectTechStack(dir);
    const buildEntries = entries.filter((e) => e.category === 'Build');
    const names = buildEntries.map((e) => e.technology);

    expect(names).toContain('vite');
    expect(names).toContain('esbuild');
  });

  test('detects linting tools', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: {},
      devDependencies: { eslint: '^8.0.0', prettier: '^3.0.0' },
    });

    const entries = await detectTechStack(dir);
    const lintEntries = entries.filter((e) => e.category === 'Linting');
    const names = lintEntries.map((e) => e.technology);

    expect(names).toContain('eslint');
    expect(names).toContain('prettier');
  });

  test('returns empty array when package.json is absent', async () => {
    const entries = await detectTechStack(dir);
    expect(entries).toEqual([]);
  });

  test('returns empty array when package.json is malformed JSON', async () => {
    await writeFile(join(dir, 'package.json'), '{ not valid json', 'utf-8');
    const entries = await detectTechStack(dir);
    expect(entries).toEqual([]);
  });

  test('result is sorted by category then technology', async () => {
    await writeJson(dir, 'package.json', {
      dependencies: { react: '^18.0.0', jest: '^29.0.0', vite: '^5.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });

    const entries = await detectTechStack(dir);
    const categories = entries.map((e) => e.category);

    // Verify sorted order: Build < Framework < Language < Testing (alphabetical).
    for (let i = 1; i < categories.length; i++) {
      expect(categories[i].localeCompare(categories[i - 1])).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// detectTechStack — Cargo.toml
// ---------------------------------------------------------------------------

describe('detectTechStack — Cargo.toml', () => {
  let dir: string;

  beforeEach(async () => { dir = await makeTmpDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('detects tokio and actix-web from [dependencies]', async () => {
    const cargo = [
      '[package]',
      'name = "my-app"',
      '',
      '[dependencies]',
      'tokio = "1.37"',
      'actix-web = { version = "4.5", features = ["macros"] }',
    ].join('\n');
    await writeFile(join(dir, 'Cargo.toml'), cargo, 'utf-8');

    const entries = await detectTechStack(dir);
    const names = entries.map((e) => e.technology);

    expect(names).toContain('tokio');
    expect(names).toContain('actix-web');
    expect(entries.find((e) => e.technology === 'tokio')?.version).toBe('1.37');
    expect(entries.find((e) => e.technology === 'actix-web')?.version).toBe('4.5');
  });

  test('detects sqlx as Database', async () => {
    const cargo = ['[dependencies]', 'sqlx = "0.7"'].join('\n');
    await writeFile(join(dir, 'Cargo.toml'), cargo, 'utf-8');

    const entries = await detectTechStack(dir);
    const sqlx = entries.find((e) => e.technology === 'sqlx');

    expect(sqlx?.category).toBe('Database');
    expect(sqlx?.version).toBe('0.7');
  });
});

// ---------------------------------------------------------------------------
// detectTechStack — pyproject.toml
// ---------------------------------------------------------------------------

describe('detectTechStack — pyproject.toml', () => {
  let dir: string;

  beforeEach(async () => { dir = await makeTmpDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('detects fastapi from [project.dependencies]', async () => {
    const pyproject = [
      '[project]',
      'name = "my-api"',
      '',
      '[project.dependencies]',
      '"fastapi>=0.110.0"',
      '"pytest>=8.0.0"',
    ].join('\n');
    await writeFile(join(dir, 'pyproject.toml'), pyproject, 'utf-8');

    const entries = await detectTechStack(dir);
    const names = entries.map((e) => e.technology);

    expect(names).toContain('fastapi');
    expect(names).toContain('pytest');
    expect(entries.find((e) => e.technology === 'fastapi')?.category).toBe('Framework');
    expect(entries.find((e) => e.technology === 'pytest')?.category).toBe('Testing');
  });

  test('detects flask from [tool.poetry.dependencies]', async () => {
    const pyproject = [
      '[tool.poetry.dependencies]',
      'flask = ">=3.0.0"',
    ].join('\n');
    await writeFile(join(dir, 'pyproject.toml'), pyproject, 'utf-8');

    const entries = await detectTechStack(dir);
    const flask = entries.find((e) => e.technology === 'flask');

    expect(flask?.category).toBe('Framework');
  });
});

// ---------------------------------------------------------------------------
// detectTechStack — go.mod
// ---------------------------------------------------------------------------

describe('detectTechStack — go.mod', () => {
  let dir: string;

  beforeEach(async () => { dir = await makeTmpDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('detects gin-gonic/gin from require block', async () => {
    const gomod = [
      'module example.com/myapp',
      '',
      'go 1.22',
      '',
      'require (',
      '\tgithub.com/gin-gonic/gin v1.9.1',
      '\tgorm.io/gorm v1.25.0',
      ')',
    ].join('\n');
    await writeFile(join(dir, 'go.mod'), gomod, 'utf-8');

    const entries = await detectTechStack(dir);
    const names = entries.map((e) => e.technology);

    expect(names).toContain('github.com/gin-gonic/gin');
    expect(names).toContain('gorm.io/gorm');
    expect(entries.find((e) => e.technology === 'github.com/gin-gonic/gin')?.version).toBe('1.9.1');
  });
});

// ---------------------------------------------------------------------------
// renderTechStack
// ---------------------------------------------------------------------------

describe('renderTechStack', () => {
  test('renders correct markdown table header and separator', () => {
    const entries: TechStackEntry[] = [
      { category: 'Language', technology: 'TypeScript', version: '5.0.0' },
    ];
    const output = renderTechStack(entries);
    const lines = output.split('\n');

    expect(lines[0]).toBe('| Category | Technology | Version |');
    expect(lines[1]).toBe('|----------|-----------|---------|');
  });

  test('renders a row with version', () => {
    const entries: TechStackEntry[] = [
      { category: 'Framework', technology: 'react', version: '18.2.0' },
    ];
    const output = renderTechStack(entries);

    expect(output).toContain('| Framework | react | 18.2.0 |');
  });

  test('renders a row without version using em dash', () => {
    const entries: TechStackEntry[] = [
      { category: 'Language', technology: 'JavaScript' },
    ];
    const output = renderTechStack(entries);

    expect(output).toContain('| Language | JavaScript | — |');
  });

  test('renders React + TypeScript table correctly', () => {
    const entries: TechStackEntry[] = [
      { category: 'Framework', technology: 'react', version: '18.2.0' },
      { category: 'Language', technology: 'TypeScript', version: '5.0.0' },
      { category: 'Testing', technology: 'jest', version: '29.0.0' },
    ];
    const output = renderTechStack(entries);
    const lines = output.split('\n');

    // Header + separator + 3 rows = 5 lines.
    expect(lines).toHaveLength(5);
    expect(lines[2]).toBe('| Framework | react | 18.2.0 |');
    expect(lines[3]).toBe('| Language | TypeScript | 5.0.0 |');
    expect(lines[4]).toBe('| Testing | jest | 29.0.0 |');
  });

  test('returns empty string for empty entries', () => {
    expect(renderTechStack([])).toBe('');
  });

  test('integration: detectTechStack output renders a valid table', async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          dependencies: { react: '^18.2.0' },
          devDependencies: { typescript: '^5.0.0', jest: '^29.0.0' },
        }),
        'utf-8',
      );

      const entries = await detectTechStack(dir);
      const table = renderTechStack(entries);
      const lines = table.split('\n');

      // Must have header + separator + at least 3 entries.
      expect(lines.length).toBeGreaterThanOrEqual(5);
      expect(lines[0]).toBe('| Category | Technology | Version |');
      expect(lines[1]).toBe('|----------|-----------|---------|');
      // Every data row must match the column pattern.
      for (const row of lines.slice(2)) {
        expect(row).toMatch(/^\| .+ \| .+ \| .+ \|$/);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
