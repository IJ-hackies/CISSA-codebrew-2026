---
name: reupdate
description: Review everything done in the current session and update all relevant files in `.context/` (ABOUT.md, PROGRESS.md, SCHEMA.md, etc.) so the project context stays in sync with reality. Use this skill whenever the user says "reupdate", "update context", "sync context", "update the context files", "refresh progress", or otherwise asks to reflect session work back into the `.context/` docs. Trigger this even if the user only mentions updating "progress" or "about" — the skill handles deciding which files actually need edits.
---

# Reupdate

Your job: look at what meaningfully changed or got decided this session, then update the files in `.context/` so a future `/recontext` run reflects the new reality. The counterpart to `/recontext` — that skill *loads* context, this one *writes it back*.

## Why this exists

`.context/` is the project's living memory. If session work lands but the docs don't move, the next session starts with a stale mental model and either re-derives things from scratch or, worse, acts on outdated assumptions. The cost of a five-minute doc pass now is a whole conversation of confusion later.

## Steps

1. **Survey the session.** Reconstruct what actually happened: files created/modified, decisions made, pipeline stages advanced, bugs fixed, architectural choices, things tried and abandoned. Use `git status` and `git diff` (against the branch base, not just HEAD) to ground yourself in concrete changes. Don't rely on memory alone — the diff is authoritative.

2. **List the `.context/` files.** Glob `.context/*`. Read each file that could plausibly need updates. **Never read or write `FUTURE.md`** — it's speculative and owned by the user. Also skip anything the user has explicitly told you not to touch.

3. **Decide what actually needs changing.** For each file, ask: does the session's work invalidate or extend anything here? Common patterns:
   - `PROGRESS.md` — almost always gets a new changelog entry when something shipped, and stage checkboxes/status lines may flip. Append newest entries at the top. Use today's absolute date (check the environment's `currentDate`, don't guess). Include the branch name if relevant.
   - `ABOUT.md` — update when architecture, pipeline shape, tech choices, or the "current implementation" paragraph drifted. Don't touch it for routine feature work that doesn't change the story.
   - `SCHEMA.md` — update when the data contract moved (new scope, new field, new mutability rule, new stage mapping). Leave it alone for pure implementation changes.
   - Other files — read them and judge.

4. **Make surgical edits.** Prefer `Edit` over `Write`. Don't rewrite sections that are still accurate. Match the existing voice, formatting, and level of detail — these docs have a style, keep it. If a section is getting long, tighten rather than append indefinitely.

5. **Don't invent facts.** If you're not sure whether something landed, check the code or the diff. A wrong entry in `PROGRESS.md` is worse than a missing one, because it'll mislead every future session.

6. **Report back briefly.** Tell the user which files you touched and a one-line summary of each change. Keep it short — they can read the diff if they want detail.

## What NOT to do

- Don't touch `FUTURE.md` under any circumstance.
- Don't add speculative plans or "next steps" to `PROGRESS.md` — it's a log of what shipped, not a roadmap.
- Don't create new files in `.context/` unless the user asked for one. If you feel a new doc is warranted, propose it first.
- Don't reformat or restructure existing files just because you think it could be cleaner. Minimal diff, maximum signal.
- Don't commit the changes. Leave staging/commit decisions to the user unless they explicitly asked.

## Edge cases

- **Nothing substantive happened this session.** Say so and don't write edits just to look productive. An empty update is a valid outcome.
- **Multiple things landed but only some are worth logging.** Bundle related work into one changelog entry rather than spamming a line per file. PROGRESS.md entries should describe *what shipped and why it mattered*, not enumerate commits.
- **The session work contradicts something in ABOUT.md.** Update ABOUT.md — the docs serve the code, not the other way around. Note the change explicitly in your report so the user can sanity-check.
- **User worked across multiple branches.** Attribute each changelog entry to the branch it landed on.
