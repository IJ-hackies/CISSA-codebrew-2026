---
id: bafb861d-c56e-4fd4-8622-82ec63724415
type: story
---

# The Cartographer of Consequences

## Introduction

Dr. Lena Vasquez had spent fourteen years drawing boundaries. Coastlines, fault lines, the shifting edges of glaciers retreating from warming seas. She worked in millimetre precision, her instruments calibrated to tolerances that most people would call obsessive and she would call responsible. Her maps were beautiful in the way that accurate things are beautiful -- not adorned, but honest. Every contour line earned. Every elevation verified. She had built a career on the conviction that if you measured the present carefully enough, you could hold it still.

The mission briefing arrived on a Tuesday. Exploration Command needed a cartographer for a survey of eleven newly discovered planets in the Stochastic Rim, a cluster of systems that defied conventional mapping. The planets were not spatially complex -- no impossible topographies, no non-Euclidean geometries. They were temporally complex. Their landscapes changed according to rules that were probabilistic rather than fixed, and Exploration Command needed someone who could map not just where things were but how they would change. They needed someone fluent in the grammar of space who could learn the grammar of time.

Lena almost declined. Her discipline was the present tense. She mapped what existed, not what might exist, and the gap between those two activities felt to her like the gap between science and speculation. But three questions had been gathering at the edges of her thinking for years, questions her static maps could never answer, and the mission profile spoke directly to each one.

The first was the question of [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Sequential Decision Making]]. She had watched urban planners use her maps to make choices -- where to build a bridge, where to route a highway -- and she had seen how each choice constrained the next. A bridge here meant no park there. A highway through this valley meant that valley's watershed was altered for decades. Decisions chained together, each one reshaping the landscape on which the next decision would be made, and her maps captured none of that cascade. She wanted to understand the mechanics of how choices link into sequences, how one commitment propagates forward into a hundred consequences.

The second was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) The Markov Property]] -- a principle she had encountered in a statistics seminar and could not stop thinking about. The idea that the present state of a system contains everything necessary to predict its future. That history, however rich, however painful, compresses into the current configuration. For a cartographer, this was either liberation or heresy. It meant that a sufficiently detailed map of now was, in some formal sense, a map of everything that could happen next. It meant the present was not just a snapshot but a sufficient statistic. She needed to see whether that was true.

The third was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Discounting]] -- the question of whether distant consequences should weigh as heavily as near ones. Every planner she had worked with treated the far future as vaguely important but practically negligible, and she had never known whether this was wisdom or cowardice. If you discount the future steeply, you grab what is close and ignore what is far. If you refuse to discount at all, every decision becomes paralysing, because every consequence stretches to infinity. There had to be a principled answer, and she suspected these planets held it.

She packed her instruments. Theodolite, laser rangefinder, graphing tablet, three notebooks with grid paper. She packed them knowing they might be the wrong tools entirely. Then she boarded the survey vessel and set course for the first planet.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Agents Model]]

The first planet looked, from orbit, like a clockwork mechanism laid bare. Vast translucent structures stretched across its surface -- lattices of crystal that pulsed with faint internal light, each node connected to its neighbours by filaments that brightened and dimmed in rhythmic patterns. Lena brought the survey vessel down on a plateau of dark basalt and stepped out into thin, breathable air.

She walked toward the nearest lattice. Up close, the nodes were large -- each one a chamber the size of a small room, its walls transparent. Inside, she could see representations: models of environments, simplified and schematic, projected onto the inner surfaces. One chamber showed a grid of corridors. Another showed a branching tree of decisions. A third showed a simple room with obstacles and a goal.

She pressed her hand against the crystal wall and felt it warm. Text resolved beneath her fingertips, or something like text -- meaning that arrived without words. The agent's model. An internal representation of how the environment works. It predicts what will happen next: the probability of transitioning from one state to another when an action is taken, and the expected reward for doing so. If the policy says what to do and the value function says what is worth pursuing, the model says what the world will do in response.

