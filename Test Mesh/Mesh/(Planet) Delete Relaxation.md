---
id: d09197c8-1223-44c6-84ec-0a31538ab3d9
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Logistics Truck]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Goal Counting]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Eight Puzzle]]"
---

# Delete Relaxation

Delete relaxation performs one radical simplification: once a fact becomes true, it stays true forever. Delete effects are stripped from every action, so propositions can only be added, never removed. The world becomes a place where nothing is lost, nothing unlearned, nothing undone.

In the logistics problem, this means the truck is simultaneously at every city it has ever visited. Drive from A to B, and you are at both A and B. It sounds absurd, but this absurdity makes the problem tractable. Preconditions are still checked — you must be at C to load the package — so the causal structure of the problem is preserved. Only the cleanup is removed. The result is a relaxed problem that is dramatically easier to solve while still capturing the essential ordering of actions.

Delete relaxation is the workhorse of modern planning heuristics. H+ (the optimal delete-relaxed heuristic) provides strong guidance, but computing it is itself NP-complete in the worst case. This motivates H_add, H_max, and FF — cheaper approximations of H+ that trade exactness for speed. The entire hierarchy of practical planning heuristics rests on this single idea: ignore the deletes, preserve the preconditions, and use the resulting easier problem to guide search through the hard one.
