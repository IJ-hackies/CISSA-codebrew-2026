---
id: d1f6b4c3-9e5a-4d8b-c2f1-a3b5e7d9f1b4
type: source
filename: "Lecture 4.txt"
media-ref: "Source/Lecture 4.txt"
---

# Heuristic Relaxation Techniques

This is a transcript of the fourth live lecture for COMP90054, covering one of the most important ideas in AI: problem relaxation. The core principle is taking a hard problem, relaxing it into an easier one, solving the easier problem quickly, and using that solution to guide the original search.

The lecture centres on the 8-puzzle as a running example. In the original puzzle, tiles can only move into blank adjacent positions. Two relaxations are explored: (1) dropping the blank precondition while keeping adjacency yields Manhattan distance as the heuristic — tiles can slide through occupied squares but must still move along the grid; (2) dropping all preconditions (tiles can teleport anywhere) yields misplaced tile count. Interactive quizzes drive home these distinctions, with many students initially confusing the two.

Key properties of relaxations are defined: a relaxation is "native" if the relaxed problem is a subclass of the original problem (goal counting in TSP is native; straight-line distance in route finding is not); "efficiently constructible" if you can build the relaxed problem quickly; and "efficiently computable" if you can solve it quickly. The travelling salesman problem illustrates a case where even the relaxed problem (goal counting with dropped preconditions) remains NP-hard, requiring further approximation.

The lecture then demonstrates relaxation during search using a logistics domain — a truck must pick up a package at C and deliver it to D while returning home to A. Two approaches are animated step by step: goal counting (just count unachieved goals — cheap but uninformative, leading to extensive search) and delete relaxation (ignore delete effects so facts once true stay true — much more informative, successfully guiding search to a solution with fewer expansions). The delete relaxation example shows how, without deletes, the truck is simultaneously "at" multiple locations, which simplifies reasoning while still respecting preconditions. The session ends with a competition covering relaxation properties across multiple domains including FreeCell and Sokoban.
