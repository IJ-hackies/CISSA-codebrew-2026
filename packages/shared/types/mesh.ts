/**
 * v4 Narrative Galaxy — Markdown Mesh types.
 *
 * These types describe the JSON API response that the server produces
 * by parsing a galaxy workspace's Mesh/ directory of typed markdown files.
 */

export type UUID = string;

/** Maps "(Type) Name" strings to UUIDs for frontend wikilink resolution. */
export type WikiLinkIndex = Record<string, UUID>;

export interface MeshSource {
  id: UUID;
  type: "source";
  title: string;
  filename: string;
  mediaRef: string;
  markdown: string;
}

export interface MeshSolarSystem {
  id: UUID;
  type: "solar-system";
  title: string;
  planets: UUID[];
  concepts: UUID[];
  markdown: string;
}

export interface MeshPlanet {
  id: UUID;
  type: "planet";
  title: string;
  planetConnections: UUID[];
  markdown: string;
}

export interface MeshConcept {
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

export interface MeshStory {
  id: UUID;
  type: "story";
  title: string;
  introduction: {
    markdown: string;
    conceptIds: UUID[];
  };
  scenes: StoryScene[];
  conclusion: {
    markdown: string;
    conceptIds: UUID[];
  };
}

export interface MeshMedia {
  id: UUID;
  filename: string;
  url: string;
}

/** The full response for a galaxy workspace, assembled from parsed markdown files. */
export interface GalaxyData {
  solarSystems: Record<UUID, MeshSolarSystem>;
  planets: Record<UUID, MeshPlanet>;
  concepts: Record<UUID, MeshConcept>;
  stories: MeshStory[];
  sources: Record<UUID, MeshSource>;
  media: Record<UUID, MeshMedia>;
  wikiLinkIndex: WikiLinkIndex;
}
