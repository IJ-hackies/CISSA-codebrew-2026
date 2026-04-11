---
id: 4acae561-573c-4a24-9f79-4c04f364cc76
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Max Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The FF Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Manhattan Distance Relaxation]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Admissibility]]"
---

# Heuristic Informativeness

Search performance depends on two factors: how informative the heuristic is, and how much it costs to compute. A perfect heuristic (h = h*) makes A* expand only optimal-path nodes but may be as expensive to compute as solving the original problem. A trivial heuristic (h = 0) is free but provides no guidance, degenerating A* to uniform-cost search.

The trade-off is everywhere. Manhattan distance is more informative than misplaced tile count but costs slightly more to compute (sum of distances vs. simple count). H_add is more informative than H_max but is inadmissible. FF is more informative than H_add and avoids overcounting but requires plan extraction. Each step up the informativeness ladder buys fewer node expansions at the cost of more computation per node.

The best heuristic is not the most informative one — it is the one that minimises total search time, balancing per-node computation against the number of nodes expanded. This is why the FF heuristic dominates in practice: its plan extraction is cheap (linear in plan length), and its informativeness dramatically reduces the search space.