Lena pulled out her notebook and began sketching. In planning, she read from the lattice, the model is given -- the transition graph, the rules of the game. The agent can simulate actions mentally, trace consequences without acting, choose optimally before committing. But in learning, the model is initially unknown. The agent must build it from experience or bypass it entirely, learning to act well without ever understanding why.

She stood back and looked at the lattice stretching to the horizon. Each chamber was an agent's understanding of its world -- imperfect, approximate, but functional. The grid world's stochastic transitions meant that even a known model yielded uncertain outcomes. Ninety percent chance of going where intended, ten percent chance of slipping. Even perfect knowledge of the rules did not eliminate surprise. She wrote in her notebook: *The map is not the territory. But without a map, you cannot even begin to plan.* She had always known this. She had never seen it encoded in crystal.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Student Markov Chain]]

The second planet was alive with movement. Lena set down near an equatorial plateau and immediately noticed that the terrain was not terrain at all -- it was a network of paths, worn smooth by countless traversals, branching and rejoining in patterns that looked almost organic. Small luminous markers drifted along the paths like migrating insects, each one following a trajectory dictated by probabilities she could not yet read.

She followed one marker. It began at a node labelled Class 1 and moved forward with hesitant momentum toward Class 2. But at a junction, it wavered. There was a branch toward something called Instagram -- a tight loop, a self-referential curl where the path fed back into itself. The marker entered the loop and began to circle. Each revolution dimmed it slightly. Lena watched it orbit five, six, seven times before it finally broke free and stumbled toward Class 2.

Another marker took a different route. From Class 1 it veered toward the Bar -- a broad, comfortable-looking node with warm amber light. It lingered there, accumulating a small positive glow, then emerged and drifted not forward but backward, all the way to Class 1. The reward was +1, small and immediate. Meanwhile, a third marker pushed doggedly through Class 2, Class 3, enduring the -2 cost at each stage, and finally reached Pass, where it blazed with +10 before settling into the terminal stillness of Sleep.

The rewards, Lena realised, laid bare the economics of attention and discipline. The Bar gave small pleasures. Instagram eroded capacity at -1 per loop. Studying cost -2 per class but led to the +10 of passing. When she computed returns with different discount factors in her notebook, the numbers revealed something like character: a myopic agent saw the Bar as attractive and studying as pointless. A far-sighted agent endured the costs because the distant reward dominated. She wrote: *Patience is not a virtue here. It is a discount factor.* The chain made probability feel personal -- not abstract, but biographical.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Transition Matrices]]

The third planet was a world of grids. Lena landed on a plain of polished obsidian, and as she walked, the surface beneath her feet illuminated with numbers. Rows and columns stretched in every direction, vast matrices etched in light, each entry a probability between zero and one.

She knelt and traced a row with her finger. Each row was a state. Each column was a possible successor state. The entry at their intersection was the probability of moving from one to the other in a single step. Every row summed to one -- from any state, you must go somewhere. The constraint was elegant and absolute. No row could exceed unity. No state could refuse to have a future.

She found the student Markov chain encoded here as a specific matrix. The row for Class 1 had 0.5 in the Class 2 column and probabilities scattered toward Instagram and the Bar. The row for Instagram had a large number on its own diagonal -- the self-loop, the probability of scrolling leading to more scrolling, encoded as a single decimal. The row for Sleep was all zeros except a 1 on its diagonal. An absorbing state. Once you arrive, you never leave. Lena stared at that row for a long time. A terminal state was just a row that pointed entirely at itself.

She walked further and found matrices that depended on actions. In an MDP, there was a separate matrix for each choice: one for move north, another for move south. The grid world's move-north matrix had 0.9 on the entry for the cell above and 0.05 each for the cells to the left and right. These matrices, she understood, were the numerical backbone of everything. The Bellman equation would multiply them by value vectors. Policy evaluation would iterate over them. The entire computational machinery of planning and learning rested on these grids of probabilities. She had spent her career making maps from measurements. Here, the map was made of numbers, and the territory was made of chance.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Policy]]

The fourth planet announced itself through arrows. Lena could see them from orbit -- vast directional indicators carved into the landscape, each one fixed in a cell of a planetwide grid, each pointing in exactly one direction. North, south, east, west. No ambiguity. No hesitation. The entire surface was a single, enormous instruction set.

