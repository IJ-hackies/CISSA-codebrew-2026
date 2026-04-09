// Hand-authored sample galaxy used for local development and as a render
// target for the frontend before the real pipeline is wired up.
//
// The fixture is validated against the Galaxy Zod schema at import time,
// so if the schema drifts from this shape the server will fail to start
// rather than serving a subtly-broken blob. This is intentional — the
// fixture is also a living contract test.

import { Galaxy } from "../../../shared/types";

const now = Date.now();

const raw = {
  meta: {
    id: "a1b2c3d4-e5f6-4789-8abc-123456789abc",
    schemaVersion: 1,
    createdAt: now - 20000,
    updatedAt: now,
    title: "Intro to Astronomy (fixture)",
  },

  source: {
    kind: "text",
    filename: null,
    byteSize: 1024,
    charCount: 1024,
    contentHash: "fixture-sha256-placeholder",
    excerpt:
      "Sample astronomy notes covering the solar system and stellar evolution...",
  },

  knowledge: {
    title: "Intro to Astronomy",
    summary: "A brief survey of the solar system and the life cycle of stars.",
    topics: [
      {
        id: "solar-system",
        title: "The Solar System",
        summary: "The worlds orbiting our own star.",
        subtopicIds: ["inner-planets", "outer-planets"],
      },
      {
        id: "stellar-evolution",
        title: "Stellar Evolution",
        summary: "How stars are born, live, and die.",
        subtopicIds: ["main-sequence", "stellar-death"],
      },
    ],
    subtopics: [
      {
        id: "inner-planets",
        title: "Inner Planets",
        summary: "The small, rocky worlds close to the sun.",
        conceptIds: ["rocky-planet-def", "venus-atmosphere"],
      },
      {
        id: "outer-planets",
        title: "Outer Planets",
        summary: "The gas and ice giants of the outer solar system.",
        conceptIds: ["gas-giant-composition", "jupiter-red-spot"],
      },
      {
        id: "main-sequence",
        title: "Main Sequence",
        summary: "The long, stable phase of a star's life.",
        conceptIds: ["hydrogen-fusion", "hr-diagram"],
      },
      {
        id: "stellar-death",
        title: "Stellar Death",
        summary: "The endpoints of stellar evolution.",
        conceptIds: ["supernova", "black-hole-formation"],
      },
    ],
    concepts: [
      {
        id: "rocky-planet-def",
        title: "Rocky Planet Definition",
        kind: "definition",
        brief: "A planet composed primarily of silicate rock or metal.",
        modelTier: "light",
      },
      {
        id: "venus-atmosphere",
        title: "Venus Atmospheric Pressure",
        kind: "fact",
        brief: "Venus has roughly 92 times Earth's surface pressure.",
        modelTier: "light",
      },
      {
        id: "gas-giant-composition",
        title: "Gas Giant Composition",
        kind: "definition",
        brief: "Gas giants are dominated by hydrogen and helium.",
        modelTier: "standard",
      },
      {
        id: "jupiter-red-spot",
        title: "Jupiter's Great Red Spot",
        kind: "fact",
        brief: "A persistent anticyclonic storm larger than Earth.",
        modelTier: "light",
      },
      {
        id: "hydrogen-fusion",
        title: "Hydrogen Fusion",
        kind: "process",
        brief: "The proton-proton chain that powers main-sequence stars.",
        modelTier: "standard",
      },
      {
        id: "hr-diagram",
        title: "Luminosity-Temperature Relation",
        kind: "principle",
        brief: "The HR diagram plots luminosity against surface temperature.",
        modelTier: "heavy",
      },
      {
        id: "supernova",
        title: "Supernova",
        kind: "process",
        brief: "The explosive death of a massive star.",
        modelTier: "heavy",
      },
      {
        id: "black-hole-formation",
        title: "Black Hole Formation",
        kind: "process",
        brief: "Gravitational collapse of a sufficiently massive stellar core.",
        modelTier: "heavy",
      },
      {
        id: "cosmic-scale",
        title: "Cosmic Scale Intuition",
        kind: "fact",
        brief: "Distances in space are unintuitively vast.",
        modelTier: "light",
      },
    ],
    // Concepts not attached to any subtopic — these become asteroids in
    // the spatial layer instead of moons.
    looseConceptIds: ["cosmic-scale"],
  },

  // Partial population is valid. Stage 2 fills this in as chunks finish;
  // here we include a couple of entries to demo the shape and leave the
  // rest missing on purpose.
  detail: {
    "rocky-planet-def": {
      conceptId: "rocky-planet-def",
      fullDefinition:
        "A rocky (terrestrial) planet is a planet composed primarily of silicate rocks or metals, with a solid surface, in contrast to gas giants which lack a well-defined surface.",
      formulas: [],
      workedExamples: [
        "Mercury, Venus, Earth, and Mars are the rocky planets of our solar system.",
      ],
      edgeCases: ["Some exoplanets blur the line between rocky and mini-Neptune."],
      mnemonics: [],
      emphasisMarkers: [],
      sourceQuotes: [],
      extractedAt: now - 7500,
    },
    "hydrogen-fusion": {
      conceptId: "hydrogen-fusion",
      fullDefinition:
        "Hydrogen fusion in main-sequence stars proceeds primarily via the proton-proton chain, converting four protons into one helium-4 nucleus plus positrons, neutrinos, and gamma-ray photons.",
      formulas: ["4 ¹H → ⁴He + 2 e⁺ + 2 νₑ + 2 γ"],
      workedExamples: [
        "The Sun converts approximately 4.3 million tonnes of mass into energy every second via this process.",
      ],
      edgeCases: [
        "More massive stars also use the CNO cycle, which dominates above about 1.3 solar masses.",
      ],
      mnemonics: [],
      emphasisMarkers: [
        "Emphasized: the proton-proton chain is the dominant channel in sun-like stars.",
      ],
      sourceQuotes: [],
      extractedAt: now - 6800,
    },
  },

  relationships: [
    { from: "hydrogen-fusion", to: "supernova", kind: "prerequisite" },
    { from: "rocky-planet-def", to: "gas-giant-composition", kind: "contrasts" },
    { from: "supernova", to: "black-hole-formation", kind: "prerequisite" },
    { from: "hr-diagram", to: "hydrogen-fusion", kind: "related" },
  ],

  narrative: {
    setting:
      "The dying embers of a forgotten star cluster, where the last light of ancient suns fades into archival silence.",
    protagonist:
      "You are a first-cycle cadet of the Veyari Cartographers Guild, sent to chart the cluster before its stars go dark.",
    premise:
      "Each world holds a fragment of knowledge the Veyari left behind. Recover them all, and you become a Cartographer in truth.",
    stakes:
      "If the knowledge is not mapped before the last star dims, it is lost to the galaxy forever.",
    tone: {
      primary: "wondrous",
      secondary: "tinged with quiet melancholy",
      genre: "archaeological",
    },
    aesthetic: {
      paletteDirection:
        "deep indigos, warm amber glows, pale bioluminescent highlights",
      atmosphereDirection:
        "soft drifting particles, distant auroras, a sense of vast silence",
      motifKeywords: [
        "glyphs",
        "starlight",
        "archives",
        "drift",
        "echoes",
        "cartography",
      ],
    },
    arcSummary:
      "A journey from the familiar worlds of the solar system outward into the life and death of stars, ending at the threshold of a black hole where the Veyari's last message waits.",
    arcBeats: [
      {
        topicId: "solar-system",
        role: "opening",
        beat:
          "You arrive at the cluster's outer rim and catalogue its small, familiar worlds.",
        emotionalTarget: "curiosity",
        connectsTo: ["stellar-evolution"],
      },
      {
        topicId: "stellar-evolution",
        role: "climax",
        beat:
          "You follow the life of the cluster's dying star and witness its final transformation.",
        emotionalTarget: "awe",
        connectsTo: ["solar-system"],
      },
    ],
    recurringCharacters: [
      {
        id: "the-curator",
        name: "The Curator",
        role: "guide",
        description:
          "A pale bioluminescent figure who appears at each archive, half-present, half-memory.",
        voice:
          "Formal, archaic, never uses contractions, refers to the user as 'cadet'.",
        arc: "Grows more solid — more present — with each fragment recovered.",
      },
    ],
    finaleHook:
      "At the center of the dying cluster, the last Veyari archive opens and speaks your own voice back to you.",
    hardConstraints: [
      "the user is never in physical danger",
      "the Veyari are never shown alive, only through their records",
      "no other living beings appear except the Curator",
    ],
  },

  spatial: {
    bounds: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
    bodies: [
      // ─── Root ─────────────────────────────────────────
      {
        kind: "galaxy",
        id: "root-galaxy",
        position: { x: 0, y: 0 },
        parentId: null,
        radius: 900,
        knowledgeRef: null,
      },

      // ─── System 1: The Solar System ───────────────────
      {
        kind: "system",
        id: "sys-solar",
        position: { x: -400, y: 0 },
        parentId: "root-galaxy",
        radius: 250,
        knowledgeRef: "solar-system",
      },
      {
        kind: "star",
        id: "star-solar",
        position: { x: -400, y: 0 },
        parentId: "sys-solar",
        radius: 40,
        spectralClass: "G",
      },
      {
        kind: "planet",
        id: "planet-inner",
        position: { x: -320, y: -60 },
        parentId: "sys-solar",
        radius: 25,
        knowledgeRef: "inner-planets",
        orbitRadius: 100,
        orbitAngle: 0.4,
      },
      {
        kind: "moon",
        id: "moon-rocky-def",
        position: { x: -300, y: -60 },
        parentId: "planet-inner",
        radius: 8,
        knowledgeRef: "rocky-planet-def",
        orbitRadius: 20,
        orbitAngle: 0,
      },
      {
        kind: "moon",
        id: "moon-venus",
        position: { x: -320, y: -40 },
        parentId: "planet-inner",
        radius: 8,
        knowledgeRef: "venus-atmosphere",
        orbitRadius: 20,
        orbitAngle: 1.5,
      },
      {
        kind: "planet",
        id: "planet-outer",
        position: { x: -480, y: 60 },
        parentId: "sys-solar",
        radius: 30,
        knowledgeRef: "outer-planets",
        orbitRadius: 120,
        orbitAngle: 2.1,
      },
      {
        kind: "moon",
        id: "moon-gas-giant",
        position: { x: -460, y: 60 },
        parentId: "planet-outer",
        radius: 8,
        knowledgeRef: "gas-giant-composition",
        orbitRadius: 22,
        orbitAngle: 0,
      },
      {
        kind: "moon",
        id: "moon-jupiter-spot",
        position: { x: -500, y: 70 },
        parentId: "planet-outer",
        radius: 8,
        knowledgeRef: "jupiter-red-spot",
        orbitRadius: 22,
        orbitAngle: 3.1,
      },

      // ─── System 2: Stellar Evolution ──────────────────
      {
        kind: "system",
        id: "sys-stellar",
        position: { x: 400, y: 0 },
        parentId: "root-galaxy",
        radius: 250,
        knowledgeRef: "stellar-evolution",
      },
      {
        kind: "star",
        id: "star-stellar",
        position: { x: 400, y: 0 },
        parentId: "sys-stellar",
        radius: 50,
        spectralClass: "O",
      },
      {
        kind: "planet",
        id: "planet-mainseq",
        position: { x: 320, y: -60 },
        parentId: "sys-stellar",
        radius: 28,
        knowledgeRef: "main-sequence",
        orbitRadius: 110,
        orbitAngle: 0.5,
      },
      {
        kind: "moon",
        id: "moon-fusion",
        position: { x: 300, y: -60 },
        parentId: "planet-mainseq",
        radius: 8,
        knowledgeRef: "hydrogen-fusion",
        orbitRadius: 20,
        orbitAngle: 0,
      },
      {
        kind: "moon",
        id: "moon-hr",
        position: { x: 340, y: -80 },
        parentId: "planet-mainseq",
        radius: 8,
        knowledgeRef: "hr-diagram",
        orbitRadius: 20,
        orbitAngle: 2,
      },
      {
        kind: "planet",
        id: "planet-death",
        position: { x: 480, y: 60 },
        parentId: "sys-stellar",
        radius: 32,
        knowledgeRef: "stellar-death",
        orbitRadius: 130,
        orbitAngle: 2.3,
      },
      {
        kind: "moon",
        id: "moon-supernova",
        position: { x: 460, y: 60 },
        parentId: "planet-death",
        radius: 10,
        knowledgeRef: "supernova",
        orbitRadius: 25,
        orbitAngle: 0,
      },
      {
        kind: "moon",
        id: "moon-blackhole-form",
        position: { x: 500, y: 70 },
        parentId: "planet-death",
        radius: 10,
        knowledgeRef: "black-hole-formation",
        orbitRadius: 25,
        orbitAngle: 3,
      },

      // ─── Loose concept as an asteroid ─────────────────
      {
        kind: "asteroid",
        id: "asteroid-cosmic-scale",
        position: { x: 0, y: 300 },
        parentId: "root-galaxy",
        radius: 6,
        knowledgeRef: "cosmic-scale",
      },

      // ─── Decoratives (code-placed, no knowledge) ──────
      {
        kind: "nebula",
        id: "nebula-1",
        position: { x: 200, y: -400 },
        parentId: "root-galaxy",
        radius: 180,
      },
      {
        kind: "dust-cloud",
        id: "dust-1",
        position: { x: -200, y: 400 },
        parentId: "root-galaxy",
        radius: 160,
      },
      {
        kind: "comet",
        id: "comet-1",
        position: { x: 600, y: -300 },
        parentId: "root-galaxy",
        radius: 5,
        trajectoryAngle: 1.2,
      },
      {
        kind: "black-hole",
        id: "bh-1",
        position: { x: 700, y: 500 },
        parentId: "root-galaxy",
        radius: 20,
      },
      {
        kind: "asteroid-belt",
        id: "belt-1",
        position: { x: 0, y: 0 },
        parentId: "root-galaxy",
        radius: 850,
        innerRadius: 820,
        outerRadius: 880,
      },
    ],
  },

  visuals: {
    "root-galaxy": {
      kind: "galaxy",
      palette: {
        primary: "#0a0020",
        secondary: "#2a0f40",
        accent: "#ff9a3c",
        atmosphere: "rgba(30,0,60,0.5)",
      },
      armStyle: "spiral",
      starDensity: 0.7,
    },
    "sys-solar": {
      kind: "system",
      palette: {
        primary: "#1a0533",
        secondary: "#6b2fa0",
        accent: "#ffc98a",
        atmosphere: "rgba(107,47,160,0.3)",
      },
      starGlow: 0.6,
      orbitRingVisible: true,
    },
    "sys-stellar": {
      kind: "system",
      palette: {
        primary: "#0f0a28",
        secondary: "#4a1b70",
        accent: "#ff6b35",
        atmosphere: "rgba(74,27,112,0.35)",
      },
      starGlow: 0.9,
      orbitRingVisible: true,
    },
    "planet-inner": {
      kind: "planet",
      palette: {
        primary: "#b07a4e",
        secondary: "#6c4028",
        accent: "#f3d08a",
        atmosphere: "rgba(200,140,80,0.2)",
      },
      terrain: "rocky",
      atmosphere: "thin",
      lighting: "sunlit",
      features: ["craters", "dusty plains"],
      mood: "arid",
      ring: false,
    },
    "planet-outer": {
      kind: "planet",
      palette: {
        primary: "#6a8cc9",
        secondary: "#2d3f6b",
        accent: "#e4c57a",
        atmosphere: "rgba(106,140,201,0.35)",
      },
      terrain: "gaseous",
      atmosphere: "dense-haze",
      lighting: "twilight",
      features: ["banded clouds", "storm"],
      mood: "vast",
      ring: true,
    },
    "planet-mainseq": {
      kind: "planet",
      palette: {
        primary: "#d9844f",
        secondary: "#5a2b12",
        accent: "#ffe08a",
        atmosphere: "rgba(217,132,79,0.3)",
      },
      terrain: "molten",
      atmosphere: "stormy",
      lighting: "sunlit",
      features: ["lava rivers", "solar flares"],
      mood: "radiant",
      ring: false,
    },
    "planet-death": {
      kind: "planet",
      palette: {
        primary: "#2a1a3d",
        secondary: "#0f0820",
        accent: "#b266ff",
        atmosphere: "rgba(42,26,61,0.5)",
      },
      terrain: "crystalline",
      atmosphere: "aurora",
      lighting: "nebula-lit",
      features: ["fractured surface", "violet aurora"],
      mood: "ominous",
      ring: false,
    },
    "moon-rocky-def": {
      kind: "moon",
      palette: {
        primary: "#8a7560",
        secondary: "#4d3a29",
        accent: "#d9c6a0",
        atmosphere: "rgba(0,0,0,0)",
      },
      terrain: "rocky",
      cratered: true,
      glow: false,
    },
    "moon-venus": {
      kind: "moon",
      palette: {
        primary: "#d9a857",
        secondary: "#7a4f1c",
        accent: "#ffd998",
        atmosphere: "rgba(217,168,87,0.4)",
      },
      terrain: "rocky",
      cratered: false,
      glow: true,
    },
    "moon-gas-giant": {
      kind: "moon",
      palette: {
        primary: "#a0b4d9",
        secondary: "#4a5d80",
        accent: "#f0e8c0",
        atmosphere: "rgba(0,0,0,0)",
      },
      terrain: "gaseous",
      cratered: false,
      glow: false,
    },
    "moon-jupiter-spot": {
      kind: "moon",
      palette: {
        primary: "#c76b5a",
        secondary: "#6b2b1e",
        accent: "#f0c19a",
        atmosphere: "rgba(199,107,90,0.3)",
      },
      terrain: "gaseous",
      cratered: false,
      glow: false,
    },
    "moon-fusion": {
      kind: "moon",
      palette: {
        primary: "#ffd48a",
        secondary: "#b06a1a",
        accent: "#ffffff",
        atmosphere: "rgba(255,212,138,0.5)",
      },
      terrain: "molten",
      cratered: false,
      glow: true,
    },
    "moon-hr": {
      kind: "moon",
      palette: {
        primary: "#7db0d4",
        secondary: "#2d4a6b",
        accent: "#ffffff",
        atmosphere: "rgba(0,0,0,0)",
      },
      terrain: "crystalline",
      cratered: false,
      glow: true,
    },
    "moon-supernova": {
      kind: "moon",
      palette: {
        primary: "#ff5a3c",
        secondary: "#8a1a0c",
        accent: "#ffe08a",
        atmosphere: "rgba(255,90,60,0.5)",
      },
      terrain: "molten",
      cratered: false,
      glow: true,
    },
    "moon-blackhole-form": {
      kind: "moon",
      palette: {
        primary: "#1a0833",
        secondary: "#000000",
        accent: "#7a3cff",
        atmosphere: "rgba(26,8,51,0.6)",
      },
      terrain: "crystalline",
      cratered: true,
      glow: true,
    },
    "asteroid-cosmic-scale": {
      kind: "asteroid",
      palette: {
        primary: "#6e6457",
        secondary: "#332e28",
        accent: "#c4b89a",
        atmosphere: "rgba(0,0,0,0)",
      },
      shape: "angular",
    },
    "star-solar": {
      kind: "star",
      palette: {
        primary: "#ffdc7d",
        secondary: "#ff9a3c",
        accent: "#ffffff",
        atmosphere: "rgba(255,220,125,0.4)",
      },
      coronaIntensity: 0.6,
      pulseRate: 0.2,
    },
    "star-stellar": {
      kind: "star",
      palette: {
        primary: "#a0c4ff",
        secondary: "#3c6bff",
        accent: "#ffffff",
        atmosphere: "rgba(160,196,255,0.5)",
      },
      coronaIntensity: 0.9,
      pulseRate: 0.5,
    },
    "nebula-1": {
      kind: "nebula",
      palette: {
        primary: "#4a1b70",
        secondary: "#1a0533",
        accent: "#b266ff",
        atmosphere: "rgba(74,27,112,0.4)",
      },
      density: 0.5,
      swirl: 0.3,
    },
    "dust-1": {
      kind: "dust-cloud",
      palette: {
        primary: "#3a2a4a",
        secondary: "#1a1020",
        accent: "#6a4a80",
        atmosphere: "rgba(58,42,74,0.3)",
      },
      opacity: 0.4,
    },
    "comet-1": {
      kind: "comet",
      palette: {
        primary: "#a0c4ff",
        secondary: "#4a6bff",
        accent: "#ffffff",
        atmosphere: "rgba(0,0,0,0)",
      },
      tailLength: 60,
    },
    "bh-1": {
      kind: "black-hole",
      palette: {
        primary: "#000000",
        secondary: "#1a0033",
        accent: "#7a3cff",
        atmosphere: "rgba(122,60,255,0.3)",
      },
      accretionIntensity: 0.8,
    },
    "belt-1": {
      kind: "asteroid-belt",
      palette: {
        primary: "#5a4a3a",
        secondary: "#2a2018",
        accent: "#8a7560",
        atmosphere: "rgba(0,0,0,0)",
      },
      density: 0.3,
    },
  },

  scenes: {},

  progress: {
    bodies: {},
    totalBodies: 9,
    visitedCount: 0,
    completedCount: 0,
    overallMastery: 0,
  },

  pipeline: {
    ingest:    { status: "done", progress: 1, startedAt: now - 20000, finishedAt: now - 19500, error: null },
    structure: { status: "done", progress: 1, startedAt: now - 19500, finishedAt: now - 17000, error: null },
    detail:    { status: "done", progress: 1, startedAt: now - 17000, finishedAt: now - 12000, error: null },
    narrative: { status: "done", progress: 1, startedAt: now - 12000, finishedAt: now - 10000, error: null },
    layout:    { status: "done", progress: 1, startedAt: now - 17000, finishedAt: now - 16000, error: null },
    visuals:   { status: "done", progress: 1, startedAt: now - 10000, finishedAt: now - 8000, error: null },
  },
};

// Parse at import time — fails loudly if the fixture drifts from the schema.
export const sampleGalaxy = Galaxy.parse(raw);
