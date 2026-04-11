---
id: 505539f2-f97c-45dd-a838-c912a054a1d1
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Max Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Eight Puzzle]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Optimality]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Consistency]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Relaxation]]"
---

# Admissibility

A heuristic is admissible if it never overestimates the true cost to reach the goal. It may underestimate — be optimistic — but it must never claim the journey is shorter than reality. This constraint makes A* optimal: by always expanding the lowest f-value node and trusting the estimate is never too high, A* never prematurely abandons the optimal path.

Admissibility is the line dividing H_max from H_add. H_max is always <= H+ <= H*, so it is admissible. H_add can exceed H* through overcounting, so it is not. The FF heuristic occupies a middle ground — not provably admissible, but empirically reliable enough to dominate planning competitions. The art of heuristic design is pushing informativeness as high as possible without crossing the admissibility line.
