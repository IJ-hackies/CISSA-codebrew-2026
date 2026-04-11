// Gallery ("The Taco") routes.
//
//   GET  /api/gallery                → list public galaxies (sort + search)
//   POST /api/gallery/publish        → publish a galaxy (requires owner_token + tagline)
//   POST /api/gallery/unpublish      → remove from gallery (requires owner_token)
//   POST /api/gallery/reconcile      → touch last_owner_seen_at (keeps entries alive)
//   PATCH /api/gallery/:id/tagline   → update tagline (requires owner_token)

import { Hono } from "hono";
import {
  listPublicGalaxies,
  publishGalaxy,
  unpublishGalaxy,
  updateGalaxyTagline,
  reconcileOwnership,
  verifyOwnerToken,
  getGalaxyRow,
} from "../db/client";
import { moderateGalleryContent } from "../lib/moderation";

export const galleryRoutes = new Hono();

// ── GET /api/gallery ───────────────────────────────────────────────
// Query params:
//   sort=newest|planets|alpha  (default: newest)
//   q=<search term>

galleryRoutes.get("/", (c) => {
  const sort = (c.req.query("sort") ?? "newest") as "newest" | "planets" | "alpha";
  const q = (c.req.query("q") ?? "").trim().toLowerCase();

  let cards = listPublicGalaxies();

  // Search
  if (q) {
    cards = cards.filter(
      (card) =>
        card.title.toLowerCase().includes(q) ||
        (card.tagline ?? "").toLowerCase().includes(q),
    );
  }

  // Sort
  if (sort === "planets") {
    cards.sort((a, b) => b.planetCount - a.planetCount);
  } else if (sort === "alpha") {
    cards.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // newest — by updatedAt desc
    cards.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return c.json({ cards });
});

// ── POST /api/gallery/publish ──────────────────────────────────────

galleryRoutes.post("/publish", async (c) => {
  let body: { galaxyId?: string; ownerToken?: string; tagline?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const { galaxyId, ownerToken, tagline } = body;
  if (!galaxyId || !ownerToken || typeof tagline !== "string") {
    return c.json({ error: "galaxyId, ownerToken, and tagline are required" }, 400);
  }

  const trimmedTagline = tagline.trim();
  if (!trimmedTagline) {
    return c.json({ error: "tagline cannot be empty" }, 400);
  }
  if (trimmedTagline.length > 280) {
    return c.json({ error: "tagline must be 280 characters or fewer" }, 400);
  }

  const row = verifyOwnerToken(galaxyId, ownerToken);
  if (!row) return c.json({ error: "invalid owner token" }, 403);

  if (row.status !== "complete") {
    return c.json({ error: "galaxy must be complete before publishing" }, 409);
  }

  // Moderation check
  const mod = await moderateGalleryContent(row.title, trimmedTagline);
  if (!mod.pass) {
    return c.json({ error: "content policy violation", reason: mod.reason }, 422);
  }

  publishGalaxy(galaxyId, trimmedTagline);
  return c.json({ ok: true, galaxyId });
});

// ── POST /api/gallery/unpublish ────────────────────────────────────

galleryRoutes.post("/unpublish", async (c) => {
  let body: { galaxyId?: string; ownerToken?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const { galaxyId, ownerToken } = body;
  if (!galaxyId || !ownerToken) {
    return c.json({ error: "galaxyId and ownerToken are required" }, 400);
  }

  const row = verifyOwnerToken(galaxyId, ownerToken);
  if (!row) return c.json({ error: "invalid owner token" }, 403);

  unpublishGalaxy(galaxyId);
  return c.json({ ok: true, galaxyId });
});

// ── POST /api/gallery/reconcile ────────────────────────────────────
// Frontend calls this on dashboard mount to keep published galaxies alive.

galleryRoutes.post("/reconcile", async (c) => {
  let body: { owned?: Array<{ galaxyId: string; ownerToken: string }> };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const owned = body.owned ?? [];
  if (!Array.isArray(owned)) {
    return c.json({ error: "owned must be an array" }, 400);
  }

  const updated = reconcileOwnership(owned);
  return c.json({ ok: true, updated });
});

// ── PATCH /api/gallery/:id/tagline ─────────────────────────────────

galleryRoutes.patch("/:id/tagline", async (c) => {
  const galaxyId = c.req.param("id");

  let body: { ownerToken?: string; tagline?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const { ownerToken, tagline } = body;
  if (!ownerToken || typeof tagline !== "string") {
    return c.json({ error: "ownerToken and tagline are required" }, 400);
  }

  const trimmedTagline = tagline.trim();
  if (!trimmedTagline) {
    return c.json({ error: "tagline cannot be empty" }, 400);
  }
  if (trimmedTagline.length > 280) {
    return c.json({ error: "tagline must be 280 characters or fewer" }, 400);
  }

  const row = verifyOwnerToken(galaxyId, ownerToken);
  if (!row) return c.json({ error: "invalid owner token" }, 403);

  // Moderation check on updated tagline
  const mod = await moderateGalleryContent(row.title, trimmedTagline);
  if (!mod.pass) {
    return c.json({ error: "content policy violation", reason: mod.reason }, 422);
  }

  updateGalaxyTagline(galaxyId, trimmedTagline);
  return c.json({ ok: true, galaxyId });
});
