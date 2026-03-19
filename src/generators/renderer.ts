import { AnalysisResult, ReadmeStyle } from '../types';
import { renderBadges } from './badges';
import { renderTechStack } from '../detectors/tech-stack';
import { renderEnvVars } from '../detectors/env-vars';
import { renderScripts } from '../detectors/scripts';
import { renderApiDocs } from '../detectors/api-docs';

const FOOTER =
  '---\n\n<p align="center">Generated with ❤️ by <a href="https://github.com/readmecraft">readmecraft</a></p>';

/** Wrap section content with readmecraft HTML comment markers. */
function wrapSection(id: string, heading: string, body: string): string {
  return [
    `<!-- readmecraft:section:${id} -->`,
    heading,
    '',
    body,
    '',
    `<!-- readmecraft:end:${id} -->`,
  ].join('\n');
}

/** Build the title section: H1 heading followed by badges on the next line. */
function buildTitle(analysis: AnalysisResult): string {
  const { name } = analysis.projectInfo;
  const badgesLine = analysis.badges.length > 0 ? renderBadges(analysis.badges) : '';
  const body = badgesLine ? `${badgesLine}` : '_No badges configured._';
  return wrapSection('title', `# ${name}`, body);
}

/** Build the description section. */
function buildDescription(analysis: AnalysisResult): string {
  const desc = analysis.projectInfo.description || '_No description provided._';
  return wrapSection('description', '## Description', desc);
}

/** Build the table of contents with anchor links for all visible sections. */
function buildToc(analysis: AnalysisResult): string {
  const entries: Array<[string, string]> = [
    ['Description', '#description'],
    ['Tech Stack', '#tech-stack'],
    ['Installation', '#installation'],
    ['Usage', '#usage'],
  ];

  if (analysis.apiDocs.length > 0) {
    entries.push(['API Documentation', '#api-documentation']);
  }
  if (analysis.envVars.length > 0) {
    entries.push(['Environment Variables', '#environment-variables']);
  }
  if (analysis.scripts.length > 0) {
    entries.push(['Scripts', '#scripts']);
  }
  entries.push(['Project Structure', '#project-structure']);
  if (analysis.hasDocker) {
    entries.push(['Docker', '#docker']);
  }
  if (analysis.hasCiCd) {
    entries.push(['CI/CD', '#cicd']);
  }
  entries.push(['Contributing', '#contributing']);
  entries.push(['License', '#license']);

  const lines = entries.map(([label, anchor]) => `- [${label}](${anchor})`);
  return wrapSection('toc', '## Table of Contents', lines.join('\n'));
}

/** Build the tech stack section. */
function buildTechStack(analysis: AnalysisResult): string {
  const table = renderTechStack(analysis.techStack);
  const body = table || '_No tech stack detected._';
  return wrapSection('tech-stack', '## Tech Stack', body);
}

/** Build the installation section. */
function buildInstallation(analysis: AnalysisResult): string {
  const body = analysis.installation || '_See project documentation._';
  return wrapSection('installation', '## Installation', body);
}

/** Build the usage section. */
function buildUsage(analysis: AnalysisResult): string {
  const body = analysis.usage || '_See project documentation._';
  return wrapSection('usage', '## Usage', body);
}

/** Build the API documentation section (only when entries exist). */
function buildApiDocs(analysis: AnalysisResult): string {
  const body = renderApiDocs(analysis.apiDocs);
  return wrapSection('api-documentation', '## API Documentation', body);
}

/** Build the environment variables section. */
function buildEnvVars(analysis: AnalysisResult): string {
  const table = renderEnvVars(analysis.envVars);
  const body = table || '_No environment variables detected._';
  return wrapSection('environment-variables', '## Environment Variables', body);
}

/** Build the scripts/commands section. */
function buildScripts(analysis: AnalysisResult): string {
  const table = renderScripts(analysis.scripts);
  const body = table || '_No scripts detected._';
  return wrapSection('scripts', '## Scripts', body);
}

/** Build the project structure section. */
function buildProjectStructure(analysis: AnalysisResult): string {
  const tree = analysis.projectTree
    ? `\`\`\`\n${analysis.projectTree}\n\`\`\``
    : '_No project tree available._';
  return wrapSection('project-structure', '## Project Structure', tree);
}

/** Build the Docker section. */
function buildDocker(analysis: AnalysisResult): string {
  const body = analysis.dockerSetup || '_Docker configuration detected. See Dockerfile._';
  return wrapSection('docker', '## Docker', body);
}

/** Build the CI/CD section. */
function buildCiCd(analysis: AnalysisResult): string {
  const body = analysis.ciCdInfo || '_CI/CD configuration detected._';
  return wrapSection('cicd', '## CI/CD', body);
}

/** Build the contributing section. */
function buildContributing(analysis: AnalysisResult): string {
  const body =
    analysis.contributing ||
    'Contributions are welcome! Please open an issue or submit a pull request.';
  return wrapSection('contributing', '## Contributing', body);
}

/** Build the license section. */
function buildLicense(analysis: AnalysisResult): string {
  const body =
    analysis.licenseSection ||
    (analysis.projectInfo.license
      ? `This project is licensed under the **${analysis.projectInfo.license}** license.`
      : '_No license specified._');
  return wrapSection('license', '## License', body);
}

/**
 * Assemble a complete README.md string from an AnalysisResult.
 *
 * 'detailed' produces all sections; 'minimal' produces only the core set.
 */
export function renderReadme(analysis: AnalysisResult, style: ReadmeStyle): string {
  if (style === 'minimal') {
    const sections = [
      buildTitle(analysis),
      buildDescription(analysis),
      buildInstallation(analysis),
      buildUsage(analysis),
      buildLicense(analysis),
    ];
    return sections.join('\n\n') + '\n\n' + FOOTER + '\n';
  }

  // detailed
  const sections: string[] = [
    buildTitle(analysis),
    buildDescription(analysis),
    buildToc(analysis),
    buildTechStack(analysis),
    buildInstallation(analysis),
    buildUsage(analysis),
  ];

  if (analysis.apiDocs.length > 0) {
    sections.push(buildApiDocs(analysis));
  }

  if (analysis.envVars.length > 0) {
    sections.push(buildEnvVars(analysis));
  }

  if (analysis.scripts.length > 0) {
    sections.push(buildScripts(analysis));
  }

  sections.push(buildProjectStructure(analysis));

  if (analysis.hasDocker) {
    sections.push(buildDocker(analysis));
  }

  if (analysis.hasCiCd) {
    sections.push(buildCiCd(analysis));
  }

  sections.push(buildContributing(analysis));
  sections.push(buildLicense(analysis));

  return sections.join('\n\n') + '\n\n' + FOOTER + '\n';
}
