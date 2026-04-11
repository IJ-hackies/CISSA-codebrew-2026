/**
 * Mesh API routes — serve parsed GalaxyData from a galaxy workspace.
 *
 * Temporary route for development. Will be integrated into the main
 * galaxy routes once the v4 pipeline is wired up.
 */

import { Hono } from "hono";
import { resolve } from "path";
import { parseMeshDirectory } from "../lib/mesh-parser";

export const meshRoutes = new Hono();

/**
 * GET /api/mesh/:id
 *
 * Parse a galaxy workspace's Mesh/ directory and return GalaxyData JSON.
 * The :id is the galaxy workspace folder name under galaxies/.
 *
 * For dev/testing, also accepts a `path` query param to parse any Mesh/ directory:
 *   GET /api/mesh/test?path=/absolute/path/to/Mesh
 */
meshRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const queryPath = c.req.query("path");

  let meshDir: string;

  if (queryPath) {
    meshDir = queryPath;
  } else {
    // Default: look in galaxies/<id>/Mesh/
    const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();
    meshDir = resolve(workspaceRoot, "galaxies", id, "Mesh");
  }

  try {
    const data = await parseMeshDirectory(meshDir);

    console.log(
      `[mesh] parsed ${id}: ${Object.keys(data.solarSystems).length} solar systems, ` +
        `${Object.keys(data.planets).length} planets, ${Object.keys(data.concepts).length} concepts, ` +
        `${data.stories.length} stories, ${Object.keys(data.sources).length} sources`,
    );

    return c.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mesh] parse error for ${id}:`, message);
    return c.json({ error: "failed to parse mesh", message }, 500);
  }
});
