---
id: eb751b9b-3f43-4e8e-b51e-fb68ace5fd8e
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Logistics Truck]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Travelling Salesman Problem]]"
---

# Goal Counting

The simplest possible relaxation: drop all preconditions and delete effects, then count how many goal propositions remain unsatisfied. If the goal is "package at D AND truck at A" and neither is true, the count is 2. Achieve one, and it drops to 1. It is a valid heuristic — admissible, efficient, correct — but it is nearly useless.

Goal counting ignores all structure. It does not know that you must be at city C before loading the package. It does not know that driving from A to B moves you away from A. It treats all unachieved goals as equally easy, regardless of how many actions they require. In the logistics problem, goal counting lets the truck wander aimlessly — the count changes by at most 1 per action, providing almost no gradient to follow.

Despite its weakness, goal counting matters theoretically. It establishes a floor: any admissible heuristic must be at least as informative as goal counting. It also serves as a native relaxation — the relaxed problem (planning with no preconditions or deletes) is a subclass of the original planning problem. And in the TSP, even this trivially simple relaxation produces a problem that is NP-hard, proving that relaxation does not automatically yield tractability. Goal counting is the baseline against which all better heuristics are measured.
