#include <iostream>
#include <string>
#include <vector>
#include <unordered_set>
#include <algorithm>
#include "data.h"
#include "graph.h"
#include "algorithms.h"

// Helper to escape JSON strings (simple replacement for quotes)
std::string escapeJSON(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else out += c;
    }
    return out;
}

// Function to print a hospital in JSON format
void printHospitalJSON(const Hospital& h) {
    std::cout << "{\"name\":\"" << escapeJSON(h.name) 
              << "\",\"sector\":\"" << escapeJSON(h.sector)
              << "\",\"capacity\":" << h.capacity
              << ",\"beds_available\":" << h.beds_available
              << ",\"contact\":\"" << escapeJSON(h.contact) << "\"}";
}

// Function to print a shelter in JSON format
void printShelterJSON(const Shelter& s) {
    std::cout << "{\"name\":\"" << escapeJSON(s.name)
              << "\",\"sector\":\"" << escapeJSON(s.sector)
              << "\",\"capacity\":" << s.capacity
              << ",\"spaces_available\":" << s.spaces_available
              << ",\"status\":\"" << escapeJSON(s.status) << "\"}";
}

// Function to print a rescue team in JSON format
void printTeamJSON(const RescueTeam& t) {
    std::cout << "{\"name\":\"" << escapeJSON(t.name)
              << "\",\"sector\":\"" << escapeJSON(t.sector)
              << "\",\"size\":" << t.size
              << ",\"specialty\":\"" << escapeJSON(t.specialty)
              << "\",\"contact\":\"" << escapeJSON(t.contact) << "\"}";
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"No arguments provided. Use --help for usage.\"\n}\n";
        return 1;
    }

    std::string arg1 = argv[1];
    if (arg1 == "--help" || arg1 == "-h") {
        std::cout << "{\n  \"status\": \"info\",\n  \"usage\": \"DisasterSystem [command] [options]\",\n"
                  << "  \"commands\": [\n"
                  << "    \"--route <src> <dest> [--block <src-dest,...>]: Calculate optimal rescue route\",\n"
                  << "    \"--graph [--block <src-dest,...>]: Get network graph structure\",\n"
                  << "    \"--traversal <bfs|dfs> <src> [--block <src-dest,...>]: Run graph traversal\",\n"
                  << "    \"--resources <sector>: Get emergency resources for a sector\"\n"
                  << "  ]\n}\n";
        return 0;
    }

    // Initialize Data Manager and Graph
    DataManager dm;
    std::string dataPath = "data/";
    
    if (!dm.loadRoads(dataPath + "roads.csv") ||
        !dm.loadHospitals(dataPath + "hospitals.csv") ||
        !dm.loadShelters(dataPath + "shelters.csv") ||
        !dm.loadTeams(dataPath + "teams.csv") ||
        !dm.loadCoordinates(dataPath + "coordinates.csv")) {
        std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"Failed to load datasets from " << dataPath << "\"\n}\n";
        return 1;
    }

    // Parse disaster type if present in arguments
    std::string disasterType = "";
    for (int i = 2; i < argc; ++i) {
        std::string param = argv[i];
        if (param == "--disaster" && i + 1 < argc) {
            disasterType = argv[i + 1];
            break;
        }
    }

    std::unordered_set<std::string> affectedCities;
    if (disasterType == "flood") {
        affectedCities = {"Guwahati", "Siliguri", "Patna", "Kolkata", "Chennai", "Vijayawada"};
    } else if (disasterType == "cyclone") {
        affectedCities = {"Visakhapatnam", "Bhubaneswar", "Chennai", "Puducherry"};
    } else if (disasterType == "landslide") {
        affectedCities = {"Shimla", "Chandigarh", "Jammu", "Srinagar"};
    } else if (disasterType == "earthquake") {
        affectedCities = {"Jammu", "Srinagar", "Dehradun", "Rishikesh"};
    } else if (disasterType == "fire") {
        affectedCities = {"Bengaluru", "Mysuru", "Nagpur", "Bhopal"};
    }

    Graph graph;
    for (const auto& road : dm.roads) {
        int adjustedDanger = road.danger_level;
        if (!disasterType.empty()) {
            if (affectedCities.count(road.source) || affectedCities.count(road.destination)) {
                adjustedDanger = std::min(5, adjustedDanger + 2);
            }
        }
        graph.addEdge(road.source, road.destination, road.distance, adjustedDanger, road.blocked);
    }

    // Parse block list if present in arguments
    std::string blockListStr = "";
    for (int i = 2; i < argc; ++i) {
        std::string param = argv[i];
        if (param == "--block" && i + 1 < argc) {
            blockListStr = argv[i + 1];
            break;
        }
    }

    if (!blockListStr.empty()) {
        std::vector<std::string> blocks = DataManager::split(blockListStr, ',');
        for (const auto& block : blocks) {
            std::vector<std::string> nodes = DataManager::split(block, ':');
            if (nodes.size() == 2) {
                std::string n1 = DataManager::trim(nodes[0]);
                std::string n2 = DataManager::trim(nodes[1]);
                graph.toggleRoadBlock(n1, n2, true);
            }
        }
    }

    if (arg1 == "--route") {
        if (argc < 4) {
            std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"Missing source or destination for --route.\"\n}\n";
            return 1;
        }
        std::string src = argv[2];
        std::string dest = argv[3];

        // Parse algorithm choice (dijkstra or astar)
        std::string routeAlgo = "dijkstra";
        for (int i = 4; i < argc; ++i) {
            std::string param = argv[i];
            if (param == "--algo" && i + 1 < argc) {
                routeAlgo = argv[i + 1];
                break;
            }
        }

        RouteResult res;
        if (routeAlgo == "astar") {
            res = Algorithms::findAStarPath(graph, src, dest, dm.coordinates);
        } else if (routeAlgo == "bfs") {
            res = Algorithms::findBFSPath(graph, src, dest);
        } else if (routeAlgo == "dfs") {
            res = Algorithms::findDFSPath(graph, src, dest);
        } else {
            res = Algorithms::findShortestPath(graph, src, dest);
        }

        if (!res.success) {
            std::cout << "{\n  \"status\": \"failed\",\n  \"message\": \"" << escapeJSON(res.message) << "\"\n}\n";
            return 0;
        }

        // Print route and nearby resources at destination and along path
        std::cout << "{\n  \"status\": \"success\",\n";
        std::cout << "  \"source\": \"" << escapeJSON(src) << "\",\n";
        std::cout << "  \"destination\": \"" << escapeJSON(dest) << "\",\n";
        std::cout << "  \"total_distance\": " << res.total_distance << ",\n";
        std::cout << "  \"average_danger\": " << res.average_danger << ",\n";
        
        // Print path
        std::cout << "  \"path\": [";
        for (size_t i = 0; i < res.path.size(); ++i) {
            std::cout << "\"" << escapeJSON(res.path[i]) << "\"";
            if (i < res.path.size() - 1) std::cout << ",";
        }
        std::cout << "],\n";

        // Find emergency resources associated with the destination or adjacent nodes on path
        std::unordered_set<std::string> pathNodes(res.path.begin(), res.path.end());

        // Hospitals
        std::cout << "  \"hospitals\": [";
        bool first = true;
        for (const auto& h : dm.hospitals) {
            // Find hospitals located at nodes along the path (prioritize destination)
            if (pathNodes.find(h.sector) != pathNodes.end()) {
                if (!first) std::cout << ",";
                printHospitalJSON(h);
                first = false;
            }
        }
        std::cout << "],\n";

        // Shelters
        std::cout << "  \"shelters\": [";
        first = true;
        for (const auto& s : dm.shelters) {
            if (pathNodes.find(s.sector) != pathNodes.end()) {
                if (!first) std::cout << ",";
                printShelterJSON(s);
                first = false;
            }
        }
        std::cout << "],\n";

        // Rescue Teams
        std::cout << "  \"teams\": [";
        first = true;
        for (const auto& t : dm.teams) {
            if (pathNodes.find(t.sector) != pathNodes.end()) {
                if (!first) std::cout << ",";
                printTeamJSON(t);
                first = false;
            }
        }
        std::cout << "],\n";
        std::cout << "  \"execution_time_ms\": " << res.execution_time_ms << ",\n";
        std::cout << "  \"nodes_expanded\": " << res.nodes_expanded << "\n";
        std::cout << "}\n";

    } else if (arg1 == "--graph") {
        std::cout << "{\n  \"status\": \"success\",\n";
        std::cout << "  \"nodes\": [";
        std::vector<std::string> nodes = graph.getNodes();
        for (size_t i = 0; i < nodes.size(); ++i) {
            std::cout << "\"" << escapeJSON(nodes[i]) << "\"";
            if (i < nodes.size() - 1) std::cout << ",";
        }
        std::cout << "],\n";

        std::cout << "  \"roads\": [\n";
        const auto& adjList = graph.getAdjList();
        bool firstRoad = true;
        
        // Track unique edges to prevent printing duplicate reverse edges twice
        std::unordered_set<std::string> printedEdges;

        for (const auto& pair : adjList) {
            std::string src = pair.first;
            for (const auto& edge : pair.second) {
                std::string dest = edge.destination;
                std::string key1 = src + "->" + dest;
                std::string key2 = dest + "->" + src;
                
                if (printedEdges.find(key1) == printedEdges.end() && printedEdges.find(key2) == printedEdges.end()) {
                    printedEdges.insert(key1);
                    if (!firstRoad) std::cout << ",\n";
                    std::cout << "    {\"source\":\"" << escapeJSON(src)
                              << "\",\"destination\":\"" << escapeJSON(dest)
                              << "\",\"distance\":" << edge.distance
                              << ",\"danger_level\":" << edge.danger_level
                              << ",\"blocked\":" << (edge.blocked ? "true" : "false") << "}";
                    firstRoad = false;
                }
            }
        }
        std::cout << "\n  ]\n";
        std::cout << "}\n";

    } else if (arg1 == "--traversal") {
        if (argc < 4) {
            std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"Missing algorithm (bfs|dfs) or source for --traversal.\"\n}\n";
            return 1;
        }
        std::string algo = argv[2];
        std::string src = argv[3];
        std::transform(algo.begin(), algo.end(), algo.begin(), ::tolower);

        std::vector<std::string> visitedOrder;
        if (algo == "bfs") {
            visitedOrder = Algorithms::runBFS(graph, src);
        } else if (algo == "dfs") {
            visitedOrder = Algorithms::runDFS(graph, src);
        } else if (algo == "dijkstra") {
            visitedOrder = Algorithms::runDijkstraTraversal(graph, src);
        } else if (algo == "astar") {
            if (argc < 5) {
                std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"A* traversal requires both source and destination arguments.\"\n}\n";
                return 1;
            }
            std::string dest = argv[4];
            visitedOrder = Algorithms::runAStarTraversal(graph, src, dest, dm.coordinates);
        } else {
            std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"Unknown traversal algorithm: " << escapeJSON(algo) << "\"\n}\n";
            return 1;
        }

        std::cout << "{\n  \"status\": \"success\",\n";
        std::cout << "  \"algorithm\": \"" << escapeJSON(algo) << "\",\n";
        std::cout << "  \"source\": \"" << escapeJSON(src) << "\",\n";
        std::cout << "  \"visited_order\": [";
        for (size_t i = 0; i < visitedOrder.size(); ++i) {
            std::cout << "\"" << escapeJSON(visitedOrder[i]) << "\"";
            if (i < visitedOrder.size() - 1) std::cout << ",";
        }
        std::cout << "]\n}\n";

    } else if (arg1 == "--resources") {
        if (argc < 3) {
            std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"Missing sector for --resources.\"\n}\n";
            return 1;
        }
        std::string targetSector = argv[2];

        std::cout << "{\n  \"status\": \"success\",\n";
        std::cout << "  \"sector\": \"" << escapeJSON(targetSector) << "\",\n";

        // Hospitals in target sector
        std::cout << "  \"hospitals\": [";
        bool first = true;
        for (const auto& h : dm.hospitals) {
            if (h.sector == targetSector) {
                if (!first) std::cout << ",";
                printHospitalJSON(h);
                first = false;
            }
        }
        std::cout << "],\n";

        // Shelters in target sector
        std::cout << "  \"shelters\": [";
        first = true;
        for (const auto& s : dm.shelters) {
            if (s.sector == targetSector) {
                if (!first) std::cout << ",";
                printShelterJSON(s);
                first = false;
            }
        }
        std::cout << "],\n";

        // Teams in target sector
        std::cout << "  \"teams\": [";
        first = true;
        for (const auto& t : dm.teams) {
            if (t.sector == targetSector) {
                if (!first) std::cout << ",";
                printTeamJSON(t);
                first = false;
            }
        }
        std::cout << "]\n";
        std::cout << "}\n";

    } else {
        std::cout << "{\n  \"status\": \"error\",\n  \"message\": \"Unknown command: " << escapeJSON(arg1) << "\"\n}\n";
        return 1;
    }

    return 0;
}
