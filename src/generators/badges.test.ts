import { generateBadges, renderBadges } from './badges';
import { ProjectInfo, Badge } from '../types';

/** Returns a minimal valid ProjectInfo, overridden by the given partial. */
function makeInfo(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    name: '',
    description: '',
    version: '',
    license: '',
    author: '',
    repository: '',
    homepage: '',
    projectType: 'unknown',
    packageManager: 'npm',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateBadges
// ---------------------------------------------------------------------------

describe('generateBadges', () => {
  describe('node project', () => {
    it('generates a language badge for node', () => {
      const badges = generateBadges(makeInfo({ projectType: 'node', name: 'mylib' }));
      const lang = badges.find((b) => b.label === 'language');
      expect(lang).toBeDefined();
      expect(lang!.url).toContain('shields.io/badge/language');
      expect(lang!.url).toContain('JavaScript');
    });

    it('generates an npm badge when name is set', () => {
      const badges = generateBadges(makeInfo({ projectType: 'node', name: 'mylib' }));
      const npm = badges.find((b) => b.label === 'npm');
      expect(npm).toBeDefined();
      expect(npm!.url).toBe('https://img.shields.io/npm/v/mylib');
    });

    it('does not generate an npm badge when name is empty', () => {
      const badges = generateBadges(makeInfo({ projectType: 'node', name: '' }));
      const npm = badges.find((b) => b.label === 'npm');
      expect(npm).toBeUndefined();
    });
  });

  describe('python project', () => {
    it('generates a language badge for python', () => {
      const badges = generateBadges(makeInfo({ projectType: 'python' }));
      const lang = badges.find((b) => b.label === 'language');
      expect(lang).toBeDefined();
      expect(lang!.url).toContain('Python');
    });

    it('does not generate an npm badge for python', () => {
      const badges = generateBadges(makeInfo({ projectType: 'python', name: 'mypkg' }));
      const npm = badges.find((b) => b.label === 'npm');
      expect(npm).toBeUndefined();
    });
  });

  describe('license badge', () => {
    it('generates a license badge when license is set', () => {
      const badges = generateBadges(makeInfo({ license: 'MIT' }));
      const lic = badges.find((b) => b.label === 'license');
      expect(lic).toBeDefined();
      expect(lic!.url).toBe('https://img.shields.io/badge/license-MIT-blue');
    });

    it('does not generate a license badge when license is empty', () => {
      const badges = generateBadges(makeInfo({ license: '' }));
      const lic = badges.find((b) => b.label === 'license');
      expect(lic).toBeUndefined();
    });
  });

  describe('version badge', () => {
    it('generates a version badge when version is set', () => {
      const badges = generateBadges(makeInfo({ version: '1.2.3' }));
      const ver = badges.find((b) => b.label === 'version');
      expect(ver).toBeDefined();
      // hyphens in version strings must be doubled to avoid shields.io separator ambiguity
      expect(ver!.url).toContain('1.2.3');
    });

    it('does not generate a version badge when version is empty', () => {
      const badges = generateBadges(makeInfo({ version: '' }));
      const ver = badges.find((b) => b.label === 'version');
      expect(ver).toBeUndefined();
    });
  });

  describe('GitHub CI badge', () => {
    it('generates a build badge for a GitHub HTTPS repository URL', () => {
      const badges = generateBadges(
        makeInfo({ repository: 'https://github.com/acme/myrepo' }),
      );
      const build = badges.find((b) => b.label === 'build');
      expect(build).toBeDefined();
      expect(build!.url).toBe(
        'https://img.shields.io/github/actions/workflow/status/acme/myrepo/ci.yml',
      );
    });

    it('generates a build badge for a GitHub SSH repository URL', () => {
      const badges = generateBadges(
        makeInfo({ repository: 'git@github.com:acme/myrepo.git' }),
      );
      const build = badges.find((b) => b.label === 'build');
      expect(build).toBeDefined();
      expect(build!.url).toContain('acme/myrepo');
    });

    it('does not generate a build badge for non-GitHub URLs', () => {
      const badges = generateBadges(
        makeInfo({ repository: 'https://gitlab.com/acme/myrepo' }),
      );
      const build = badges.find((b) => b.label === 'build');
      expect(build).toBeUndefined();
    });
  });

  describe('unknown project with no info', () => {
    it('returns no badges', () => {
      const badges = generateBadges(makeInfo());
      expect(badges).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// renderBadges
// ---------------------------------------------------------------------------

describe('renderBadges', () => {
  it('returns an empty string for an empty badge list', () => {
    expect(renderBadges([])).toBe('');
  });

  it('renders a single badge as a Markdown image link', () => {
    const badge: Badge = { label: 'license', url: 'https://img.shields.io/badge/license-MIT-blue' };
    const result = renderBadges([badge]);
    expect(result).toBe(
      '[![license](https://img.shields.io/badge/license-MIT-blue)](https://img.shields.io/badge/license-MIT-blue)',
    );
  });

  it('renders multiple badges on one line separated by spaces', () => {
    const badges: Badge[] = [
      { label: 'language', url: 'https://img.shields.io/badge/language-Python-blue' },
      { label: 'license', url: 'https://img.shields.io/badge/license-MIT-blue' },
    ];
    const result = renderBadges(badges);
    // No newlines allowed.
    expect(result).not.toContain('\n');
    // Both badges present.
    expect(result).toContain('[![language]');
    expect(result).toContain('[![license]');
    // Separated by a single space.
    const parts = result.split(' ');
    expect(parts).toHaveLength(2);
  });

  it('produces correct markdown structure for each badge', () => {
    const badge: Badge = { label: 'npm', url: 'https://img.shields.io/npm/v/mylib' };
    const result = renderBadges([badge]);
    expect(result).toMatch(/^\[!\[npm\]\(https:\/\/img\.shields\.io\/npm\/v\/mylib\)\]\(https:\/\/img\.shields\.io\/npm\/v\/mylib\)$/);
  });
});
