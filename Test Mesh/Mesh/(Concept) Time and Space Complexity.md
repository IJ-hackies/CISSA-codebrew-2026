---
id: a2548aa3-81f8-43b8-9263-66df99b4572b
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Memory Wall]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Iterative Deepening Search]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Completeness]]"
---

# Time and Space Complexity

Exponential growth is the enemy. With branching factor b and depth d, BFS generates O(b^d) nodes in both time and space. DFS matches the time but cuts space to O(b*m). Iterative deepening matches BFS's time while achieving DFS's space. The constants differ but the exponential dominates everything.

The practical implication is stark: memory, not time, is the bottleneck. A search that takes minutes is tolerable; a search that needs terabytes of RAM is impossible. Every clever trick in search — iterative deepening, heuristic pruning, beam search, IDA* — exists because of this asymmetry. The theoretical guarantees of completeness and optimality mean nothing if the algorithm cannot fit its data structures in memory.

Heuristic search attacks the problem from a different angle: instead of reducing the exponent, it reduces the effective branching factor. A perfect heuristic makes A* expand only nodes on the optimal path — effective branching factor of 1. A weak heuristic leaves the full exponential intact. The quality of the heuristic determines where on the spectrum between "exponential brute force" and "linear optimal path" the search actually falls.
