# National Disaster Response & Rescue Navigation System

---

## Project Overview

The **National Disaster Response & Rescue Navigation System** is a graph-based emergency navigation application designed to assist rescue teams during natural disasters such as floods, cyclones, earthquakes, landslides, cloudbursts, and urban flooding. 

The system models India's transportation network as a **weighted graph**, where vertices represent 36 major disaster-prone Indian cities and edges represent road connections with distance weights and safety-balanced hazard ratings.

The project integrates a high-performance **C++ DSA engine** with an **interactive Node.js web dashboard** to simulate real-world emergency response operations. Users can select a source and destination from major disaster-prone locations across India, choose a routing algorithm (Dijkstra, A* Heuristic Search, BFS, or DFS), and visualize the optimal rescue path on an interactive OpenStreetMap layer while locating nearby hospitals, shelters, and rescue teams.

---

## Aim & Objectives

* **Aim**: To develop an intelligent graph-based disaster response system that computes the shortest and safest rescue routes using Data Structures and Algorithms, enabling efficient emergency navigation and resource allocation during disaster situations.
* **Objectives**:
  * Design a weighted graph representing 36 disaster-prone locations across India.
  * Implement graph traversal algorithms (BFS and DFS) for reachability and connectivity analysis.
  * Implement shortest path algorithms (Dijkstra's Algorithm and A* Search).
  * Visualize rescue routes on an interactive map.
  * Locate nearby hospitals, shelters, and rescue teams along the computed path.
  * Demonstrate practical applications of Graph Theory and Data Structures.

---

## Technology Stack

* **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Leaflet.js with OpenStreetMap.
* **Backend**: C++ (DSA Pathfinder Engine), Node.js & Express.js (REST API Layer).
* **Database & File Handling**: CSV File Handling (Coordinates, Roads, and Resources datasets).
* **Tools**: Visual Studio Code, Git & GitHub.

---

## Data Structures Used

* **Graph (Adjacency List)**: Models the sector network efficiently using `std::unordered_map` and adjacency list representations.
* **Vector**: Dynamic array representation used across graph traversals and path listings.
* **Queue**: Powers the level-order BFS traversal logic.
* **Stack**: Powers the depth-first DFS graph search traversal.
* **Priority Queue (Min Heap)**: Powers Dijkstra's and A* search node expansions.
* **Hash Map (`std::unordered_map`)**: Powers coordinates lookup and parents tracking maps.

---

## Algorithms Implemented

### 1. Breadth First Search (BFS)
* **Used for**: Graph traversal, connectivity checking, and reachability analysis.
* **Time Complexity**: `O(V + E)`

### 2. Depth First Search (DFS)
* **Used for**: Graph traversal, graph exploration, and connected component analysis.
* **Time Complexity**: `O(V + E)`

### 3. Dijkstra's Algorithm
* **Used for**: Finding the shortest safety-balanced rescue route on weighted graphs.
* **Time Complexity**: `O(E log V)`

### 4. A* Search Algorithm
* **Used for**: Fastest rescue route calculation using a goal-oriented spatial heuristic calculated via the **Haversine formula**.
* **Time Complexity**: `O(E log V)` (average case)

---

## Proposed Graph Nodes (36 Locations across India)

The graph contains approximately **36 strategically selected locations** that are frequently affected by natural disasters:

* **Flood-Prone Regions**: Chennai, Hyderabad, Bengaluru, Mumbai, Patna, Guwahati, Srinagar, Kochi.
* **Cyclone-Prone Coastal Cities**: Visakhapatnam, Bhubaneswar, Puri, Paradeep, Kakinada, Vijayawada, Kolkata.
* **Earthquake-Sensitive Zones**: Gangtok, Shillong, Imphal, Itanagar, Dehradun.
* **Landslide-Prone Hill Stations**: Shimla, Manali, Dharamshala, Joshimath, Kedarnath, Nainital, Darjeeling.
* **Cloudburst / Heavy Rainfall Areas**: Leh, Kullu, Mandi, Jammu.
* **Disaster Response & Coordination Hubs**: New Delhi, Lucknow, Nagpur, Pune, Bhopal.

---

## Key Features

1. **Interactive Route Planning**: Select any supported disaster-prone location as the source and destination from dropdown menus or directly by clicking on the map.
2. **Intelligent Route Calculation**: Computes the safety-balanced route using Dijkstra's Algorithm or A* Search, bypassing blocked roads.
3. **Interactive Map**: Displays source, destination, the continuous path polyline, and satellites representing hospitals, shelters, and rescue teams along the path.
4. **Road Blockages Toggles**: Directly click on map roads or toggle road check-boxes in the operations sidebar. Active pathfinders will automatically bypass blocked roads.
5. **Add Resource Portal**: Add new hospitals, shelters, or rescue teams dynamically in real-time. Node.js writes them back to the CSV database, so they are immediately available.
6. **Performance & Comparisons**: Displays execution time, nodes expanded, total distance, and estimated travel time. Shows a side-by-side comparison table of all 4 algorithms.