She landed and walked among the arrows. In every cell, the arrow told the agent what to do. If you are here, go there. A deterministic policy -- a hard rule, a reflex. If the oven feels hot, pull the hand away. One direction per state, no ambiguity. She could read the planet's surface like a topographic map, except instead of elevation contours she was reading behaviour contours. The arrows described not what was, but what to do.

But as she moved toward the planet's equatorial zone, the arrows began to shimmer. Some cells contained not one arrow but several, each with a different opacity. A stochastic policy. In this state, go left with seventy percent probability, go right with thirty. The translucent arrows overlapped, creating a visual haze of partial commitment. She understood immediately why this mattered: in uncertain environments, occasional randomness helped escape local optima. The vacuum robot that always turned left would circle forever; the one that occasionally turned right would eventually find its way to the far side of the room.

She sat on a ridge and considered the difference between a plan and a policy. A plan was a sequence of actions from one initial state -- a single thread through possibility space. A policy was more general: it specified behaviour for every state, not just the planned path. This mattered when execution was stochastic. If the agent slipped, the plan broke, but a full policy handled every contingency. Lena recognised the distinction as a cartographic one. A route was a line on a map. A policy was the entire map, annotated with instructions at every point. She had been drawing routes her whole career. She had never drawn a policy.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Bellman Equation]]

The fifth planet was recursive. Lena felt it before she understood it -- a vertigo that came not from height but from depth, as though the ground beneath her feet extended downward through infinite layers of itself.

The surface was covered in circular pools of dark liquid, each one reflecting not the sky above but other pools. She approached one and looked in. The reflection showed two more pools, each weighted with a shimmering probability. One branch: 0.4, leading to a pool labelled Bar, reward 0. The other: 0.6, leading to a pool labelled Study, reward -2. The value of the pool she stood beside was the weighted sum of what lay in its reflections, discounted by a factor that dimmed with depth.

She understood. The value of a state splits into two parts: the immediate reward at the next step, and the discounted value of wherever you end up. The equation was recursive -- the value of a state depended on the values of its successors, which depended on their successors, cascading through the entire state space. She was looking at the engine that drove nearly everything in this realm of sequential decision-making.

For small problems, she read from the pool's edge, you could solve it exactly through matrix inversion -- the value vector equalled the inverse of (I minus gamma times P) times the reward vector. But matrix inversion scaled cubically. For real problems, iterative methods dominated: apply the backup operation repeatedly until values converge to a fixed point. She watched the pools shimmer and settle, shimmer and settle, each iteration bringing them closer to equilibrium.

In her notebook she wrote the arithmetic from the student chain. The state about to study Class 3 had a 0.4 probability of going to the Bar and a 0.6 probability of heading to exam prep. Multiply and sum: 0.4 times the Bar branch plus 0.6 times the study branch. The result captured every possible future radiating from that moment. Value equals immediate reward plus discounted expected future value. She circled the equation twice. It was, she suspected, the single most important relationship she would find on any of these planets.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Backup Diagrams]]

The sixth planet made the equation visible.

Lena landed in a forest of inverted trees. Each tree grew downward from a single root node suspended in the air, branches fanning out below toward the ground, each branch terminating in a leaf that glowed with a small, steady number. The roots hung at eye level. The leaves touched the soil. Information, she realised, flowed upward -- from the future at the bottom to the present at the top.

She walked beneath the nearest tree. The root was a state. Below it, branches split toward successor states, each branch labelled with a transition probability. At each leaf sat two numbers: a reward and a value. The operation was clear. You multiplied each leaf's contribution by its probability, summed everything up, and backed the result to the root. That number was the value of the state you started from.

The word backup made sudden sense. Information flowed backward -- from consequences to decisions, from the future to the present. In the student Markov chain, backing up from Class 3 meant weighting the Bar branch by 0.4 and the study branch by 0.6, summing their rewards and discounted values. The result was a single number that compressed every possible trajectory from that moment into one measure of expected goodness.

