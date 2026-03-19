import { renderReadme } from './renderer';
import { AnalysisResult } from '../types';

/** Minimal mock that satisfies every field of AnalysisResult. */
const BASE_ANALYSIS: AnalysisResult = {
  projectInfo: {
    name: 'my-project',
    description: 'A test project',
    version: '1.0.0',
    license: 'MIT',
    author: 'Alice',
    repository: 'https://github.com/alice/my-project',
    homepage: '',
    projectType: 'node',
    packageManager: 'npm',
  },
  badges: [
    { label: 'version', url: 'https://img.shields.io/badge/version-1.0.0-green' },
  ],
  techStack: [
    { category: 'Language', technology: 'TypeScript', version: '5.0.0' },
  ],
  installation: '```bash\nnpm install\n```',
  usage: '```bash\nnpm start\n```',
  apiDocs: [],
  projectTree: 'my-project/\n└── src/',
  envVars: [],
  scripts: [],
  hasDocker: false,
  dockerSetup: '',
  hasCiCd: false,
  ciCdInfo: '',
  contributing: 'Open a pull request.',
  licenseSection: 'MIT License.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasSection(output: string, id: string): boolean {
  return (
    output.includes(`<!-- readmecraft:section:${id} -->`) &&
    output.includes(`<!-- readmecraft:end:${id} -->`)
  );
}

function getSectionContent(output: string, id: string): string {
  const start = `<!-- readmecraft:section:${id} -->`;
  const end = `<!-- readmecraft:end:${id} -->`;
  const startIdx = output.indexOf(start);
  const endIdx = output.indexOf(end);
  if (startIdx === -1 || endIdx === -1) return '';
  return output.slice(startIdx + start.length, endIdx);
}

// ---------------------------------------------------------------------------
// detailed style
// ---------------------------------------------------------------------------

describe('renderReadme — detailed style', () => {
  let output: string;

  beforeAll(() => {
    output = renderReadme(BASE_ANALYSIS, 'detailed');
  });

  it('includes H1 title with project name', () => {
    expect(output).toContain('# my-project');
  });

  it('renders badge inside title section', () => {
    const titleContent = getSectionContent(output, 'title');
    expect(titleContent).toContain('version');
    expect(titleContent).toContain('img.shields.io');
  });

  it('includes all required section markers', () => {
    const requiredSections = [
      'title',
      'description',
      'toc',
      'tech-stack',
      'installation',
      'usage',
      'project-structure',
      'contributing',
      'license',
    ];
    for (const id of requiredSections) {
      expect(hasSection(output, id)).toBe(true);
    }
  });

  it('description section contains project description', () => {
    expect(getSectionContent(output, 'description')).toContain('A test project');
  });

  it('tech-stack section contains TypeScript', () => {
    expect(getSectionContent(output, 'tech-stack')).toContain('TypeScript');
  });

  it('installation section contains provided installation text', () => {
    expect(getSectionContent(output, 'installation')).toContain('npm install');
  });

  it('usage section contains provided usage text', () => {
    expect(getSectionContent(output, 'usage')).toContain('npm start');
  });

  it('does NOT include api-documentation section when apiDocs is empty', () => {
    expect(hasSection(output, 'api-documentation')).toBe(false);
  });

  it('does NOT include environment-variables section when envVars is empty', () => {
    expect(hasSection(output, 'environment-variables')).toBe(false);
  });

  it('does NOT include scripts section when scripts is empty', () => {
    expect(hasSection(output, 'scripts')).toBe(false);
  });

  it('does NOT include docker section when hasDocker is false', () => {
    expect(hasSection(output, 'docker')).toBe(false);
  });

  it('does NOT include cicd section when hasCiCd is false', () => {
    expect(hasSection(output, 'cicd')).toBe(false);
  });

  it('includes footer', () => {
    expect(output).toContain('Generated with');
    expect(output).toContain('readmecraft');
  });

  it('sections appear in correct order', () => {
    const order = ['title', 'description', 'toc', 'tech-stack', 'installation', 'usage'];
    const indices = order.map((id) =>
      output.indexOf(`<!-- readmecraft:section:${id} -->`),
    );
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
});

describe('renderReadme — detailed style with optional sections', () => {
  it('includes api-documentation when apiDocs is non-empty', () => {
    const analysis: AnalysisResult = {
      ...BASE_ANALYSIS,
      apiDocs: [
        {
          name: 'myFunc',
          file: 'src/index.ts',
          signature: 'function myFunc(x: number): void',
          description: 'Does something.',
        },
      ],
    };
    const output = renderReadme(analysis, 'detailed');
    expect(hasSection(output, 'api-documentation')).toBe(true);
    expect(output).toContain('myFunc');
  });

  it('includes environment-variables when envVars is non-empty', () => {
    const analysis: AnalysisResult = {
      ...BASE_ANALYSIS,
      envVars: [{ name: 'DATABASE_URL', source: '.env.example' }],
    };
    const output = renderReadme(analysis, 'detailed');
    expect(hasSection(output, 'environment-variables')).toBe(true);
    expect(output).toContain('DATABASE_URL');
  });

  it('includes scripts when scripts is non-empty', () => {
    const analysis: AnalysisResult = {
      ...BASE_ANALYSIS,
      scripts: [{ name: 'npm run test', command: 'jest', description: 'Run tests' }],
    };
    const output = renderReadme(analysis, 'detailed');
    expect(hasSection(output, 'scripts')).toBe(true);
    expect(output).toContain('npm run test');
  });

  it('includes docker section when hasDocker is true', () => {
    const analysis: AnalysisResult = {
      ...BASE_ANALYSIS,
      hasDocker: true,
      dockerSetup: 'docker build -t app .',
    };
    const output = renderReadme(analysis, 'detailed');
    expect(hasSection(output, 'docker')).toBe(true);
    expect(output).toContain('docker build');
  });

  it('includes cicd section when hasCiCd is true', () => {
    const analysis: AnalysisResult = {
      ...BASE_ANALYSIS,
      hasCiCd: true,
      ciCdInfo: 'GitHub Actions workflow at .github/workflows/ci.yml',
    };
    const output = renderReadme(analysis, 'detailed');
    expect(hasSection(output, 'cicd')).toBe(true);
    expect(output).toContain('GitHub Actions');
  });
});

// ---------------------------------------------------------------------------
// minimal style
// ---------------------------------------------------------------------------

describe('renderReadme — minimal style', () => {
  let output: string;

  beforeAll(() => {
    output = renderReadme(BASE_ANALYSIS, 'minimal');
  });

  it('includes title section', () => {
    expect(hasSection(output, 'title')).toBe(true);
    expect(output).toContain('# my-project');
  });

  it('includes description section', () => {
    expect(hasSection(output, 'description')).toBe(true);
  });

  it('includes installation section', () => {
    expect(hasSection(output, 'installation')).toBe(true);
  });

  it('includes usage section', () => {
    expect(hasSection(output, 'usage')).toBe(true);
  });

  it('includes license section', () => {
    expect(hasSection(output, 'license')).toBe(true);
  });

  it('does NOT include toc section', () => {
    expect(hasSection(output, 'toc')).toBe(false);
  });

  it('does NOT include tech-stack section', () => {
    expect(hasSection(output, 'tech-stack')).toBe(false);
  });

  it('does NOT include project-structure section', () => {
    expect(hasSection(output, 'project-structure')).toBe(false);
  });

  it('does NOT include contributing section', () => {
    expect(hasSection(output, 'contributing')).toBe(false);
  });

  it('includes footer', () => {
    expect(output).toContain('readmecraft');
  });
});
