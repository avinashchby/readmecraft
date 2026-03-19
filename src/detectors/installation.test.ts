import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { detectInstallation } from './installation';
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

describe('detectInstallation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'readmecraft-install-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // npm
  // -------------------------------------------------------------------------

  it('generates npm install for a library project (no bin field)', async () => {
    const pkgJson = { name: 'my-pkg', version: '1.0.0' };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const result = await detectInstallation(tmpDir, makeInfo({ packageManager: 'npm' }));

    expect(result).toContain('npm install');
    // Must NOT use -g for a plain library.
    expect(result).not.toContain('npm install -g');
  });

  it('generates global npm install for a project with a bin field', async () => {
    const pkgJson = { name: 'my-cli', version: '1.0.0', bin: { 'my-cli': 'dist/cli.js' } };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const info = makeInfo({ name: 'my-cli', packageManager: 'npm' });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('npm install -g my-cli');
  });

  it('includes clone instructions with npm install', async () => {
    const pkgJson = { name: 'my-pkg', version: '1.0.0' };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const result = await detectInstallation(tmpDir, makeInfo({ packageManager: 'npm' }));

    expect(result).toContain('git clone');
    expect(result).toContain('cd my-pkg');
  });

  it('mentions make install when a Makefile is present', async () => {
    const pkgJson = { name: 'my-pkg', version: '1.0.0' };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));
    await writeFile(path.join(tmpDir, 'Makefile'), 'install:\n\tnpm install\n');

    const result = await detectInstallation(tmpDir, makeInfo({ packageManager: 'npm' }));

    expect(result).toContain('make install');
  });

  it('does NOT mention make install when no Makefile exists', async () => {
    const pkgJson = { name: 'my-pkg', version: '1.0.0' };
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson));

    const result = await detectInstallation(tmpDir, makeInfo({ packageManager: 'npm' }));

    expect(result).not.toContain('make install');
  });

  // -------------------------------------------------------------------------
  // cargo
  // -------------------------------------------------------------------------

  it('generates cargo install for a binary crate', async () => {
    await mkdir(path.join(tmpDir, 'src'));
    await writeFile(path.join(tmpDir, 'src', 'main.rs'), 'fn main() {}');

    const info = makeInfo({ name: 'my-tool', projectType: 'rust', packageManager: 'cargo' });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('cargo install my-tool');
  });

  it('generates Cargo.toml dependency snippet for a library crate', async () => {
    await mkdir(path.join(tmpDir, 'src'));
    await writeFile(path.join(tmpDir, 'src', 'lib.rs'), 'pub fn hello() {}');

    const info = makeInfo({ name: 'my-lib', version: '0.2.0', projectType: 'rust', packageManager: 'cargo' });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('[dependencies]');
    expect(result).toContain('my-lib');
    expect(result).toContain('0.2.0');
  });

  // -------------------------------------------------------------------------
  // pip
  // -------------------------------------------------------------------------

  it('generates pip install for a Python project', async () => {
    const info = makeInfo({ name: 'my-package', projectType: 'python', packageManager: 'pip' });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('pip install my-package');
    expect(result).toContain('git clone');
  });

  it('generates uv add for a uv-managed Python project', async () => {
    const info = makeInfo({ name: 'my-pkg', projectType: 'python', packageManager: 'uv' });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('uv add my-pkg');
  });

  it('generates poetry add for a poetry-managed Python project', async () => {
    const info = makeInfo({ name: 'my-pkg', projectType: 'python', packageManager: 'poetry' });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('poetry add my-pkg');
  });

  // -------------------------------------------------------------------------
  // go
  // -------------------------------------------------------------------------

  it('generates go install for a Go project', async () => {
    const info = makeInfo({
      name: 'my-tool',
      projectType: 'go',
      packageManager: 'go',
      repository: 'github.com/user/my-tool',
    });
    const result = await detectInstallation(tmpDir, info);

    expect(result).toContain('go install github.com/user/my-tool@latest');
  });
});
