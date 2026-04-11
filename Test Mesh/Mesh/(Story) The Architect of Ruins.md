---
id: 4a687c09-c2cc-4b8d-9708-c51e132f7e23
type: story
---

# The Architect of Ruins

## Introduction

The call came on a Tuesday, which was the only unremarkable thing about it. Tomas Reyes was sitting cross-legged on the floor of his apartment in Santiago, surrounded by half-finished prototypes for a puzzle box competition in Osaka. Wooden joints, brass pins, sliding panels that interlocked in sequences of seven. He had sawdust under his fingernails and a cold cup of coffee balanced on a stack of structural load calculations he was supposed to have submitted two days ago.

He was, by training, a structural engineer. Bridges, mostly. The kind of work where you spend months computing how forces distribute through steel and concrete, and then you stand on the finished thing and feel, in your bones, whether it will hold. He was good at it. He had an intuition for where weight would concentrate, where stress would fracture a joint, where the load-bearing walls actually were in a system that presented itself as uniformly strong. His colleagues called it a gift. Tomas called it impatience. He simply could not stop himself from stripping a structure down to its skeleton, finding the parts that mattered, and ignoring the rest.

The puzzle design was a side effect of the same compulsion. He had started competing at twenty-three, almost by accident, and discovered that the thing he loved most in the world was building a mechanism that forced the solver to think in sequences -- this piece cannot move until that piece moves, and that piece is locked until you understand the hidden third constraint. His best designs were brutal, elegant, and deeply irritating to solve. He was proud of all three qualities equally.

Mission control's pitch was straightforward. They had discovered a cluster of new worlds -- strange, formal places, built from rules and structures rather than rock and atmosphere. They needed someone to map them. Not a mathematician, they said, and not a philosopher. They needed someone who thought with their hands. Someone who could look at an abstract space and see the architecture in it.

Tomas asked three questions before he agreed.

The first was about [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) State Representations]]. How do you describe the world precisely enough to reason about it? He had spent his career translating physical reality into diagrams and equations, and he knew that the translation was never neutral. The way you represent a thing determines what you can see and what you miss. A bridge drawn as a force diagram reveals stress concentrations; the same bridge drawn as an architectural elevation reveals sight lines. He wanted to know what these new worlds looked like when you wrote them down.

The second was about [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Planning versus Learning]]. Can you plan your way through, or must you learn by doing? In his puzzle boxes, the answer was always planning -- the mechanism was deterministic, the solver just had to reason through the sequence. But he had worked on enough construction sites to know that real structures surprised you. Soil shifted. Concrete cured unevenly. Sometimes the plan failed and you had to adapt on the fly. He wanted to know which kind of world he was walking into.

The third was about [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Determinism versus Stochasticity]]. Does the world hold still while you search, or does it shift? This was the question that mattered most to a man who designed locks. A lock is a deterministic system. You turn the tumbler and it moves. Every time. No probability, no randomness, no chance that the pin will bounce left instead of right. If these worlds were deterministic, he could map them completely. If they were stochastic, he would need different tools entirely.

Mission control answered: deterministic, plannable, and representable in formal languages he had never heard of. They said the worlds were made of states and actions, preconditions and effects, search trees that branched into billions of configurations. They said the interesting question was not whether a solution existed, but what it cost to find one.

That was the sentence that hooked him. Tomas Reyes had spent his whole life caring about cost. The cost of materials, the cost of weight, the cost of one more move in a seven-step puzzle sequence. He packed a bag and went.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Blocks World]]

The first world was offensively simple, and that was the point.

Tomas stood at the edge of a flat, grey table that extended to the horizon in every direction. Five blocks sat on its surface -- labelled A through E, solid and primary-coloured, like something from a children's classroom. A robotic arm hung above, its gripper open and empty, waiting. Block D rested on C, which sat on the table. Block B stood alone, clear on top, nothing touching it. The rest were scattered in a loose arrangement that had no particular logic.

A display panel floated beside him, showing the goal state: a specific tower, blocks stacked in a prescribed order. Between the current mess and that clean tower lay every possible rearrangement of five blocks on a table, and the arm had to find the right sequence of picks, places, stacks, and unstacks to get there.

He reached out and touched Block B. Solid. Real. He could feel the weight of it. "So it's physical," he muttered.

But the display told a different story. Propositions scrolled across it like a formal language: `on(D, C)` -- D is on C. `clear(B)` -- nothing sits on top of B. `arm-empty` -- the gripper holds nothing. Each fact was a crisp, binary statement. True or false. No ambiguity, no probability, no hedge.

