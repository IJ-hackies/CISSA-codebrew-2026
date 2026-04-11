---
id: 1ac28c1f-bca0-40ca-965f-b389c71583ae
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Return Computation]]"
---

# Grid World

A small grid of white cells, bordered by grey walls. One green cell offers +1 reward. One red cell threatens -1. A blue dot marks the start. The agent tries to move north, south, east, or west — but with 90% probability of success and 10% chance of slipping 90 degrees (5% left, 5% right). Moving into a wall leaves you in place. Reaching a coloured cell ends the episode.

Every component of an MDP is concrete here. States are grid cells. Actions are cardinal directions. Transition probabilities are known: 0.9 intended, 0.05 each perpendicular. Rewards are sparse: zero everywhere except terminals. The discount factor gamma weights future steps. All five MDP components — states, actions, probabilities, rewards, discount — are countable and visualisable.

Grid World is where RL abstractions collapse into something you can draw on a whiteboard and trace with a finger. The 10% slip rate is small enough to seem manageable but large enough to make optimal behaviour non-trivial: near the red cell, the "safe" policy might hug a wall because slipping toward -1 is catastrophic even if unlikely. Students discover that optimal policies in stochastic environments look qualitatively different from optimal plans in deterministic ones — caution emerges from probability, not from explicit fear.
