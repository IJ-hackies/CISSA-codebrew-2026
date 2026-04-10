// Stage 4: Layout (extension-aware).
//
// Pure code — no Claude calls. Consumes `galaxy.knowledge` and assigns
// 2D positions to every cosmic body, producing the `spatial` scope.
//
// Extension-aware: when extending a galaxy with a new chapter, existing
// body positions are PINNED — a visited moon never teleports. New topics
// land in angular gaps on an outer ring, new subtopics/concepts append
// to their parent's orbit.
//
// v1 uses deterministic concentric layout. Force-directed is a drop-in
// upgrade that must also respect position locks.

import type {
  Body,
  Galaxy,
  Knowledge,
  Spatial,
  Slug,
} from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";

const GEO = {
  galaxyRadius: 900,
  systemRingBaseRadius: 500,
  systemRingStep: 200,       // additional ring radius for overflow topics
  systemRadius: 240,
  starRadius: 40,
  planetRingRadius: 140,
  planetRadius: 26,
  moonRingRadius: 32,
  moonRadius: 8,
  asteroidRingRadius: 760,
  asteroidRadius: 6,
} as const;

/** Runs Stage 4. Requires `knowledge` to be populated. */
export function runLayout(galaxy: Galaxy): void {
  stageStart(galaxy, "layout");

  try {
    if (!galaxy.knowledge) {
      throw new Error("layout: knowledge is null — run Stage 1 first");
    }

    // Collect existing pinned bodies (from prior chapters).
    const existingBodies = galaxy.spatial?.bodies ?? [];
    const pinnedIds = new Set(existingBodies.map((b) => b.id));
    const pinnedByKnowledgeRef = new Map<string, Body>();
    for (const b of existingBodies) {
      if ("knowledgeRef" in b && b.knowledgeRef) {
        pinnedByKnowledgeRef.set(b.knowledgeRef, b);
      }
    }

    const bodies: Body[] = [...existingBodies];

    // Root galaxy body — only create if not already pinned.
    const rootId = "root-galaxy" as Slug;
    if (!pinnedIds.has(rootId)) {
      bodies.push({
        kind: "galaxy",
        id: rootId,
        position: { x: 0, y: 0 },
        parentId: null,
        radius: GEO.galaxyRadius,
        knowledgeRef: null,
      });
    }

    placeKnowledgeBearing(galaxy.knowledge, rootId, bodies, pinnedIds, pinnedByKnowledgeRef);
    placeAsteroids(galaxy.knowledge, rootId, bodies, pinnedIds);
    placeDecoratives(rootId, bodies, pinnedIds);

    // Compute bounds from actual body positions.
    const bounds = computeBounds(bodies);

    const spatial: Spatial = { bounds, bodies };
    galaxy.spatial = spatial;

    // Update totalBodies — playable = moons + asteroids.
    const playable = bodies.filter(
      (b) => b.kind === "moon" || b.kind === "asteroid",
    ).length;
    galaxy.progress = { ...galaxy.progress, totalBodies: playable };

    // Update meta.chapters with body IDs added by this run.
    const lastChapter = galaxy.meta.chapters[galaxy.meta.chapters.length - 1];
    if (lastChapter) {
      const newBodyIds = bodies
        .filter((b) => !pinnedIds.has(b.id))
        .map((b) => b.id);
      lastChapter.addedBodyIds = newBodyIds;
    }

    stageDone(galaxy, "layout");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "layout", message);
    throw err;
  }
}

function placeKnowledgeBearing(
  knowledge: Knowledge,
  rootId: Slug,
  bodies: Body[],
  pinnedIds: Set<string>,
  pinnedByKnowledgeRef: Map<string, Body>,
): void {
  const topics = knowledge.topics;
  if (topics.length === 0) return;

  const subtopicLookup = new Map(knowledge.subtopics.map((s) => [s.id, s]));

  // Count how many topics are already placed to find the next angular gap.
  const existingSystems = bodies.filter((b) => b.kind === "system");
  const placedTopicCount = existingSystems.length;

  // Determine which ring to use: base ring if room, outer ring otherwise.
  const totalTopics = topics.length;
  const ringRadius = totalTopics <= 8
    ? GEO.systemRingBaseRadius
    : GEO.systemRingBaseRadius + GEO.systemRingStep;

  topics.forEach((topic, ti) => {
    const systemId = `sys-${topic.id}` as Slug;
    const starId = `star-${topic.id}` as Slug;

    let sx: number, sy: number;

    if (pinnedByKnowledgeRef.has(topic.id)) {
      // Topic already placed — use existing position.
      const existing = pinnedByKnowledgeRef.get(topic.id)!;
      sx = existing.position.x;
      sy = existing.position.y;
    } else {
      // New topic — find an angular gap.
      const tAngle = ((placedTopicCount + ti) / Math.max(totalTopics, 6)) * Math.PI * 2;
      sx = Math.cos(tAngle) * ringRadius;
      sy = Math.sin(tAngle) * ringRadius;

      bodies.push({
        kind: "system",
        id: systemId,
        position: { x: sx, y: sy },
        parentId: rootId,
        radius: GEO.systemRadius,
        knowledgeRef: topic.id as Slug,
      });

      // Decorative star at the centre of each system.
      const spectral = ["G", "K", "M", "F", "A", "B", "O"] as const;
      bodies.push({
        kind: "star",
        id: starId,
        position: { x: sx, y: sy },
        parentId: systemId,
        radius: GEO.starRadius,
        spectralClass: spectral[ti % spectral.length],
      });
    }

    // Place subtopics as planets.
    const subtopics = topic.subtopicIds
      .map((id) => subtopicLookup.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);

    // Count existing planets for this system to find next orbit slot.
    const existingPlanets = bodies.filter(
      (b) => b.kind === "planet" && b.parentId === systemId,
    );

    subtopics.forEach((subtopic, pi) => {
      const planetId = `planet-${subtopic.id}` as Slug;

      if (pinnedByKnowledgeRef.has(subtopic.id)) {
        // Subtopic already placed — place its new concepts only.
        const existing = pinnedByKnowledgeRef.get(subtopic.id)!;
        placeConceptMoons(
          subtopic.conceptIds as Slug[],
          planetId,
          existing.position.x,
          existing.position.y,
          bodies,
          pinnedIds,
        );
        return;
      }

      const pAngle =
        ((existingPlanets.length + pi) / Math.max(subtopics.length, 1)) * Math.PI * 2 + ti * 0.7;
      const px = sx + Math.cos(pAngle) * GEO.planetRingRadius;
      const py = sy + Math.sin(pAngle) * GEO.planetRingRadius;

      bodies.push({
        kind: "planet",
        id: planetId,
        position: { x: px, y: py },
        parentId: systemId,
        radius: GEO.planetRadius,
        knowledgeRef: subtopic.id as Slug,
        orbitRadius: GEO.planetRingRadius,
        orbitAngle: pAngle,
      });

      placeConceptMoons(
        subtopic.conceptIds as Slug[],
        planetId,
        px,
        py,
        bodies,
        pinnedIds,
      );
    });
  });
}