She moved through the forest for hours, studying trees of varying complexity. Some had two branches. Some had dozens. But the operation was always the same: weight, sum, compress. These diagrams were not just illustrations. They were the actual computational primitive. Policy evaluation applied the backup at every state, sweeping through the entire state space until convergence. Value iteration applied a maximising backup, choosing the best action at each state. Every dynamic programming method was, at its core, a disciplined application of this single operation across the state space. The diagram made visible what the equation described algebraically: value flowing backward through time, from consequences to the decisions that caused them. Lena sketched tree after tree in her notebook, each one a small proof that the future could be compressed into a number.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Umbrella Decision]]

The seventh planet was small and mild. After the recursive depths and inverted forests of the previous worlds, its simplicity felt almost domestic. Lena stepped onto a surface that resembled a garden path -- flagstones set in soft ground, a mild sky overhead that flickered between sunshine and grey.

An umbrella stood propped against a stone. Beside it, a small plaque: *Should you bring it?*

She laughed. After transition matrices and Bellman equations, the question felt absurd. But she sat down on the path and worked through it. The world could be sunny or rainy. She could bring the umbrella or leave it. Four outcomes arranged themselves in her mind with the neatness of a two-by-two matrix. Bring it and it is sunny: mildly annoyed, carrying it for nothing. Bring it and it rains: happy, dry. Leave it and it is sunny: best case, unencumbered. Leave it and it rains: worst case, soaked.

The framework said: assign utilities to each outcome, estimate the probability of each world-state, compute the expected utility of each action. If there was a thirty percent chance of rain, the expected utility of bringing the umbrella was 0.7 times the annoyance plus 0.3 times staying dry. The expected utility of leaving it was 0.7 times freedom plus 0.3 times getting soaked. Whichever number was bigger won.

Lena turned the umbrella over in her hands. This was a single-step decision problem -- one choice, one outcome, done. But she had seen enough now to recognise that reinforcement learning extended this to sequences: bring the umbrella today, and tomorrow you face a different weather pattern, and the day after that another. Every MDP was, in a sense, a chain of umbrella decisions, each shaped by the consequences of the last. The core logic remained identical throughout: weigh outcomes by probability, maximise expected total reward. She left the umbrella where she found it. The sky stayed clear. She noted in her margin: *The simplest problem contains the entire architecture. Everything else is repetition across time.*

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Grid World]]

The eighth planet was the one she had been waiting for. A cartographer's planet. A grid.

From orbit it looked like a chessboard laid over a small moon -- white cells bordered by grey walls, one green cell pulsing with +1, one red cell threatening -1, a blue dot marking the start. She landed at the blue dot and immediately felt the stochasticity in the ground. When she stepped north, the surface shifted beneath her -- ninety percent of the time she moved where she intended, but there was a five percent chance of slipping left and five percent right. The uncertainty was subtle but real, a faint sideways tug with every step.

She began mapping. States were grid cells -- finite, enumerable, each one a position she could mark on a chart. Actions were cardinal directions. Transition probabilities were known: 0.9 intended, 0.05 each perpendicular. Rewards were sparse: zero everywhere except the terminals. The discount factor gamma weighted future steps. All five MDP components -- states, actions, probabilities, rewards, discount -- were countable and visible. She could draw this world on her graphing tablet in an hour.

But the behaviour it demanded was not simple. Near the red cell, the safe policy hugged the far wall, because slipping toward -1 was catastrophic even if unlikely. Caution emerged not from explicit programming but from probability -- the optimal policy in a stochastic environment looked qualitatively different from the optimal plan in a deterministic one. A straight line to the green cell was the shortest route, but it passed one cell away from the red terminal, and with a five percent slip rate, that proximity was a gamble a rational agent would refuse.

Lena mapped every cell, every arrow, every transition probability. For the first time, she was doing what she had always done -- measuring, recording, charting positions -- but the map included instructions. Not just where things were, but what to do at each location. A map that was also a policy. She had never made anything like it, and it felt, she admitted to herself, like the work she had been preparing for her entire career.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]

The ninth planet formalised everything she had seen.

