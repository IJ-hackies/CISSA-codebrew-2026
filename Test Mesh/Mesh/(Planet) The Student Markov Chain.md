---
id: 6b978612-e719-4fb1-b43f-557a68b0eae8
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Rat Experiment]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Computing Returns]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Blocks World]]"
---

# The Student Markov Chain

A student begins in Class 1. With some probability, they progress to Class 2, then Class 3, then Pass, then the terminal state of Sleep — the optimal trajectory. But the probabilities branch. There is a chance of veering into Instagram, where scrolling becomes a self-loop: each swipe feeds back into the same state. There is the Bar, where time spent determines whether the student returns to Class 2 or all the way back to Class 1.

The rewards lay bare the economics of student life. Passing yields +10. Studying costs -2 per class. The Bar gives +1 — small, immediate pleasure. Instagram is -1 — it feels good but somehow erodes capacity. Sleep is 0. When you compute returns with different discount factors, the numbers reveal character: a myopic student sees the Bar as attractive and studying as pointless; a far-sighted student endures the -2 costs because the +10 at the end dominates.

The chain doubles as a test case for cross-formalism translation. Expressing it in STRIPS requires objects (classes, social media) and propositions ("studied_C1", "passed", "sleeping"). But the Bar creates havoc — classical planning demands deterministic actions, and the Bar has three probabilistic outcomes. You would need separate operators for different drinking durations. The non-determinism that Markov processes handle naturally becomes awkward in propositional logic. This tension — between the elegance of probability and the precision of propositions — runs through the entire course.
