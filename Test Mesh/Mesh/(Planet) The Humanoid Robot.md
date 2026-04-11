---
id: b3afb570-f1f5-4ff3-9b32-b67c29a962e2
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Exploration-Exploitation Examples]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
---

# The Humanoid Robot

Negative reward for falling over. Positive reward for forward motion. These two signals — a penalty and an incentive — are enough to teach a machine to walk. The humanoid robot is the paradigmatic example of reward shaping: translating a complex, multi-dimensional goal ("walk forward bipedally without falling") into a simple scalar signal that an RL agent can optimise.

The robot does not receive instructions about joint angles, balance points, or gait patterns. It receives only the reward signal and must discover locomotion through trial and error. Early episodes are catastrophic — the robot falls immediately, accumulating negative reward. But through exploration, it discovers that certain joint configurations produce brief forward motion before collapse. It reinforces those configurations, extends them, and gradually assembles a gait.

The example illustrates both the power and the fragility of reward shaping. The reward seems obvious — penalise falling, reward motion — but subtle design choices matter. Should the penalty for falling be large or small? If too large, the robot becomes pathologically cautious and never moves. If too small, it takes excessive risks and falls constantly. Should forward motion be rewarded per-step or cumulatively? Per-step rewards encourage speed; cumulative rewards encourage distance. The "simple" reward signal conceals a design space of its own, and the agent's learned behaviour is profoundly sensitive to these choices.
