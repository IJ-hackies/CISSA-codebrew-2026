---
id: f5a6b9f5-d62d-4589-87d3-1199c5a1f4aa
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Agents Model]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
---

# Transition Matrices

A transition matrix encodes the dynamics of a Markov process in a grid of numbers. Each row is a state you might be in; each column is a state you might transition to. The entry at row S, column S' gives the probability of moving from S to S' in one step. Every row sums to 1 — from any state, you must go somewhere.

The student Markov chain's matrix captures its entire personality. The row for Class 1 has a 0.5 in the Class 2 column and probabilities scattered toward Instagram and the Bar. The row for Instagram has a large self-loop probability — the chance of scrolling leading to more scrolling. The row for Sleep is all zeros except for a 1 on its own diagonal, because Sleep is a terminal absorbing state: once you arrive, you never leave.

Transition matrices also encode action-dependent dynamics. In an MDP, there is a separate matrix for each action: one for "move north," another for "move south," and so on. The grid world's "move north" matrix has 0.9 on the entry for the cell directly above and 0.05 each for the cells to the left and right. These matrices are the numerical backbone of everything — the Bellman equation multiplies them by value vectors, policy evaluation iterates over them, and model-based RL agents try to estimate them from data. The entire computational machinery of planning and learning rests on these grids of probabilities.
