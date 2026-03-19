import { readFile } from 'fs/promises';
import { join } from 'path';
import { TechStackEntry } from '../types';

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

type CategoryMap = Record<string, string>;

const NPM_FRAMEWORK: CategoryMap = {
  react: 'Framework',
  vue: 'Framework',
  angular: 'Framework',
  next: 'Framework',
  nuxt: 'Framework',
  express: 'Framework',
  fastify: 'Framework',
  koa: 'Framework',
  nest: 'Framework',
  '@nestjs/core': 'Framework',
};

const NPM_DATABASE: CategoryMap = {
  prisma: 'Database',
  '@prisma/client': 'Database',
  typeorm: 'Database',
  sequelize: 'Database',
  mongoose: 'Database',
  pg: 'Database',
  mysql2: 'Database',
  sqlite3: 'Database',
  redis: 'Database',
  ioredis: 'Database',
};

const NPM_TESTING: CategoryMap = {
  jest: 'Testing',
  mocha: 'Testing',
  vitest: 'Testing',
};

const NPM_BUILD: CategoryMap = {
  webpack: 'Build',
  vite: 'Build',
  esbuild: 'Build',
  rollup: 'Build',
  turbo: 'Build',
  nx: 'Build',
};

const NPM_LINTING: CategoryMap = {
  eslint: 'Linting',
  prettier: 'Linting',
  biome: 'Linting',
};

/** All npm-based lookup maps in priority order. */
const NPM_MAPS: CategoryMap[] = [
  NPM_FRAMEWORK,
  NPM_DATABASE,
  NPM_TESTING,
  NPM_BUILD,
  NPM_LINTING,
];

const CARGO_CRATES: CategoryMap = {
  tokio: 'Framework',
  'actix-web': 'Framework',
  rocket: 'Framework',
  serde: 'Build',
  diesel: 'Database',
  sqlx: 'Database',
};

const PYTHON_PACKAGES: CategoryMap = {
  django: 'Framework',
  flask: 'Framework',
  fastapi: 'Framework',
  pytest: 'Testing',
  ruff: 'Linting',
  sqlalchemy: 'Database',
};

