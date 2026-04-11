---
id: 03d58ad1-a46c-4838-abff-a077b7f81cd5
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Additive Heuristic]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Delete Relaxation]]"
---

# The FF Heuristic

FF resolves the tension between H_add and H_max by extracting an actual relaxed plan rather than computing a single number. Instead of summing subgoal costs (H_add) or taking the max (H_max), FF traces back through the best-supporter function to assemble a concrete sequence of actions that solves the delete-relaxed problem. The heuristic value is the length (or cost) of this relaxed plan.

The key insight is that shared actions are counted only once. When H_add computed the TSP, it tallied driving Sydney to Adelaide three times because three different subgoal computations each needed that drive. The relaxed plan includes the drive once — it is a plan, not a sum of independent estimates. This eliminates overcounting while preserving informativeness.

FF is described in the lectures as dramatically better than H_add alone, better than H+ in practice, and super fast to compute because the fixed-point tables are already available from the H_add/H_max computation. The plan extraction adds negligible cost. FF represents the state of the art in practical planning heuristics — the technique that turned delete relaxation from a theoretical curiosity into a tool that solves real planning problems in international planning competitions.
