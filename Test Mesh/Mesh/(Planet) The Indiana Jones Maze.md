---
id: e17945d3-e446-4319-8564-edf28ef67c9d
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Manhattan Distance Relaxation]]"
---

# The Indiana Jones Maze

A maze with walls. Indiana Jones must navigate from start to goal, moving only to adjacent cells that are not blocked. The quiz asks: what is H+ (the delete-relaxed heuristic) equal to? Manhattan distance? Horizontal distance? The perfect heuristic H*?

Many students initially answer Manhattan distance, drawing on the eight-puzzle intuition. But the maze is different. In delete relaxation, you drop delete effects but keep preconditions. The precondition for moving is that the destination cell is adjacent and not a wall. Walls are never deleted (they are not effects of any action), so they persist in the relaxed problem. The agent cannot walk through walls even with delete relaxation.

For a single-goal maze, this means H+ equals H* — the delete-relaxed heuristic is perfect. The relaxed problem and the real problem have the same solution because there are no delete effects that matter: moving to a cell does not "delete" your presence at the previous cell in any way that affects future movement options in a single-goal problem. This result is striking: it shows that delete relaxation's power depends heavily on the domain. In the eight puzzle, it provides a useful approximation. In the maze, it provides the exact answer. The structure of the domain determines how much relaxation helps.
