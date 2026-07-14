#include <iostream>
#include <cassert>
#include "backend/src/data.h"
#include "backend/src/graph.h"
#include "backend/src/algorithms.h"

void testCSVLoading() {
    DataManager dm;
    std::string dataPath = "data/";
    
    assert(dm.loadRoads(dataPath + "roads.csv") == true);
    assert(dm.loadHospitals(dataPath + "hospitals.csv") == true);
    assert(dm.loadShelters(dataPath + "shelters.csv") == true);
    assert(dm.loadTeams(dataPath + "teams.csv") == true);
    
    std::cout << "[PASS] CSV Datasets loaded successfully." << std::endl;
    std::cout << "       Roads loaded: " << dm.roads.size() << std::endl;
    std::cout << "       Hospitals loaded: " << dm.hospitals.size() << std::endl;
    std::cout << "       Shelters loaded: " << dm.shelters.size() << std::endl;
    std::cout << "       Rescue Teams loaded: " << dm.teams.size() << std::endl;
}

void testGraphStructure() {
    Graph graph;
    graph.addEdge("A", "B", 10.0, 1, false);
    graph.addEdge("B", "C", 5.0, 2, false);
    graph.addEdge("A", "C", 20.0, 5, true); // Blocked edge
    
    assert(graph.hasNode("A") == true);
    assert(graph.hasNode("B") == true);
    assert(graph.hasNode("C") == true);
    assert(graph.hasNode("D") == false);
    
    assert(graph.isRoadBlocked("A", "C") == true);
    assert(graph.isRoadBlocked("A", "B") == false);
    
    graph.toggleRoadBlock("A", "B", true);
    assert(graph.isRoadBlocked("A", "B") == true);
    
    std::cout << "[PASS] Graph data structure operations passed." << std::endl;
}

void testPathfindingAndTraversals() {
    Graph graph;
    // Build a simple 4-node diamond graph
    //     B (dist 2)
    //   /   \
    // A       D (dist 2)
    //   \   /
    //     C (dist 10)
    graph.addEdge("A", "B", 2.0, 1, false);
    graph.addEdge("B", "D", 2.0, 1, false);
    graph.addEdge("A", "C", 10.0, 1, false);
    graph.addEdge("C", "D", 10.0, 1, false);
    
    // Shortest path A -> D should be A -> B -> D (dist = 4)
    RouteResult route = Algorithms::findShortestPath(graph, "A", "D");
    assert(route.success == true);
    assert(route.path.size() == 3);
    assert(route.path[0] == "A");
    assert(route.path[1] == "B");
    assert(route.path[2] == "D");
    assert(route.total_distance == 4.0);
    
    // Block road B -> D, routing should fall back to A -> C -> D (dist = 20)
    graph.toggleRoadBlock("B", "D", true);
    route = Algorithms::findShortestPath(graph, "A", "D");
    assert(route.success == true);
    assert(route.path.size() == 3);
    assert(route.path[0] == "A");
    assert(route.path[1] == "C");
    assert(route.path[2] == "D");
    assert(route.total_distance == 20.0);
    
    // BFS traversal order (from A) should visit neighbors in alphabetical order B, then C
    // B's edge to D is blocked, C's edge to D is open.
    // BFS queue: A -> pops A, visits B, C.
    // pops B (no unvisited open neighbors)
    // pops C, visits D.
    // Order: A, B, C, D
    std::vector<std::string> bfsOrder = Algorithms::runBFS(graph, "A");
    assert(bfsOrder.size() == 4);
    assert(bfsOrder[0] == "A");
    assert(bfsOrder[1] == "B");
    assert(bfsOrder[2] == "C");
    assert(bfsOrder[3] == "D");
    
    // DFS traversal check
    std::vector<std::string> dfsOrder = Algorithms::runDFS(graph, "A");
    assert(dfsOrder.size() == 4);
    
    std::cout << "[PASS] Dijkstra pathfinding and BFS/DFS traversal tests passed." << std::endl;
}

void testAStar() {
    double dist = Algorithms::haversine(28.6304, 77.2177, 28.6692, 77.4538); // CP to Ghaziabad
    assert(dist > 0.0);
    
    Graph graph;
    graph.addEdge("Dwarka", "Janakpuri", 4.5, 1, false);
    graph.addEdge("Janakpuri", "Connaught Place", 5.0, 1, false);
    
    std::unordered_map<std::string, std::pair<double, double>> coords;
    coords["Dwarka"] = {28.5921, 77.0460};
    coords["Janakpuri"] = {28.6219, 77.0878};
    coords["Connaught Place"] = {28.6304, 77.2177};
    
    RouteResult route = Algorithms::findAStarPath(graph, "Dwarka", "Connaught Place", coords);
    assert(route.success == true);
    assert(route.path.size() == 3);
    assert(route.path[0] == "Dwarka");
    assert(route.path[1] == "Janakpuri");
    assert(route.path[2] == "Connaught Place");
    
    std::vector<std::string> trav = Algorithms::runAStarTraversal(graph, "Dwarka", "Connaught Place", coords);
    assert(trav.size() == 3);
    
    std::cout << "[PASS] A* search and Haversine formula unit tests passed." << std::endl;
}

void testBFSDFSPath() {
    Graph graph;
    graph.addEdge("A", "B", 10.0, 1, false);
    graph.addEdge("B", "C", 5.0, 2, false);
    graph.addEdge("A", "C", 20.0, 5, false);

    RouteResult bfsRoute = Algorithms::findBFSPath(graph, "A", "C");
    assert(bfsRoute.success == true);

    RouteResult dfsRoute = Algorithms::findDFSPath(graph, "A", "C");
    assert(dfsRoute.success == true);

    std::cout << "[PASS] BFS and DFS pathfinding unit tests passed." << std::endl;
}

int main() {
    std::cout << "===========================================" << std::endl;
    std::cout << " Running Disaster Response System Unit Tests " << std::endl;
    std::cout << "===========================================" << std::endl;
    
    try {
        testCSVLoading();
        testGraphStructure();
        testPathfindingAndTraversals();
        testAStar();
        testBFSDFSPath();
        
        std::cout << "===========================================" << std::endl;
        std::cout << " SUCCESS: All Unit Tests Passed Successfully!" << std::endl;
        std::cout << "===========================================" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << " FAILURE: Test execution failed: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}