He watched the arm execute a stack operation. To stack X on Y, the arm had to be holding X and Y had to be clear. After stacking, `on(X, Y)` appeared in the state description, `arm-empty` became true, `holding(X)` vanished, and `clear(Y)` was deleted. He traced the logic with his finger, the way he would trace load paths through a truss diagram. Each action had preconditions and effects. Each effect rewrote the state. The mechanics were deliberately simple -- a child's toy -- but they contained all the essential machinery he had been sent to find.

And then he understood what made this world useful. It was not the blocks. It was the boundary it exposed. These actions were perfectly deterministic. Pick up a block and it is in the gripper. No probability, no ambiguity. This was exactly the kind of problem that logic could handle cleanly. He thought of stochastic systems he had encountered -- concrete that cured unpredictably, soil that shifted under load -- and realised this world was the opposite. It was crisp enough for pure reasoning. A domain where you could plan without hedging.

Tomas stacked the five blocks into their goal configuration by hand, just to feel the satisfaction of it, and then turned toward the next world. The blocks were trivial. The formalism beneath them was not.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) PDDL Domain and Problem Files]]

The second world had no blocks at all. It was made entirely of text.

Tomas arrived on a barren plateau where two monolithic slabs stood face to face, their surfaces covered in precise, structured notation. The left slab was labelled DOMAIN. The right was labelled PROBLEM. Between them, a narrow corridor led to a third structure in the distance, labelled PLANNER.

He walked to the domain slab first and began reading. It defined predicates -- `on`, `clear`, `holding`, `on-table` -- and parameterised actions like `stack(X, Y)` with preconditions and effects. It said nothing about specific blocks, nothing about goals, nothing about any particular situation. It was a general theory of manipulation. The physics of a world, abstracted into grammar.

The problem slab was different. It introduced objects -- blocks A through E, the same ones he had just been handling -- along with an initial state describing which blocks were where and a goal describing the desired configuration. It was specific where the domain was general. Situational where the domain was universal.

He stood between the two slabs and felt a familiar thrill. This was the same separation he used in structural engineering every day. The building code was the domain: general rules about load distribution, material strength, safety factors. The architectural drawings were the problem: specific beams, specific spans, specific loads. You could not build anything with just the code, and you could not build anything with just the drawings. You needed both, and the power was in the separation.

The notation used quantified variables -- uppercase X and Y in the actions -- that would get grounded to specific objects at planning time. Preconditions were conjunctions of propositions that had to be true. Effects were lists of propositions to add or delete. It was close to logic but readable, closer to a blueprint specification than to pure mathematics. One Blocks World domain file could serve thousands of problem instances. Different initial arrangements, different goal towers, different numbers of blocks. The domain captured the physics. The problem captured the situation.

Tomas pressed his palm against the domain slab and felt the warmth of its internal consistency. He had always believed that the best structures were the ones where you could swap the contents without changing the frame. A parking garage that could become a hospital. A modular bridge that could span a river or a canyon. Here, that intuition was made formal. The algorithm was generic. The data was specific. And a planner took both and synthesised a sequence of actions to bridge the gap.

He walked the corridor toward the planner and watched it work. It took the physics from the left and the situation from the right and produced a plan. It was, he thought, exactly what he did when he stood on a construction site and translated code into concrete.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Breadth-First Search]]

The third world was a pond.

Or rather, it behaved like one. Tomas stood at a central point and watched the search expand outward in concentric rings, patient and systematic and relentless. Every node at depth one was explored before anything at depth two was touched. Every node at depth two was examined before a single node at depth three received attention. It radiated outward like ripples from a stone dropped in still water, and it never skipped, never jumped, never took a shortcut.

He walked alongside the expanding frontier, watching it work. The algorithm used a first-in, first-out queue -- nodes discovered first were expanded first. This gave it a discipline that felt almost architectural. Level by level, layer by layer, it covered every possibility at each depth before moving on. If a goal existed within a finite number of steps, this search would find it. The guarantee was absolute, and it had a name: completeness. No reachable goal could escape detection.

Tomas knelt at the edge of depth three and watched the frontier advance to depth four. For uniform action costs -- all steps equally expensive -- this search was also optimal. It found the shallowest goal first, and since all steps cost the same, shallowest meant cheapest. But he could already see the catch. If one path cost six through expensive edges and another cost a hundred and one through a chain of cheap-then-expensive edges, the algorithm might return the expensive solution simply because it was shallower. It explored by depth, not by cumulative cost.

