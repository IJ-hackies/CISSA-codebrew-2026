---
id: cf0c63a4-ef14-4f5c-9d87-7b9e8e9dfd7a
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Umbrella Decision]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Exploration versus Exploitation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) State Design for MDPs]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Determinism versus Stochasticity]]"
---

# Uncertainty

Uncertainty is not noise to be eliminated — it is the defining condition of the problems reinforcement learning was built to solve. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Umbrella Decision]], uncertainty is simple: you do not know whether it will rain. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]], uncertainty is mechanical: you intend to go north but slip east with 5% probability. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]], uncertainty is structural: the transition function P(s'|s,a) is a probability distribution, not a lookup table.

The distinction between deterministic and stochastic environments (see [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Determinism versus Stochasticity]]) is the distinction between planning with certainty and deciding under risk. Classical planning assumes actions have predictable outcomes — apply operator, get successor state. MDPs assume actions have probabilistic outcomes — apply action, sample from a distribution. This shift from certainty to probability is what separates STRIPS from RL, and it is why expected utility rather than simple utility becomes the decision criterion.

Uncertainty also drives the [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Exploration versus Exploitation]] dilemma. If the agent knew the true value of every action, there would be nothing to explore. It is precisely because the agent is uncertain about the world that it must sometimes sacrifice reward for information. The optimal balance between exploration and exploitation depends on the agent's degree of uncertainty — and on how quickly that uncertainty can be resolved through experience.
