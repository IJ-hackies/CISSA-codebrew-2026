---
id: f16d45f4-1aa0-4d1b-82b6-10bbdec5e1cd
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Max Heuristic]]"
---

# Fixed Point Computation

The practical computation of H_add and H_max uses iterative fixed-point tables. Create a table with one row per goal-relevant proposition. Initialise: facts true in the current state get cost 0; everything else gets infinity. Iterate: for each action, if its preconditions have finite cost, compute the cost of achieving each of its effects. Update the table entry if the new cost is lower. Repeat until no entry changes — this is the fixed point.

The TSP example makes the iteration tangible. At iteration 0, Sydney is achieved (cost 0), everything else is infinity. At iteration 1, Brisbane becomes reachable (cost 1, via drive Sydney-Brisbane) and Adelaide (cost 1.5). At iteration 2, Darwin becomes reachable (cost 5.5, via Adelaide then drive), because Adelaide was not available at iteration 1. At iteration 3, nothing changes — fixed point reached. Read off the values, aggregate with sum (H_add) or max (H_max), and you have your heuristic.

The fixed point typically converges in a linear number of iterations relative to the plan length, making it extremely fast. During search, this computation happens at every state — the agent re-computes the relaxed heuristic from scratch at each search step, using the current state as the new "initial state" for the relaxed problem. The speed of convergence is what makes delete-relaxation heuristics practical: a linear-time inner loop inside an outer search that might expand thousands of nodes.
