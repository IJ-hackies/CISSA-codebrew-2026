---
id: ed7f1675-6a48-478a-97d9-6fd1262b12ef
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Eight Puzzle]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Goal Counting]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Travelling Salesman Problem]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Manhattan Distance Relaxation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Indiana Jones Maze]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Admissibility]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Heuristic Informativeness]]"
---

# Relaxation

Take one problem. Relax it into an easier problem. Solve the easier one. Use that solution to guide the original. This is relaxation — one of the oldest and most widely used ideas in AI.

The mechanics: remove constraints to create a simpler version where solutions are cheaper to find. In the eight puzzle, dropping blank yields Manhattan distance; dropping everything yields misplaced count. In the TSP, dropping preconditions and deletes reduces planning to counting. Each relaxation produces a new problem whose optimal solution provides a heuristic.

Three properties determine a relaxation's usefulness. Is it native (the relaxed problem is a subclass of the original)? Is it efficiently constructible (can you build it quickly)? Is it efficiently computable (can you solve it quickly)? When the relaxed problem is still too hard — as with goal counting in the TSP — you approximate the heuristic to the relaxed problem: approximating an approximation, two layers of simplification. The power of relaxation lies in its generality — it applies wherever search operates.
