import type { ScriptEntry } from '../types';
import { renderScripts } from './scripts';

const sample: ScriptEntry[] = [
  { name: 'npm run build', command: 'tsc', description: 'Compile / bundle for production' },
  { name: 'npm run test', command: 'jest', description: 'Run test suite' },
  { name: 'npm run dev', command: 'ts-node src/cli.ts', description: 'Start development server with watch mode' },
];

describe('renderScripts', () => {
  it('returns a fallback string when given an empty array', () => {
    expect(renderScripts([])).toBe('_No scripts detected._');
  });

  it('renders a markdown table header', () => {
    const out = renderScripts(sample);
    expect(out).toContain('| Command | Description |');
    expect(out).toContain('|---------|-------------|');
  });

  it('wraps command names in backticks', () => {
    const out = renderScripts(sample);
    expect(out).toContain('`npm run build`');
    expect(out).toContain('`npm run test`');
  });

  it('renders the description column', () => {
    const out = renderScripts(sample);
    expect(out).toContain('Compile / bundle for production');
    expect(out).toContain('Run test suite');
  });

  it('falls back to the raw command when description is empty', () => {
    const noDesc: ScriptEntry[] = [
      { name: 'make clean', command: 'make clean', description: '' },
    ];
    const out = renderScripts(noDesc);
    // Falls back to command value
    expect(out).toContain('make clean');
  });

  it('renders one row per script', () => {
    const out = renderScripts(sample);
    const dataRows = out.split('\n').filter((l) => l.startsWith('|')).slice(2);
    expect(dataRows.length).toBe(sample.length);
  });
});
