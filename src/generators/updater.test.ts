import { updateReadme } from './updater';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(id: string, content: string): string {
  return [
    `<!-- readmecraft:section:${id} -->`,
    content,
    `<!-- readmecraft:end:${id} -->`,
  ].join('\n');
}

function customSection(id: string, content: string): string {
  return [
    `<!-- readmecraft:section:${id} -->`,
    '<!-- custom -->',
    content,
    `<!-- readmecraft:end:${id} -->`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// No markers in existing file
// ---------------------------------------------------------------------------

describe('updateReadme — existing file has no markers', () => {
  it('returns new content when existing has no markers', () => {
    const existing = '# My Old README\n\nSome text without any markers.';
    const newContent = section('title', '# New Title') + '\n\n' + section('installation', 'npm install');

    const result = updateReadme(existing, newContent);

    // Should contain the warning comment
    expect(result).toContain('<!-- readmecraft:');
    // Should contain the new generated content
    expect(result).toContain('# New Title');
    expect(result).toContain('npm install');
  });

  it('prepends a warning comment when no markers found', () => {
    const result = updateReadme('plain text', section('title', '# Title'));
    expect(result).toMatch(/<!-- readmecraft:.*no section markers.*-->/i);
  });
});

// ---------------------------------------------------------------------------
// Auto sections are replaced
// ---------------------------------------------------------------------------

describe('updateReadme — auto sections are replaced', () => {
  it('replaces an auto section with the new generated version', () => {
    const existing =
      section('title', '# Old Title') + '\n\n' + section('installation', 'pip install old');
    const newContent =
      section('title', '# New Title') + '\n\n' + section('installation', 'npm install new');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('# New Title');
    expect(result).toContain('npm install new');
    expect(result).not.toContain('# Old Title');
    expect(result).not.toContain('pip install old');
  });

  it('replaces multiple auto sections', () => {
    const existing = [
      section('title', 'old title'),
      section('usage', 'old usage'),
      section('license', 'old license'),
    ].join('\n\n');

    const newContent = [
      section('title', 'new title'),
      section('usage', 'new usage'),
      section('license', 'new license'),
    ].join('\n\n');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('new title');
    expect(result).toContain('new usage');
    expect(result).toContain('new license');
    expect(result).not.toContain('old title');
    expect(result).not.toContain('old usage');
    expect(result).not.toContain('old license');
  });
});

// ---------------------------------------------------------------------------
// Custom sections are preserved
// ---------------------------------------------------------------------------

describe('updateReadme — custom sections are preserved', () => {
  it('keeps a custom-marked section unchanged', () => {
    const existing =
      section('title', '# Auto Title') +
      '\n\n' +
      customSection('installation', 'My hand-written install steps');
    const newContent =
      section('title', '# New Auto Title') +
      '\n\n' +
      section('installation', 'Generated install steps');

    const result = updateReadme(existing, newContent);

    // Auto section is replaced.
    expect(result).toContain('# New Auto Title');
    // Custom section is preserved.
    expect(result).toContain('My hand-written install steps');
    expect(result).not.toContain('Generated install steps');
  });

  it('preserves the custom marker itself inside the section', () => {
    const existing =
      section('title', 'title') + '\n\n' + customSection('usage', 'custom usage content');
    const newContent =
      section('title', 'new title') + '\n\n' + section('usage', 'generated usage');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('<!-- custom -->');
    expect(result).toContain('custom usage content');
  });

  it('preserves multiple custom sections while replacing auto ones', () => {
    const existing = [
      customSection('title', 'custom title'),
      section('installation', 'old install'),
      customSection('license', 'custom license text'),
    ].join('\n\n');

    const newContent = [
      section('title', 'new auto title'),
      section('installation', 'new install'),
      section('license', 'new license'),
    ].join('\n\n');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('custom title');
    expect(result).toContain('new install');
    expect(result).toContain('custom license text');
    expect(result).not.toContain('new auto title');
    expect(result).not.toContain('old install');
    expect(result).not.toContain('new license');
  });
});

// ---------------------------------------------------------------------------
// Preamble and postamble preservation
// ---------------------------------------------------------------------------

describe('updateReadme — preamble and postamble preservation', () => {
  it('preserves content before the first section marker', () => {
    const preamble = '<!-- user custom header -->\n# Project Name\n\n';
    const existing = preamble + section('installation', 'old install');
    const newContent = section('installation', 'new install');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('<!-- user custom header -->');
    expect(result).toContain('new install');
  });

  it('preserves content after the last section end marker', () => {
    const postamble = '\n\n<!-- user custom footer -->\nCustom footer text';
    const existing = section('license', 'old license') + postamble;
    const newContent = section('license', 'new license');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('Custom footer text');
    expect(result).toContain('new license');
  });

  it('preserves both preamble and postamble together', () => {
    const preamble = '<!-- top -->\n';
    const postamble = '\n<!-- bottom -->';
    const existing = preamble + section('title', 'old') + postamble;
    const newContent = section('title', 'new');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('<!-- top -->');
    expect(result).toContain('<!-- bottom -->');
    expect(result).toContain('new');
    expect(result).not.toContain('old');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('updateReadme — edge cases', () => {
  it('handles new content that adds sections not present in existing', () => {
    const existing = section('title', 'title') + '\n\n' + section('installation', 'install');
    // New content has an extra section
    const newContent =
      section('title', 'new title') +
      '\n\n' +
      section('installation', 'new install') +
      '\n\n' +
      section('license', 'MIT');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('new title');
    expect(result).toContain('new install');
    expect(result).toContain('MIT');
  });

  it('handles existing content with extra sections not in new content', () => {
    // Existing has a section that new content omits — it should simply be absent.
    const existing =
      section('title', 'title') +
      '\n\n' +
      section('deprecated-section', 'old stuff') +
      '\n\n' +
      section('license', 'MIT');

    const newContent = section('title', 'new title') + '\n\n' + section('license', 'Apache-2.0');

    const result = updateReadme(existing, newContent);

    expect(result).toContain('new title');
    expect(result).toContain('Apache-2.0');
    // deprecated-section was not in newContent so it should not appear
    expect(result).not.toContain('deprecated-section');
  });

  it('is idempotent when called twice with the same auto content', () => {
    const newContent = section('title', 'title') + '\n\n' + section('license', 'MIT');

    const firstPass = updateReadme(newContent, newContent);
    const secondPass = updateReadme(firstPass, newContent);

    // The meaningful section content should remain stable.
    expect(secondPass).toContain('<!-- readmecraft:section:title -->');
    expect(secondPass).toContain('<!-- readmecraft:section:license -->');
  });
});
