---
id: c847d32e-8b7b-4653-b04f-61d1d1d4ef2c
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Rat Experiment]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Transition Matrices]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) The Markov Property]]"
---

# State Representations

What goes into a state? This question sits beneath every other question in the course. The rat experiment shows that different state encodings — last three events, event counts, full sequence — produce different predictions from identical histories. The Markov property demands that the state capture everything decision-relevant, but says nothing about how. The designer must choose.

Too narrow a representation and the agent conflates situations that demand different actions. Too broad and the state space explodes — every possible history becomes a distinct state, and computation becomes intractable. The sweet spot is a representation that wraps up exactly enough past to determine the future, compressing history without losing predictive power.

Deep learning has transformed this challenge. Rather than hand-engineering state features, agents can learn latent representations that discover what matters. The pixels on an Atari screen are a raw, high-dimensional observation; a trained network compresses them into a compact latent state that preserves the information needed for action selection. Function approximation handles infinite state spaces by replacing explicit state tables with parametric functions. The choice of representation is never neutral — it shapes what the agent can learn, how fast it converges, and whether it succeeds at all.
