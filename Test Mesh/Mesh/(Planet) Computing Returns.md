---
id: 0e3d57f9-5ce2-4d6a-b256-37b07735eb16
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Reward Hypothesis]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
---

# Computing Returns

The return at time T is the sum of discounted future rewards: R_{t+1} + gamma * R_{t+2} + gamma^2 * R_{t+3} + ... Each successive reward is multiplied by gamma raised to a higher power, so future rewards count less and less. With gamma = 0.5, starting from the student chain at Class 1, an episode that goes Class 1 → Class 2 → Class 3 → Pass → Sleep yields -2 + 0.5*(-2) + 0.25*(-2) + 0.125*(10) + 0.0625*(0) — the studying costs are front-loaded and nearly full-weight, while the +10 for passing is heavily discounted.

The discount factor transforms the character of optimal behaviour. At gamma = 0 (myopic), only the immediate reward matters: the bar (+1) looks better than studying (-2), and the distant +10 is invisible. At gamma = 0.9 (far-sighted), the +10 for passing dominates: the agent endures the studying costs because the future payoff looms large. At gamma = 1 (fully far-sighted), a student stuck in the Instagram self-loop accumulates infinite negative reward — discounting prevents this by ensuring the infinite sum converges.

Four sample episodes through the student MRP are computed explicitly in the lectures, showing how the same transitions produce wildly different returns depending on gamma. This arithmetic is the first hands-on encounter with a principle that pervades the course: the same environment, the same actions, the same rewards, but a single parameter — the discount factor — reshapes what counts as optimal behaviour. The agent's relationship to time is not fixed by the world; it is a design choice.
