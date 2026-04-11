---
id: 270e5f77-d99d-44bb-bc73-164ac326c1c9
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Goal Counting]]"
---

# The Logistics Truck

A truck at city A must pick up a package at C, deliver it to D, and return home. The actions are drive(X, Y), load(package), and unload(package), each with preconditions and effects. The galaxy workspace includes animated step-by-step examples comparing two relaxation strategies on this single problem.

Under goal counting, the truck wanders. Start at A with two goals unachieved (package at D, truck at A). Drive to B — still 2 goals away. Drive around, sometimes making progress, sometimes not. Goal counting provides almost no guidance because it ignores the causal structure: you must be at C before loading, must have the package before unloading. The number of unachieved goals changes slowly and uninformatively.

Under delete relaxation, the truck cuts straight to a solution in 5 steps: drive A→B, B→C, load, drive C→D, unload. The truck "remembers" being at every city it visited because delete effects are suppressed — driving from A to B adds at(B) without removing at(A). Getting back to A costs nothing because the truck never left. The contrast is dramatic: goal counting leads to extensive, meandering search; delete relaxation preserves causal chains (must be at C to load, must have package to unload) while removing only the cleanup, yielding focused, efficient guidance.
