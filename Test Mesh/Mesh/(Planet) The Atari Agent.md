---
id: 122da9d7-76b4-4a08-9cfc-a575628f2f5e
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Reward Hypothesis]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Policy]]"
---

# The Atari Agent

Imagine sitting before a retro arcade cabinet. A brain — yours, or an artificial one — watches coloured pixels shift across the screen: Pac-Man navigating a maze, Defender scrolling across a starfield, Breakout bouncing a ball against bricks. The agent observes these pixels, pushes a joystick, and receives a reward — a score increment, a lost life, a power-up consumed. This is the primal scene of AI planning and learning, reduced to its simplest components: observation, action, reward.

The Atari example cleaves the subject in two. If you know the rules — if you have played enough to build a perfect internal model of what happens when you push left versus right from any state — you can plan. Simulate consequences, reason forward, choose the path that maximises score. This is classical planning: a known model, a goal, and deliberation. But if you sit down for the first time, all you see are meaningless pixel patterns and a number in the corner that occasionally changes. You do not know what the sprites are, the dynamics, or which joystick movements produce which screen changes. This is reinforcement learning: an unknown model, trial and error, and the slow accumulation of understanding through feedback.

DeepMind's landmark system learned to play dozens of Atari games from raw pixels alone, matching or exceeding human performance without being told the rules. It demonstrated that the planning-learning divide is not a wall but a spectrum — and that agents armed with enough experience can cross it entirely. The Atari agent is where the course begins: the question of how an agent should behave, and the two great traditions that attempt to answer it.
