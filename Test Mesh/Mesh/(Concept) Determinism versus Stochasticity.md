---
id: 5fc25153-bbd4-40e2-95ab-842e44391a26
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Blocks World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Policy]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Agents Model]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Planning versus Learning]]"
---

# Determinism versus Stochasticity

In classical planning, actions are deterministic: stack block X on Y, and X is on Y. Period. The outcome is certain, the world is crisp, and search through a known graph suffices. In reinforcement learning, outcomes are probabilistic: try to move north, and with 10% probability you slip sideways. The world is noisy, and the agent must reason about distributions over possible futures rather than single trajectories.

This divide maps directly onto the planning-learning split. STRIPS and PDDL assume determinism — preconditions are either true or false, effects either fire or don't. Markov processes and MDPs embrace stochasticity — every transition is weighted by probability, and expected values replace certain outcomes. The student Markov chain lives naturally in the stochastic world; Blocks World lives naturally in the deterministic one.

But real-world problems rarely fall cleanly into either camp. A robot arm might have deterministic kinematics but stochastic sensor readings. A game might have deterministic rules but an opponent whose moves look random. The course teaches both formalisms precisely because the most powerful modern systems combine them: deterministic reasoning where possible, probabilistic hedging where necessary, and learned representations bridging the gap between what is known and what must be discovered.
