/** Marker pattern used to delimit auto-generated sections. */
const SECTION_START_RE = /<!-- readmecraft:section:(\S+?) -->/g;
const SECTION_END_RE = /<!-- readmecraft:end:(\S+?) -->/g;
const CUSTOM_MARKER = '<!-- custom -->';
const NO_MARKERS_WARNING =
  '<!-- readmecraft: no section markers found in original file — replaced with generated content -->';

interface ParsedSection {
  id: string;
  /** Full text including surrounding markers. */
  raw: string;
  /** Inner content between the start and end markers. */
  content: string;
  isCustom: boolean;
}

interface ParsedReadme {
  /** Text before the first section marker. */
  preamble: string;
  sections: ParsedSection[];
  /** Text after the last section end marker. */
  postamble: string;
}

/**
 * Split a README string into preamble, a list of parsed sections, and
 * postamble.  Sections without a matching end marker are skipped.
 */
function parseContent(content: string): ParsedReadme {
  const sections: ParsedSection[] = [];

  // Reset stateful regex indices.
  SECTION_START_RE.lastIndex = 0;

  let preamble: string | null = null;
  let cursor = 0;

  let startMatch: RegExpExecArray | null;
  while ((startMatch = SECTION_START_RE.exec(content)) !== null) {
    if (preamble === null) {
      preamble = content.slice(0, startMatch.index);
    }

    const id = startMatch[1];
    const afterStart = startMatch.index + startMatch[0].length;

    // Find the matching end marker.
    const endMarker = `<!-- readmecraft:end:${id} -->`;
    const endIdx = content.indexOf(endMarker, afterStart);
    if (endIdx === -1) {
      // No matching end — skip this section.
      continue;
    }

    const inner = content.slice(afterStart, endIdx);
    const raw = content.slice(startMatch.index, endIdx + endMarker.length);

    sections.push({
      id,
      raw,
      content: inner,
      isCustom: inner.includes(CUSTOM_MARKER),
    });

    cursor = endIdx + endMarker.length;
    // Advance the outer regex past the end marker so it does not re-enter this section.
    SECTION_START_RE.lastIndex = cursor;
  }

  const postamble = content.slice(cursor);

  return {
    preamble: preamble ?? '',
    sections,
    postamble,
  };
}

/** Build a Map<id, ParsedSection> for O(1) lookup. */
function indexSections(sections: ParsedSection[]): Map<string, ParsedSection> {
  const map = new Map<string, ParsedSection>();
  for (const s of sections) {
    map.set(s.id, s);
  }
  return map;
}

/**
 * Merge an existing README with freshly generated content.
 *
 * Rules:
 * - If the existing file has no readmecraft markers, append a warning comment
 *   and return the new content unchanged.
 * - For each section in the new content, preserve the existing version when
 *   the existing section contains `<!-- custom -->`, otherwise use the new
 *   auto-generated version.
 * - Content before the first marker (preamble) and after the last marker
 *   (postamble) from the existing file is preserved.
 */
export function updateReadme(existingContent: string, newContent: string): string {
  const existing = parseContent(existingContent);
  const generated = parseContent(newContent);

  // If the existing file has no markers at all, return new content with warning.
  if (existing.sections.length === 0) {
    return NO_MARKERS_WARNING + '\n\n' + newContent;
  }

  const existingIndex = indexSections(existing.sections);

  // Rebuild section list from the generated output, substituting preserved
  // custom sections where applicable.
  const mergedSections = generated.sections.map((genSection) => {
    const existingSection = existingIndex.get(genSection.id);
    if (existingSection && existingSection.isCustom) {
      // Return the existing custom raw block unchanged.
      return existingSection.raw;
    }
    return genSection.raw;
  });

  // Re-assemble: prefer existing preamble, regenerated sections, existing postamble.
  const preamble = existing.preamble || generated.preamble;
  const postamble = existing.postamble.trim()
    ? existing.postamble
    : generated.postamble;

  const body = mergedSections.join('\n\n');

  const parts: string[] = [];
  if (preamble.trim()) parts.push(preamble.trimEnd());
  parts.push(body);
  if (postamble.trim()) parts.push(postamble.trimStart());

  return parts.join('\n\n');
}
