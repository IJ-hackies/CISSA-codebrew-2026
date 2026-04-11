---
id: 70979ce7-1e87-4272-a631-e5f6fe0bb42d
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Warehouse Inventory Problem]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Uncertainty]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Agent Perspectives]]"
---

# State Design for MDPs

What counts as a state? The question sounds philosophical, but it is the most consequential engineering decision in any MDP formulation. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]], the state is the agent's position — a pair of coordinates. Nothing else. No memory of where it has been, no velocity, no history. The Markov property demands that the state contain everything the agent needs to predict the future; position alone suffices because the grid's dynamics depend only on where you are, not how you got there.

In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Warehouse Inventory Problem]], the state must encode current inventory level, and perhaps the season, demand forecasts, or supplier lead times. Include too little and the Markov property is violated — the agent cannot predict tomorrow's stockout risk from today's state alone. Include too much and the state space explodes, making learning intractable. The designer must find the representation that is both Markov-sufficient and computationally manageable.

[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]] formalises this: states S are the first element of the 5-tuple, and every other element — actions, transitions, rewards, discount — is defined relative to them. Change the state representation and you change the entire problem. A Grid World that includes velocity in its state is a different MDP from one that does not, even if the physical environment is identical.

The concept connects to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Uncertainty]] because state design determines what the agent can and cannot be uncertain about — if velocity is not in the state, the agent cannot learn to account for momentum. It connects to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Agent Perspectives]] because what the agent observes shapes what it can represent, and what it represents shapes what it can learn.