What struck him hardest, though, was the sheer physical weight of the operation. Every node the frontier touched was stored. Every single one. The time complexity was exponential -- O(b^d), where b was the branching factor and d was the depth. And space complexity matched. In his engineering work, he had learned to distinguish between problems that were expensive in time and problems that were expensive in material. This search was expensive in both, but material -- memory -- was the critical resource. He could feel it in the way the expanding rings grew heavier, denser, more demanding with each new layer.

He admired the completeness guarantee the way he admired a cathedral: beautiful in principle, crushing in its material requirements. There had to be a limit. Something had to give. He turned toward the next world already suspecting what it would show him.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Memory Wall]]

He found it laid out as a table, carved into stone like a monument to exponential brutality.

Branching factor ten. Ten thousand nodes processed per second. One thousand bytes per node. At depth two: eleven hundredths of a second, one megabyte of memory. Manageable. Trivial, even. At depth four: eleven seconds, 111 megabytes. Still within reach. At depth eight: two minutes, 103 gigabytes. Tomas stopped walking.

One hundred and three gigabytes. For a search eight levels deep. He had designed bridges that spanned rivers, and the engineering tolerances had never felt this unforgiving. He read the next line. Depth fourteen: three and a half years, ten petabytes. Ten petabytes. Beyond server farms. Beyond anything he could imagine physically storing.

The numbers climbed because breadth-first search stored every generated node, and the number of nodes at each depth multiplied by the branching factor. It was exponential growth made tangible, and Tomas felt a physical revulsion at the waste. He had spent his career eliminating waste from structures -- removing material that did not bear load, simplifying joints that did not need complexity, cutting weight everywhere it could be cut. This wall was the opposite. It was a system that demanded exponentially more resources for each additional level of depth, and it could not be optimised away. It was fundamental.

Which was the worse constraint -- time or memory? He stood at the table and worked it through. A search that took two minutes was tolerable. You could wait two minutes. But a search that required 103 gigabytes of memory was impossible on consumer hardware. You could not wait your way past a memory limitation. You needed a different machine entirely, or a different algorithm.

That distinction landed with the force of professional experience. In structural engineering, time constraints were soft. You could pour concrete slowly. But material constraints were hard. If the beam could not support the load, no amount of patience would save it. Memory was the beam. Time was the pour rate. And the beam was failing.

He understood now why this world existed. It was a monument to the wall that every subsequent algorithm was built to circumvent. Every clever trick in search -- every strategy he was about to encounter -- existed because of this exponential reality. Systematic exploration demanded exponential storage, and the only way forward was to stop being systematic, or to be systematic more cleverly.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Depth-First Search]]

The fifth world was a narrow canyon, and Tomas loved it immediately.

Where breadth-first search had been a pond, radiating outward in disciplined rings, this was a needle. The algorithm picked a direction and went deep. All the way down a single branch, as far as it could go, before it backtracked and tried another path. It operated on a last-in, first-out stack -- always expanding the most recently discovered node, always driving forward, always committed to the current line of inquiry until it hit a dead end.

The memory footprint was beautiful. Where BFS had stored every node it touched -- that crushing, exponential accumulation -- this search stored only the nodes along the current path. Space complexity was O(b times m), linear in depth. Tomas ran his hand along the canyon wall and thought about cantilever bridges -- structures that committed their weight forward, extending out over the void, supported only by what lay directly behind them. That was depth-first search. A single path, a single line of support, lean and efficient and bold.

But the gamble was obvious. He watched the algorithm explore the left branch of a tree, going deep, deeper, twenty levels down, and find a goal there. It declared victory. Meanwhile, on the right branch, just two levels down, sat a cheaper, shallower goal that the algorithm never checked. DFS was not optimal, even for unit costs. If the solution happened to be on the first branch explored, it was fast. If not, it might return a vastly suboptimal answer and never know.

And then the cycle. He watched the algorithm reach a node and follow an edge that led back to the same node. A to A to A to A, an endless loop, the search trapped in a corridor of its own making while the goal sat untouched on another branch entirely. Unadorned depth-first search was not complete. Cycles could trap it forever.

Adding cycle detection -- checking whether a node had already been visited along the current path -- restored completeness for finite graphs without cycles. But the raw algorithm made no such promise. It was a gambler. Fast when lucky. Catastrophic when not.

Tomas respected it the way he respected reckless engineers -- the ones who could look at a problem, make a gut call, and drive a solution forward without second-guessing. Sometimes they were brilliant. Sometimes they built things that collapsed. The trick was to keep the recklessness but add just enough discipline. He could already see how that might work.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Iterative Deepening Search]]

The sixth world was, at first glance, a waste of time. Tomas almost turned around.

