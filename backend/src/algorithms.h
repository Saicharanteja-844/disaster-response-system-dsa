#ifndef ALGORITHMS_H
#define ALGORITHMS_H

#include "graph.h"
#include <vector>
#include <string>
#include <unordered_map>

struct RouteResult {
    bool success;
    std::vector<std::string> path;
    double total_distance;
    double average_danger;
    std::string message;
    double execution_time_ms;
    int nodes_expanded;
};

class Algorithms {
public:
    static RouteResult findShortestPath(const Graph& graph, const std::string& source, const std::string& destination);
    static RouteResult findBFSPath(const Graph& graph, const std::string& source, const std::string& destination);
    static RouteResult findDFSPath(const Graph& graph, const std::string& source, const std::string& destination);
    static std::vector<std::string> runBFS(const Graph& graph, const std::string& source);
    static std::vector<std::string> runDFS(const Graph& graph, const std::string& source);
    static std::vector<std::string> runDijkstraTraversal(const Graph& graph, const std::string& source);
    
    static double haversine(double lat1, double lon1, double lat2, double lon2);
    static RouteResult findAStarPath(const Graph& graph, const std::string& source, const std::string& destination, const std::unordered_map<std::string, std::pair<double, double>>& coordinates);
    static std::vector<std::string> runAStarTraversal(const Graph& graph, const std::string& source, const std::string& destination, const std::unordered_map<std::string, std::pair<double, double>>& coordinates);
};

#endif
