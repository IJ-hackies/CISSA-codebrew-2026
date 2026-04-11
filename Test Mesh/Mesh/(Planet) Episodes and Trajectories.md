---
id: 63cd25e4-b41f-45e6-8e15-1a470923dc33
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Return Computation]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
---

# Episodes and Trajectories

An episode is a sequence of states, actions, and rewards from start to termination. In Grid World: start at (1,1), try up, actually go right (slip), go right, go up, try up, veer left, land on the red terminal. Each step records the state, the action attempted, the state reached, and the reward received. The full trajectory is the agent's lived experience — one sample from the distribution of possible lives in this MDP.

Not all MDPs have terminal states. Some — like inventory management or robot locomotion — continue indefinitely. These are called continuing tasks, and they use discounting to ensure returns remain finite. Episodic tasks — like Grid World or game playing — have natural endpoints where the episode resets. The distinction matters for algorithm design: episodic tasks can learn from complete trajectories; continuing tasks must learn online, updating estimates as new experience arrives without waiting for an ending.

The expected return over all possible episodes is what value functions estimate. One episode might yield -0.729; another might yield +0.9. The value of a state is the average return across all episodes starting from that state, following a given policy. Computing this expectation analytically requires the full transition model; estimating it empirically requires sampling many episodes. This is the fundamental choice between model-based and model-free RL.
