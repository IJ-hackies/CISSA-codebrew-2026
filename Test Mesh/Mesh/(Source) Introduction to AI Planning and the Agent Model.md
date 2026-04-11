---
id: a3c8e1f0-7b2d-4a9e-b5c1-d8e2f4a6b0c3
type: source
filename: "Lecture 1.txt"
media-ref: "Source/Lecture 1.txt"
---

# Introduction to AI Planning and the Agent Model

This is a transcript of the first live lecture for COMP90054: AI Planning for Autonomy at the University of Melbourne, delivered by Adrian Pierce (subject coordinator) with tutor Guang Hu and academic specialist Andrew Chess. The lecture introduces the foundational concepts of the course, which covers both classical planning and reinforcement learning.

The lecture opens with course logistics — tutorials starting Friday of week 1 due to a public holiday, pre-class activities on Ed, and pointers to Python and probability refresher materials. The core content begins with the agent model, illustrated through the Atari example: an agent observes pixels on a screen, takes actions via a joystick, and receives rewards (scores, lives). Planning is framed as reasoning with known rules ("if you know the rules of the game"), while learning (reinforcement learning) is framed as discovering rules through trial and error with only pixels and scores as input.

Key concepts introduced include the reward hypothesis (all goals can be described by maximisation of expected cumulative reward), sequential decision making (actions have long-term consequences; reward may be delayed), and Markov states (the future is independent of the past given the present — a "sufficient statistic of the future"). The rat lever experiment illustrates how different state representations (last 3 items, counts, full sequence) lead to different predictions, reinforcing that state design matters. Interactive PollEverywhere quizzes engage students throughout.

The lecture defines the three core components of a Markov planning and learning agent: policy (behaviour function mapping states to actions, deterministic or stochastic), value function (prediction of future reward used to evaluate states, with discount factor gamma weighting near-term reward higher), and model (transition probabilities and expected rewards). A grid-world example demonstrates all three — the policy as directional arrows in each cell, the value function as numbers representing state goodness, and the model as transition probabilities. The lecture closes by contrasting planning (model-known, goal-directed, deterministic) with reinforcement learning (model-unknown, reward-driven, probabilistic), and notes that modern GenAI systems like ChatGPT and DeepSeek use techniques from both via proximal policy optimisation.
