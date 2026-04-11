---
id: 7121339c-2a55-4833-b296-5dff767a98ab
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Iterative Deepening Search]]"
---

# The Memory Wall

A table in the lecture lays it bare. Branching factor 10, 10,000 nodes per second, 1000 bytes per node. At depth 2: 0.11 seconds, 1 megabyte. At depth 8: 2 minutes, 103 gigabytes — far beyond most machines. At depth 14: 3.5 years, 10 petabytes — beyond even large server farms. The numbers climb exponentially because BFS stores every generated node, and the number of nodes at each depth multiplies by the branching factor.

Which is the worst problem — time or memory? Memory, overwhelmingly. You will run out of RAM long before you run out of patience. A search that takes 2 minutes is tolerable; a search that requires 103 gigabytes of memory is impossible on consumer hardware. The gap between what BFS can theoretically find and what it can practically store defines the landscape of search algorithm design.

This memory wall is the motivation for every subsequent algorithm in the course. Depth-first search trades completeness for lean memory usage. Iterative deepening keeps BFS's guarantees while using DFS's memory footprint. Heuristic search focuses effort on promising regions, avoiding the brute-force expansion of entire levels. Every clever trick in search exists because of this wall — the exponential reality that systematic exploration demands exponential storage.
