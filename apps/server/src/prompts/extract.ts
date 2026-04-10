// Stage 1a prompt: Batched per-chunk extraction (parallel map phase).
//
// Each parallel agent reads a BATCH of source chunks and produces one
// digest file per chunk. Batching reduces Claude Code cold-start
// overhead from N processes to ~N/BATCH_SIZE processes.

export interface ExtractPromptInput {
  chapterId: string;
  unitIds: string[];
}

export function buildExtractPrompt(input: ExtractPromptInput): string {
  const { chapterId, unitIds } = input;
  const fileList = unitIds
    .map((id) => `- \`sources/${chapterId}/${id}.md\``)
    .join("\n");

  return `You are a content analyst. Read the following source files and produce one structured digest per file.

## Source files to read

${fileList}

## Output

For EACH source file, create a digest file: \`stage1-structure/<unitId>-digest.md\`

So you will create exactly ${unitIds.length} files.

Use this exact format for each — YAML frontmatter only, no body text:

\`\`\`yaml
---
unitId: <the unit id, e.g. ${unitIds[0]}>
summary: <2-3 sentence summary of what this chunk contains>
entities:
  - name: <entity name>
    type: <person | place | artifact | event | concept | time-period>
themes: [<theme1>, <theme2>]
dates: [<any dates or time references mentioned>]
keyFacts:
  - <important fact or claim 1>
  - <important fact or claim 2>
mood: <dominant tone: joyful | melancholic | energetic | peaceful | tense | nostalgic | triumphant | curious | bittersweet | determined>
---
\`\`\`

## Rules

1. **One digest file per source file.** Create exactly ${unitIds.length} files.
2. **Be thorough.** Extract ALL named entities (people, places, objects, events).
3. **Be concise.** Summary = 2-3 sentences. Each key fact = one line.
4. **Preserve terminology.** Use the source's own names and terms.
5. **3-8 entities**, 1-4 themes, 2-5 key facts per chunk.
6. **No body text in the files.** Everything goes in the frontmatter.
7. **Write ALL digest files before stopping.** Do not stop early.`;
}
