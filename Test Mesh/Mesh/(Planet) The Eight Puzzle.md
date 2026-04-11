---
id: cea22a12-cfaa-4b3c-b468-b1985fe0d86a
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Manhattan Distance Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
---

# The Eight Puzzle

A 3x3 grid holds eight numbered tiles and one blank space. Tiles slide into the blank — up, down, left, right — and the goal is to arrange them in order. Preconditions are simple: a tile moves to position Y only if Y is blank and Y is adjacent. After moving, the old position becomes blank. It is a toy problem, but it is the perfect laboratory for heuristics and relaxation.

Two relaxations unlock two heuristics. Drop the blank precondition — let tiles slide through occupied squares along the grid — and you get Manhattan distance: tile 1 needs 4 steps to reach its goal; tile 8 needs 2; sum them all for the total heuristic value of 18. Drop all preconditions — let tiles teleport anywhere — and you get misplaced tile count: simply count how many tiles are not in their goal position, maximum 8.

Both heuristics are admissible (never overestimate), efficiently constructible (just edit the PDDL), and efficiently computable (just arithmetic). Manhattan distance is more informative — it distinguishes a tile 4 steps away from one 1 step away — while misplaced count treats them equally. The eight puzzle is where abstract properties of relaxation become concrete and visible, where you can trace exactly how dropping a precondition changes the search landscape.
