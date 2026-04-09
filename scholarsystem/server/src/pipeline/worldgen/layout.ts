// Stage 4: Layout.
//
// Pure code — no Claude call. Consumes `galaxy.knowledge` and assigns 2D
// positions to every cosmic body, producing the `spatial` scope.
//
// This v1 uses a deterministic concentric layout rather than a full
// force-directed simulation. Force-directed is more visually pleasing for
// dense graphs, but for hackathon v1 the deterministic layout is:
//   - trivially debuggable (every position is a function of tree indices)
//   - stable across re-runs (same input → identical layout, good for diffs)
//   - sufficient for rendering a playable galaxy map
//
// Upgrade path: swap the body of `placeKnowledgeBearing` for a force-directed
// pass. The surrounding code (stage flipping, decorative placement, bounds
// calculation, progress totalBodies count) doesn't change.
//
// Layout strategy:
//   - Root galaxy at the origin.
//   - Topic systems placed on a ring around the origin.
//   - Each system has a central star (decorative) and its subtopic planets
//     arranged on a ring around the star.
//   - Each planet's concept moons arranged on a small ring around the planet.
//   - Loose concepts become asteroids scattered in an outer ring.
//   - A few decoratives (nebula, dust cloud, comet, belt) sprinkled in for
//     visual density. Real decorative density comes later.

import {
  Body,
  Galaxy,
  KNOWLEDGE_BEARING_KINDS,
  Knowledge,
  Spatial,
} from "../../../../shared/types";
import { stageStart, stageDone, stageError } from "../../lib/blob";

// Geometry knobs. Tweak here — every magic number is named and centralised.
const GEO = {
  galaxyRadius: 900,
  systemRingRadius: 500,
  systemRadius: 240,
  starRadius: 40,
  planetRingRadius: 140,
  planetRadius: 26,
  moonRingRadius: 32,
  moonRadius: 8,
  asteroidRingRadius: 760,
  asteroidRadius: 6,
  bounds: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
} as const;

/** Runs Stage 4 against the galaxy. Requires `knowledge` to be populated. */
export function runLayout(galaxy: Galaxy): Galaxy {
  stageStart(galaxy, "layout");

  try {
    if (!galaxy.knowledge) {
      throw new Error("layout: knowledge is null — run Stage 1 first");
    }

    const bodies: Body[] = [];
    const rootId = "root-galaxy";

    // ─── Root galaxy ─────────────────────────────────
    bodies.push({
      kind: "galaxy",
      id: rootId,
      position: { x: 0, y: 0 },
      parentId: null,
      radius: GEO.galaxyRadius,
      knowledgeRef: null,
    });

    placeKnowledgeBearing(galaxy.knowledge, rootId, bodies);
    placeAsteroids(galaxy.knowledge, rootId, bodies);
    placeDecoratives(rootId, bodies);

    const spatial: Spatial = {
      bounds: { ...GEO.bounds },
      bodies,
    };

    galaxy.spatial = spatial;

    // Progress.totalBodies reflects the count of playable bodies (moons +
    // asteroids — the per-concept scene anchors). We update it here because
    // layout is the first stage that knows the final count.
    const playable = bodies.filter(
      (b) => b.kind === "moon" || b.kind === "asteroid",
    ).length;
    galaxy.progress = { ...galaxy.progress, totalBodies: playable };

    stageDone(galaxy, "layout");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "layout", message);
    throw err;
  }
}

