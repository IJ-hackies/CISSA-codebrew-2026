---
id: 0fa5050e-1ccd-4c16-9dbc-c76eb2b37454
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Transition Matrices]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Backup Diagrams]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
---

# The Bellman Equation

The Bellman equation splits the value of a state into two parts: the immediate reward at the next step, and the discounted value of wherever you end up. This decomposition, grounded in the law of iterated expectations, is the engine that drives nearly everything in reinforcement learning.

The equation is recursive: the value of a state depends on the values of its successors, which depend on their successors, cascading through the entire state space. For small problems, you can solve it exactly through matrix inversion — the value vector equals the inverse of (I - gamma * P) times the reward vector. But matrix inversion scales cubically, so for real problems, iterative methods dominate: apply the backup operation repeatedly until values converge to a fixed point.

In the student MRP, the Bellman equation becomes concrete arithmetic. The state "about to study Class 3" has a 0.4 probability of going to the Bar (reward 0, plus the Bar's value) and a 0.6 probability of heading to exam prep (reward -2, plus that state's value). Multiply and sum: 0.4 times the Bar branch plus 0.6 times the study branch. The result captures every possible future episode radiating from that moment. This recursive decomposition — value equals immediate reward plus discounted expected future value — is the single most important equation in the course.
