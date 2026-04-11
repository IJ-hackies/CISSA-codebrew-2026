---
name: recontext
description: Load project context by reading every file in the .context/ folder except FUTURE.md. Use this skill whenever the user asks you to "recontext", get up to speed, understand the project, load context, or refresh your understanding of what this project is about - even if they don't explicitly mention the .context folder.
---

# Recontext

Your job is to load the project's context so you understand what it is and how it works.

## Steps

1. List `.context/` with Glob (pattern: `.context/*`).
2. Read every file in `.context/` **except `FUTURE.md`** (case-insensitive — skip `future.md` too). FUTURE.md is intentionally excluded because it describes speculative future plans that should not shape current understanding.
3. After reading, give the user a brief (3-6 bullet) summary of what the project is, so they can confirm you're grounded.

Read files in parallel when possible. Do not read FUTURE.md under any circumstance as part of this skill.
