#include "graph.h"
#include <algorithm>

void Graph::addEdge(const std::string& src, const std::string& dest, double dist, int danger, bool blocked) {
    // Add forward edge
    adjList[src].push_back({dest, dist, danger, blocked});
    // Add backward edge for undirected graph
    adjList[dest].push_back({src, dist, danger, blocked});
}

void Graph::toggleRoadBlock(const std::string& src, const std::string& dest, bool blocked) {
    // Toggle forward edge
    if (adjList.find(src) != adjList.end()) {
        for (auto& edge : adjList[src]) {
            if (edge.destination == dest) {
                edge.blocked = blocked;
                break;
            }
        }
    }
    // Toggle backward edge
    if (adjList.find(dest) != adjList.end()) {
        for (auto& edge : adjList[dest]) {
            if (edge.destination == src) {
                edge.blocked = blocked;
                break;
            }
        }
    }
}

bool Graph::isRoadBlocked(const std::string& src, const std::string& dest) const {
    if (adjList.find(src) != adjList.end()) {
        for (const auto& edge : adjList.at(src)) {
            if (edge.destination == dest) {
                return edge.blocked;
            }
        }
    }
    return false;
}

const std::unordered_map<std::string, std::vector<Edge>>& Graph::getAdjList() const {
    return adjList;
}

std::vector<std::string> Graph::getNodes() const {
    std::vector<std::string> nodes;
    for (const auto& pair : adjList) {
        nodes.push_back(pair.first);
    }
    std::sort(nodes.begin(), nodes.end());
    return nodes;
}

bool Graph::hasNode(const std::string& node) const {
    return adjList.find(node) != adjList.end();
}
