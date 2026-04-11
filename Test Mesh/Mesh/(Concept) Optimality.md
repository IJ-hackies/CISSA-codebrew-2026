---
id: 636de98e-2806-47fe-91e1-f3b07aa3a95d
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Greedy Best-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Completeness]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Admissibility]]"
---

# Optimality

Finding a goal is not enough — you want the best one. Optimality means the algorithm returns the cheapest solution. BFS achieves it for uniform costs but fails for variable costs. DFS never achieves it. Greedy best-first fails because it ignores accumulated cost. A* achieves it with admissible heuristics, combining cost-so-far with an optimistic estimate of cost-to-go.

Optimality and completeness are independent properties. An algorithm can be complete but not optimal (greedy best-first), optimal but not universally complete (A* with inconsistent heuristics in some edge cases), or neither (DFS). The gold standard is both: completeness ensures you find a solution, optimality ensures it is the right one. A* with an admissible, consistent heuristic achieves both, which is why it dominates informed search.
