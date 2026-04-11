---
id: c9e5a3b2-8d4f-4c7a-b1e0-f2a4d6c8e0a3
type: source
filename: "Lecture 3.txt"
media-ref: "Source/Lecture 3.txt"
---

# Search Algorithms and Their Properties

This is a transcript of the third live lecture for COMP90054, focused on understanding the properties of search algorithms — particularly completeness, optimality, and complexity. The lecture covers breadth-first search (BFS), depth-first search (DFS), iterative deepening search (IDS), greedy best-first search, and A* search.

The lecture begins by establishing two key properties: completeness (if a goal exists, the algorithm will find it) and optimality (it finds the best goal). BFS is shown to be both complete and optimal for uniform action costs — it systematically explores level by level, guaranteeing it reaches any goal a finite number of steps away. However, for non-uniform costs, BFS is not optimal because it explores by depth, not by cumulative cost. Time complexity is O(b^d) where b is branching factor and d is depth. Space complexity is the dominant practical concern — at depth 8 with branching factor 10, memory requirements hit 103GB, far exceeding typical machine capacity.

DFS is shown to be neither complete nor optimal. It fails optimality even for unit costs because it explores depth-first and may find a deeper solution before a shallower one. It fails completeness due to infinite loops in cyclic graphs. However, DFS has better space complexity at O(b*m) since it only stores nodes along the current path. Iterative deepening search combines the best of both: it runs depth-limited searches at increasing depths, achieving BFS's completeness and optimality with DFS's space efficiency O(b*d).

The lecture then introduces heuristic search. Greedy best-first search uses heuristic functions to estimate distance to the goal — it is complete but not optimal even with perfect heuristics. A* search combines actual cost g(n) with heuristic estimate h(n), achieving both completeness and optimality for admissible heuristics (those that never overestimate). The lecture discusses consistency (triangle inequality for heuristics) and its relationship to reopening closed states. The session ends with a trivia competition covering heuristic function properties: safety (h(s) = infinity only when no solution exists), goal-awareness (h = 0 at goal states), admissibility, and the dependence of search performance on both heuristic informativeness and computation overhead.
