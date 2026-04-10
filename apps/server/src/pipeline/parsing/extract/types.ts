// Shared types for the extractor module.

import type { SourceKind } from "@scholarsystem/shared";

export interface Extracted {
  /** Plain-text (or markdown) content ready to feed into Stage 0. */
  text: string;
  /** Optional title pulled from the document (heading, metadata, etc.). */
  title?: string;
}

export type Extractor = (buf: Buffer, filename: string) => Promise<Extracted>;

export class UnsupportedFormatError extends Error {
  constructor(public readonly filename: string) {
    super(`unsupported file format: ${filename}`);
    this.name = "UnsupportedFormatError";
  }
}

/**
 * Canonical server-side allowlist of ingestable file extensions and the
 * `source.kind` each maps to. MUST be kept in sync with the client list at
 * `client/src/lib/fileTypes.ts`. Anything the client accepts but the
 * server doesn't have an extractor for will 415 at the route boundary.
 */
export const EXTENSION_TO_KIND: Record<string, SourceKind> = {
  ".txt": "text",
  ".md": "markdown",
  ".markdown": "markdown",
  ".pdf": "pdf",
  ".docx": "docx",
  ".pptx": "pptx",
};
