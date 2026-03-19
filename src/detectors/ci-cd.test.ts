import { detectCiCd } from './ci-cd';
import * as fsPromises from 'fs/promises';
import fg from 'fast-glob';

jest.mock('fs/promises');
jest.mock('fast-glob');

const mockAccess = fsPromises.access as jest.MockedFunction<typeof fsPromises.access>;
const mockReadFile = fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>;
const mockFg = fg as jest.MockedFunction<typeof fg>;

/** Make access() succeed for paths ending with the given suffixes. */
function accessExistsFor(...suffixes: string[]): void {
  mockAccess.mockImplementation((filePath) => {
    const p = String(filePath);
    return suffixes.some((s) => p.endsWith(s))
      ? Promise.resolve()
      : Promise.reject(new Error('ENOENT'));
  });
}

/** Make readFile return content for paths ending with the given suffix. */
function readFileReturns(map: Record<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockReadFile as jest.MockedFunction<any>).mockImplementation((filePath: unknown) => {
    const p = String(filePath);
    for (const [suffix, content] of Object.entries(map)) {
      if (p.endsWith(suffix)) return Promise.resolve(content);
    }
    return Promise.reject(new Error('ENOENT'));
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAccess.mockRejectedValue(new Error('ENOENT'));
  mockReadFile.mockRejectedValue(new Error('ENOENT'));
  // Default: no workflow files found.
  mockFg.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// No CI/CD files
// ---------------------------------------------------------------------------

describe('detectCiCd — no CI/CD configuration', () => {
  it('returns hasCiCd=false and empty string when nothing is found', async () => {
    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(false);
    expect(result.ciCdInfo).toBe('');
  });
});

// ---------------------------------------------------------------------------
// GitHub Actions
// ---------------------------------------------------------------------------

describe('detectCiCd — GitHub Actions', () => {
  it('returns hasCiCd=true when workflow files are present', async () => {
    accessExistsFor('.github/workflows');
    mockFg.mockResolvedValue(['ci.yml']);
    readFileReturns({ 'ci.yml': 'name: CI\non: push\n' });

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
  });

  it('includes GitHub Actions in the output', async () => {
    accessExistsFor('.github/workflows');
    mockFg.mockResolvedValue(['ci.yml']);
    readFileReturns({ 'ci.yml': 'name: CI\non: push\n' });

    const result = await detectCiCd('/project');
    expect(result.ciCdInfo).toContain('GitHub Actions');
  });

  it('extracts the workflow name from the YAML file', async () => {
    accessExistsFor('.github/workflows');
    mockFg.mockResolvedValue(['release.yml']);
    readFileReturns({ 'release.yml': 'name: Release Pipeline\non: push\n' });

    const result = await detectCiCd('/project');
    expect(result.ciCdInfo).toContain('Release Pipeline');
  });

  it('lists multiple workflow files', async () => {
    accessExistsFor('.github/workflows');
    mockFg.mockResolvedValue(['ci.yml', 'deploy.yml']);
    readFileReturns({
      'ci.yml': 'name: CI\n',
      'deploy.yml': 'name: Deploy\n',
    });

    const result = await detectCiCd('/project');
    expect(result.ciCdInfo).toContain('ci.yml');
    expect(result.ciCdInfo).toContain('deploy.yml');
  });

  it('handles workflow files without a name field gracefully', async () => {
    accessExistsFor('.github/workflows');
    mockFg.mockResolvedValue(['unnamed.yml']);
    readFileReturns({ 'unnamed.yml': 'on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n' });

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
    expect(result.ciCdInfo).toContain('unnamed.yml');
  });

  it('returns hasCiCd=false when workflows directory exists but contains no yml files', async () => {
    accessExistsFor('.github/workflows');
    mockFg.mockResolvedValue([]);

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GitLab CI
// ---------------------------------------------------------------------------

describe('detectCiCd — GitLab CI', () => {
  it('detects .gitlab-ci.yml and returns hasCiCd=true', async () => {
    accessExistsFor('.gitlab-ci.yml');

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
    expect(result.ciCdInfo).toContain('GitLab CI');
  });
});

// ---------------------------------------------------------------------------
// CircleCI
// ---------------------------------------------------------------------------

describe('detectCiCd — CircleCI', () => {
  it('detects .circleci/config.yml and returns hasCiCd=true', async () => {
    accessExistsFor('.circleci/config.yml');

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
    expect(result.ciCdInfo).toContain('CircleCI');
  });
});

// ---------------------------------------------------------------------------
// Jenkins
// ---------------------------------------------------------------------------

describe('detectCiCd — Jenkins', () => {
  it('detects Jenkinsfile and returns hasCiCd=true', async () => {
    accessExistsFor('Jenkinsfile');

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
    expect(result.ciCdInfo).toContain('Jenkins');
  });
});

// ---------------------------------------------------------------------------
// Travis CI
// ---------------------------------------------------------------------------

describe('detectCiCd — Travis CI', () => {
  it('detects .travis.yml and returns hasCiCd=true', async () => {
    accessExistsFor('.travis.yml');

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
    expect(result.ciCdInfo).toContain('Travis CI');
  });
});

// ---------------------------------------------------------------------------
// Bitbucket Pipelines
// ---------------------------------------------------------------------------

describe('detectCiCd — Bitbucket Pipelines', () => {
  it('detects bitbucket-pipelines.yml and returns hasCiCd=true', async () => {
    accessExistsFor('bitbucket-pipelines.yml');

    const result = await detectCiCd('/project');
    expect(result.hasCiCd).toBe(true);
    expect(result.ciCdInfo).toContain('Bitbucket Pipelines');
  });
});

// ---------------------------------------------------------------------------
// Multiple CI/CD providers
// ---------------------------------------------------------------------------

describe('detectCiCd — multiple providers', () => {
  it('lists all detected providers', async () => {
    accessExistsFor('.github/workflows', '.travis.yml');
    mockFg.mockResolvedValue(['ci.yml']);
    readFileReturns({ 'ci.yml': 'name: CI\n' });

    const result = await detectCiCd('/project');
    expect(result.ciCdInfo).toContain('GitHub Actions');
    expect(result.ciCdInfo).toContain('Travis CI');
  });
});
