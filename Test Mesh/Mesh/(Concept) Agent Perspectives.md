---
id: 067f4dee-7a57-464a-bf49-75e8c649a38c
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Model-Free versus Model-Based Learning]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Uncertainty]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Delayed Consequences]]"
---

# Agent Perspectives

The same MDP looks different depending on what the agent knows. A model-based agent sees the transition function and reward function directly — it can simulate trajectories without acting, plan ahead without cost, and evaluate policies in its head. A model-free agent sees only the stream of states, actions, and rewards it actually experiences — it must extract value estimates from lived interaction, one episode at a time.

This difference in perspective shapes everything. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Model-Free versus Model-Based Learning]], the agent with a model is sample-efficient but fragile — if the model is wrong, it plans optimally in a fictional world. The agent without a model is robust but sample-hungry — every evaluation requires real interaction. Neither perspective is universally better; each trades one vulnerability for another.

The perspective also determines what the agent learns from an episode. In [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]], a model-based agent uses each transition to update its model of how the world works. A model-free agent uses the same transition to update its estimate of how much reward to expect. Same data, different lessons. The MDP formalism in [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]] is neutral — it defines the problem, not the solution method. But the agent's perspective on the MDP determines which solution methods are available, which are efficient, and which are even possible.

The concept connects to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Uncertainty]] because the agent's perspective determines what it is uncertain about — the model-based agent is uncertain about transition probabilities, the model-free agent is uncertain about value estimates — and to [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Delayed Consequences]] because both perspectives must grapple with the fact that actions have effects that unfold across time, not just in the immediate next state.
