---
id: b03ca196-0afe-4bc9-b514-118e3763bab5
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Umbrella Decision]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
---

# Expected Utility Maximisation

The decision rule: for each available action, compute the sum of (probability of each outcome) times (utility of that outcome). Choose the action with the highest sum. This is expected utility maximisation — the formal principle underlying all of reinforcement learning's goal structure.

The umbrella problem makes it explicit. E(bring) = P(sunny) * U(bring, sunny) + P(rain) * U(bring, rain). E(leave) = P(sunny) * U(leave, sunny) + P(rain) * U(leave, rain). Plug in numbers, compare, decide. The principle scales from one decision to millions: in an MDP, the agent applies this logic at every state, choosing the action that maximises expected cumulative reward.

The power of expected utility is that it combines two separate things — beliefs about the world (probabilities) and preferences about outcomes (utilities) — into a single number that supports comparison. You do not need to resolve your uncertainty before deciding; you can decide optimally given your uncertainty. This insight drives everything from Bayesian reasoning to Monte Carlo tree search to the policy gradient algorithms used to fine-tune modern language models.
