---
id: d573d2ba-b7e3-4c9c-a242-343819621c00
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]"
---

# Iterative Deepening Search

Iterative deepening is a genuinely elegant idea. Run depth-limited search at limit 0. Then limit 1. Then limit 2. Each iteration searches the complete tree up to that depth using DFS mechanics, then discards everything and starts fresh one level deeper. It sounds wasteful — surely redoing all that work is expensive? — but the mathematics reveals a surprise.

The algorithm inherits BFS's completeness and optimality for uniform costs: it finds the shallowest goal, and if that goal exists, it will reach the correct depth eventually. But it uses DFS's space complexity — O(b*d) — because each iteration only stores a single path. The repeated work at shallow depths is dwarfed by the final iteration's work at the target depth, because exponential growth means the last level dominates.

The result is the best of both worlds: the guarantees of breadth-first search with the memory efficiency of depth-first search. For uninformed search (no heuristic), iterative deepening is essentially the ideal algorithm — it provides completeness and optimality while keeping memory manageable. It is the benchmark against which heuristic search methods are judged: can A* or greedy best-first do better than iterative deepening, and if so, at what cost?
