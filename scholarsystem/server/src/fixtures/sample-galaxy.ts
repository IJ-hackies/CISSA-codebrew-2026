// Hand-authored sample galaxy (v3 schema) used for local development and
// as a render target for the frontend before the real pipeline is wired up.
//
// Validated against the Galaxy Zod schema at import time — if the schema
// drifts the server will fail to start rather than serving a broken blob.

import { Galaxy } from "@scholarsystem/shared";

const now = Date.now();
const CH = "w1"; // chapter prefix

const raw = {
  meta: {
    id: "a1b2c3d4-e5f6-4789-8abc-123456789abc",
    schemaVersion: 3,
    createdAt: now - 20000,
    updatedAt: now,
    title: "Intro to Astronomy (fixture)",
    chapters: [
      {
        id: CH,
        uploadedAt: now - 20000,
        filename: null,
        addedNodeIds: [
          `${CH}-solar-system`, `${CH}-stellar-evolution`,
          `${CH}-inner-planets`, `${CH}-outer-planets`, `${CH}-main-sequence`, `${CH}-stellar-death`,
          `${CH}-rocky-planet-def`, `${CH}-venus-atmosphere`, `${CH}-gas-giant-composition`,
          `${CH}-jupiter-red-spot`, `${CH}-hydrogen-fusion`, `${CH}-hr-diagram`,
          `${CH}-supernova`, `${CH}-black-hole-formation`, `${CH}-cosmic-scale`,
        ],
      },
    ],
  },

  source: {
    chapters: [
      {
        id: CH,
        kind: "text" as const,
        filename: null,
        byteSize: 1024,
        charCount: 1024,
        contentHash: "fixture-sha256-placeholder",
        excerpt: "Sample astronomy notes covering the solar system and stellar evolution...",
        units: [
          { id: `${CH}-s-0001`, text: "The Solar System consists of the Sun and the objects that orbit it.", charStart: 0, charEnd: 66 },
          { id: `${CH}-s-0002`, text: "Rocky planets have solid surfaces made of silicate rock or metal.", charStart: 67, charEnd: 131 },
          { id: `${CH}-s-0003`, text: "Venus has roughly 92 times Earth's surface atmospheric pressure.", charStart: 132, charEnd: 195 },
          { id: `${CH}-s-0004`, text: "Gas giants like Jupiter and Saturn are dominated by hydrogen and helium.", charStart: 196, charEnd: 267 },
          { id: `${CH}-s-0005`, text: "Jupiter's Great Red Spot is a persistent anticyclonic storm larger than Earth.", charStart: 268, charEnd: 345 },
          { id: `${CH}-s-0006`, text: "Main-sequence stars fuse hydrogen into helium via the proton-proton chain.", charStart: 346, charEnd: 420 },
          { id: `${CH}-s-0007`, text: "The HR diagram plots stellar luminosity against surface temperature.", charStart: 421, charEnd: 488 },
          { id: `${CH}-s-0008`, text: "A supernova is the explosive death of a massive star.", charStart: 489, charEnd: 542 },
          { id: `${CH}-s-0009`, text: "Black holes form from gravitational collapse of sufficiently massive stellar cores.", charStart: 543, charEnd: 625 },
          { id: `${CH}-s-0010`, text: "Distances in space are unintuitively vast.", charStart: 626, charEnd: 668 },
        ],
      },
    ],
  },

  knowledge: {
    clusters: [
      {
        id: `${CH}-solar-system`, chapter: CH,
        title: "The Solar System",
        brief: "The worlds orbiting our own star.",
        sourceRefs: [`${CH}-s-0001`],
        groupIds: [`${CH}-inner-planets`, `${CH}-outer-planets`],
      },
      {
        id: `${CH}-stellar-evolution`, chapter: CH,
        title: "Stellar Evolution",
        brief: "How stars are born, live, and die.",
        sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`],
        groupIds: [`${CH}-main-sequence`, `${CH}-stellar-death`],
      },
    ],
    groups: [
      { id: `${CH}-inner-planets`, chapter: CH, title: "Inner Planets", brief: "The small, rocky worlds close to the sun.", clusterId: `${CH}-solar-system`, entryIds: [`${CH}-rocky-planet-def`, `${CH}-venus-atmosphere`], sourceRefs: [`${CH}-s-0002`, `${CH}-s-0003`] },
      { id: `${CH}-outer-planets`, chapter: CH, title: "Outer Planets", brief: "The gas and ice giants of the outer solar system.", clusterId: `${CH}-solar-system`, entryIds: [`${CH}-gas-giant-composition`, `${CH}-jupiter-red-spot`], sourceRefs: [`${CH}-s-0004`, `${CH}-s-0005`] },
      { id: `${CH}-main-sequence`, chapter: CH, title: "Main Sequence", brief: "The long, stable phase of a star's life.", clusterId: `${CH}-stellar-evolution`, entryIds: [`${CH}-hydrogen-fusion`, `${CH}-hr-diagram`], sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`] },
      { id: `${CH}-stellar-death`, chapter: CH, title: "Stellar Death", brief: "The endpoints of stellar evolution.", clusterId: `${CH}-stellar-evolution`, entryIds: [`${CH}-supernova`, `${CH}-black-hole-formation`], sourceRefs: [`${CH}-s-0008`, `${CH}-s-0009`] },
    ],
    entries: [
      { id: `${CH}-rocky-planet-def`, chapter: CH, title: "Rocky Planet Definition", brief: "A planet composed primarily of silicate rock or metal.", kind: "place", groupId: `${CH}-inner-planets`, sourceRefs: [`${CH}-s-0002`] },
      { id: `${CH}-venus-atmosphere`, chapter: CH, title: "Venus Atmospheric Pressure", brief: "Venus has roughly 92 times Earth's surface pressure.", kind: "place", groupId: `${CH}-inner-planets`, sourceRefs: [`${CH}-s-0003`] },
      { id: `${CH}-gas-giant-composition`, chapter: CH, title: "Gas Giant Composition", brief: "Gas giants are dominated by hydrogen and helium.", kind: "place", groupId: `${CH}-outer-planets`, sourceRefs: [`${CH}-s-0004`] },
      { id: `${CH}-jupiter-red-spot`, chapter: CH, title: "Jupiter's Great Red Spot", brief: "A persistent anticyclonic storm larger than Earth.", kind: "moment", groupId: `${CH}-outer-planets`, sourceRefs: [`${CH}-s-0005`] },
      { id: `${CH}-hydrogen-fusion`, chapter: CH, title: "Hydrogen Fusion", brief: "The proton-proton chain that powers main-sequence stars.", kind: "theme", groupId: `${CH}-main-sequence`, sourceRefs: [`${CH}-s-0006`] },
      { id: `${CH}-hr-diagram`, chapter: CH, title: "Luminosity-Temperature Relation", brief: "The HR diagram plots luminosity against surface temperature.", kind: "artifact", groupId: `${CH}-main-sequence`, sourceRefs: [`${CH}-s-0007`] },
      { id: `${CH}-supernova`, chapter: CH, title: "Supernova", brief: "The explosive death of a massive star.", kind: "milestone", groupId: `${CH}-stellar-death`, sourceRefs: [`${CH}-s-0008`] },
      { id: `${CH}-black-hole-formation`, chapter: CH, title: "Black Hole Formation", brief: "Gravitational collapse of a sufficiently massive stellar core.", kind: "milestone", groupId: `${CH}-stellar-death`, sourceRefs: [`${CH}-s-0009`] },
      { id: `${CH}-cosmic-scale`, chapter: CH, title: "Cosmic Scale Intuition", brief: "Distances in space are unintuitively vast.", kind: "theme", groupId: null, sourceRefs: [`${CH}-s-0010`] },
    ],
  },

  relationships: {
    edges: [
      { id: `${CH}-fusion-to-supernova`, source: `${CH}-hydrogen-fusion`, target: `${CH}-supernova`, type: "causal", label: "Fusion exhaustion leads to supernova", weight: 0.9, sourceRefs: [`${CH}-s-0006`, `${CH}-s-0008`], chapter: CH },
      { id: `${CH}-rocky-vs-gas`, source: `${CH}-rocky-planet-def`, target: `${CH}-gas-giant-composition`, type: "contrasts", label: "Rocky vs gaseous composition", weight: 0.7, sourceRefs: [`${CH}-s-0002`, `${CH}-s-0004`], chapter: CH },
      { id: `${CH}-supernova-to-bh`, source: `${CH}-supernova`, target: `${CH}-black-hole-formation`, type: "causal", label: "Massive supernova remnants collapse into black holes", weight: 0.95, sourceRefs: [`${CH}-s-0008`, `${CH}-s-0009`], chapter: CH },
      { id: `${CH}-hr-to-fusion`, source: `${CH}-hr-diagram`, target: `${CH}-hydrogen-fusion`, type: "related", label: "HR diagram classifies fusion-powered stars", weight: 0.6, sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`], chapter: CH },
    ],
  },

  wraps: {
    [`${CH}-solar-system`]: {
      nodeId: `${CH}-solar-system`, level: "cluster" as const,
      headline: "Our Cosmic Neighborhood",
      summary: "The Solar System is the gravitationally bound system of the Sun and the objects that orbit it. From rocky inner worlds to gas giant outer planets, it's a diverse collection of worlds.",
      mood: "curious" as const, color: "#4A90D9",
      stats: [{ label: "Groups", value: "2" }, { label: "Entries", value: "4" }],
      highlights: ["The Solar System consists of the Sun and the objects that orbit it."],
      derivatives: [{ sourceRef: `${CH}-s-0001`, quote: "The Solar System consists of the Sun and the objects that orbit it." }],
      sourceRefs: [`${CH}-s-0001`],
      dateRange: undefined,
      topEntries: [`${CH}-rocky-planet-def`, `${CH}-gas-giant-composition`, `${CH}-jupiter-red-spot`],
      themes: ["planetary composition", "orbital mechanics"],
    },
    [`${CH}-stellar-evolution`]: {
      nodeId: `${CH}-stellar-evolution`, level: "cluster" as const,
      headline: "Life and Death of Stars",
      summary: "From hydrogen fusion on the main sequence to the explosive finality of supernovae, stellar evolution traces the full arc of a star's existence.",
      mood: "triumphant" as const, color: "#E8A838",
      stats: [{ label: "Groups", value: "2" }, { label: "Entries", value: "4" }],
      highlights: ["Main-sequence stars fuse hydrogen into helium via the proton-proton chain."],
      derivatives: [{ sourceRef: `${CH}-s-0006`, quote: "Main-sequence stars fuse hydrogen into helium via the proton-proton chain." }],
      sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`],
      topEntries: [`${CH}-hydrogen-fusion`, `${CH}-supernova`, `${CH}-black-hole-formation`],
      themes: ["nuclear fusion", "stellar death", "gravitational collapse"],
    },
    [`${CH}-inner-planets`]: {
      nodeId: `${CH}-inner-planets`, level: "group" as const,
      headline: "The Rocky Worlds",
      summary: "Mercury, Venus, Earth, and Mars — the small, dense planets with solid surfaces closest to the Sun.",
      mood: "peaceful" as const, color: "#C9884A",
      stats: [{ label: "Entries", value: "2" }],
      highlights: ["Rocky planets have solid surfaces made of silicate rock or metal."],
      derivatives: [{ sourceRef: `${CH}-s-0002`, quote: "Rocky planets have solid surfaces made of silicate rock or metal." }],
      sourceRefs: [`${CH}-s-0002`, `${CH}-s-0003`],
      theme: "Terrestrial planets with solid silicate surfaces",
    },
    [`${CH}-outer-planets`]: {
      nodeId: `${CH}-outer-planets`, level: "group" as const,
      headline: "Giants of the Outer Reaches",
      summary: "Jupiter, Saturn, and their icy neighbors dominate the outer solar system with their massive hydrogen-helium atmospheres.",
      mood: "energetic" as const, color: "#7B68EE",
      stats: [{ label: "Entries", value: "2" }],
      highlights: ["Gas giants like Jupiter and Saturn are dominated by hydrogen and helium."],
      derivatives: [{ sourceRef: `${CH}-s-0004`, quote: "Gas giants like Jupiter and Saturn are dominated by hydrogen and helium." }],
      sourceRefs: [`${CH}-s-0004`, `${CH}-s-0005`],
      theme: "Gas and ice giant planets of the outer solar system",
    },
    [`${CH}-main-sequence`]: {
      nodeId: `${CH}-main-sequence`, level: "group" as const,
      headline: "The Steady Burn",
      summary: "Main-sequence stars spend most of their lives fusing hydrogen, their luminosity and temperature charted on the famous HR diagram.",
      mood: "determined" as const, color: "#FFD700",
      stats: [{ label: "Entries", value: "2" }],
      highlights: ["The proton-proton chain powers sun-like stars for billions of years."],
      derivatives: [{ sourceRef: `${CH}-s-0006`, quote: "Main-sequence stars fuse hydrogen into helium via the proton-proton chain." }],
      sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`],
      theme: "The stable hydrogen-burning phase of stellar life",
    },
    [`${CH}-stellar-death`]: {
      nodeId: `${CH}-stellar-death`, level: "group" as const,
      headline: "When Stars Fall",
      summary: "The dramatic endpoints of stellar evolution — from the explosive fury of supernovae to the silent collapse into black holes.",
      mood: "tense" as const, color: "#DC143C",
      stats: [{ label: "Entries", value: "2" }],
      highlights: ["A supernova is the explosive death of a massive star."],
      derivatives: [{ sourceRef: `${CH}-s-0008`, quote: "A supernova is the explosive death of a massive star." }],
      sourceRefs: [`${CH}-s-0008`, `${CH}-s-0009`],
      theme: "The endpoints of stellar evolution",
    },
    [`${CH}-rocky-planet-def`]: {
      nodeId: `${CH}-rocky-planet-def`, level: "entry" as const,
      headline: "Built on Stone",
      summary: "Rocky planets are defined by their solid surfaces of silicate rock or metal, standing in stark contrast to the gaseous giants.",
      mood: "peaceful" as const, color: "#C9884A",
      stats: [{ label: "Surface type", value: "Solid" }],
      highlights: ["Rocky planets have solid surfaces made of silicate rock or metal."],
      derivatives: [{ sourceRef: `${CH}-s-0002`, quote: "Rocky planets have solid surfaces made of silicate rock or metal." }],
      sourceRefs: [`${CH}-s-0002`],
      body: "A rocky (terrestrial) planet is a planet composed primarily of silicate rocks or metals, with a solid surface. Mercury, Venus, Earth, and Mars are the four rocky planets in our solar system. Unlike gas giants, these worlds have well-defined surfaces you could theoretically stand on. Their compositions tell the story of the early solar system, where heavier elements condensed close to the young Sun while lighter gases were blown outward. Some exoplanets blur the line between rocky super-Earths and mini-Neptunes, challenging our neat categories.",
      keyFacts: [{ label: "Composition", value: "Silicate rock and metal" }, { label: "Examples", value: "Mercury, Venus, Earth, Mars" }],
      connections: [{ targetId: `${CH}-gas-giant-composition`, reason: "Rocky vs gaseous composition contrast" }],
    },
    [`${CH}-hydrogen-fusion`]: {
      nodeId: `${CH}-hydrogen-fusion`, level: "entry" as const,
      headline: "The Engine of Stars",
      summary: "Hydrogen fusion via the proton-proton chain is the fundamental process that powers main-sequence stars like our Sun.",
      mood: "energetic" as const, color: "#FFD700",
      stats: [{ label: "Reaction", value: "4 ¹H → ⁴He" }, { label: "Dominant below", value: "1.3 M☉" }],
      highlights: ["Main-sequence stars fuse hydrogen into helium via the proton-proton chain.", "The Sun converts ~4.3 million tonnes of mass into energy every second."],
      derivatives: [{ sourceRef: `${CH}-s-0006`, quote: "Main-sequence stars fuse hydrogen into helium via the proton-proton chain." }],
      sourceRefs: [`${CH}-s-0006`],
      body: "Hydrogen fusion in main-sequence stars proceeds primarily via the proton-proton chain, converting four protons into one helium-4 nucleus plus positrons, neutrinos, and gamma-ray photons. This process releases enormous energy according to E=mc², powering stars for billions of years. Our Sun converts approximately 4.3 million tonnes of mass into energy every second through this mechanism. More massive stars also utilize the CNO cycle, which becomes the dominant energy source above about 1.3 solar masses. The balance between gravitational collapse and radiation pressure from fusion defines the star's equilibrium on the main sequence.",
      keyFacts: [{ label: "Process", value: "Proton-proton chain" }, { label: "Product", value: "Helium-4 + energy" }],
      connections: [{ targetId: `${CH}-supernova`, reason: "Fusion exhaustion leads to stellar death" }, { targetId: `${CH}-hr-diagram`, reason: "HR diagram classifies fusion-powered stars" }],
    },
  },

  exploration: {
    visited: {},
    bookmarked: [],
  },

  pipeline: {
    ingest:    { status: "complete" as const, startedAt: now - 20000, completedAt: now - 19500, error: null },
    structure: { status: "complete" as const, startedAt: now - 19500, completedAt: now - 17000, error: null },
    wraps:     { status: "complete" as const, startedAt: now - 17000, completedAt: now - 12000, error: null },
    coverage:  { status: "complete" as const, startedAt: now - 12000, completedAt: now - 11500, error: null },
  },
};

// Parse at import time — fails loudly if the fixture drifts from the schema.
export const sampleGalaxy = Galaxy.parse(raw);
