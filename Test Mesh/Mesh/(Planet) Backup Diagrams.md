---
id: 86f782fd-3857-42ef-8428-e9a0896db7bc
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
---

# Backup Diagrams

A backup diagram is a visual computation. You stand at a state — the root. Below you, branches fan out to all possible successor states, each weighted by its transition probability. At each leaf sits a reward (the immediate payoff) and the value of that successor state. You multiply each leaf's contribution by its probability, sum everything up, and "back up" the result to the root. That number is the value of the state you started in.

The operation is called "backup" because information flows backward — from the future (the leaves) to the present (the root). In the student Markov chain, backing up from the Class 3 state means weighting the Bar branch by 0.4 and the study branch by 0.6, summing their rewards and discounted values. The result is a single number that compresses every possible trajectory emanating from that moment into one measure of expected goodness.

Backup diagrams are not just pedagogical illustrations — they are the actual computational primitive. Policy evaluation applies the backup at every state, sweeping through the entire state space until convergence. Value iteration applies a maximising backup, choosing the best action at each state. Every dynamic programming method in reinforcement learning is, at its core, a disciplined application of the backup operation across the state space. The diagram makes visible what the equation describes algebraically: value flowing backward through time, from consequences to the decisions that caused them.
