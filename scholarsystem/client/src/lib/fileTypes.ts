/**
 * Canonical accepted-file-type list. Frontend `accept` attribute, drop-zone
 * validator, and (eventually) backend ingest must mirror this exactly.
 *
 * If you add a type here, also add an extractor on the server side.
 */

export const ACCEPTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.rtf',
  '.pdf',
  '.docx',
  '.html',
  '.htm',
  '.csv',
  '.json',
  '.pptx',
  '.epub',
  '.tex',
  '.ipynb',
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
