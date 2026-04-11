---
id: b7d4f2a1-6c3e-4b8f-a9d0-e1f3c5b7d9e2
type: source
filename: "Lecture 2.txt"
media-ref: "Source/Lecture 2.txt"
---

# Modelling with MRPs, PDDL, and STRIPS

This is a transcript of the second live lecture for COMP90054, focusing on modelling techniques: Markov Reward Processes (MRPs) and classical planning languages STRIPS and PDDL. The lecture bridges the two paradigms, showing how the same problem can be represented using either probabilistic or propositional formalisms.

The lecture opens with Markov processes — memoryless sequences of random states with finite state sets and transition probability matrices. The "student Markov chain" example traces episodes: a student progresses through classes, possibly gets distracted by Instagram or the bar, eventually passes and sleeps. An interactive quiz establishes that almost any problem can be formalised as a Markov process because the state can encode the full history, infinite states can be handled via function approximation, and memory can be encoded in the state representation. This frames the Markov formalism as surprisingly flexible.

The lecture then introduces reward accounting through the return function, which sums discounted future rewards using gamma (0 = myopic, 1 = far-sighted). A word cloud activity surfaces reasons for discounting: mathematical convergence guarantees, avoiding infinite returns in cyclic processes, uncertainty about the future, financial time-value of money, and biological preference for immediate reward. The Bellman equation is derived by decomposing value into immediate reward plus discounted successor state value, computed via backup diagrams.

The second half pivots to STRIPS and PDDL. The blocks world example introduces propositional modelling: predicates (on, clear, holding, arm-empty), objects (blocks A-E), actions with preconditions and add/delete effects. PDDL separates domain files (predicates, parameterised actions) from problem files (objects, initial state, goal). The lecture then compares when to use MRPs versus STRIPS: MRPs suit known states and probabilities, STRIPS suits known propositions, and when neither is known, learning techniques can fill the gaps. A discussion exercise converts the student Markov chain into STRIPS form, revealing challenges — particularly non-determinism at the bar, which classical planning handles poorly. The lecture concludes with a trivia competition covering Bellman equations, expected return, and agent components.
