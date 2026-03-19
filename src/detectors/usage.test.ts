import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { detectUsage } from './usage';
import { ProjectInfo } from '../types';

/** Creates a minimal ProjectInfo with the given overrides. */
function makeInfo(overrides: Partial<ProjectInfo>): ProjectInfo {
  return {
    name: 'my-pkg',
    description: '',
    version: '1.0.0',
    license: 'MIT',
    author: '',
    repository: 'https://github.com/user/my-pkg',
    homepage: '',
    projectType: 'node',
    packageManager: 'npm',
    ...overrides,
  };
}

describe('detectUsage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'readmecraft-usage-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Node.js — bin field
  // -------------------------------------------------------------------------

  it('generates CLI usage when package.json has a string bin field', async () => {
    const pkgJson = {
      name: 'my-cli',
      version: '1.0.0',
      bin: 'dist/cli.js',
    };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const info = makeInfo({ name: 'my-cli' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('CLI Usage');
    expect(result).toContain('my-cli [options]');
  });

  it('generates CLI usage for each key when bin is an object', async () => {
    const pkgJson = {
      name: 'my-tool',
      version: '1.0.0',
      bin: { 'tool-a': 'dist/a.js', 'tool-b': 'dist/b.js' },
    };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const info = makeInfo({ name: 'my-tool' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('tool-a [options]');
    expect(result).toContain('tool-b [options]');
  });

  it('generates import usage when package.json has a main field', async () => {
    const pkgJson = {
      name: 'my-lib',
      version: '1.0.0',
      main: 'dist/index.js',
    };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const info = makeInfo({ name: 'my-lib' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('Library Usage');
    expect(result).toContain("require('my-lib')");
    expect(result).toContain("import my-lib from 'my-lib'");
  });

  it('extracts named exports from src/index.ts when present', async () => {
    const pkgJson = { name: 'my-lib', version: '1.0.0', main: 'dist/index.js' };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    await mkdir(path.join(tmpDir, 'src'));
    const indexSource = [
      'export function hello() {}',
      'export const VERSION = "1.0.0";',
      'export class MyClass {}',
    ].join('\n');
    await writeFile(path.join(tmpDir, 'src', 'index.ts'), indexSource);

    const info = makeInfo({ name: 'my-lib' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('hello');
    expect(result).toContain('VERSION');
    expect(result).toContain('MyClass');
  });

  it('returns empty string for an unknown project type', async () => {
    const info = makeInfo({ projectType: 'unknown', packageManager: 'npm' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toBe('');
  });

  // -------------------------------------------------------------------------
  // Node.js — no bin, no main → empty output
  // -------------------------------------------------------------------------

  it('returns empty string for a node project with no bin or main fields', async () => {
    const pkgJson = { name: 'my-pkg', version: '1.0.0' };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const result = await detectUsage(tmpDir, makeInfo({}));

    expect(result).toBe('');
  });

  // -------------------------------------------------------------------------
  // Python
  // -------------------------------------------------------------------------

  it('generates python -m usage when __main__.py exists', async () => {
    await writeFile(path.join(tmpDir, '__main__.py'), 'if __name__ == "__main__": pass\n');

    const info = makeInfo({ name: 'my-app', projectType: 'python', packageManager: 'pip' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('python -m my-app');
  });

  it('generates script usage from pyproject.toml [project.scripts]', async () => {
    const pyproject = [
      '[project]',
      'name = "my-app"',
      '',
      '[project.scripts]',
      'my-cli = "my_app.cli:main"',
      'my-other = "my_app.other:run"',
    ].join('\n');
    await writeFile(path.join(tmpDir, 'pyproject.toml'), pyproject);

    const info = makeInfo({ name: 'my-app', projectType: 'python', packageManager: 'poetry' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('my-cli [options]');
    expect(result).toContain('my-other [options]');
  });

  it('falls back to import snippet for a Python library with no entry points', async () => {
    const info = makeInfo({ name: 'my-lib', projectType: 'python', packageManager: 'pip' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('import my_lib');
  });

  // -------------------------------------------------------------------------
  // Rust
  // -------------------------------------------------------------------------

  it('generates CLI usage for a Rust binary (src/main.rs)', async () => {
    await mkdir(path.join(tmpDir, 'src'));
    await writeFile(path.join(tmpDir, 'src', 'main.rs'), 'fn main() {}');

    const info = makeInfo({ name: 'my-tool', projectType: 'rust', packageManager: 'cargo' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('my-tool [options]');
  });

  it('generates library usage for a Rust library (src/lib.rs)', async () => {
    await mkdir(path.join(tmpDir, 'src'));
    await writeFile(path.join(tmpDir, 'src', 'lib.rs'), 'pub fn hello() {}');

    const info = makeInfo({ name: 'my-lib', projectType: 'rust', packageManager: 'cargo' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('use my_lib::*');
  });

  // -------------------------------------------------------------------------
  // Go
  // -------------------------------------------------------------------------

  it('generates usage from cmd/ sub-directories for a Go project', async () => {
    const cmdDir = path.join(tmpDir, 'cmd');
    await mkdir(path.join(cmdDir, 'serve'), { recursive: true });
    await mkdir(path.join(cmdDir, 'migrate'), { recursive: true });

    const info = makeInfo({ name: 'my-svc', projectType: 'go', packageManager: 'go' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('serve [options]');
    expect(result).toContain('migrate [options]');
  });

  it('falls back to main.go usage for a simple Go binary', async () => {
    await writeFile(path.join(tmpDir, 'main.go'), 'package main\nfunc main() {}\n');

    const info = makeInfo({ name: 'my-svc', projectType: 'go', packageManager: 'go' });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('my-svc [options]');
  });

  it('generates library import for a Go package with no cmd/ or main.go', async () => {
    const info = makeInfo({
      name: 'my-lib',
      projectType: 'go',
      packageManager: 'go',
      repository: 'github.com/user/my-lib',
    });
    const result = await detectUsage(tmpDir, info);

    expect(result).toContain('import "github.com/user/my-lib"');
  });
});
