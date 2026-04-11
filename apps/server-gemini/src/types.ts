// GalaxyData — the v4 API shape the frontend renders.
// Mirrors `galaxy-data 1.json` at the repo root exactly. Kept local to this
// app per plan.md (the experiment is self-contained and deletable).

export type UUID = string;
export type WikiLinkIndex = Record<string, UUID>;

export interface Source {
  id: UUID;
  type: "source";
  title: string;
  filename: string;
  mediaRef: string;
  markdown: string;
}

export interface SolarSystem {
  id: UUID;
  type: "solar-system";
  title: string;
  planets: UUID[];
  concepts: UUID[];
  markdown: string;
}

export interface Planet {
  id: UUID;
  type: "planet";
  title: string;
  planetConnections: UUID[];
  markdown: string;
}

export interface Concept {
  id: UUID;
  type: "concept";
  title: string;
  planetConnections: UUID[];
  conceptConnections: UUID[];
  markdown: string;
}

export interface StoryScene {
  planetId: UUID;
  markdown: string;
}

export interface Story {
  id: UUID;
  type: "story";
  title: string;
  introduction: { markdown: string; conceptIds: UUID[] };
  scenes: StoryScene[];
  conclusion: { markdown: string; conceptIds: UUID[] };
}

export interface Media {
  id: UUID;
  filename: string;
  url: string;
}

export interface GalaxyData {
  solarSystems: Record<UUID, SolarSystem>;
  planets: Record<UUID, Planet>;
  concepts: Record<UUID, Concept>;
  stories: Story[];
  sources: Record<UUID, Source>;
  media: Record<UUID, Media>;
  wikiLinkIndex: WikiLinkIndex;
}

export function emptyGalaxy(): GalaxyData {
  return {
    solarSystems: {},
    planets: {},
    concepts: {},
    stories: [],
    sources: {},
    media: {},
    wikiLinkIndex: {},
  };
}

export type JobStatus =
  | "queued"
  | "ingest"
  | "cluster"
  | "outline"
  | "expand"
  | "stories"
  | "complete"
  | "error";

export interface GalaxyRow {
  id: UUID;
  title: string;
  status: JobStatus;
  stageDetail: string;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
