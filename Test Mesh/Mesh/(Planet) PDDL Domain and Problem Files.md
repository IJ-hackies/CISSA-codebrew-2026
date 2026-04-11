---
id: c5f386f2-5c76-46e8-aca6-76f9e755305b
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Blocks World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
---

# PDDL Domain and Problem Files

The Planning Domain Definition Language separates what from where. A domain file defines the physics of a world: predicates like `on`, `clear`, `holding`, `on-table`, and parameterised actions like `stack(X, Y)` with preconditions and effects. It says nothing about specific blocks or goals — it is a general theory of manipulation. A problem file then introduces objects (blocks A through E), an initial state (which blocks are where), and a goal (the desired configuration). A planner takes both files and synthesises a plan.

This separation is elegant because it enables reuse. One Blocks World domain file can serve thousands of problem instances — different initial arrangements, different goal towers, different numbers of blocks. The domain captures the physics; the problem captures the situation. It is the same pattern that recurs in software engineering: the algorithm is generic, the data is specific.

PDDL uses quantified variables in actions (uppercase X, Y) that get grounded to specific objects at planning time. The notation is close to logic but readable: preconditions are conjunctions of propositions that must be true, effects are lists of propositions to add or delete. Students see it for the first time through Blocks World and gradually recognise it as a general-purpose language — applicable to logistics, robotics, game playing, and any domain where states can be described by propositions and actions by their preconditions and effects.
