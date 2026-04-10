# Pipeline

The content engine. Takes raw user input and produces a fully populated `Galaxy` blob. Runs in six stages plus one on-demand stage, grouped into four phases.

## Stage order

```
0. Ingest      (parsing/ingest.ts)       meta, source, pipeline
1. Structure   (parsing/structure.ts)    knowledge, relationships
2. Detail      (parsing/detail.ts)       detail                     (parallel chunks)
3. Narrative   (storyline/narrative.ts)  narrative                  (blocks on 2)
4. Layout      (worldgen/layout.ts)      spatial                    (runs parallel with 3)
5. Visuals     (worldgen/visuals.ts)     visuals                    (blocks on 3 + 4)
6. Scene       (gameplay/scene.ts)       scenes[bodyId]             (on-demand, per landing)
```

## Phases

- **`parsing/`** — turning raw input into structured knowledge. Stages 0-2.
- **`storyline/`** — wrapping the knowledge in a galaxy-wide story. Stage 3.
- **`worldgen/`** — building the spatial + visual game world. Stages 4-5.
- **`gameplay/`** — generating the interactive content the user actually plays. Stage 6, on-demand.

## Rules every stage follows

1. **Read and write to the `Galaxy` blob** — stages do not pass data to each other directly. The blob is the shared state.
2. **Validate output against Zod before writing** — each stage writes to a specific scope (see `.context/SCHEMA.md`) and must validate its output against that scope's schema from `shared/types/`. Validation failures fail loudly at the stage boundary.
3. **Update the `pipeline` scope** — every stage flips its status to `running` at start and `done` (or `error` with a message) at end. Frontend reads this to drive the "watch your galaxy form" progress UI.
4. **Respect the mutability rules** — stages write to their own scope only. Do not modify scopes owned by other stages.

## What lives here vs `prompts/`

- `pipeline/<phase>/<stage>.ts` — the orchestration code: loads input from the blob, calls the spawner with a prompt, parses and validates the response, writes the result back.
- `prompts/<phase>/<stage>.ts` — the prompt text itself. Exports a `build<Stage>Prompt()` function. Keeping prompts in their own files means you can iterate on prompt wording without touching orchestration.

The mirror between `pipeline/` and `prompts/` is intentional — for every `pipeline/worldgen/visuals.ts` there's a `prompts/worldgen/visuals.ts`.
