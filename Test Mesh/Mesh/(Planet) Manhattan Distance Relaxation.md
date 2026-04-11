---
id: b94fc705-be00-4034-861d-a22d34b40a3a
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Eight Puzzle]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Indiana Jones Maze]]"
---

# Manhattan Distance Relaxation

To derive Manhattan distance as a heuristic, you remove exactly one precondition from the eight puzzle: the requirement that the destination square be blank. Tiles can still only move to adjacent squares — they must walk the grid, not teleport — but they can slide through occupied positions. The optimal solution cost in this relaxed world equals the sum of each tile's grid distance to its goal position: the Manhattan distance.

The quiz in the lecture trips many students up. Three options: move if blank, move if adjacent, move without restriction. The answer is "move if adjacent" — keeping adjacency but dropping blankness. If you only require blankness, the heuristic degenerates to 1 (every tile can always reach a blank neighbour). If you drop everything, tiles can teleport, and you get the weaker misplaced tile count instead.

The distinction is precise and pedagogically sharp. Manhattan distance is a better heuristic precisely because it retains more structure from the original problem. It keeps the grid topology — tiles must walk, not fly — while removing only the constraint that makes the problem hard (competing for blank space). This principle generalises: the best relaxations remove as little as possible, preserving the maximum amount of problem structure in the heuristic.
