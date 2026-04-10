---
name: Stage 1 & 2 pipeline rewrite by teammate
description: A teammate is building an enhanced Stage 1 (structure) and Stage 2 (detail) pipeline using a skill/instructions-md system with scripts; current stages are temporary placeholders to be replaced.
type: project
---

A teammate is independently developing an enhanced version of Stage 1 (structure) and Stage 2 (detail) using a "skill" system — a set of instruction markdown files that guide Claude Code through the files, paired with scripts. The current Stage 1 and Stage 2 in this repo are temporary implementations without perfect accuracy or depth. They will be replaced by the teammate's version once it's ready.

**Why:** The current stages are functional placeholders to unblock downstream work (Stage 2.5+, compile, routes). The teammate's version targets higher extraction accuracy and depth via structured instruction files.

**How to apply:** Don't over-invest in the current Stage 1/2 prompt logic or accuracy tuning — it's throwaway. Build downstream stages (coverage audit, narrative, compile, etc.) against the *schema contract*, not against specific Stage 1/2 output quirks. The interface boundary (Obsidian markdown with frontmatter + wikilinks in stage folders) will stay the same.