const GO_MODULES: CategoryMap = {
  'github.com/gin-gonic/gin': 'Framework',
  'github.com/labstack/echo': 'Framework',
  'github.com/gofiber/fiber': 'Framework',
  'gorm.io/gorm': 'Database',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a file as UTF-8 text; return null if it does not exist. */
async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Strip a semver range prefix (^, ~, >=, etc.) to get the bare version. */
function stripRange(version: string): string {
  return version.replace(/^[^0-9]*/, '').trim() || version;
}

/** Look up a package name across all category maps. Returns entry or null. */
function lookupNpm(
  name: string,
  maps: CategoryMap[],
  version: string,
): TechStackEntry | null {
  for (const map of maps) {
    if (Object.prototype.hasOwnProperty.call(map, name)) {
      return {
        category: map[name],
        technology: name,
        version: stripRange(version),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-ecosystem parsers
// ---------------------------------------------------------------------------

/** Parse package.json and return tech stack entries. */
async function fromPackageJson(rootDir: string): Promise<TechStackEntry[]> {
  const raw = await tryReadFile(join(rootDir, 'package.json'));
  if (!raw) return [];

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps = (pkg['dependencies'] ?? {}) as Record<string, string>;
  const devDeps = (pkg['devDependencies'] ?? {}) as Record<string, string>;
  const allDeps = { ...deps, ...devDeps };

  const entries: TechStackEntry[] = [];
  const seen = new Set<string>();

  // Language detection: TypeScript in devDeps signals TS project.
  if (Object.prototype.hasOwnProperty.call(devDeps, 'typescript')) {
    entries.push({
      category: 'Language',
      technology: 'TypeScript',
      version: stripRange(devDeps['typescript']),
    });
    seen.add('typescript');
  } else {
    entries.push({ category: 'Language', technology: 'JavaScript' });
  }

  for (const [name, version] of Object.entries(allDeps)) {
    if (seen.has(name)) continue;
    const entry = lookupNpm(name, NPM_MAPS, version);
    if (entry) {
      entries.push(entry);
      seen.add(name);
    }
  }

  return entries;
}

/**
 * Parse Cargo.toml [dependencies] section.
 * Uses a simple line-by-line parser — no external TOML library needed.
 */
async function fromCargoToml(rootDir: string): Promise<TechStackEntry[]> {
  const raw = await tryReadFile(join(rootDir, 'Cargo.toml'));
  if (!raw) return [];

  const entries: TechStackEntry[] = [];
  let inDeps = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[')) {
      inDeps = trimmed === '[dependencies]';
      continue;
    }

    if (!inDeps || trimmed === '' || trimmed.startsWith('#')) continue;

    // Handles: tokio = "1.0" | tokio = { version = "1.0", features = [...] }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const name = trimmed.slice(0, eqIdx).trim();
    if (!Object.prototype.hasOwnProperty.call(CARGO_CRATES, name)) continue;

    // Extract version string if present.
    const rest = trimmed.slice(eqIdx + 1).trim();
    const versionMatch = rest.match(/"([^"]+)"/);
    const version = versionMatch ? versionMatch[1] : undefined;

    entries.push({ category: CARGO_CRATES[name], technology: name, version });
  }

  return entries;
}

/**
 * Parse pyproject.toml for [project.dependencies] and
 * [tool.poetry.dependencies].
 */
async function fromPyprojectToml(rootDir: string): Promise<TechStackEntry[]> {
  const raw = await tryReadFile(join(rootDir, 'pyproject.toml'));
  if (!raw) return [];

  const entries: TechStackEntry[] = [];
  let inDeps = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[')) {
      inDeps =
        trimmed === '[project.dependencies]' ||
        trimmed === '[tool.poetry.dependencies]';
      continue;
    }

    if (!inDeps || trimmed === '' || trimmed.startsWith('#')) continue;

    // Array-style: "django>=4.0" — common in [project.dependencies]
    const arrayItem = trimmed.replace(/^"/, '').replace(/",$/, '').trim();
    const arrayMatch = arrayItem.match(/^([A-Za-z0-9_-]+)/);
    if (arrayMatch) {
      const name = arrayMatch[1].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(PYTHON_PACKAGES, name)) {
        const versionMatch = arrayItem.match(/[>=<^~]+\s*([0-9][^\s,"]*)/);
        entries.push({
          category: PYTHON_PACKAGES[name],
          technology: name,
          version: versionMatch ? versionMatch[1] : undefined,
        });
        continue;
      }
    }

    // Key-value style: django = ">=4.0" — common in [tool.poetry.dependencies]
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const name = trimmed.slice(0, eqIdx).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PYTHON_PACKAGES, name)) continue;

    const rest = trimmed.slice(eqIdx + 1).trim();
    const versionMatch = rest.match(/"([^"]+)"/);
    entries.push({
      category: PYTHON_PACKAGES[name],
      technology: name,
      version: versionMatch ? versionMatch[1] : undefined,
    });
  }

  return entries;
}

/** Parse go.mod require block for known modules. */
async function fromGoMod(rootDir: string): Promise<TechStackEntry[]> {
  const raw = await tryReadFile(join(rootDir, 'go.mod'));
  if (!raw) return [];

  const entries: TechStackEntry[] = [];
  let inRequire = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('require (')) {
      inRequire = true;
      continue;
    }
    if (trimmed === ')') {
      inRequire = false;
      continue;
    }
    // Single-line require: require github.com/gin-gonic/gin v1.9.0
    if (trimmed.startsWith('require ')) {
      const parts = trimmed.slice('require '.length).trim().split(/\s+/);
      const [mod, ver] = parts;
      if (mod && Object.prototype.hasOwnProperty.call(GO_MODULES, mod)) {
        entries.push({
          category: GO_MODULES[mod],
          technology: mod,
          version: ver?.replace(/^v/, ''),
        });
      }
      continue;
    }

    if (!inRequire) continue;

    const parts = trimmed.split(/\s+/);
    const [mod, ver] = parts;
    if (!mod || mod.startsWith('//')) continue;
    if (Object.prototype.hasOwnProperty.call(GO_MODULES, mod)) {
      entries.push({
        category: GO_MODULES[mod],
        technology: mod,
        version: ver?.replace(/^v/, ''),
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the tech stack for the project rooted at `rootDir`.
 * Inspects package.json, Cargo.toml, pyproject.toml, and go.mod.
 * Returns deduplicated entries sorted by category then technology.
 */
export async function detectTechStack(
  rootDir: string,
): Promise<TechStackEntry[]> {
  const [npmEntries, cargoEntries, pyEntries, goEntries] = await Promise.all([
    fromPackageJson(rootDir),
    fromCargoToml(rootDir),
    fromPyprojectToml(rootDir),
    fromGoMod(rootDir),
  ]);

  const all = [...npmEntries, ...cargoEntries, ...pyEntries, ...goEntries];

  // Deduplicate by technology name (first occurrence wins).
  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    const key = e.technology.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Stable sort: category ascending, technology ascending.
  deduped.sort((a, b) => {
    const cat = a.category.localeCompare(b.category);
    return cat !== 0 ? cat : a.technology.localeCompare(b.technology);
  });

  return deduped;
}

/**
 * Render a list of tech stack entries as a Markdown table.
 *
 * | Category | Technology | Version |
 * |----------|-----------|---------|
 */
export function renderTechStack(entries: TechStackEntry[]): string {
  if (entries.length === 0) return '';

  const header = '| Category | Technology | Version |';
  const separator = '|----------|-----------|---------|';
  const rows = entries.map(
    (e) => `| ${e.category} | ${e.technology} | ${e.version ?? '—'} |`,
  );

  return [header, separator, ...rows].join('\n');
}
