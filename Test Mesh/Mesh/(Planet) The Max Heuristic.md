---
id: 3e785895-698e-4b61-a0f8-893041b68d29
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Fixed Point Computation]]"
---

# The Max Heuristic

H_max takes the opposite approach from H_add: instead of summing all subgoal costs, it takes the maximum. The most expensive single subgoal determines the heuristic value. This guarantees admissibility — H_max is always less than or equal to H+, which is always less than or equal to H* — making it safe for A*.

But admissibility comes at the price of informativeness. For the TSP, H_max yields 5.5 against an H* of 20. For the logistics problem, H_max is 5 against H* of 8. It sees only the single hardest subgoal and ignores everything else. A state where nine out of ten subgoals are trivially achieved and one is hard gets the same H_max as a state where all ten are hard. The heuristic is honest — it never lies — but it is so vague as to provide little search guidance.

H_max and H_add occupy opposite ends of a trade-off. H_max is admissible but far too optimistic. H_add is informative but inadmissible. They both agree when a goal is unreachable (both return infinity), so approximation is only needed when a relaxed plan exists. Both are computed from the same fixed-point tables in the same linear time — the only difference is whether you sum or maximise at the aggregation step. This elegant symmetry makes them natural teaching companions.
