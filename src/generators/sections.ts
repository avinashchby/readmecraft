import { ProjectInfo } from '../types';

/** Maps a package manager to its dependency install command. */
function installCommand(info: ProjectInfo): string {
  switch (info.packageManager) {
    case 'npm':
      return 'npm install';
    case 'yarn':
      return 'yarn';
    case 'pnpm':
      return 'pnpm install';
    case 'bun':
      return 'bun install';
    case 'pip':
      return 'pip install -r requirements.txt';
    case 'uv':
      return 'uv sync';
    case 'poetry':
      return 'poetry install';
    case 'cargo':
      return 'cargo build';
    case 'go':
      return 'go mod download';
    default:
      return 'See project documentation for install instructions.';
  }
}

/**
 * Generates a Contributing section for the README.
 *
 * Covers the standard fork → branch → commit → PR workflow and includes
 * the project-specific install command.
 */
export function generateContributing(info: ProjectInfo): string {
  const install = installCommand(info);
  const projectName = info.name || 'this project';

  return [
    `Contributions to ${projectName} are welcome!`,
    '',
    '**Workflow:**',
    '',
    '1. Fork the repository',
    '2. Create a feature branch: `git checkout -b feat/my-feature`',
    '3. Install dependencies:',
    '',
    '   ```bash',
    `   ${install}`,
    '   ```',
    '',
    '4. Make your changes and add tests where applicable',
    '5. Commit using conventional commits: `git commit -m "feat: add my feature"`',
    '6. Push to your fork: `git push origin feat/my-feature`',
    '7. Open a Pull Request against the `main` branch',
    '',
    'Please ensure your code passes linting and all tests before submitting.',
  ].join('\n');
}

/**
 * Generates a License section for the README.
 *
 * References the LICENSE file in the repository and includes the license type
 * when known.
 */
export function generateLicense(info: ProjectInfo): string {
  if (info.license) {
    return [
      `This project is licensed under the **${info.license}** license.`,
      '',
      'See the [LICENSE](LICENSE) file for the full license text.',
    ].join('\n');
  }

  return [
    'See the [LICENSE](LICENSE) file for license details.',
  ].join('\n');
}
