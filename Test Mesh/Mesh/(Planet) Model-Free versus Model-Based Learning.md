---
id: f8009705-fa21-4ad6-b6b2-17bd26ae4612
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
---

# Model-Free versus Model-Based Learning

In model-based RL, the agent learns or is given a model of the environment — the transition probabilities and reward function — and uses it to plan internally before acting. In model-free RL, the agent learns the policy or value function directly from interaction, without ever constructing an explicit model. The distinction shapes algorithm design, sample efficiency, and computational cost.

Model-based methods are sample-efficient: every interaction provides data about the model, and the model can be queried repeatedly for planning without additional real-world interaction. But they are fragile — if the model is wrong, the agent plans optimally in a fictional world. Model-free methods are robust: they learn from real outcomes, not simulated ones. But they are sample-hungry — every evaluation requires actual interaction, and the agent cannot "think ahead" without acting.

The course previews this distinction without resolving it, because the resolution occupies the entire second half of the curriculum. Model-based prediction, model-free prediction, model-free control — each gets its own module. The key insight at this stage is that the choice is not binary. Modern systems combine both: learn a model where you can, use it for planning, and fall back to model-free updates where the model is unreliable. The Atari agent, which started model-free, inspired subsequent work that added learned models for more efficient training. The frontier is hybrid.