He watched the algorithm run depth-limited search at limit zero. It searched everything reachable in zero steps -- which was nothing but the start node -- and then threw it all away. Then limit one. It searched the start node and its immediate children, using depth-first mechanics, and threw everything away again. Then limit two. Then three. Each iteration explored the complete tree up to that depth, discarded everything, and started fresh one level deeper.

"You're doing it all again," Tomas said aloud, incredulous. "Every time. You're redoing all that work."

He was an engineer. He hated waste. He had once spent three weeks redesigning a bridge joint to save four kilograms of steel. The idea of deliberately repeating computation -- of searching depth one, then searching depth one again as part of the depth-two search, then searching it again as part of depth three -- made his skin crawl.

But then he looked at the numbers.

The algorithm inherited BFS's completeness: it would find the shallowest goal, guaranteed, because it tried every depth in order. It inherited BFS's optimality for uniform costs: shallowest meant cheapest when all steps cost the same. But it used DFS's space complexity -- O(b times d) -- because each iteration stored only a single path. The memory wall that had horrified him two worlds ago simply did not apply here. The storage cost was linear.

And the repeated work? He traced the mathematics. The last iteration -- the one that actually found the goal -- dominated all previous iterations combined, because exponential growth meant the final level contained more nodes than every preceding level put together. The waste was real, but it was a constant-factor overhead, swamped by the exponential cost of the final search. Relative to the total work, the repetition was rounding error.

Tomas stood still for a long time. He was recalculating his intuitions. In structural engineering, redundancy was usually waste -- extra material, extra weight, extra cost. But sometimes redundancy was safety. A bridge with redundant load paths survived the failure of a single member. Here, the redundancy of repeated shallow searches bought something precious: the guarantees of breadth-first search without the memory death sentence.

It was, he admitted grudgingly, genuinely elegant. For uninformed search -- no heuristic, no domain knowledge, just raw exploration -- iterative deepening was essentially the ideal algorithm. The best of both worlds. He had come to this planet expecting to find waste and found instead the most efficient compromise he had encountered since arriving.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Eight Puzzle]]

The seventh world gave him something to hold.

A 3x3 grid floated before him, eight numbered tiles and one blank space. Tiles could slide into the blank -- up, down, left, right -- and the goal was to arrange them in numerical order. Preconditions were simple: a tile moved to position Y only if Y was blank and Y was adjacent. After moving, the old position became blank. It was a toy problem, and Tomas recognised it immediately. He had owned a physical version as a child. He had solved it thousands of times.

But this world was not about solving the puzzle. It was about measuring the cost of solving it.

Two relaxations were carved into pedestals on either side of the grid. The first dropped the blank precondition -- tiles could slide through occupied squares, ignoring collisions, gliding along the grid as if every other tile were a ghost. Under this relaxation, each tile needed exactly as many moves as its Manhattan distance from its goal position: tile one needed four steps, tile eight needed two, and you summed them all for a total heuristic value of eighteen. The second relaxation dropped all preconditions entirely -- tiles could teleport anywhere, materialising in their goal positions from wherever they happened to be. Under this relaxation, the heuristic was simply the count of misplaced tiles: how many tiles were not in their goal position, maximum eight.

Tomas picked up the physical tiles and felt them click. Both heuristics were admissible -- they never overestimated the true cost, because removing constraints could only make the problem easier, never harder. Manhattan distance was more informative: it knew that a tile four steps away was harder to place than a tile one step away. Misplaced count treated them the same. A binary: wrong or right, out of place or home.

He turned a tile over in his fingers and thought about structural analysis. When you could not solve the full equations -- nonlinear material behaviour, complex geometry, dynamic loads -- you simplified. You assumed the material was linear. You assumed the geometry was regular. You dropped constraints until the problem became tractable, and then you used the simplified answer as an estimate of the real one. That was exactly what these relaxations did. They simplified the puzzle by removing preconditions, and the simplified solution became a lower bound on the real cost.

The eight puzzle was where abstract properties became concrete. He could trace exactly how dropping a precondition changed the search landscape, could feel the difference between a heuristic that counted and one that measured. It was the most satisfying world he had visited since the blocks.

---
planet: [[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Indiana Jones Maze]]

The last world was a maze, and it nearly fooled him.

Walls rose around Tomas as he materialised -- solid, unyielding, arranged in corridors and dead ends. Somewhere ahead, a goal point glowed. The rules were simple: move to adjacent cells that are not blocked. Indiana Jones territory. Navigate from start to goal without walking through walls.

A question was inscribed at the entrance: what is H+, the delete-relaxed heuristic, equal to here? Manhattan distance? Horizontal distance? The perfect heuristic H*?

