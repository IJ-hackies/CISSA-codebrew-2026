---
id: 98f3297a-d5c9-4a82-accb-afaeb95f2a87
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
---

# Expected Return Computation

The hands-on exercise: compute the return for a specific Grid World trajectory with gamma = 0.9. Start at (1,1). Step 1: try up, slip right to (1,2), reward 0. Step 2: go right to (1,3), reward 0. Step 3: go up to (2,3), reward 0. Step 4: try up, slip left to (2,2), land on the red terminal, reward -1.

The return is: 0 + 0.9*(0) + 0.81*(0) + 0.729*(-1) = -0.729. Each reward is multiplied by gamma to the power of how many steps it took. Most steps yield 0; only the terminal matters. The discount ensures that reaching the bad terminal later hurts less than reaching it sooner — a four-step delay reduces the penalty from -1 to -0.729.

The exercise exposes a subtle point about notation: does the reward come from the action taken or the state reached? In Grid World, rewards depend on the destination state, not the action. "Try to go up" and "actually slip right" produce the same reward — the reward of the cell you land in. This is not universal; other MDPs might penalise certain actions regardless of outcome (like the cost of jumping versus walking). The student must understand which convention applies to compute returns correctly.
