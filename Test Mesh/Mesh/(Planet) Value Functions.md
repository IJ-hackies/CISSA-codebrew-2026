---
id: a757fa58-d4ae-4534-9678-816cf862b3f4
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Policy]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Reward Hypothesis]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
---

# Value Functions

A value function assigns every state a number answering: how good is it to be here? Not the immediate reward, but the total expected future reward from this state forward under a particular policy. States near the goal are valuable. States surrounded by penalties are costly. The function transforms the state space into a landscape of goodness and badness.

The notation is V_pi(s) — the value of state s under policy pi. It equals the expected sum of discounted future rewards: reward at the next step, plus gamma times the next, plus gamma squared times the next, cascading into the future with each term diminished by the discount factor. When gamma is near zero, only immediate reward matters and the landscape is flat. When gamma is near one, distant rewards carry full weight and the function encodes deep structure.

In the grid world, value functions become concrete numbers in cells. The goal cell might be 0. Cells one step away are -1. Cells far from the goal are -7 or -12. These numbers create a gradient, and the optimal policy simply follows it downhill. The value function does not tell the agent what to do — it tells the agent what is worth pursuing. You must solve the prediction problem (evaluate states) before you can solve the control problem (find the best policy). This ordering — prediction before control — structures the entire reinforcement learning curriculum.
