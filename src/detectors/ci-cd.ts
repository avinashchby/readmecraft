import { readFile, access } from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';

/** Checks whether a file exists at the given absolute path. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Reads a file, returning null on any error. */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/** Extracts the `name:` field from a GitHub Actions workflow YAML (first occurrence). */
function extractWorkflowName(content: string): string {
  const match = /^name:\s*['"]?(.+?)['"]?\s*$/m.exec(content);
  return match ? match[1].trim() : '';
}

/** Detected CI/CD provider entry. */
interface CiEntry {
  provider: string;
  detail: string;
}

/**
 * Scans for GitHub Actions workflow files and returns one entry per file,
 * including the workflow name when available.
 */
async function detectGitHubActions(rootDir: string): Promise<CiEntry[]> {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  const dirExists = await fileExists(workflowDir);
  if (!dirExists) return [];

  const files = await fg(['*.yml', '*.yaml'], {
    cwd: workflowDir,
    absolute: false,
    onlyFiles: true,
  });

  if (files.length === 0) return [];

  const entries: CiEntry[] = await Promise.all(
    files.map(async (filename) => {
      const content = await readFileSafe(path.join(workflowDir, filename));
      const workflowName = content ? extractWorkflowName(content) : '';
      const detail = workflowName ? `${filename} — ${workflowName}` : filename;
      return { provider: 'GitHub Actions', detail };
    }),
  );

  return entries;
}

/** Checks for a single-file CI provider and returns an entry if found. */
async function detectSingleFile(
  rootDir: string,
  filename: string,
  provider: string,
): Promise<CiEntry | null> {
  const exists = await fileExists(path.join(rootDir, filename));
  if (!exists) return null;
  return { provider, detail: filename };
}

/** Generates the CI/CD documentation markdown section. */
function buildCiCdSection(entries: CiEntry[]): string {
  const lines: string[] = ['### CI/CD'];
  lines.push('');

  // Group entries by provider.
  const byProvider = new Map<string, string[]>();
  for (const entry of entries) {
    const existing = byProvider.get(entry.provider) ?? [];
    existing.push(entry.detail);
    byProvider.set(entry.provider, existing);
  }

  for (const [provider, details] of byProvider) {
    lines.push(`**${provider}**`);
    for (const detail of details) {
      lines.push(`- ${detail}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Detects CI/CD configuration in a project directory and generates documentation.
 *
 * Checks for GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis CI, and
 * Bitbucket Pipelines. Returns hasCiCd=true with a markdown summary when any
 * configuration is found.
 */
export async function detectCiCd(
  rootDir: string,
): Promise<{ hasCiCd: boolean; ciCdInfo: string }> {
  const [githubEntries, gitlab, circleci, jenkins, travis, bitbucket] = await Promise.all([
    detectGitHubActions(rootDir),
    detectSingleFile(rootDir, '.gitlab-ci.yml', 'GitLab CI'),
    detectSingleFile(rootDir, '.circleci/config.yml', 'CircleCI'),
    detectSingleFile(rootDir, 'Jenkinsfile', 'Jenkins'),
    detectSingleFile(rootDir, '.travis.yml', 'Travis CI'),
    detectSingleFile(rootDir, 'bitbucket-pipelines.yml', 'Bitbucket Pipelines'),
  ]);

  const allEntries: CiEntry[] = [
    ...githubEntries,
    ...[gitlab, circleci, jenkins, travis, bitbucket].filter(
      (e): e is CiEntry => e !== null,
    ),
  ];

  if (allEntries.length === 0) {
    return { hasCiCd: false, ciCdInfo: '' };
  }

  return { hasCiCd: true, ciCdInfo: buildCiCdSection(allEntries) };
}
