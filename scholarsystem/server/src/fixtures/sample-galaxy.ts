// Hand-authored sample galaxy (v2 schema) used for local development and
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
    schemaVersion: 2,
    createdAt: now - 20000,
    updatedAt: now,
    title: "Intro to Astronomy (fixture)",
    chapters: [
      {
        id: CH,
        uploadedAt: now - 20000,
        filename: null,
        addedKnowledgeIds: [
          `${CH}-solar-system`, `${CH}-stellar-evolution`,
          `${CH}-inner-planets`, `${CH}-outer-planets`, `${CH}-main-sequence`, `${CH}-stellar-death`,
          `${CH}-rocky-planet-def`, `${CH}-venus-atmosphere`, `${CH}-gas-giant-composition`,
          `${CH}-jupiter-red-spot`, `${CH}-hydrogen-fusion`, `${CH}-hr-diagram`,
          `${CH}-supernova`, `${CH}-black-hole-formation`, `${CH}-cosmic-scale`,
        ],
        addedBodyIds: [
          "root-galaxy",
          `sys-${CH}-solar-system`, `star-${CH}-solar-system`,
          `planet-${CH}-inner-planets`, `moon-${CH}-rocky-planet-def`, `moon-${CH}-venus-atmosphere`,
          `planet-${CH}-outer-planets`, `moon-${CH}-gas-giant-composition`, `moon-${CH}-jupiter-red-spot`,
          `sys-${CH}-stellar-evolution`, `star-${CH}-stellar-evolution`,
          `planet-${CH}-main-sequence`, `moon-${CH}-hydrogen-fusion`, `moon-${CH}-hr-diagram`,
          `planet-${CH}-stellar-death`, `moon-${CH}-supernova`, `moon-${CH}-black-hole-formation`,
          `asteroid-${CH}-cosmic-scale`,
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
    title: "Intro to Astronomy",
    summary: "A brief survey of the solar system and the life cycle of stars.",
    topics: [
      {
        id: `${CH}-solar-system`, chapter: CH,
        title: "The Solar System",
        summary: "The worlds orbiting our own star.",
        subtopicIds: [`${CH}-inner-planets`, `${CH}-outer-planets`],
        sourceRefs: [`${CH}-s-0001`],
      },
      {
        id: `${CH}-stellar-evolution`, chapter: CH,
        title: "Stellar Evolution",
        summary: "How stars are born, live, and die.",
        subtopicIds: [`${CH}-main-sequence`, `${CH}-stellar-death`],
        sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`],
      },
    ],
    subtopics: [
      { id: `${CH}-inner-planets`, chapter: CH, title: "Inner Planets", summary: "The small, rocky worlds close to the sun.", conceptIds: [`${CH}-rocky-planet-def`, `${CH}-venus-atmosphere`], sourceRefs: [`${CH}-s-0002`, `${CH}-s-0003`] },
      { id: `${CH}-outer-planets`, chapter: CH, title: "Outer Planets", summary: "The gas and ice giants of the outer solar system.", conceptIds: [`${CH}-gas-giant-composition`, `${CH}-jupiter-red-spot`], sourceRefs: [`${CH}-s-0004`, `${CH}-s-0005`] },
      { id: `${CH}-main-sequence`, chapter: CH, title: "Main Sequence", summary: "The long, stable phase of a star's life.", conceptIds: [`${CH}-hydrogen-fusion`, `${CH}-hr-diagram`], sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`] },
      { id: `${CH}-stellar-death`, chapter: CH, title: "Stellar Death", summary: "The endpoints of stellar evolution.", conceptIds: [`${CH}-supernova`, `${CH}-black-hole-formation`], sourceRefs: [`${CH}-s-0008`, `${CH}-s-0009`] },
    ],
    concepts: [
      { id: `${CH}-rocky-planet-def`, chapter: CH, title: "Rocky Planet Definition", kind: "definition", brief: "A planet composed primarily of silicate rock or metal.", modelTier: "light", sourceRefs: [`${CH}-s-0002`] },
      { id: `${CH}-venus-atmosphere`, chapter: CH, title: "Venus Atmospheric Pressure", kind: "fact", brief: "Venus has roughly 92 times Earth's surface pressure.", modelTier: "light", sourceRefs: [`${CH}-s-0003`] },
      { id: `${CH}-gas-giant-composition`, chapter: CH, title: "Gas Giant Composition", kind: "definition", brief: "Gas giants are dominated by hydrogen and helium.", modelTier: "standard", sourceRefs: [`${CH}-s-0004`] },
      { id: `${CH}-jupiter-red-spot`, chapter: CH, title: "Jupiter's Great Red Spot", kind: "fact", brief: "A persistent anticyclonic storm larger than Earth.", modelTier: "light", sourceRefs: [`${CH}-s-0005`] },
      { id: `${CH}-hydrogen-fusion`, chapter: CH, title: "Hydrogen Fusion", kind: "process", brief: "The proton-proton chain that powers main-sequence stars.", modelTier: "standard", sourceRefs: [`${CH}-s-0006`] },
      { id: `${CH}-hr-diagram`, chapter: CH, title: "Luminosity-Temperature Relation", kind: "principle", brief: "The HR diagram plots luminosity against surface temperature.", modelTier: "heavy", sourceRefs: [`${CH}-s-0007`] },
      { id: `${CH}-supernova`, chapter: CH, title: "Supernova", kind: "process", brief: "The explosive death of a massive star.", modelTier: "heavy", sourceRefs: [`${CH}-s-0008`] },
      { id: `${CH}-black-hole-formation`, chapter: CH, title: "Black Hole Formation", kind: "process", brief: "Gravitational collapse of a sufficiently massive stellar core.", modelTier: "heavy", sourceRefs: [`${CH}-s-0009`] },
      { id: `${CH}-cosmic-scale`, chapter: CH, title: "Cosmic Scale Intuition", kind: "fact", brief: "Distances in space are unintuitively vast.", modelTier: "light", sourceRefs: [`${CH}-s-0010`] },
    ],
    looseConceptIds: [`${CH}-cosmic-scale`],
  },

  detail: {
    [`${CH}-rocky-planet-def`]: {
      conceptId: `${CH}-rocky-planet-def`, chapter: CH,
      fullDefinition: "A rocky (terrestrial) planet is a planet composed primarily of silicate rocks or metals, with a solid surface, in contrast to gas giants which lack a well-defined surface.",
      formulas: [], workedExamples: ["Mercury, Venus, Earth, and Mars are the rocky planets of our solar system."],
      edgeCases: ["Some exoplanets blur the line between rocky and mini-Neptune."],
      mnemonics: [], emphasisMarkers: [], sourceQuotes: [],
      sourceRefs: [`${CH}-s-0002`], extractedAt: now - 7500,
    },
    [`${CH}-hydrogen-fusion`]: {
      conceptId: `${CH}-hydrogen-fusion`, chapter: CH,
      fullDefinition: "Hydrogen fusion in main-sequence stars proceeds primarily via the proton-proton chain, converting four protons into one helium-4 nucleus plus positrons, neutrinos, and gamma-ray photons.",
      formulas: ["4 ¹H → ⁴He + 2 e⁺ + 2 νₑ + 2 γ"],
      workedExamples: ["The Sun converts approximately 4.3 million tonnes of mass into energy every second via this process."],
      edgeCases: ["More massive stars also use the CNO cycle, which dominates above about 1.3 solar masses."],
      mnemonics: [], emphasisMarkers: ["Emphasized: the proton-proton chain is the dominant channel in sun-like stars."],
      sourceQuotes: [], sourceRefs: [`${CH}-s-0006`], extractedAt: now - 6800,
    },
  },

  relationships: [
    { from: `${CH}-hydrogen-fusion`, to: `${CH}-supernova`, kind: "prerequisite", sourceRefs: [`${CH}-s-0006`, `${CH}-s-0008`] },
    { from: `${CH}-rocky-planet-def`, to: `${CH}-gas-giant-composition`, kind: "contrasts", sourceRefs: [`${CH}-s-0002`, `${CH}-s-0004`] },
    { from: `${CH}-supernova`, to: `${CH}-black-hole-formation`, kind: "prerequisite", sourceRefs: [`${CH}-s-0008`, `${CH}-s-0009`] },
    { from: `${CH}-hr-diagram`, to: `${CH}-hydrogen-fusion`, kind: "related", sourceRefs: [`${CH}-s-0006`, `${CH}-s-0007`] },
  ],

  narrative: {
    canon: {
      setting: "The dying embers of a forgotten star cluster, where the last light of ancient suns fades into archival silence.",
      protagonist: "You are a first-cycle cadet of the Veyari Cartographers Guild, sent to chart the cluster before its stars go dark.",
      premise: "Each world holds a fragment of knowledge the Veyari left behind. Recover them all, and you become a Cartographer in truth.",
      stakes: "If the knowledge is not mapped before the last star dims, it is lost to the galaxy forever.",
      tone: { primary: "wondrous", secondary: "tinged with quiet melancholy", genre: "archaeological" },
      aesthetic: {
        paletteDirection: "deep indigos, warm amber glows, pale bioluminescent highlights",
        atmosphereDirection: "soft drifting particles, distant auroras, a sense of vast silence",
        motifKeywords: ["glyphs", "starlight", "archives", "drift", "echoes", "cartography"],
      },
      recurringCharacters: [
        {
          id: `${CH}-the-curator`, name: "The Curator", role: "guide",
          description: "A pale bioluminescent figure who appears at each archive, half-present, half-memory.",
          voice: "Formal, archaic, never uses contractions, refers to the user as 'cadet'.",
          arc: "Grows more solid — more present — with each fragment recovered.",
        },
      ],
      finaleHook: "At the center of the dying cluster, the last Veyari archive opens and speaks your own voice back to you.",
      hardConstraints: [
        "the user is never in physical danger",
        "the Veyari are never shown alive, only through their records",
        "no other living beings appear except the Curator",
      ],
    },
    arcs: [
      {
        chapter: CH,
        arcSummary: "A journey from the familiar worlds of the solar system outward into the life and death of stars.",
        beats: [
          { topicId: `${CH}-solar-system`, role: "opening", beat: "You arrive at the cluster's outer rim and catalogue its small, familiar worlds.", emotionalTarget: "curiosity", connectsTo: [`${CH}-stellar-evolution`] },
          { topicId: `${CH}-stellar-evolution`, role: "climax", beat: "You follow the life of the cluster's dying star and witness its final transformation.", emotionalTarget: "awe", connectsTo: [`${CH}-solar-system`] },
        ],
        chapterHook: "The Veyari's last survey ship drifts into sensor range, its hull inscribed with coordinates you recognize.",
      },
    ],
  },

  spatial: {
    bounds: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
    bodies: [
      { kind: "galaxy", id: "root-galaxy", position: { x: 0, y: 0 }, parentId: null, radius: 900, knowledgeRef: null },

      // System 1: Solar System
      { kind: "system", id: `sys-${CH}-solar-system`, position: { x: -400, y: 0 }, parentId: "root-galaxy", radius: 250, knowledgeRef: `${CH}-solar-system` },
      { kind: "star", id: `star-${CH}-solar-system`, position: { x: -400, y: 0 }, parentId: `sys-${CH}-solar-system`, radius: 40, spectralClass: "G" },
      { kind: "planet", id: `planet-${CH}-inner-planets`, position: { x: -320, y: -60 }, parentId: `sys-${CH}-solar-system`, radius: 25, knowledgeRef: `${CH}-inner-planets`, orbitRadius: 100, orbitAngle: 0.4 },
      { kind: "moon", id: `moon-${CH}-rocky-planet-def`, position: { x: -300, y: -60 }, parentId: `planet-${CH}-inner-planets`, radius: 8, knowledgeRef: `${CH}-rocky-planet-def`, orbitRadius: 20, orbitAngle: 0 },
      { kind: "moon", id: `moon-${CH}-venus-atmosphere`, position: { x: -320, y: -40 }, parentId: `planet-${CH}-inner-planets`, radius: 8, knowledgeRef: `${CH}-venus-atmosphere`, orbitRadius: 20, orbitAngle: 1.5 },
      { kind: "planet", id: `planet-${CH}-outer-planets`, position: { x: -480, y: 60 }, parentId: `sys-${CH}-solar-system`, radius: 30, knowledgeRef: `${CH}-outer-planets`, orbitRadius: 120, orbitAngle: 2.1 },
      { kind: "moon", id: `moon-${CH}-gas-giant-composition`, position: { x: -460, y: 60 }, parentId: `planet-${CH}-outer-planets`, radius: 8, knowledgeRef: `${CH}-gas-giant-composition`, orbitRadius: 22, orbitAngle: 0 },
      { kind: "moon", id: `moon-${CH}-jupiter-red-spot`, position: { x: -500, y: 70 }, parentId: `planet-${CH}-outer-planets`, radius: 8, knowledgeRef: `${CH}-jupiter-red-spot`, orbitRadius: 22, orbitAngle: 3.1 },

      // System 2: Stellar Evolution
      { kind: "system", id: `sys-${CH}-stellar-evolution`, position: { x: 400, y: 0 }, parentId: "root-galaxy", radius: 250, knowledgeRef: `${CH}-stellar-evolution` },
      { kind: "star", id: `star-${CH}-stellar-evolution`, position: { x: 400, y: 0 }, parentId: `sys-${CH}-stellar-evolution`, radius: 50, spectralClass: "O" },
      { kind: "planet", id: `planet-${CH}-main-sequence`, position: { x: 320, y: -60 }, parentId: `sys-${CH}-stellar-evolution`, radius: 28, knowledgeRef: `${CH}-main-sequence`, orbitRadius: 110, orbitAngle: 0.5 },
      { kind: "moon", id: `moon-${CH}-hydrogen-fusion`, position: { x: 300, y: -60 }, parentId: `planet-${CH}-main-sequence`, radius: 8, knowledgeRef: `${CH}-hydrogen-fusion`, orbitRadius: 20, orbitAngle: 0 },
      { kind: "moon", id: `moon-${CH}-hr-diagram`, position: { x: 340, y: -80 }, parentId: `planet-${CH}-main-sequence`, radius: 8, knowledgeRef: `${CH}-hr-diagram`, orbitRadius: 20, orbitAngle: 2 },
      { kind: "planet", id: `planet-${CH}-stellar-death`, position: { x: 480, y: 60 }, parentId: `sys-${CH}-stellar-evolution`, radius: 32, knowledgeRef: `${CH}-stellar-death`, orbitRadius: 130, orbitAngle: 2.3 },
      { kind: "moon", id: `moon-${CH}-supernova`, position: { x: 460, y: 60 }, parentId: `planet-${CH}-stellar-death`, radius: 10, knowledgeRef: `${CH}-supernova`, orbitRadius: 25, orbitAngle: 0 },
      { kind: "moon", id: `moon-${CH}-black-hole-formation`, position: { x: 500, y: 70 }, parentId: `planet-${CH}-stellar-death`, radius: 10, knowledgeRef: `${CH}-black-hole-formation`, orbitRadius: 25, orbitAngle: 3 },

      // Loose concept as asteroid
      { kind: "asteroid", id: `asteroid-${CH}-cosmic-scale`, position: { x: 0, y: 300 }, parentId: "root-galaxy", radius: 6, knowledgeRef: `${CH}-cosmic-scale` },

      // Decoratives
      { kind: "nebula", id: "nebula-default", position: { x: 200, y: -400 }, parentId: "root-galaxy", radius: 180 },
      { kind: "dust-cloud", id: "dust-default", position: { x: -200, y: 400 }, parentId: "root-galaxy", radius: 160 },
      { kind: "comet", id: "comet-default", position: { x: 600, y: -300 }, parentId: "root-galaxy", radius: 5, trajectoryAngle: 1.2 },
      { kind: "black-hole", id: "bh-default", position: { x: 700, y: 500 }, parentId: "root-galaxy", radius: 20 },
      { kind: "asteroid-belt", id: "belt-default", position: { x: 0, y: 0 }, parentId: "root-galaxy", radius: 850, innerRadius: 820, outerRadius: 880 },
    ],
  },

  visuals: {},
  scenes: {},
  conversations: {},

  progress: {
    bodies: {},
    totalBodies: 9,
    visitedCount: 0,
    completedCount: 0,
    overallMastery: 0,
  },

  pipeline: {
    ingest:        { status: "done", progress: 1, startedAt: now - 20000, finishedAt: now - 19500, error: null },
    structure:     { status: "done", progress: 1, startedAt: now - 19500, finishedAt: now - 17000, error: null },
    detail:        { status: "done", progress: 1, startedAt: now - 17000, finishedAt: now - 12000, error: null },
    coverageAudit: { status: "done", progress: 1, startedAt: now - 12000, finishedAt: now - 11500, error: null },
    narrative:     { status: "done", progress: 1, startedAt: now - 11500, finishedAt: now - 10000, error: null },
    layout:        { status: "done", progress: 1, startedAt: now - 17000, finishedAt: now - 16000, error: null },
    visuals:       { status: "done", progress: 1, startedAt: now - 10000, finishedAt: now - 8000, error: null },
  },
};

// Parse at import time — fails loudly if the fixture drifts from the schema.
export const sampleGalaxy = Galaxy.parse(raw);
