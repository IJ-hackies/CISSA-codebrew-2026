---
id: 21325428-bab0-4f15-bfe5-bd1115825f11
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Agents Model]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Atari Agent]]"
---

# Policy

A policy is the agent's behaviour function — a direct map from state to action. If the agent is in state S, the policy says: do action A. It defines how the agent reacts to every possible situation. Without a policy, the agent is inert — it can perceive and reason, but it cannot act.

Policies come in two flavours. A deterministic policy is a hard rule: if the oven feels hot, pull the hand away. In the grid world, it looks like arrows in every cell — one direction per state, no ambiguity. A stochastic policy assigns probabilities: in this state, go left with 70%, go right with 30%. Stochastic policies matter in uncertain environments because occasional randomness helps escape local optima. The vacuum robot that always turns left circles forever; the one that occasionally turns right eventually finds the power point on the other side of the room.

In planning, a plan is a special case of a policy — a sequence of actions from one initial state. A policy is more general: it specifies behaviour for every state, not just the planned path. This matters when execution is stochastic — if the agent slips, the plan breaks, but a full policy handles every contingency. The distinction between plans and policies is one of the quiet fault lines between classical planning and reinforcement learning.
