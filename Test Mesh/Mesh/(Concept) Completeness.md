---
id: bca4b430-b1b1-49a0-b3e9-dd3853a7811b
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Iterative Deepening Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Optimality]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Cycle Detection]]"
---

# Completeness

If a goal exists, will the algorithm find it? Completeness is the first guarantee you ask of any search algorithm. BFS is complete because it systematically covers every depth level. DFS is not, because cycles can trap it in infinite loops. Iterative deepening is complete because it inherits BFS's level-by-level coverage. A* is complete because admissible heuristics prevent it from abandoning reachable goals.

Completeness depends on the problem structure. In finite acyclic graphs, even DFS is complete — there are no loops to get lost in. In graphs with cycles, you need either systematic coverage (BFS), bounded depth (iterative deepening), or duplicate detection (closed lists). The properties of the graph and the properties of the algorithm interact to determine whether completeness holds.
