---
id: 048db90b-7b04-4fb2-8cdf-9b047abb1ed4
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Iterative Deepening Search]]"
---

# Depth-First Search

Depth-first search is the gambler of search algorithms. It picks a direction and goes deep — all the way down a branch — before backtracking and trying another path. It operates on a last-in, first-out frontier, always expanding the most recently discovered node. Where BFS accumulates enormous memory, DFS stores only nodes along the current path: space complexity O(b*m), linear in depth.

But the gamble has risks. DFS is not optimal, even for unit costs: if the goal is at depth 2 on the right branch but the algorithm explores left first, it might find a deeper, costlier goal at depth 20 and declare victory. It is not complete because of cycles — a self-loop at node A sends the search endlessly from A to A to A while the goal sits untouched on another branch.

Adding cycle detection — checking whether a node has been visited along the current path — restores completeness for finite acyclic graphs. But unadorned DFS makes no such promise. Its saving grace is speed when lucky: if the solution lies along the first branch explored, DFS finds it in O(b*L) time regardless of total state space size. This is why DFS persists — not as a standalone solver, but as the inner loop of iterative deepening, which tempers its recklessness with bounded depth.