function placeKnowledgeBearing(
  knowledge: Knowledge,
  rootId: string,
  bodies: Body[],
): void {
  const topics = knowledge.topics;
  if (topics.length === 0) return;

  const subtopicLookup = new Map(knowledge.subtopics.map((s) => [s.id, s]));

  topics.forEach((topic, ti) => {
    const tAngle = (ti / topics.length) * Math.PI * 2;
    const sx = Math.cos(tAngle) * GEO.systemRingRadius;
    const sy = Math.sin(tAngle) * GEO.systemRingRadius;
    const systemId = `sys-${topic.id}`;

    bodies.push({
      kind: "system",
      id: systemId,
      position: { x: sx, y: sy },
      parentId: rootId,
      radius: GEO.systemRadius,
      knowledgeRef: topic.id,
    });

    // Decorative star at the centre of each system. Spectral class rotates
    // through a small set for variety; real assignment happens in worldgen
    // visuals later.
    const spectral = ["G", "K", "M", "F", "A", "B", "O"] as const;
    bodies.push({
      kind: "star",
      id: `star-${topic.id}`,
      position: { x: sx, y: sy },
      parentId: systemId,
      radius: GEO.starRadius,
      spectralClass: spectral[ti % spectral.length],
    });

    const subtopics = topic.subtopicIds
      .map((id) => subtopicLookup.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);

    subtopics.forEach((subtopic, pi) => {
      // Stagger planet start angles per system so neighbouring systems don't
      // all line up their planets along the same axis.
      const pAngle = (pi / Math.max(subtopics.length, 1)) * Math.PI * 2 + ti * 0.7;
      const px = sx + Math.cos(pAngle) * GEO.planetRingRadius;
      const py = sy + Math.sin(pAngle) * GEO.planetRingRadius;
      const planetId = `planet-${subtopic.id}`;

      bodies.push({
        kind: "planet",
        id: planetId,
        position: { x: px, y: py },
        parentId: systemId,
        radius: GEO.planetRadius,
        knowledgeRef: subtopic.id,
        orbitRadius: GEO.planetRingRadius,
        orbitAngle: pAngle,
      });

      subtopic.conceptIds.forEach((conceptId, mi) => {
        const mAngle = (mi / Math.max(subtopic.conceptIds.length, 1)) * Math.PI * 2;
        const mx = px + Math.cos(mAngle) * GEO.moonRingRadius;
        const my = py + Math.sin(mAngle) * GEO.moonRingRadius;
        bodies.push({
          kind: "moon",
          id: `moon-${conceptId}`,
          position: { x: mx, y: my },
          parentId: planetId,
          radius: GEO.moonRadius,
          knowledgeRef: conceptId,
          orbitRadius: GEO.moonRingRadius,
          orbitAngle: mAngle,
        });
      });
    });
  });
}

function placeAsteroids(
  knowledge: Knowledge,
  rootId: string,
  bodies: Body[],
): void {
  const loose = knowledge.looseConceptIds;
  if (loose.length === 0) return;
  loose.forEach((conceptId, i) => {
    // Offset loose asteroids slightly from the belt ring so they don't
    // overlap the decorative belt visually.
    const angle = (i / loose.length) * Math.PI * 2 + 0.3;
    const r = GEO.asteroidRingRadius - 40;
    bodies.push({
      kind: "asteroid",
      id: `asteroid-${conceptId}`,
      position: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
      parentId: rootId,
      radius: GEO.asteroidRadius,
      knowledgeRef: conceptId,
    });
  });
}

function placeDecoratives(rootId: string, bodies: Body[]): void {
  // Minimal flourish. Full decorative population lands with worldgen/visuals.
  bodies.push(
    {
      kind: "nebula",
      id: "nebula-default",
      position: { x: -700, y: -600 },
      parentId: rootId,
      radius: 180,
    },
    {
      kind: "dust-cloud",
      id: "dust-default",
      position: { x: 700, y: 600 },
      parentId: rootId,
      radius: 160,
    },
    {
      kind: "comet",
      id: "comet-default",
      position: { x: 820, y: -520 },
      parentId: rootId,
      radius: 5,
      trajectoryAngle: 1.2,
    },
    {
      kind: "asteroid-belt",
      id: "belt-default",
      position: { x: 0, y: 0 },
      parentId: rootId,
      radius: GEO.asteroidRingRadius,
      innerRadius: GEO.asteroidRingRadius - 20,
      outerRadius: GEO.asteroidRingRadius + 20,
    },
  );
}

// Re-exported so route handlers and tests can assert on the kinds we place.
export const KNOWLEDGE_KINDS = KNOWLEDGE_BEARING_KINDS;
