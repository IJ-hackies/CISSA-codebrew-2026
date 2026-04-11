---
id: 51ba2877-2db4-465b-beb1-4c6e31f14319
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Computing Returns]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Sequential Decision Making]]"
---

# Discounting

Gamma — a number between 0 and 1 — controls how much the future matters. Set it to zero and only the immediate reward counts. Set it to one and a reward in a thousand steps is worth exactly as much as one now. Most practical systems live in between, valuing nearer rewards more without ignoring the distant future.

The reasons are layered. Mathematically, discounting guarantees convergence — without it, cyclic processes accumulate infinite returns. Computationally, it makes proofs tractable. Epistemically, it reflects uncertainty: the further you project, the less reliable the model. Economically, it mirrors the time value of money — a dollar today earns interest. Behaviourally, humans and animals consistently prefer immediate reward, a pattern so robust it appears across species and cultures. A student word cloud in the lecture surfaces all of these: "convergence," "uncertainty," "infinity," "delayed rewards."

Discounting does not change the environment — the rewards and transitions are identical regardless of gamma. But it profoundly changes what counts as optimal behaviour. The myopic student sees the bar as attractive; the far-sighted student endures studying. Discounting is not about the world; it is about the agent's relationship to time. And that relationship is a design choice, not a fact of nature.
