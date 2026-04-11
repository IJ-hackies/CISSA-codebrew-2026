---
id: f3b8d6e5-1a7c-4f0d-e4b3-c5d7a9f1b3d6
type: source
filename: "Lecture 6.txt"
media-ref: "Source/Lecture 6.txt"
---

# Introduction to Reinforcement Learning and MDPs

This is a transcript of the sixth live lecture for COMP90054, marking the transition from classical planning to reinforcement learning. Adrian Pierce hands over to Sarita Rosenstock, who will teach the next six lectures on RL. The lecture introduces reinforcement learning as a paradigm and formally defines Markov Decision Processes (MDPs).

The lecture frames RL as a machine learning paradigm where agents learn sequential decisions in uncertain environments guided by rewards and penalties. Key distinguishing features are highlighted: the agent perspective (limited view, no top-down knowledge), uncertainty (from environment or other agents), and the exploration-exploitation trade-off (balancing known-good actions against discovering potentially better ones). The Atari example contrasts the planning approach (using a game emulator as a perfect model) with the RL approach (learning from raw pixels and scores without knowing the rules).

The reward hypothesis is revisited: goals are characterised as maximisation of expected cumulative reward. Examples include humanoid robot walking (negative reward for falling, positive for forward motion) and warehouse inventory control (negative reward for lost sales and holding costs, positive for sales). The umbrella decision problem illustrates expected utility maximisation — weighting outcomes by their probabilities and choosing the action with the highest expected value.

MDPs are formally defined as a tuple of states, actions, transition probabilities, rewards, and discount factor. Unlike classical planning's deterministic transition functions, MDPs have probabilistic transitions — taking an action in state S gives a probability distribution over next states. Grid World serves as the primary example: states are grid cells, actions are cardinal directions with 10% chance of 90-degree error, and terminal states provide +1 or -1 reward (all other states give 0). A hands-on exercise calculates the discounted return for a specific trajectory through Grid World with gamma = 0.9.

The lecture discusses discounting rationale: avoiding infinite returns, reflecting future uncertainty, expressing preference for speed, and enabling comparison between trajectories of different lengths. The Markov property is re-emphasised — designing state representations that capture all decision-relevant information from the past. The lecture closes by previewing RL solution methods: policies (deterministic or stochastic behaviour functions), value functions (state evaluations), and models (learned environment representations).
