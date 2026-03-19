import { readFile, access } from 'fs/promises';
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

/** Builds the primary install command based on package manager and project name. */
function buildInstallCommand(info: ProjectInfo, isBinary: boolean): string {
  const { packageManager, name } = info;

  switch (packageManager) {
    case 'npm':
      return isBinary ? `npm install -g ${name}` : 'npm install';
    case 'yarn':
      return `yarn add ${name}`;
    case 'pnpm':
      return `pnpm add ${name}`;
    case 'bun':
      return `bun add ${name}`;
    case 'pip':
      return `pip install ${name}`;
    case 'uv':
      return `uv add ${name}`;
    case 'poetry':
      return `poetry add ${name}`;
    case 'cargo':
      return `cargo install ${name}`;
    case 'go':
      return `go install ${info.repository || name}@latest`;
    default:
      return 'See project documentation for installation instructions.';
  }
}

/** Builds the clone-and-install block for source-based installation. */
function buildCloneBlock(info: ProjectInfo, installCommand: string): string {
  const repoUrl = info.repository || `https://github.com/user/${info.name}`;
  const cloneTarget = info.name || 'project';

  return [
    '```bash',
    `git clone ${repoUrl}`,
    `cd ${cloneTarget}`,
    installCommand,
    '```',
  ].join('\n');
}

/** Builds a Cargo.toml dependency snippet for library crates. */
function buildCargoTomlSnippet(info: ProjectInfo): string {
  return [
    'Or add it as a dependency in your `Cargo.toml`:',
    '',
    '```toml',
    `[dependencies]`,
    `${info.name} = "${info.version || '*'}"`,
    '```',
  ].join('\n');
}

/**
 * Detects installation method for the project and generates markdown instructions.
 *
 * @param rootDir - Absolute path to the project root.
 * @param info    - Aggregated project metadata.
 * @returns Markdown string for the Installation section.
 */
export async function detectInstallation(rootDir: string, info: ProjectInfo): Promise<string> {
  const hasMakefile = await fileExists(path.join(rootDir, 'Makefile'));

  // Determine whether the Node project exposes a binary.
  let isBinary = false;
  if (info.projectType === 'node') {
    const pkgJson = await readJson(path.join(rootDir, 'package.json'));
    isBinary = pkgJson != null && 'bin' in pkgJson && pkgJson['bin'] != null;
  }

  // Cargo: distinguish binary crate from library crate.
  let isCargoLib = false;
  if (info.packageManager === 'cargo') {
    const cargoToml = await readJson(path.join(rootDir, 'Cargo.toml'));
    const hasSrcLib = await fileExists(path.join(rootDir, 'src', 'lib.rs'));
    const hasSrcMain = await fileExists(path.join(rootDir, 'src', 'main.rs'));
    // If there is a lib.rs and no explicit [[bin]], treat as library.
    const hasExplicitBin =
      cargoToml != null &&
      Array.isArray((cargoToml as Record<string, unknown>)['bin']);
    isCargoLib = hasSrcLib && !hasSrcMain && !hasExplicitBin;
  }

  const installCommand = buildInstallCommand(info, isBinary);
  const sections: string[] = [];

  // --- Direct install block ---
  if (info.packageManager === 'cargo' && isCargoLib) {
    sections.push(buildCargoTomlSnippet(info));
  } else {
    sections.push('```bash', installCommand, '```');
  }

  // --- Clone + install alternative ---
  sections.push('', '**Or clone and build from source:**', '');
  sections.push(buildCloneBlock(info, installCommand));

  // --- Makefile mention ---
  if (hasMakefile) {
    sections.push('', 'If you have `make` available, you can also run:', '', '```bash', 'make install', '```');
  }

  return sections.join('\n');
}
