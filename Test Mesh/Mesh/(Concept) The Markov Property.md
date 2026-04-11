---
id: 18d3ff21-0ed4-4de9-9c2c-ffaa4378acb5
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Rat Experiment]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Transition Matrices]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) State Representations]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Sequential Decision Making]]"
---

# The Markov Property

The future is independent of the past given the present. This single sentence is the load-bearing axiom of both planning and reinforcement learning. It says that if you know the current state completely, you can throw the history away. Every decision, prediction, and value computation depends only on where you are now, not on how you got here.

The property sounds restrictive but is surprisingly permissive. If the past matters — if how much energy the robot has expended affects what it should do next — then you encode that information into the state. The state is not just a position; it is a complete snapshot of everything decision-relevant. In theory, it could be the entire history of the universe. In practice, deep learning excels at discovering compact representations that capture exactly the right slice.

The Markov property recurs across every lecture. It grounds the Bellman equation (value depends only on the current state and its successors). It defines MDPs (transition probabilities depend only on current state and action). It makes the student chain a valid model. And it raises the central design question: have you chosen a representation that truly captures everything the agent needs to decide?
