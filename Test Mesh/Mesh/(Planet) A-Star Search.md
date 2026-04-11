---
id: 5e00be7e-4859-4d21-9800-698a9407e02b
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Greedy Best-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Eight Puzzle]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
---

# A-Star Search

A* is the crown jewel of informed search. Its equation is f(n) = g(n) + h(n): cost so far plus estimated cost to go. At every step, A* expands the node with the lowest f-value — always pursuing the most promising total path. This simple combination of actual cost and heuristic estimate yields both completeness and optimality, provided the heuristic is admissible.

Everything hinges on admissibility: h(n) must never overestimate the true cost to the goal. Admissible heuristics are optimistic — they may underestimate, but they never claim the journey is shorter than it truly is. This guarantee ensures A* never overlooks the optimal solution. Consistency, a stronger property, requires h to satisfy the triangle inequality: h(n) <= cost(n, n') + h(n'). Consistent heuristics make f-values non-decreasing along any path, meaning closed states never need reopening.

A* cannot wander forever among cheap nodes. Because everything is ordered by f-value, the search gradually, inevitably approaches any reachable solution. If a solution of cost C exists, A* will find it. The question is only how fast, and that depends on the heuristic's informativeness and computation cost. A perfect heuristic (h = h*) makes A* expand only nodes on the optimal path. A weak heuristic (h = 0) degrades A* to uniform-cost search. The art of A* is the art of crafting heuristics — which is exactly what relaxation provides.
