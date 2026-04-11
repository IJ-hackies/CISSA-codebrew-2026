---
id: 839e233e-d019-4431-ad7d-0a092a64d2f2
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) PDDL Domain and Problem Files]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
---

# Blocks World

Five blocks — A through E — sit on a table. A robotic arm hovers above, gripper empty. Block D rests on C, which rests on the table. Block B sits alone, clear on top. The initial state is scattered; the goal is a specific tower. Between here and there lies every possible rearrangement, and the agent must find a sequence of picks, places, stacks, and unstacks to bridge the gap.

Propositions describe the world: `on(D, C)` says D is on C; `clear(B)` says nothing is on top of B; `arm-empty` says the gripper holds nothing. Actions have preconditions and effects: to stack X on Y, the arm must be holding X and Y must be clear. After stacking, `on(X, Y)` is added, `arm-empty` becomes true, `holding(X)` is deleted, and `clear(Y)` is deleted. The mechanics are deliberately simple — a child's toy — but they contain all the essential machinery of classical planning.

What makes Blocks World enduringly useful is how it exposes the boundary between formalisms. Its actions are perfectly deterministic — pick up a block and it is in the gripper, no probability, no ambiguity. This is exactly the kind of problem STRIPS was designed for. Compare it with the student Markov chain, where the Bar's uncertain outcomes demand probabilistic treatment, and you see why two different traditions exist: some domains are crisp enough for logic, others demand probability, and the interesting frontier lies where they meet.
