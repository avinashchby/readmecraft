import { detectProjectInfo } from './project-info';
import type { ProjectInfo } from '../types';

// ---------------------------------------------------------------------------
// Filesystem mock
// ---------------------------------------------------------------------------

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

/** Build a readFile mock that serves a fixed file map; throws ENOENT otherwise. */
function mockFs(files: Record<string, string>): void {
  mockReadFile.mockImplementation(async (filePath: unknown) => {
    const p = filePath as string;
    for (const [name, content] of Object.entries(files)) {
      if (p.endsWith(name)) return content;
    }
    const err = Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    throw err;
  });
}

beforeEach(() => jest.resetAllMocks());

// ---------------------------------------------------------------------------
// Node.js — package.json
// ---------------------------------------------------------------------------

describe('Node.js project detection (package.json)', () => {
  const pkg = JSON.stringify({
    name: 'my-app',
    version: '1.2.3',
    description: 'A sample Node app',
    license: 'MIT',
    author: { name: 'Alice', email: 'alice@example.com' },
    repository: { type: 'git', url: 'https://github.com/alice/my-app' },
    homepage: 'https://my-app.dev',
  });

  test('extracts all fields from package.json', async () => {
    mockFs({ 'package.json': pkg, 'package-lock.json': '' });

    const info: ProjectInfo = await detectProjectInfo('/project');

    expect(info.name).toBe('my-app');
    expect(info.version).toBe('1.2.3');
    expect(info.description).toBe('A sample Node app');
    expect(info.license).toBe('MIT');
    expect(info.author).toBe('Alice <alice@example.com>');
    expect(info.repository).toBe('https://github.com/alice/my-app');
    expect(info.homepage).toBe('https://my-app.dev');
    expect(info.projectType).toBe('node');
  });

  test('handles string-form author and repository', async () => {
    mockFs({
      'package.json': JSON.stringify({
        name: 'pkg',
        author: 'Bob',
        repository: 'https://github.com/bob/pkg',
      }),
    });

    const info = await detectProjectInfo('/project');
    expect(info.author).toBe('Bob');
    expect(info.repository).toBe('https://github.com/bob/pkg');
  });

  test('detects npm from package-lock.json', async () => {
    mockFs({ 'package.json': pkg, 'package-lock.json': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('npm');
  });

  test('detects yarn from yarn.lock', async () => {
    mockFs({ 'package.json': pkg, 'yarn.lock': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('yarn');
  });

  test('detects pnpm from pnpm-lock.yaml', async () => {
    mockFs({ 'package.json': pkg, 'pnpm-lock.yaml': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('pnpm');
  });

  test('detects bun from bun.lockb', async () => {
    mockFs({ 'package.json': pkg, 'bun.lockb': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('bun');
  });
});

// ---------------------------------------------------------------------------
// Rust — Cargo.toml
// ---------------------------------------------------------------------------

describe('Rust project detection (Cargo.toml)', () => {
  const cargoToml = `
[package]
name = "my-crate"
version = "0.3.0"
description = "A sample Rust crate"
license = "Apache-2.0"
authors = ["Carol <carol@example.com>", "Dave"]
repository = "https://github.com/carol/my-crate"
homepage = "https://my-crate.rs"
`;

  test('extracts all fields from Cargo.toml', async () => {
    mockFs({ 'Cargo.toml': cargoToml, 'Cargo.lock': '' });

    const info = await detectProjectInfo('/project');

    expect(info.name).toBe('my-crate');
    expect(info.version).toBe('0.3.0');
    expect(info.description).toBe('A sample Rust crate');
    expect(info.license).toBe('Apache-2.0');
    expect(info.author).toBe('Carol <carol@example.com>');
    expect(info.repository).toBe('https://github.com/carol/my-crate');
    expect(info.homepage).toBe('https://my-crate.rs');
    expect(info.projectType).toBe('rust');
  });

  test('detects cargo from Cargo.lock', async () => {
    mockFs({ 'Cargo.toml': cargoToml, 'Cargo.lock': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('cargo');
  });

  test('falls back to cargo package manager when no lock file exists', async () => {
    mockFs({ 'Cargo.toml': cargoToml });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('cargo');
  });
});

// ---------------------------------------------------------------------------
// Python — pyproject.toml ([project] section)
// ---------------------------------------------------------------------------

describe('Python project detection (pyproject.toml — [project])', () => {
  const pyproject = `
[project]
name = "my-pkg"
version = "2.0.0"
description = "A Python package"
license = "GPL-3.0"
authors = ["Eve <eve@example.com>"]

[project.urls]
homepage = "https://my-pkg.io"
repository = "https://github.com/eve/my-pkg"
`;

  test('extracts all fields from [project] section', async () => {
    mockFs({ 'pyproject.toml': pyproject, 'uv.lock': '' });

    const info = await detectProjectInfo('/project');

    expect(info.name).toBe('my-pkg');
    expect(info.version).toBe('2.0.0');
    expect(info.description).toBe('A Python package');
    expect(info.license).toBe('GPL-3.0');
    expect(info.author).toBe('Eve <eve@example.com>');
    expect(info.homepage).toBe('https://my-pkg.io');
    expect(info.repository).toBe('https://github.com/eve/my-pkg');
    expect(info.projectType).toBe('python');
  });

  test('detects uv from uv.lock', async () => {
    mockFs({ 'pyproject.toml': pyproject, 'uv.lock': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('uv');
  });

  test('detects poetry from poetry.lock', async () => {
    mockFs({ 'pyproject.toml': pyproject, 'poetry.lock': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('poetry');
  });

  test('detects pip from Pipfile.lock', async () => {
    mockFs({ 'pyproject.toml': pyproject, 'Pipfile.lock': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('pip');
  });

  test('falls back to pip package manager when no lock file exists', async () => {
    mockFs({ 'pyproject.toml': pyproject });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('pip');
  });
});

// ---------------------------------------------------------------------------
// Python — pyproject.toml ([tool.poetry] section)
// ---------------------------------------------------------------------------

describe('Python project detection (pyproject.toml — [tool.poetry])', () => {
  const pyproject = `
[tool.poetry]
name = "poetry-pkg"
version = "1.0.0"
description = "Built with Poetry"
license = "MIT"
authors = ["Frank <frank@example.com>"]

[tool.poetry.urls]
Homepage = "https://poetry-pkg.dev"
Repository = "https://github.com/frank/poetry-pkg"
`;

  test('extracts fields from [tool.poetry] when [project] is absent', async () => {
    mockFs({ 'pyproject.toml': pyproject });

    const info = await detectProjectInfo('/project');

    expect(info.name).toBe('poetry-pkg');
    expect(info.version).toBe('1.0.0');
    expect(info.description).toBe('Built with Poetry');
    expect(info.license).toBe('MIT');
    expect(info.author).toBe('Frank <frank@example.com>');
    expect(info.homepage).toBe('https://poetry-pkg.dev');
    expect(info.repository).toBe('https://github.com/frank/poetry-pkg');
    expect(info.projectType).toBe('python');
  });
});

// ---------------------------------------------------------------------------
// Go — go.mod
// ---------------------------------------------------------------------------

describe('Go project detection (go.mod)', () => {
  const goMod = `module github.com/alice/awesome-tool

go 1.22
`;

  test('extracts module name and sets projectType to go', async () => {
    mockFs({ 'go.mod': goMod, 'go.sum': '' });

    const info = await detectProjectInfo('/project');

    expect(info.name).toBe('awesome-tool');
    expect(info.repository).toBe('github.com/alice/awesome-tool');
    expect(info.projectType).toBe('go');
  });

  test('detects go from go.sum', async () => {
    mockFs({ 'go.mod': goMod, 'go.sum': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('go');
  });

  test('falls back to go package manager when go.sum is absent', async () => {
    mockFs({ 'go.mod': goMod });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('go');
  });
});

// ---------------------------------------------------------------------------
// Fallback — no manifest found
// ---------------------------------------------------------------------------

describe('Fallback when no manifest is found', () => {
  test('returns default ProjectInfo with unknown type', async () => {
    mockFs({});

    const info = await detectProjectInfo('/project');

    expect(info.name).toBe('');
    expect(info.description).toBe('');
    expect(info.version).toBe('');
    expect(info.license).toBe('');
    expect(info.author).toBe('');
    expect(info.repository).toBe('');
    expect(info.homepage).toBe('');
    expect(info.projectType).toBe('unknown');
    expect(info.packageManager).toBe('npm');
  });
});

// ---------------------------------------------------------------------------
// Package manager detection priority
// ---------------------------------------------------------------------------

describe('Package manager detection priority', () => {
  const pkg = JSON.stringify({ name: 'app' });

  test('npm wins if package-lock.json is present alongside yarn.lock', async () => {
    // The lock-file list is checked in order: package-lock.json comes first.
    mockFs({ 'package.json': pkg, 'package-lock.json': '', 'yarn.lock': '' });
    const info = await detectProjectInfo('/project');
    expect(info.packageManager).toBe('npm');
  });
});
