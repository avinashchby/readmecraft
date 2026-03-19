import type { EnvVar } from '../types';
import { renderEnvVars } from './env-vars';

const sample: EnvVar[] = [
  { name: 'DATABASE_URL', source: 'src/db.ts' },
  { name: 'API_KEY', source: '.env.example', defaultValue: 'changeme' },
  { name: 'PORT', source: 'src/server.ts', defaultValue: '3000' },
];

describe('renderEnvVars', () => {
  it('returns a fallback string when given an empty array', () => {
    expect(renderEnvVars([])).toBe('_No environment variables detected._');
  });

  it('renders a markdown table header', () => {
    const out = renderEnvVars(sample);
    expect(out).toContain('| Variable | Default | Source |');
    expect(out).toContain('|----------|---------|--------|');
  });

  it('wraps variable names in backticks', () => {
    const out = renderEnvVars(sample);
    expect(out).toContain('`DATABASE_URL`');
    expect(out).toContain('`API_KEY`');
  });

  it('shows default values in backticks when present', () => {
    const out = renderEnvVars(sample);
    expect(out).toContain('`changeme`');
    expect(out).toContain('`3000`');
  });

  it('shows em-dash when no default value is set', () => {
    const out = renderEnvVars(sample);
    // DATABASE_URL has no defaultValue
    const dbRow = out.split('\n').find((l) => l.includes('DATABASE_URL'));
    expect(dbRow).toContain('—');
  });

  it('includes the source column', () => {
    const out = renderEnvVars(sample);
    expect(out).toContain('src/db.ts');
    expect(out).toContain('.env.example');
  });

  it('renders one row per variable', () => {
    const out = renderEnvVars(sample);
    // Header + separator + N data rows
    const lines = out.split('\n').filter((l) => l.startsWith('|'));
    expect(lines.length).toBe(sample.length + 2);
  });
});
