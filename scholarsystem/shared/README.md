# shared

Code shared between `client/` and `server/`. Right now that's just the data contract — the Zod schemas that define the `Galaxy` blob.

## `types/`

The source of truth for every piece of data that flows through the system. Organized by scope — one file per top-level scope of the galaxy blob, plus the top-level composition in `galaxy.ts`.

```
types/
├── ids.ts            # Slug validator (kebab-case id discipline)
├── meta.ts           # id, schemaVersion, timestamps, title
├── source.ts         # input provenance
├── knowledge.ts      # topics → subtopics → concepts (flat with id refs)
├── detail.ts         # deep per-concept content
├── relationships.ts  # flat cross-link graph
├── narrative.ts      # galaxy-wide story spine
├── spatial.ts        # polymorphic bodies (discriminated union by kind)
├── visuals.ts        # per-body visual params (discriminated union by kind)
├── scenes.ts         # cached per-concept interactive scenes
├── progress.ts       # user progress state
├── pipeline.ts       # per-stage status for the streaming UI
├── galaxy.ts         # top-level composition — the actual stored blob
└── index.ts          # barrel export
```

## How to use it

**In the server:**

```ts
import { Galaxy, Knowledge, type Concept } from "../../shared/types";

const parsed = Galaxy.parse(blob);          // runtime validation
const k: Knowledge = parsed.knowledge!;
```

**In the client:**

```ts
import { Galaxy, type Galaxy as GalaxyType } from "../../shared/types";
```

Both sides import directly from this folder via relative paths — no build step, no npm link needed. `shared/` is a Bun workspace member of the `scholarsystem/` root, so `zod` is hoisted into `scholarsystem/node_modules` and resolves for both `server/` and `shared/` automatically. Run `bun install` from `scholarsystem/` (not from `server/`) to set it up.

## Rules

1. **This folder is the single source of truth.** Never define galaxy-shape types anywhere else. Derive TS types via `z.infer<typeof Schema>` — never hand-write duplicates.
2. **Every pipeline stage validates its output against the relevant schema here** before writing to the blob. Validation failures at the boundary catch prompt drift early.
3. **Schema changes require bumping `SCHEMA_VERSION` in `meta.ts`** if existing blobs can no longer parse. Adding optional fields or widening enums is non-breaking; renaming, removing, or narrowing fields is breaking.
4. **The authoritative design reference is `.context/SCHEMA.md` at the repo root.** It documents the 11 scopes, their pipeline ownership, mutability zones, the knowledge-to-spatial mapping, and the design decisions behind the shape.
