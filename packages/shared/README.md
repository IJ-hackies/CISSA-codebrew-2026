# shared

Code shared between `client/` and `server/`. Contains the TypeScript types for the v4 Galaxy data model.

> **v4 NOTE:** The types need to be rewritten for the markdown mesh architecture. The current code contains v3 types (Cluster, Group, Entry, Wrap). The target types are below.

## Target Types (v4)

The v4 data model uses typed markdown files instead of a JSON blob. The shared types define the JSON API response that the server produces by parsing the workspace.

```typescript
type UUID = string;
type WikiLinkIndex = Record<string, UUID>;

interface SolarSystem {
  id: UUID;
  type: "solar-system";
  title: string;
  planets: UUID[];
  concepts: UUID[];
  markdown: string;
}

interface Planet {
  id: UUID;
  type: "planet";
  title: string;
  planetConnections: UUID[];
  markdown: string;
}

interface Concept {
  id: UUID;
  type: "concept";
  title: string;
  planetConnections: UUID[];
  conceptConnections: UUID[];
  markdown: string;
}

interface Story {
  id: UUID;
  type: "story";
  title: string;
  introduction: { markdown: string; conceptIds: UUID[] };
  scenes: StoryScene[];
  conclusion: { markdown: string; conceptIds: UUID[] };
}

interface GalaxyData {
  solarSystems: Record<UUID, SolarSystem>;
  planets: Record<UUID, Planet>;
  concepts: Record<UUID, Concept>;
  stories: Story[];
  sources: Record<UUID, Source>;
  media: Record<UUID, Media>;
  wikiLinkIndex: WikiLinkIndex;
}
```

## How to use it

**In the server:**

```ts
import type { GalaxyData, SolarSystem, Planet } from "@scholarsystem/shared";
```

**In the client:**

```ts
import type { GalaxyData, Story } from "@scholarsystem/shared";
```

Both sides import via `@scholarsystem/shared` — no build step needed. `packages/shared/` is a Bun workspace member.

## Rules

1. **This folder is the single source of truth for API types.** Never define galaxy-shape types anywhere else.
2. **The authoritative design reference is `.context/SCHEMA.md` at the repo root.**