Lena descended through thin cloud cover and found a world of pure structure -- no terrain, no features, only relationships. The surface was a crystalline lattice encoding a five-tuple: states S, actions A, transition probabilities P(s'|s,a), reward function R(s,a,s'), and discount factor gamma. Each element was a visible axis of the lattice, and where they intersected, behaviour emerged.

She walked along the actions axis and felt the transition probabilities shift beneath her. Unlike classical planning's deterministic transitions, this framework embraced probability. Taking an action in a state gave a distribution over next states, not a single guaranteed outcome. Unlike the simple Markov chains she had seen on the second planet, this structure included agency -- the entity within the system chose, it did not merely observe.

The transition probability matrix had one slice per action. She recognised the grid world encoded here: the move-north matrix with 0.9 on the cell above and 0.05 on each side. The move-east matrix rotated those probabilities ninety degrees. The reward function assigned values to state-action-state triples, though in the grid world it depended only on the destination.

What struck her most was the role of the discount factor. A grid world with gamma equal to 0.1 produced a myopic agent that grabbed the nearest reward. The same grid world with gamma equal to 0.99 produced a careful agent that avoided risks and planned long paths. The same environment, the same rules, the same physics -- but a different discount factor produced a different character. She sat with this observation for a long time. The MDP was not just a formalism. It was the language in which sequential decision problems were spoken, and the discount factor was the accent -- the inflection that revealed whether the speaker valued the present or the future.

She wrote in her notebook: *Formally defining the problem is the first step. You must specify what counts as a state, what actions are available, how the world responds, what the agent values, and how much it discounts the future. Each choice shapes the problem profoundly.*

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Episodes and Trajectories]]

The tenth planet was a world of histories. Lena touched down and immediately understood that time here was not a dimension but a substance -- thick, layered, recordable. The ground was composed of compressed trajectories, stacked like geological strata, each layer a complete episode from beginning to end.

She knelt and read the nearest stratum. Start at cell (1,1). Try up. Actually go right -- a slip. Go right. Go up. Try up. Veer left. Land on the red terminal. Each step recorded the state, the action attempted, the state reached, and the reward received. A full trajectory: the agent's lived experience, one sample from the distribution of possible lives in this MDP. She could read it like a core sample, except instead of sediment layers she was reading decision layers.

She dug deeper and found different episodes from the same starting point. Some reached the green terminal. Some wandered in circles. Some ended quickly at the red cell. The variance was striking -- the same policy, the same environment, but radically different outcomes depending on where the stochastic transitions had fallen.

Not all the strata had endpoints. Some continued indefinitely, layer after layer without termination -- continuing tasks like inventory management or robot locomotion, where there was no natural endpoint and discounting was used to keep returns finite. Others had clean terminal boundaries -- episodic tasks with natural endings where the system reset. The distinction mattered: episodic tasks could learn from complete trajectories, but continuing tasks had to learn online, updating as new experience arrived without waiting for an ending.

The expected return over all possible episodes was what value functions estimated. One episode might yield -0.729; another might yield +0.9. The value of a state was the average return across all episodes starting from that state, following a given policy. Lena pressed her palm against the layered ground and felt every possible future radiating outward from this moment. She wrote: *A single trajectory is a story. The expected value is the average of all possible stories. I have spent my life mapping the ground. This planet maps what happens on it.*

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Return Computation]]

The final planet was a workshop. No grand landscapes, no crystalline structures. Just a workbench, a trajectory pinned beneath glass, and a set of arithmetic tools laid out with the precision of surgical instruments.

Lena sat down and read the problem. Compute the return for a specific grid world trajectory with gamma equal to 0.9. Start at (1,1). Step one: try up, slip right to (1,2), reward 0. Step two: go right to (1,3), reward 0. Step three: go up to (2,3), reward 0. Step four: try up, slip left to (2,2), land on the red terminal, reward -1.

She picked up a stylus and worked through it. The return was 0 plus 0.9 times 0 plus 0.81 times 0 plus 0.729 times negative one. The answer was -0.729. Each reward multiplied by gamma to the power of how many steps it took. Most steps yielded zero; only the terminal mattered. The discount ensured that reaching the bad terminal later hurt less than reaching it sooner -- a four-step delay reduced the penalty from -1 to -0.729.

