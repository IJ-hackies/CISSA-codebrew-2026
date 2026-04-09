/**
 * Canonical accepted-file-type list. Frontend `accept` attribute, drop-zone
 * validator, and backend ingest MUST mirror this exactly. The server-side
 * source of truth is `server/src/pipeline/parsing/extract/types.ts` —
 * `EXTENSION_TO_KIND`. Anything the client accepts that the server has no
 * extractor for will be rejected at the route boundary with HTTP 415.
 *
 * If you add a type here, also add an extractor on the server side.
 */

export const ACCEPTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.pdf',
  '.docx',
  '.pptx',
] as const

export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number]

/** For the file picker `accept` attribute. */
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')

export const TOTAL_SIZE_LIMIT_BYTES = 100 * 1024 * 1024 // 100 MB

export function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Filter dropped/picked files into accepted + rejected. */
export function partitionFiles(files: File[]): { accepted: File[]; rejected: File[] } {
  const accepted: File[] = []
  const rejected: File[] = []
  for (const f of files) {
    if (hasAcceptedExtension(f.name)) accepted.push(f)
    else rejected.push(f)
  }
  return { accepted, rejected }
}

/** Pretty byte formatter for chips and the running total. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
