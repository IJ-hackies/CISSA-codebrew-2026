/**
 * Markdown renderer for drawer bodies.
 *
 * Splits a markdown body into sections on H2/H3 headings.
 *
 * Wikilinks `[[(Type) Name]]` are resolved via the provided WikiLinkIndex
 * and rendered as `<a data-id="..." data-type="..." class="wikilink">Name</a>`.
 * Click handling is the caller's responsibility.
 *
 * Image embeds `![[filename]]` resolve to `/api/media/<filename>`.
 */

import type { WikiLinkIndex } from './meshApi'

export interface RenderedProse {
  /** Sections split on H2/H3 headings. First section may have no heading. */
  sections: RenderedSection[]
}

export interface RenderedSection {
  heading?: string
  /** HTML for this section's body (paragraphs wrapped in <p>). */
  html: string
}

// ── Wikilink + inline pass ─────────────────────────────────────────────────

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Resolves wikilinks, image embeds, and basic inline markdown.
 * Leaves block-level structure alone.
 */
function renderInline(md: string, wikiLinkIndex: WikiLinkIndex): string {
  // Build a lowercase fallback index once for case-insensitive resolution
  const lowerIndex: Record<string, string> = {}
  for (const [k, v] of Object.entries(wikiLinkIndex)) {
    lowerIndex[k.toLowerCase()] = v
  }

  function resolveWikiKey(raw: string): { uuid: string; key: string } | null {
    // Normalize: collapse internal whitespace, strip path prefix
    const normalized = (raw.includes('/') ? raw.split('/').pop()! : raw)
      .replace(/\s+/g, ' ').trim()
    const direct = wikiLinkIndex[normalized]
    if (direct) return { uuid: direct, key: normalized }
    const lower = lowerIndex[normalized.toLowerCase()]
    if (lower) return { uuid: lower, key: normalized }
    return null
  }

  // Image embeds first (so [[...]] pass doesn't eat them)
  let out = md.replace(/!\[\[([^\]]+)\]\]/g, (_m, filename: string) => {
    const safe = encodeURIComponent(filename)
    return `<img src="/api/media/${safe}" alt="${escape(filename)}" class="prose-img" />`
  })

  // Wikilinks
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_m, name: string) => {
    const resolved = resolveWikiKey(name)
    const key = (name.includes('/') ? name.split('/').pop()! : name).replace(/\s+/g, ' ').trim()
    const label = key.replace(/^\([^)]+\)\s*/, '')
    if (!resolved) return `<span class="wikilink-broken">${escape(label)}</span>`
    const typeMatch = key.match(/^\((\w[\w ]*)\)/)
    const type = typeMatch?.[1]?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'
    return `<a data-id="${resolved.uuid}" data-type="${type}" class="wikilink">${escape(label)}</a>`
  })

  // Inline: bold, italic, code
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')

  return out
}

/** Convert a block of text (no headings) into <p> tags split on blank lines. */
function blockToParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Unordered list
      if (/^[-*]\s+/.test(p)) {
        const items = p
          .split(/\n/)
          .map((line) => line.replace(/^[-*]\s+/, '').trim())
          .filter(Boolean)
          .map((item) => `<li>${item}</li>`)
          .join('')
        return `<ul>${items}</ul>`
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
}

// ── Main split ─────────────────────────────────────────────────────────────

/**
 * Render a markdown body as a TL;DR lead + heading-split sections.
 *
 * Leading `# Title` is stripped (the drawer hero shows the title separately).
 */
export function renderMarkdownSectioned(
  md: string,
  wikiLinkIndex: WikiLinkIndex,
): RenderedProse {
  // Strip leading h1 (title is shown in the hero)
  let body = md.replace(/^\s*#\s+[^\n]*\n?/, '').trim()

  // Inline pass over the whole body first
  body = renderInline(body, wikiLinkIndex)

  // Split on H2 / H3 boundaries. Keep the heading with its following block.
  const lines = body.split('\n')
  const sections: { heading?: string; lines: string[] }[] = [{ lines: [] }]
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/)
    if (m) {
      sections.push({ heading: m[2].trim(), lines: [] })
    } else {
      sections[sections.length - 1].lines.push(line)
    }
  }

  // First section might be empty if the body starts with a heading
  if (sections.length > 1 && sections[0].lines.join('').trim() === '') {
    sections.shift()
  }

  const renderedSections: RenderedSection[] = sections
    .map((sec) => ({
      heading: sec.heading,
      html: blockToParagraphs(sec.lines.join('\n').trim()),
    }))
    .filter((sec) => sec.heading || sec.html)

  return { sections: renderedSections }
}
