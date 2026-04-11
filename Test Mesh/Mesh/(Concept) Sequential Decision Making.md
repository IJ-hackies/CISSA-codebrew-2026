---
id: 1928b334-f4f3-4386-9b18-bcf402828820
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Reward Hypothesis]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Computing Returns]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) The Markov Property]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Discounting]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Prediction and Control]]"
---

# Sequential Decision Making

Actions have consequences that unfold over time. What you do now affects not just the immediate outcome but the entire trajectory of future states and rewards. A financial investment takes months to mature. A game move sets up positions that matter dozens of turns later. A student skipping Class 2 for the Bar might not feel the consequences until exam day.

This temporal depth separates the problems studied here from simpler machine learning. In classification, each prediction is independent. In sequential decision making, data is non-IID: each state depends on prior actions, and each action reshapes what comes next. The agent is not a passive observer but an active participant whose choices create the world it inhabits.

The challenge compounds because reward is often delayed. The best chess move might look bad for ten turns. The optimal warehouse restock happens weeks before the demand it prevents. This is why value functions exist: they propagate future reward backward through time, assigning each state a number that captures everything that could happen after. Sequential decision making is the thread connecting planning and learning, the Bellman equation and policy optimisation — the reason the entire course exists.
