import { ProjectInfo, Badge, ProjectType } from '../types';

/** Maps a projectType to its display label, color, and language name for the language badge. */
interface LanguageBadgeSpec {
  label: string;
  color: string;
}

const LANGUAGE_BADGE_MAP: Partial<Record<ProjectType, LanguageBadgeSpec>> = {
  node: { label: 'JavaScript%2FTypeScript', color: 'yellow' },
  python: { label: 'Python', color: 'blue' },
  rust: { label: 'Rust', color: 'orange' },
  go: { label: 'Go', color: 'cyan' },
};

/**
 * Extracts GitHub owner and repo from a repository URL.
 *
 * Handles both HTTPS (`https://github.com/owner/repo`) and
 * SSH (`git@github.com:owner/repo.git`) formats.
 * Returns null if the URL is not a recognisable GitHub URL.
 */
function extractGitHubOwnerRepo(repositoryUrl: string): { owner: string; repo: string } | null {
  // HTTPS format: https://github.com/owner/repo or https://github.com/owner/repo.git
  const httpsMatch = repositoryUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = repositoryUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

/**
 * Builds a shields.io static badge URL.
 * Encodes the value so that hyphens and spaces in version strings are safe.
 */
function staticBadgeUrl(label: string, value: string, color: string): string {
  const encodedValue = value.replace(/-/g, '--').replace(/\s/g, '_');
  return `https://img.shields.io/badge/${label}-${encodedValue}-${color}`;
}

/**
 * Generates an array of shields.io badges for the given project.
 *
 * Badges are produced in a stable order:
 *   language → license → version → npm → GitHub CI
 */
export function generateBadges(info: ProjectInfo): Badge[] {
  const badges: Badge[] = [];

  // Language badge — only for known project types.
  const langSpec = LANGUAGE_BADGE_MAP[info.projectType];
  if (langSpec) {
    badges.push({
      label: 'language',
      url: staticBadgeUrl('language', langSpec.label, langSpec.color),
    });
  }

  // License badge.
  if (info.license) {
    badges.push({
      label: 'license',
      url: `https://img.shields.io/badge/license-${encodeURIComponent(info.license)}-blue`,
    });
  }

  // Version badge.
  if (info.version) {
    badges.push({
      label: 'version',
      url: staticBadgeUrl('version', info.version, 'green'),
    });
  }

  // npm version badge — node projects with a package name.
  if (info.projectType === 'node' && info.name) {
    badges.push({
      label: 'npm',
      url: `https://img.shields.io/npm/v/${encodeURIComponent(info.name)}`,
    });
  }

  // GitHub Actions CI badge — any project whose repository lives on GitHub.
  if (info.repository) {
    const gh = extractGitHubOwnerRepo(info.repository);
    if (gh) {
      badges.push({
        label: 'build',
        url: `https://img.shields.io/github/actions/workflow/status/${gh.owner}/${gh.repo}/ci.yml`,
      });
    }
  }

  return badges;
}

/**
 * Renders a list of badges as a single line of Markdown image links.
 * Each badge becomes `[![{label}]({url})]({url})` and they are joined with spaces.
 */
export function renderBadges(badges: Badge[]): string {
  return badges
    .map((badge) => `[![${badge.label}](${badge.url})](${badge.url})`)
    .join(' ');
}
