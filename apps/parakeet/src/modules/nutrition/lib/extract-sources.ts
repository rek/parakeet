// @spec docs/features/nutrition/spec-data-layer.md
export interface SourceLink {
  title: string;
  url: string;
}

/**
 * Parse the `## Sources` section of a protocol's description_md and return
 * every [title](url) link found in it. Lines preceding the Sources heading
 * are ignored. Returns an empty array if the section is absent.
 */
export function extractSources(md: string | null | undefined): SourceLink[] {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+sources\s*$/i.test(lines[i].trim())) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return [];

  // Collect until next heading at same or higher level, or EOF.
  const sectionLines: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,2}\s+/.test(lines[i])) break;
    sectionLines.push(lines[i]);
  }
  const body = sectionLines.join(' ');
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const out: SourceLink[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: m[1].trim(), url });
  }
  return out;
}
