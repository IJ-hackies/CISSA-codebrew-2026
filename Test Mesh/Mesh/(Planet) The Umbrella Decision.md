---
id: 0cf822e4-1ece-468d-9cf0-4bdb9dda7169
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Utility Maximisation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
---

# The Umbrella Decision

Should you bring an umbrella? The world can be sunny or rainy. You can bring it or leave it. Four outcomes: bring it and it's sunny (mildly annoyed — carrying it for nothing), bring it and it rains (happy — you're dry), leave it and it's sunny (best case — unencumbered), leave it and it rains (worst case — soaked). No numbers yet — just feelings.

The decision theory framework says: assign utilities to each outcome, estimate the probability of each world-state, and compute the expected utility of each action. If there's a 30% chance of rain, the expected utility of bringing the umbrella is 0.7 * (annoyance) + 0.3 * (dry). The expected utility of leaving it is 0.7 * (freedom) + 0.3 * (soaked). Whichever number is bigger wins.

This toy problem introduces the foundational logic of reinforcement learning without any of its machinery. The umbrella decision is a single-step decision problem — one choice, one outcome, done. RL extends this to sequential decisions: bring the umbrella today, and tomorrow you might face a different weather pattern, and the day after that another. But the core logic — weigh outcomes by probability, maximise expected total reward — remains identical. Every MDP is, in a sense, a chain of umbrella decisions, each shaped by the consequences of the last.
