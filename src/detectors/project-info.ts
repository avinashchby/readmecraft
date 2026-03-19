import { readFile } from 'fs/promises';
import path from 'path';
import type { ProjectInfo, ProjectType, PackageManager } from '../types';

/** Default ProjectInfo returned when no manifest is found. */
const DEFAULT_PROJECT_INFO: ProjectInfo = {
  name: '',
  description: '',
  version: '',
  license: '',
  author: '',
  repository: '',
  homepage: '',
  projectType: 'unknown',
  packageManager: 'npm',
};

/** Read a file relative to rootDir, returning null if not found. */
async function readManifest(rootDir: string, filename: string): Promise<string | null> {
  try {
    return await readFile(path.join(rootDir, filename), 'utf8');
  } catch {
    return null;
  }
}

/** Resolve author from package.json author field (string or object). */
function resolvePackageJsonAuthor(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj['name'] === 'string') parts.push(obj['name']);
    if (typeof obj['email'] === 'string') parts.push(`<${obj['email']}>`);
    return parts.join(' ');
  }
  return '';
}

/** Resolve repository from package.json repository field (string or object). */
function resolvePackageJsonRepository(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return typeof obj['url'] === 'string' ? obj['url'] : '';
  }
  return '';
}

/** Parse project info from package.json content. */
function parsePackageJson(content: string): Partial<ProjectInfo> {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }

  return {
    name: typeof pkg['name'] === 'string' ? pkg['name'] : '',
    description: typeof pkg['description'] === 'string' ? pkg['description'] : '',
    version: typeof pkg['version'] === 'string' ? pkg['version'] : '',
    license: typeof pkg['license'] === 'string' ? pkg['license'] : '',
    author: resolvePackageJsonAuthor(pkg['author']),
    repository: resolvePackageJsonRepository(pkg['repository']),
    homepage: typeof pkg['homepage'] === 'string' ? pkg['homepage'] : '',
    projectType: 'node',
  };
}

/**
 * Extract a value from a TOML file using simple regex.
 * Matches `key = "value"` or `key = 'value'` lines.
 * Only looks within the given section block.
 */
function extractTomlField(section: string, key: string): string {
  const pattern = new RegExp(`^${key}\\s*=\\s*["']([^"']*)["']`, 'm');
  const match = pattern.exec(section);
  return match ? match[1] : '';
}

/**
 * Extract an array field from TOML (e.g. authors = ["Alice <a@x.com>"]).
 * Returns the first element only for simplicity.
 */
function extractTomlArrayFirst(section: string, key: string): string {
  const pattern = new RegExp(`^${key}\\s*=\\s*\\[\\s*["']([^"']*)["']`, 'm');
  const match = pattern.exec(section);
  return match ? match[1] : '';
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

/** Parse project info from Cargo.toml content. */
function parseCargoToml(content: string): Partial<ProjectInfo> {
  const section = extractTomlSection(content, 'package');
  if (!section) return {};

  return {
    name: extractTomlField(section, 'name'),
    version: extractTomlField(section, 'version'),
    description: extractTomlField(section, 'description'),
    license: extractTomlField(section, 'license'),
    author: extractTomlArrayFirst(section, 'authors'),
    repository: extractTomlField(section, 'repository'),
    homepage: extractTomlField(section, 'homepage'),
    projectType: 'rust',
  };
}

/** Parse project info from pyproject.toml content. */
function parsePyprojectToml(content: string): Partial<ProjectInfo> {
  // Prefer [project] over [tool.poetry]
  const projectSection = extractTomlSection(content, 'project');
  const poetrySection = extractTomlSection(content, 'tool\\.poetry');
  const section = projectSection || poetrySection;
  if (!section) return {};

  // urls can live under [project.urls] or [tool.poetry.urls]
  const urlsSection =
    extractTomlSection(content, 'project\\.urls') ||
    extractTomlSection(content, 'tool\\.poetry\\.urls');

  const homepage =
    extractTomlField(urlsSection, 'homepage') ||
    extractTomlField(urlsSection, 'Homepage') ||
    extractTomlField(section, 'homepage');

  const repository =
    extractTomlField(urlsSection, 'repository') ||
    extractTomlField(urlsSection, 'Repository') ||
    extractTomlField(section, 'repository');

  return {
    name: extractTomlField(section, 'name'),
    version: extractTomlField(section, 'version'),
    description: extractTomlField(section, 'description'),
    license: extractTomlField(section, 'license'),
    author: extractTomlArrayFirst(section, 'authors'),
    repository,
    homepage,
    projectType: 'python',
  };
}

/** Parse module name from go.mod content. */
function parseGoMod(content: string): Partial<ProjectInfo> {
  const match = /^module\s+(\S+)/m.exec(content);
  if (!match) return { projectType: 'go' };

  const modulePath = match[1];
  // Use the last path segment as name (e.g. github.com/foo/bar → bar)
  const name = modulePath.split('/').pop() ?? modulePath;

  return {
    name,
    repository: modulePath,
    projectType: 'go',
  };
}

/** Detect package manager by checking for well-known lock files. */
async function detectPackageManager(rootDir: string): Promise<PackageManager | undefined> {
  const lockFiles: Array<[string, PackageManager]> = [
    ['package-lock.json', 'npm'],
    ['yarn.lock', 'yarn'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['bun.lockb', 'bun'],
    ['Pipfile.lock', 'pip'],
    ['uv.lock', 'uv'],
    ['poetry.lock', 'poetry'],
    ['Cargo.lock', 'cargo'],
    ['go.sum', 'go'],
  ];

  for (const [filename, manager] of lockFiles) {
    const found = await readManifest(rootDir, filename);
    if (found !== null) return manager;
  }

  return undefined;
}

/**
 * Detect project metadata by reading manifest files found in rootDir.
 *
 * Checks package.json, Cargo.toml, pyproject.toml, and go.mod in order,
 * stopping at the first hit. Lock files are then checked to determine the
 * package manager.
 */
export async function detectProjectInfo(rootDir: string): Promise<ProjectInfo> {
  const manifests: Array<[string, (content: string) => Partial<ProjectInfo>]> = [
    ['package.json', parsePackageJson],
    ['Cargo.toml', parseCargoToml],
    ['pyproject.toml', parsePyprojectToml],
    ['go.mod', parseGoMod],
  ];

  let detected: Partial<ProjectInfo> = {};

  for (const [filename, parser] of manifests) {
    const content = await readManifest(rootDir, filename);
    if (content !== null) {
      detected = parser(content);
      break;
    }
  }

  const packageManager = (await detectPackageManager(rootDir)) ??
    inferDefaultPackageManager(detected.projectType);

  return {
    ...DEFAULT_PROJECT_INFO,
    ...detected,
    packageManager,
  };
}

/** Choose a sensible default package manager given a project type. */
function inferDefaultPackageManager(projectType: ProjectType | undefined): PackageManager {
  switch (projectType) {
    case 'rust': return 'cargo';
    case 'go': return 'go';
    case 'python': return 'pip';
    default: return 'npm';
  }
}
