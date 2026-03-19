import { detectDocker } from './docker';
import * as fsPromises from 'fs/promises';
import * as fg from 'fast-glob';

jest.mock('fs/promises');
jest.mock('fast-glob');

const mockAccess = fsPromises.access as jest.MockedFunction<typeof fsPromises.access>;
const mockReadFile = fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>;

/** Helper: make access() resolve (file exists) for paths that include the given suffix. */
function accessExistsFor(...suffixes: string[]): void {
  mockAccess.mockImplementation((filePath) => {
    const p = String(filePath);
    return suffixes.some((s) => p.endsWith(s))
      ? Promise.resolve()
      : Promise.reject(new Error('ENOENT'));
  });
}

/** Helper: make readFile return content when the path ends with the given suffix. */
function readFileReturns(suffix: string, content: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockReadFile as jest.MockedFunction<any>).mockImplementation((filePath: unknown) => {
    const p = String(filePath);
    if (p.endsWith(suffix)) return Promise.resolve(content);
    return Promise.reject(new Error('ENOENT'));
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAccess.mockRejectedValue(new Error('ENOENT'));
  mockReadFile.mockRejectedValue(new Error('ENOENT'));
});

// ---------------------------------------------------------------------------
// No Docker files
// ---------------------------------------------------------------------------

describe('detectDocker — no Docker files', () => {
  it('returns hasDocker=false and empty string when nothing is found', async () => {
    const result = await detectDocker('/project');
    expect(result.hasDocker).toBe(false);
    expect(result.dockerSetup).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Dockerfile present
// ---------------------------------------------------------------------------

describe('detectDocker — Dockerfile exists', () => {
  it('returns hasDocker=true when Dockerfile exists', async () => {
    const dockerfile = 'FROM node:20-alpine\nEXPOSE 3000\nCMD ["node","index.js"]\n';
    accessExistsFor('Dockerfile');
    readFileReturns('Dockerfile', dockerfile);

    const result = await detectDocker('/project');
    expect(result.hasDocker).toBe(true);
  });

  it('includes the base image in the documentation', async () => {
    const dockerfile = 'FROM node:20-alpine\n';
    accessExistsFor('Dockerfile');
    readFileReturns('Dockerfile', dockerfile);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('node:20-alpine');
  });

  it('includes docker build command', async () => {
    const dockerfile = 'FROM python:3.12-slim\n';
    accessExistsFor('Dockerfile');
    readFileReturns('Dockerfile', dockerfile);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('docker build');
  });

  it('includes docker run with port mapping when EXPOSE is present', async () => {
    const dockerfile = 'FROM nginx:alpine\nEXPOSE 80\n';
    accessExistsFor('Dockerfile');
    readFileReturns('Dockerfile', dockerfile);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('-p 80:80');
  });

  it('handles multiple EXPOSE instructions', async () => {
    const dockerfile = 'FROM node:18\nEXPOSE 3000\nEXPOSE 9229\n';
    accessExistsFor('Dockerfile');
    readFileReturns('Dockerfile', dockerfile);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('3000');
    expect(result.dockerSetup).toContain('9229');
  });

  it('outputs docker run without port flags when no EXPOSE is declared', async () => {
    const dockerfile = 'FROM alpine:3.19\n';
    accessExistsFor('Dockerfile');
    readFileReturns('Dockerfile', dockerfile);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('docker run my-app');
    expect(result.dockerSetup).not.toContain('-p');
  });
});

// ---------------------------------------------------------------------------
// docker-compose present
// ---------------------------------------------------------------------------

describe('detectDocker — docker-compose.yml exists', () => {
  it('returns hasDocker=true when docker-compose.yml exists', async () => {
    const compose = `
version: '3'
services:
  web:
    image: nginx
  db:
    image: postgres
`;
    accessExistsFor('docker-compose.yml');
    readFileReturns('docker-compose.yml', compose);

    const result = await detectDocker('/project');
    expect(result.hasDocker).toBe(true);
  });

  it('lists detected services in the documentation', async () => {
    const compose = `
services:
  api:
    build: .
  redis:
    image: redis:7
`;
    accessExistsFor('docker-compose.yml');
    readFileReturns('docker-compose.yml', compose);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('api');
    expect(result.dockerSetup).toContain('redis');
  });

  it('includes docker-compose up command', async () => {
    const compose = 'services:\n  app:\n    build: .\n';
    accessExistsFor('docker-compose.yml');
    readFileReturns('docker-compose.yml', compose);

    const result = await detectDocker('/project');
    expect(result.dockerSetup).toContain('docker-compose up');
  });
});

// ---------------------------------------------------------------------------
// Both Dockerfile and docker-compose present
// ---------------------------------------------------------------------------

describe('detectDocker — Dockerfile and docker-compose both exist', () => {
  it('includes both sections in the documentation', async () => {
    const dockerfile = 'FROM node:20\nEXPOSE 4000\n';
    const compose = 'services:\n  app:\n    build: .\n';

    mockAccess.mockImplementation((filePath) => {
      const p = String(filePath);
      if (p.endsWith('Dockerfile') || p.endsWith('docker-compose.yml')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('ENOENT'));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockReadFile as jest.MockedFunction<any>).mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('Dockerfile')) return Promise.resolve(dockerfile);
      if (p.endsWith('docker-compose.yml')) return Promise.resolve(compose);
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await detectDocker('/project');
    expect(result.hasDocker).toBe(true);
    expect(result.dockerSetup).toContain('docker build');
    expect(result.dockerSetup).toContain('docker-compose up');
  });
});
