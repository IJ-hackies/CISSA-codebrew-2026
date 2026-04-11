---
id: e2a7c5d4-0f6b-4e9c-d3a2-b4c6f8e0a2c5
type: source
filename: "Lecture 5.txt"
media-ref: "Source/Lecture 5.txt"
---

# Additive and Max Heuristics with Relaxed Plans

This is a transcript of the fifth live lecture for COMP90054, diving deep into two practical heuristic approximations — H_add (additive) and H_max (max) — and introducing the FF heuristic based on relaxed plan extraction. This lecture addresses the computational reality that computing the perfect delete-relaxation heuristic H+ is itself NP-complete, necessitating further approximation.

The lecture opens with a quiz on delete relaxation in a maze domain, establishing that H+ equals H* (the perfect heuristic) for single-goal problems in maze domains because preconditions (walls) cannot be relaxed away. This motivates the need for cheaper approximations when H+ is too expensive to compute.

H_add is defined via dynamic programming: for a single goal, find the minimum-cost action achieving it and recurse on its preconditions; for multiple goals, sum the individual goal costs. A linear domain example shows H_add computing 2N+1 when H* is only N+1, because it counts shared subplan costs multiple times — proving H_add is not admissible. H_max takes the maximum over individual goal costs instead of summing, making it admissible (always <= H+) but often too optimistic to be informative.

Both heuristics are illustrated on the TSP and logistics domains using iterative fixed-point tables. In TSP, H_max = 5.5 while H_add = 13, versus H+ = 10 and H* = 20. In logistics, H_add overcounts because it tallies the cost of driving Sydney-Adelaide three times across different goal computations. The lecture formally establishes: H_max is admissible but far too optimistic; H_add is more informative but pessimistic and inadmissible; both agree that when H+ = infinity, the goal is unreachable.

The FF heuristic is introduced as the resolution: instead of just computing a numeric value, extract an actual relaxed plan by tracing back through the best-supporter function. This eliminates the overcounting problem because shared actions in the plan are counted only once. FF is described as way better than H_add alone, better than H+, and super fast to compute via dynamic programming fixed points. The session concludes with a competition covering delete relaxation properties across FreeCell and Sokoban domains.
