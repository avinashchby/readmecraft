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

/** Extracts the base image from a Dockerfile (first FROM instruction). */
function extractBaseImage(dockerfile: string): string {
  const match = /^FROM\s+(\S+)/im.exec(dockerfile);
  return match ? match[1] : '';
}

/** Extracts all ports declared with EXPOSE in a Dockerfile. */
function extractExposedPorts(dockerfile: string): string[] {
  const ports: string[] = [];
  const pattern = /^EXPOSE\s+(.+)$/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(dockerfile)) !== null) {
    // A single EXPOSE line can list multiple ports separated by spaces.
    const linePorts = match[1].trim().split(/\s+/);
    ports.push(...linePorts);
  }
  return ports;
}

/** Generates the Dockerfile markdown section. */
function buildDockerfileSection(imageName: string, ports: string[]): string {
  const lines: string[] = ['### Docker'];
  lines.push('');

  if (imageName) {
    lines.push(`Base image: \`${imageName}\``);
    lines.push('');
  }

  lines.push('**Build the image:**', '');
  lines.push('```bash', 'docker build -t my-app .', '```', '');

  if (ports.length > 0) {
    const portFlags = ports.map((p) => `-p ${p}:${p}`).join(' ');
    lines.push('**Run the container:**', '');
    lines.push('```bash', `docker run ${portFlags} my-app`, '```');
  } else {
    lines.push('**Run the container:**', '');
    lines.push('```bash', 'docker run my-app', '```');
  }

  return lines.join('\n');
}

/** Extracts top-level service names from a docker-compose file (naive YAML parse). */
function extractComposeServices(content: string): string[] {
  // Find the `services:` block and collect direct child keys (service names).
  const servicesMatch = /^services:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m.exec(content);
  if (!servicesMatch) return [];

  const serviceBlock = servicesMatch[1];
  const services: string[] = [];
  const namePattern = /^[ \t]+(\w[\w-]*)\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(serviceBlock)) !== null) {
    services.push(match[1]);
  }
  return services;
}

/** Generates the docker-compose markdown section. */
function buildComposeSection(services: string[]): string {
  const lines: string[] = ['### Docker Compose'];
  lines.push('');

  if (services.length > 0) {
    lines.push(`Services: ${services.map((s) => `\`${s}\``).join(', ')}`);
    lines.push('');
  }

  lines.push('**Start all services:**', '');
  lines.push('```bash', 'docker-compose up', '```', '');
  lines.push('**Start in detached mode:**', '');
  lines.push('```bash', 'docker-compose up -d', '```', '');
  lines.push('**Stop all services:**', '');
  lines.push('```bash', 'docker-compose down', '```');

  return lines.join('\n');
}

/**
 * Detects Docker setup in a project directory and generates documentation.
 *
 * Checks for a Dockerfile and docker-compose variants. Returns hasDocker=true
 * when either is found, along with a markdown documentation string.
 */
export async function detectDocker(
  rootDir: string,
): Promise<{ hasDocker: boolean; dockerSetup: string }> {
  const composeFilenames = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ];

  const [dockerfileContent, ...composePaths] = await Promise.all([
    readFileSafe(path.join(rootDir, 'Dockerfile')),
    ...composeFilenames.map((f) => fileExists(path.join(rootDir, f)).then((exists) => (exists ? f : null))),
  ]);

  const composeFilename = (composePaths as Array<string | null>).find(Boolean) ?? null;
  const composeContent = composeFilename
    ? await readFileSafe(path.join(rootDir, composeFilename))
    : null;

  const hasDocker = dockerfileContent !== null || composeContent !== null;
  if (!hasDocker) {
    return { hasDocker: false, dockerSetup: '' };
  }

  const sections: string[] = [];

  if (dockerfileContent !== null) {
    const baseImage = extractBaseImage(dockerfileContent);
    const ports = extractExposedPorts(dockerfileContent);
    sections.push(buildDockerfileSection(baseImage, ports));
  }

  if (composeContent !== null) {
    const services = extractComposeServices(composeContent);
    sections.push(buildComposeSection(services));
  }

  return { hasDocker: true, dockerSetup: sections.join('\n\n') };
}

// Re-export for testability (fast-glob is referenced indirectly via the glob pattern path)
export { fg };
