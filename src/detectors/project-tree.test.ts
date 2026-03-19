import os from 'os';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { detectProjectTree } from './project-tree';

/** Create a minimal temp directory tree for integration tests. */
async function makeFixture(structure: Record<string, string>): Promise<string> {
  const root = path.join(os.tmpdir(), `readmecraft-tree-${Date.now()}`);
  for (const [rel, content] of Object.entries(structure)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return root;
}

describe('detectProjectTree', () => {
  it('renders the root directory name with trailing slash on the first line', async () => {
    const root = await makeFixture({ 'index.ts': '' });
    const tree = await detectProjectTree(root);
    const firstLine = tree.split('\n')[0];
    expect(firstLine).toBe(`${path.basename(root)}/`);
  });

  it('lists files at the top level', async () => {
    const root = await makeFixture({
      'package.json': '',
      'tsconfig.json': '',
    });
    const tree = await detectProjectTree(root);
    expect(tree).toContain('package.json');
    expect(tree).toContain('tsconfig.json');
  });

  it('lists nested files under their parent directory', async () => {
    const root = await makeFixture({ 'src/index.ts': '', 'src/cli.ts': '' });
    const tree = await detectProjectTree(root);
    expect(tree).toContain('src/');
    expect(tree).toContain('index.ts');
    expect(tree).toContain('cli.ts');
  });

  it('uses ├── for non-last entries and └── for the last entry', async () => {
    const root = await makeFixture({ 'a.ts': '', 'b.ts': '' });
    const tree = await detectProjectTree(root);
    expect(tree).toContain('├──');
    expect(tree).toContain('└──');
  });

  it('shows overflow message when a directory has more than 15 items', async () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 18; i++) files[`file${i}.ts`] = '';
    const root = await makeFixture(files);
    const tree = await detectProjectTree(root);
    expect(tree).toMatch(/\.\.\. and \d+ more/);
  });
});
