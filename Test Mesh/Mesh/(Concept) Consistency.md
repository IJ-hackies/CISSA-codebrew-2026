---
id: 4106c5be-c989-4f2d-94f4-ca9bac261263
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Admissibility]]"
---

# Consistency

Consistency strengthens admissibility. A heuristic is consistent if it satisfies the triangle inequality: h(n) <= cost(n, n') + h(n') for every edge from n to n'. This ensures f-values never decrease along any path, which means once a state is expanded and placed on the closed list, it never needs reopening.

The practical benefit is efficiency. Without consistency, A* might need to reopen closed states when it discovers a cheaper path to an already-expanded node. With consistency, the first expansion is guaranteed to be optimal, so the closed list is truly closed. Most practical heuristics — Manhattan distance, straight-line distance — are both admissible and consistent. But the distinction matters for edge cases and for understanding why some A* implementations include reopening logic while others do not. As the lecturer explains to a confused student: admissibility says "never overestimate," consistency says "arithmetic must add up properly along paths." They are related but distinct guarantees.
