---
id: 9cc4c8da-430a-4340-b96d-909aab4aa887
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Atari Agent]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]"
---

# The Rat Experiment

A rat is hungry. It can press a lever, observe a light, or hear a bell. In the first episode, the light goes off, the light goes off again, the rat pulls the lever, a bell dings — and the rat gets a shock. In the second episode, a bell dings, a light goes off, the rat pulls the lever, pulls again — and gets cheese. Now comes the prediction: what happens if the rat pulls the lever, sees the light, pulls again, and hears the bell?

The answer depends entirely on what the rat uses as its state. If the state is the last three items in the sequence — lever, light, lever, bell — it matches the first episode, so the rat expects a shock. If the state is a count of events (one bell, one light, two levers), it matches the second episode, so the rat expects cheese. If the state is the complete sequence, neither episode matches, and the rat simply cannot predict.

This thought experiment demonstrates that the Markov property is not a fact about the world — it is a choice about representation. Different state encodings make different histories visible and invisible. The rat experiment forces the most fundamental question in agent design: what should the state contain? Too little, and the agent cannot distinguish situations requiring different actions. Too much, and the state space explodes. The right representation wraps up exactly enough of the past to determine the future — no more, no less.
