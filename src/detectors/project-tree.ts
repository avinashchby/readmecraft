import fg from 'fast-glob';
import path from 'path';

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  'target',
  '.next',
  'coverage',
  '.venv',
  'venv',
  'vendor',
];

const MAX_DEPTH = 3;
const MAX_ITEMS = 15;
const SHOW_ITEMS = 10;

interface TreeNode {
  name: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
}

/** Create an empty tree node. */
function makeNode(name: string, isDir: boolean): TreeNode {
  return { name, isDir, children: new Map() };
}

/** Insert a file path (relative, split into parts) into the tree. */
function insertPath(root: TreeNode, parts: string[]): void {
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (!current.children.has(part)) {
      current.children.set(part, makeNode(part, !isLast));
    }
    const child = current.children.get(part)!;
    // A node becomes a dir if something is inserted beneath it
    if (!isLast) child.isDir = true;
    current = child;
  }
}

/** Sort children: directories first, then files, each group alphabetical. */
function sortedChildren(node: TreeNode): TreeNode[] {
  const dirs = [...node.children.values()].filter((n) => n.isDir).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const files = [...node.children.values()].filter((n) => !n.isDir).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return [...dirs, ...files];
}

/** Recursively render tree nodes as ASCII art lines. */
function renderNode(node: TreeNode, prefix: string, depth: number, lines: string[]): void {
  if (depth > MAX_DEPTH) return;

  const children = sortedChildren(node);
  const total = children.length;
  const visible = total > MAX_ITEMS ? children.slice(0, SHOW_ITEMS) : children;
  const hiddenCount = total - visible.length;

  visible.forEach((child, idx) => {
    const isLast = idx === visible.length - 1 && hiddenCount === 0;
    const connector = isLast ? '└── ' : '├── ';
    const label = child.isDir ? `${child.name}/` : child.name;
    lines.push(`${prefix}${connector}${label}`);
    if (child.isDir && depth < MAX_DEPTH) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      renderNode(child, childPrefix, depth + 1, lines);
    }
  });

  if (hiddenCount > 0) {
    lines.push(`${prefix}└── ... and ${hiddenCount} more`);
  }
}

/**
 * Generates an ASCII tree of the project directory up to 3 levels deep.
 * Excludes common non-source directories like node_modules and .git.
 */
export async function detectProjectTree(rootDir: string): Promise<string> {
  const excludePatterns = EXCLUDED_DIRS.map((d) => `**/${d}/**`);

  const files = await fg('**/*', {
    cwd: rootDir,
    ignore: excludePatterns,
    dot: true,
    onlyFiles: true,
    deep: MAX_DEPTH,
  });

  const rootName = path.basename(rootDir);
  const root = makeNode(rootName, true);

  for (const file of files) {
    const parts = file.split('/');
    insertPath(root, parts);
  }

  const lines: string[] = [`${rootName}/`];
  renderNode(root, '', 1, lines);
  return lines.join('\n');
}