She paused over a subtle point the workbench highlighted. Does the reward come from the action taken or the state reached? In the grid world, rewards depended on the destination state, not the action. Trying to go up and actually slipping right produced the same reward -- the reward of the cell you landed in. This was not universal. Other MDPs might penalise certain actions regardless of outcome, like the cost of jumping versus walking. The convention mattered. Getting it wrong meant computing the wrong return, and from a wrong return, every downstream calculation -- every value, every policy -- would be corrupted.

She set down the stylus and looked at the number: -0.729. It was small and precise and it summarised an entire four-step misadventure in a single figure. She had spent eleven planets learning to read numbers like this one. Not as abstractions, but as compressed biographies -- each decimal place a chapter of consequence, each power of gamma a measure of temporal distance. She closed her notebook and prepared for the long flight home.

---

## Conclusion

The journey back was quiet. Lena let the survey vessel fly on autopilot while she spread her notebooks across the navigation table and traced the arc of everything she had seen. Eleven planets. Each one a mechanism, a principle made tangible, a piece of the machinery that governed how decisions ripple through time.

Two patterns had crystallised with particular clarity, and she found herself returning to them the way she returned to verified contour lines -- with the certainty that they would hold.

The first was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Prediction and Control]]. Every planet she had visited was engaged in one of two activities, and the distinction between them was sharper than she had expected. Some structures predicted -- they estimated the value of states, computed expected returns, assessed what would happen under a given policy. The Bellman equation pools, the backup diagram forests, the expected return workshop: these were instruments of prediction. They asked: *If I behave this way, what will the world give me?* Other structures controlled -- they searched for the best policy, the optimal arrows, the behaviour that maximised long-term return. The policy planet, the grid world with its cautious wall-hugging paths: these were instruments of control. They asked: *How should I behave to get the most from the world?* Prediction without control was passive understanding. Control without prediction was blind action. Every system she had mapped was doing one or both, and the interplay between them -- using prediction to improve control, using control to generate data for better prediction -- was the heartbeat of the entire enterprise.

The second was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Delayed Consequences]]. The student Markov chain had shown it most vividly: the -2 cost of studying was immediate and certain, while the +10 reward of passing was distant and contingent on a chain of successful transitions. The Bar offered +1 now. Studying offered +10 later. Every planet had contained some version of this tension -- the grid world's cautious policies that sacrificed short paths for safe ones, the umbrella decision's weighing of present inconvenience against future discomfort, the discount factor's role in compressing infinite futures into finite numbers. Consequences did not arrive at the moment of decision. They arrived later, diluted by time and probability, and the central challenge of sequential decision-making was to act now in a way that accounted for what had not yet happened.

Lena closed her notebooks and looked out at the star field. She was not the same cartographer who had left. She still valued precision -- she always would. She still believed in measurement, in the patient accumulation of accurate data, in the moral obligation to draw boundaries where they actually were. But she had learned that the most important maps were not maps of space. They were maps of time -- maps that showed not where things were, but where things would be, given what you chose to do.

She had carried her instruments to eleven planets and used almost none of them. The theodolite stayed in its case. The laser rangefinder measured nothing. What she had used, exhaustively, was her notebook -- and what she had recorded was not positions but relationships. Probabilities, transitions, rewards, policies, values. The grammar of consequence.

She thought about the three questions that had driven her here. How do decisions chain together? Through states and transitions, each action reshaping the landscape on which the next action is chosen, an infinite regression that the Bellman equation compressed into a single recursive relationship. Does the present contain everything needed to predict the future? Yes -- if the state is well-defined, if it encodes everything relevant, then history is redundant. The Markov property was not a simplification. It was a design criterion for states. And do distant consequences matter as much as near ones? That depended on gamma. The discount factor was not a fact about the world but a choice about values, and different choices produced different characters -- myopic or patient, reckless or cautious, grabbing or enduring.

She set course for home. In her notebook, beneath the last computation, she wrote a single line: *The map of the future is not a prediction. It is a policy.*
