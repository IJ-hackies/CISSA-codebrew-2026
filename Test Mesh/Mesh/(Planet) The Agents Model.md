---
id: 60c24fb9-d892-4c8b-8887-c31a08e2cc2c
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Policy]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Transition Matrices]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
---

# The Agent's Model

The model is the agent's internal representation of how the environment works. It predicts what will happen next: the probability of transitioning from state S to state S' when action A is taken, and the expected reward for doing so. If the policy says what to do and the value function says what is worth pursuing, the model says what the world will do in response.

In planning, the model is given — the PDDL domain file, the transition graph, the rules of the game. The agent can simulate actions mentally, trace consequences without acting, and choose optimally before committing. In reinforcement learning, the model is initially unknown. The agent must either learn it through experience (model-based RL) or bypass it entirely, learning the policy or value function directly from interaction (model-free RL).

The model might be imperfect. The grid world's stochastic transitions — 90% chance of going where intended, 10% chance of slipping — mean even a known model yields uncertain outcomes. This is why stochastic policies are useful: when the model says the world is noisy, the agent can hedge. And when the model is learned rather than given, it might be wrong — capturing some dynamics correctly while missing others. The interplay between model accuracy and policy quality is a central tension in RL. Some of the most powerful modern systems, like those fine-tuning LLMs, combine learned models with policy optimisation, building and exploiting internal representations simultaneously.
