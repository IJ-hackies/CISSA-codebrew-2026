---
id: 0ae84f0b-6e4c-4c1c-ac36-62273e36b9b1
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Humanoid Robot]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Warehouse Inventory Problem]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Utility Maximisation]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Delayed Consequences]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Exploration versus Exploitation]]"
---

# The Reward Signal

The reward hypothesis states that all goals can be expressed as the maximisation of a single scalar signal. This claim is audacious — it says that the richness of walking, trading, navigating, and conversing can all be collapsed into a number. Yet the entire edifice of reinforcement learning rests on it.

In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Humanoid Robot]], the reward signal is handcrafted: negative for falling, positive for forward motion. The design seems obvious, but subtle choices — the magnitude of the fall penalty, whether motion is rewarded per-step or cumulatively — produce qualitatively different behaviours. Too large a fall penalty and the robot freezes; too small and it recklessly topples. The "simple" scalar signal conceals a design space as complex as the behaviour it produces.

In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Warehouse Inventory Problem]], the reward signal encodes economic preferences: holding costs, stockout penalties, sales revenue. Here the reward is not designed for learning but derived from business logic — the agent's objective function is the firm's profit function. [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Utility Maximisation]] provides the decision rule: weight each outcome by its probability and its reward, choose the action with the highest expected sum.

The reward signal is the only channel through which the designer communicates goals to the agent. Everything the agent learns — its policy, its value function, its model of the world — is shaped by this single number. Getting it right is not a technical detail; it is the design problem of reinforcement learning. Reward shaping gone wrong produces agents that are optimal in a precise, formal sense — and utterly useless for the intended purpose. The connection to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Delayed Consequences]] is direct: reward now versus reward later is the fundamental tension that discounting and value functions exist to resolve.
