---
id: 0661cca6-1001-417a-92f8-63a3f8cec6a4
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Memory Wall]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Iterative Deepening Search]]"
---

# Breadth-First Search

Breadth-first search is patient, systematic, and relentless. It explores every node at depth 1 before touching depth 2, every node at depth 2 before depth 3, radiating outward like ripples in a pond. If a goal exists within a finite number of steps, BFS will find it. This is completeness — the guarantee that no reachable goal escapes detection.

For uniform action costs, BFS is also optimal — it finds the shallowest goal first, and since all steps cost equally, shallowest means cheapest. But change the costs and the guarantee evaporates. If one path costs 6 through expensive edges and another costs 101 through cheap-then-expensive edges, BFS might return the 101-cost solution simply because it was shallower. The algorithm explores by depth, not cumulative cost.

BFS operates on a first-in, first-out frontier. Nodes discovered first are expanded first. This systematic discipline is both its strength — guaranteeing level-by-level coverage — and its weakness, because it must store every node it generates. Time complexity is O(b^d) where b is branching factor and d is depth. Space complexity matches, and in practice, memory is the killer long before time becomes an issue.
