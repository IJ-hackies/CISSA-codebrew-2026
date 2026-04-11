---
id: 42a23f79-05b6-4d61-84d8-5b2129ca1f17
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Atari Agent]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Value Functions]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Computing Returns]]"
---

# The Reward Hypothesis

All goals can be described by the maximisation of expected cumulative reward. This is the reward hypothesis — a sweeping, almost audacious claim. It says that everything an agent could want — walking without falling, delivering packages, winning at chess, passing an exam — reduces to a single scalar signal accumulated over time. Negative reward for falling, positive for forward motion. Negative for execution time, positive for throughput.

The power lies in universality. A humanoid robot does not need an explicit description of bipedal locomotion — it needs a penalty for falling and a bonus for progress. A warehouse manager does not need to plan every restock — the system needs costs for stockouts and holding. The reward signal encodes the goal implicitly, and the agent discovers the behaviour that maximises it.

But the hypothesis is also "quite a strong hypothesis," as the lecturer notes. Can every meaningful goal really be compressed into a number? What about conflicting objectives, multi-dimensional goals, or goals that evolve? The course does not resolve this tension. It plants the hypothesis as a foundation and builds everything on top: value functions estimating future reward, policies choosing actions to maximise it, and discount factors shaping how much the future matters relative to now.
