---
id: b0d1a5dc-c739-454b-97a8-dceb410423e4
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Atari Agent]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Blocks World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Agents Model]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) The Markov Property]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Determinism versus Stochasticity]]"
---

# Planning versus Learning

Planning and learning are two faces of the same problem: how should an agent behave? In planning, the model is known — the agent has a complete, certain representation of world dynamics. It deliberates, simulates, and reasons its way to an optimal plan without touching the real environment. In learning, the model is unknown — the agent interacts, observes, and builds understanding through experience.

The distinction maps onto formalisms. Classical planning uses propositions and logic: STRIPS operators with preconditions and effects, PDDL domain files with parameterised actions. Reinforcement learning uses probabilities and expectations: transition matrices, reward functions, value functions estimated from episodes. Planning is deterministic; learning is stochastic. Planning searches a known graph; learning explores an unknown one.

But the course deliberately presents them together because the modern frontier lies in their convergence. ChatGPT 3.5 used proximal policy optimisation — an RL algorithm — to fine-tune language generation. DeepSeek uses parallel RL. Attention-based transformers utilise sequence in ways that mirror both planning's causal chains and RL's temporal credit assignment. The two paradigms are not alternatives; they are endpoints of a spectrum that the best modern systems traverse freely.
