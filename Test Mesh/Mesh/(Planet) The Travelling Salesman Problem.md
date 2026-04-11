---
id: d2d05d9b-46b1-40ac-83f5-357ad92a7e4a
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Max Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Goal Counting]]"
---

# The Travelling Salesman Problem

A truck starts in Sydney. It must visit Brisbane, Adelaide, Perth, and Darwin, then return home. The driving costs vary: Sydney to Brisbane is 1 day, Sydney to Adelaide is 1.5, Adelaide to Perth is 3.5, Adelaide to Darwin is 4. The STRIPS formulation uses `drive(X, Y)` with preconditions (be at X, road exists) and effects (add visited(Y), add at(Y), delete at(X)).

When you drop preconditions and deletes for goal counting, the relaxed problem looks simple: just count how many cities remain unvisited. But even this relaxed version is NP-hard — it reduces to a minimum set cover problem because each drive action can achieve multiple goals (visiting a city and being at that city). A researcher named Bylander proved that even with just two post-conditions per action, the delete-relaxed problem remains NP-complete.

The TSP becomes the testbed for comparing H_add and H_max. H_max yields 5.5, H_add yields 13, H+ is 10, and H* is 20. The gap between H_max and H* shows how excessively optimistic H_max is. The fact that H_add exceeds H+ reveals overcounting: driving Sydney to Adelaide is tallied three times across different subgoal computations. The TSP strips away any illusion that relaxation automatically makes things easy — sometimes the relaxed problem is still hard, and you must approximate the approximation.
