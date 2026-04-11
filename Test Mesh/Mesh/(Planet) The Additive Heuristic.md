---
id: 00fc920e-20dd-4866-9ee4-39250b48386d
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Max Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The FF Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Fixed Point Computation]]"
---

# The Additive Heuristic

H_add decomposes a multi-goal problem into singleton subgoals and sums their individual costs. For each goal fact, trace backward: which action achieves it most cheaply? What are that action's preconditions? Recurse until you reach facts already true. Sum the costs for all goals independently. The computation uses iterative fixed-point tables — start with infinity for unachieved facts, iterate through actions updating costs, stop when nothing changes.

The catch is overcounting. In the TSP, H_add counts driving Sydney to Adelaide three times — once for reaching Perth, once for Darwin, once for the return. The true cost pays for that drive once. H_add yields 13 while H+ is 10. In a linear domain with goals at both ends, H_add returns 2N+1 when H* is N+1, because it tallies shared costs independently for each goal.

H_add is not admissible — it can overestimate — so A* armed with H_add may miss the optimal solution. But it is far more informative than H_max. In the logistics problem, H_add is 10 versus H_max's 5, against an H* of 8. The overcounting makes it pessimistic, but the pessimism comes with better discrimination between states. H_add sees meaningful differences where H_max sees only the single hardest subgoal.
