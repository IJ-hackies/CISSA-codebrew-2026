import { Hono } from "hono";
import { sampleGalaxy } from "../fixtures/sample-galaxy";

// Galaxy CRUD routes. Currently serves the fixture for every id so the
// frontend has something to render while the real pipeline + db layer
// are being built. Replace the handler bodies with db/store lookups
// once `db/store.ts` lands.
export const galaxyRoutes = new Hono();

galaxyRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  // TODO: look up by id from SQLite. For now every id maps to the fixture.
  return c.json({ ...sampleGalaxy, meta: { ...sampleGalaxy.meta, id: sampleGalaxy.meta.id } });
});
