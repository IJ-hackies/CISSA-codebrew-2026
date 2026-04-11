import { Hono } from "hono";
import { sign } from "hono/jwt";
import { randomUUID } from "node:crypto";
import { createUser, getUserByUsername } from "../db/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "stellataco-dev-secret";

export { JWT_SECRET };

export const authRoutes = new Hono();

// ── POST /api/auth/register ───────────────────────────────────────

authRoutes.post("/register", async (c) => {
  let body: { username?: string; password?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || username.length < 2) {
    return c.json({ error: "username must be at least 2 characters" }, 400);
  }
  if (password.length < 4) {
    return c.json({ error: "password must be at least 4 characters" }, 400);
  }

  if (getUserByUsername(username)) {
    return c.json({ error: "username already taken" }, 409);
  }

  const id = randomUUID();
  const passwordHash = await Bun.password.hash(password);
  createUser(id, username, passwordHash);

  const token = await sign({ sub: id, username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);

  return c.json({ token, user: { id, username } }, 201);
});

// ── POST /api/auth/login ──────────────────────────────────────────

authRoutes.post("/login", async (c) => {
  let body: { username?: string; password?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  const user = getUserByUsername(username);
  if (!user) {
    return c.json({ error: "invalid username or password" }, 401);
  }

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "invalid username or password" }, 401);
  }

  const token = await sign({ sub: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);

  return c.json({ token, user: { id: user.id, username: user.username } });
});
