---
id: 04b87966-65e9-4e79-8b34-b3eceff48bbc
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Warehouse Inventory Problem]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) The Reward Signal]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Discounting]]"
---

# Delayed Consequences

The action you take now may not reveal its worth for many steps. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]], moving away from the +1 terminal seems costly — zero reward this step — but it may be the first move of a path that avoids the -1 terminal entirely. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Warehouse Inventory Problem]], restocking today costs money immediately but prevents a stockout next week that would cost far more. The consequence is delayed; the decision cannot be.

This temporal gap between action and outcome is what makes sequential decision-making fundamentally harder than single-shot choices. If every action produced immediate, complete feedback, there would be no need for value functions, no need for discounting, no need for reinforcement learning at all. It is precisely because rewards arrive late — and because many actions intervene between cause and effect — that the agent must learn to evaluate states not by their immediate reward but by their long-term expected return.

[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]] shows the mechanism: a trajectory records the full sequence of states, actions, and rewards from start to termination. The return — the discounted sum — attributes credit backward through time, but imperfectly. The connection to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Discounting]] is direct: gamma controls how far into the future the agent looks when evaluating present actions. High gamma means delayed consequences matter almost as much as immediate ones; low gamma means the agent is myopic, reacting to what is in front of it. The connection to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) The Reward Signal]] is equally direct: if the reward signal is sparse — zero everywhere except at terminal states — then delayed consequences are the only consequences, and the agent must learn from echoes rather than shouts.
