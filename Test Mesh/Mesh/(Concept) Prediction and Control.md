---
id: 6f043075-d18d-4101-817c-86da74909914
type: concept
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Policy]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]"
concept-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Sequential Decision Making]]"
---

# Prediction and Control

Prediction is evaluating the future: given a policy, how good will things be? Control is optimising the future: find the best policy. These are the two fundamental problems of reinforcement learning, and they must be solved in order — you cannot find the best policy without being able to evaluate policies first.

Prediction asks: if the agent follows policy pi, what is the value of each state? This is policy evaluation — applying the Bellman equation iteratively until values converge. It answers "how good is this behaviour?" without changing the behaviour. Control then asks: among all possible policies, which one maximises value? This requires evaluating multiple policies and selecting the best, or using techniques like value iteration that fold evaluation and improvement into a single operation.

The distinction structures the entire RL curriculum. Model-based prediction and model-free prediction are separate modules. Model-free control is another. Each builds on the previous. The insight is that evaluation is the harder, more fundamental skill — once you can accurately predict the consequences of any behaviour, choosing the best behaviour becomes a comparatively straightforward optimisation. Policy iteration embodies this: evaluate, improve, evaluate, improve, alternating until convergence.