function placeConceptMoons(
  conceptIds: Slug[],
  planetId: Slug,
  px: number,
  py: number,
  bodies: Body[],
  pinnedIds: Set<string>,
): void {
  // Count existing moons for this planet.
  const existingMoons = bodies.filter(
    (b) => b.kind === "moon" && b.parentId === planetId,
  );
  const offset = existingMoons.length;

  conceptIds.forEach((conceptId, mi) => {
    const moonId = `moon-${conceptId}` as Slug;
    if (pinnedIds.has(moonId)) return; // already placed

    const totalSlots = Math.max(conceptIds.length + offset, 1);
    const mAngle = ((offset + mi) / totalSlots) * Math.PI * 2;
    const mx = px + Math.cos(mAngle) * GEO.moonRingRadius;
    const my = py + Math.sin(mAngle) * GEO.moonRingRadius;

    bodies.push({
      kind: "moon",
      id: moonId,
      position: { x: mx, y: my },
      parentId: planetId,
      radius: GEO.moonRadius,
      knowledgeRef: conceptId,
      orbitRadius: GEO.moonRingRadius,
      orbitAngle: mAngle,
    });
  });
}

function placeAsteroids(
  knowledge: Knowledge,
  rootId: Slug,
  bodies: Body[],
  pinnedIds: Set<string>,
): void {
  const loose = knowledge.looseConceptIds;
  if (loose.length === 0) return;

  const existingAsteroids = bodies.filter((b) => b.kind === "asteroid");
  const offset = existingAsteroids.length;

  loose.forEach((conceptId, i) => {
    const asteroidId = `asteroid-${conceptId}` as Slug;
    if (pinnedIds.has(asteroidId)) return;

    const totalSlots = Math.max(loose.length + offset, 1);
    const angle = ((offset + i) / totalSlots) * Math.PI * 2 + 0.3;
    const r = GEO.asteroidRingRadius - 40;

    bodies.push({
      kind: "asteroid",
      id: asteroidId,
      position: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
      parentId: rootId,
      radius: GEO.asteroidRadius,
      knowledgeRef: conceptId as Slug,
    });
  });
}

function placeDecoratives(
  rootId: Slug,
  bodies: Body[],
  pinnedIds: Set<string>,
): void {
  const decoratives: Body[] = [
    {
      kind: "nebula",
      id: "nebula-default" as Slug,
      position: { x: -700, y: -600 },
      parentId: rootId,
      radius: 180,
    },
    {
      kind: "dust-cloud",
      id: "dust-default" as Slug,
      position: { x: 700, y: 600 },
      parentId: rootId,
      radius: 160,
    },
    {
      kind: "comet",
      id: "comet-default" as Slug,
      position: { x: 820, y: -520 },
      parentId: rootId,
      radius: 5,
      trajectoryAngle: 1.2,
    },
    {
      kind: "asteroid-belt",
      id: "belt-default" as Slug,
      position: { x: 0, y: 0 },
      parentId: rootId,
      radius: GEO.asteroidRingRadius,
      innerRadius: GEO.asteroidRingRadius - 20,
      outerRadius: GEO.asteroidRingRadius + 20,
    },
  ];

  for (const d of decoratives) {
    if (!pinnedIds.has(d.id)) {
      bodies.push(d);
    }
  }
}

function computeBounds(bodies: Body[]): Spatial["bounds"] {
  if (bodies.length === 0) {
    return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of bodies) {
    const r = b.radius;
    minX = Math.min(minX, b.position.x - r);
    minY = Math.min(minY, b.position.y - r);
    maxX = Math.max(maxX, b.position.x + r);
    maxY = Math.max(maxY, b.position.y + r);
  }

  // Add padding.
  const pad = 100;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}
