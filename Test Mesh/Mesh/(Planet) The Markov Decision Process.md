---
id: b813dc48-f80c-438a-bfd7-17cf999efb13
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Umbrella Decision]]"
---

# The Markov Decision Process

An MDP is a 5-tuple: states S, actions A, transition probabilities P(s'|s,a), reward function R(s,a,s'), and discount factor gamma. Unlike classical planning's deterministic transitions, MDPs embrace probability — taking action A in state S gives a distribution over next states, not a single outcome. Unlike simple Markov chains, MDPs include actions — the agent chooses, not just observes.

The transition probability matrix has one slice per action. The "move north" matrix in Grid World has 0.9 on the cell above and 0.05 on each side cell. The "move east" matrix rotates these probabilities 90 degrees. The reward function assigns values to state-action-state triples, though in Grid World it depends only on the destination state (+1, -1, or 0).

Formally defining the MDP is the first step in any RL problem. You must specify what counts as a state (is it just position, or does it include velocity, energy, inventory?), what actions are available in each state, how the world responds to those actions, what the agent values, and how much it discounts the future. Each choice shapes the problem profoundly. A Grid World with gamma = 0.1 produces a myopic agent that grabs the nearest reward. The same Grid World with gamma = 0.99 produces a careful agent that avoids risks. The MDP is not just a formalism — it is the language in which RL problems are spoken.
