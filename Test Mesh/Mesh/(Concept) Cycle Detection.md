---
id: d43d73f9-1cf1-4f32-91f2-3159cf38d337
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) A-Star Search]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Completeness]]"
---

# Cycle Detection

Cycles are the traps that make DFS incomplete. A self-loop at node A sends the search from A to A to A indefinitely. A cycle between A and B bounces the search back and forth while the goal sits unreached on another branch. In planning, cycles are common — a robot that can move left and right naturally revisits states.

The solution is duplicate detection: maintaining a record of visited states and refusing to expand them again. BFS handles this implicitly through its closed list — once a state is expanded at some depth, it is never expanded again. DFS can add cycle checking along the current path (checking whether the current state appears anywhere among its ancestors), which restores completeness for finite acyclic searches. A* uses a closed list and, with consistent heuristics, never needs to reopen closed states.

The cost of cycle detection is memory — you must store visited states to check against them. This is one reason DFS has lower space complexity than BFS: in its pure form, DFS stores no visited states and therefore cannot detect cycles. Adding cycle detection trades some of DFS's memory advantage for the completeness guarantee. The design space of search algorithms is shaped by this tension between memory, completeness, and optimality.
