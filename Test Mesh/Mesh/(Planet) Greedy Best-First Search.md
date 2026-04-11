---
id: b33f7740-6676-4d25-8b06-cad499b12ba0
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
---

# Greedy Best-First Search

Greedy best-first search introduces heuristics into the frontier. Instead of expanding by depth (BFS) or by recency (DFS), it expands the node with the lowest heuristic estimate h(n) — the node that appears closest to the goal. It uses a priority queue ordered by h, plucking the most promising node first.

The algorithm is complete: it will find a goal if one exists, because it still performs systematic exploration with duplicate detection. States go onto a closed list once expanded, preventing infinite loops. But greedy best-first is not optimal, even with a perfect heuristic. The heuristic estimates distance to the goal, not total path cost, so the algorithm might follow a path that looks close to the goal but accumulates heavy costs along the way, missing a cheaper route through states with higher h-values.

Greedy best-first search is the stepping stone to A*. It demonstrates the power of heuristic guidance — focused expansion rather than brute-force level-by-level — while exposing the limitation: heuristic alone is not enough for optimality. You also need to account for the cost already paid. This insight motivates the f = g + h combination that makes A* work.