Tomas's first instinct, fresh from the eight puzzle, was Manhattan distance. Relaxation meant dropping constraints. Dropping constraints meant tiles sliding through each other, agents teleporting, the world becoming easier. So the relaxed version of the maze should let you walk through walls, and the heuristic should be the straight-line grid distance.

He was wrong.

He worked it out standing in the corridor, pressing his palms against the stone walls as if their solidity would help him think. Delete relaxation dropped delete effects but kept preconditions. The precondition for moving was that the destination cell was adjacent and not a wall. Walls were never deleted -- they were not the effect of any action -- so they persisted even in the relaxed problem. You could not walk through walls, not even in the relaxation. The walls were permanent features of the domain, baked into the preconditions, untouched by the relaxation process.

For a single-goal maze, this meant H+ equalled H*. The delete-relaxed heuristic was perfect. The relaxed problem and the real problem had the same solution, because there were no delete effects that mattered: moving to a cell did not delete your presence at the previous cell in any way that affected future movement options when you only had one goal to reach. The relaxation changed nothing.

Tomas leaned against the wall and laughed. It was the kind of result that would have infuriated him a week ago -- a theoretical subtlety, a trick of definitions, the kind of thing he would have dismissed as academic hairsplitting. But now he saw the architecture of it. The structure of the domain determined how much relaxation helped. In the eight puzzle, relaxation gave you a useful approximation. In the maze, it gave you the exact answer. The same technique, the same formal operation, producing wildly different results depending on what the domain was made of.

He solved the maze by walking it. The walls funnelled him through corridors and around corners, and when he reached the goal, he stood there for a moment and thought about how elegant it was that the hardest theoretical question on this entire journey had the simplest physical answer: just walk.

---

## Conclusion

Tomas Reyes came back quieter than he left.

Not subdued -- he was still the same man who designed puzzle boxes with seven-step sequences and argued with contractors about wasted kilograms of steel. But something had shifted in the way he held a problem. He had gone out expecting to map alien structures, and instead he had discovered that the cost of finding an answer was a structure in itself, as real and as load-bearing as any bridge he had ever built.

Three patterns had crystallised across the eight worlds, and they followed him home.

The first was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Completeness]]. The guarantee that if a solution existed, the algorithm would find it. He had felt its presence in breadth-first search -- that patient, level-by-level expansion that missed nothing -- and its absence in depth-first search, where a single cycle could trap the algorithm forever. Iterative deepening had shown him that completeness could be preserved without the crushing memory cost, and that the guarantee mattered not because it made search fast, but because it made search trustworthy. In his engineering work, he had always known the difference between a structure that would probably hold and one that was guaranteed to hold. Completeness was the search equivalent of a safety factor.

The second was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Time and Space Complexity]]. The memory wall had branded this into him. Time was soft -- you could wait. Space was hard -- you could not conjure storage out of patience. The exponential growth of O(b^d) had been the most visceral lesson of the entire journey, and every algorithm after the wall had been a response to it. DFS traded completeness for lean memory. Iterative deepening traded redundant computation for the same lean memory without sacrificing completeness. Every choice was a trade, and the terms of the trade were always time against space, guarantee against efficiency. He recognised this now as the fundamental tension of search, the same way material strength against weight was the fundamental tension of structural design.

The third was [[Workspace/Repos/Main/Test Mesh/Mesh/(Concept) Cycle Detection]]. He had watched depth-first search loop from A to A to A, trapped in its own path, and understood that the danger was not complexity but repetition. An algorithm that could revisit the same state endlessly was an algorithm that could fail to terminate, and failure to terminate was not just inefficiency -- it was structural collapse. Checking whether a node had been visited along the current path was a small addition, but it was load-bearing. It was the pin in the joint, the bolt in the beam, the tiny piece of mechanism that held the entire structure together.

He sat in his apartment in Santiago, sawdust still under his fingernails, and rebuilt one of his puzzle boxes from scratch. This time, when he designed the sequence of moves, he thought about branching factors and depth limits. He thought about the cost of exploring every possible path versus the cost of committing to one and hoping. He thought about the difference between a mechanism that was solvable in principle and one that was solvable in practice, within the memory and patience of a human solver.

The worlds he had visited were made of blocks and tiles and corridors and formal text. But the architecture underneath them was real. States and actions, preconditions and effects, search trees branching into billions of configurations -- these were not abstractions. They were the load-bearing walls of every intelligent system that had ever tried to find a solution in a space too large to see all at once.

Tomas Reyes had always known how to look at a structure and find the parts that mattered. Now he knew how to look at a search and do the same.
