---
id: a6fdb9f5-8a1c-4fa0-b0da-07355b456bde
type: planet
planet-connections:
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) The Markov Decision Process]]"
  - "[[Workspace/Repos/Main/Test Mesh/Mesh/(Planet) Expected Utility Maximisation]]"
---

# The Warehouse Inventory Problem

Restock now and pay the holding cost, or wait and risk a stockout during the holiday rush? The warehouse inventory problem is a sequential decision problem where every action's consequences unfold over days and weeks. Restocking costs money immediately but prevents lost sales later. Not restocking saves money now but creates risk.

The problem maps naturally to an MDP. States encode current inventory levels and perhaps the season. Actions are restock quantities. Transitions reflect uncertain demand — how many units will customers buy tomorrow? Rewards are negative for holding costs and lost sales, positive for successful sales. The discount factor captures the time value of capital: money spent on inventory today could have been invested elsewhere.

This is one of the course's examples of delayed reward in a non-game domain. Unlike Grid World, where episodes are short and terminal rewards arrive quickly, the warehouse problem plays out over long horizons with continuous, noisy feedback. The optimal policy is not a fixed rule but a function of inventory level, season, demand forecast, and cost structure. It is the kind of problem where RL's ability to handle uncertainty and sequential dependencies provides genuine practical value — and where the reward hypothesis proves its worth in a domain far removed from arcade games and puzzle slides.
