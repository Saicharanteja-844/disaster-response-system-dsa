#ifndef GRAPH_H
#define GRAPH_H

#include <string>
#include <vector>
#include <unordered_map>
#include "data.h"

struct Edge {
    std::string destination;
    double distance;
    int danger_level;
    bool blocked;
};

class Graph {
private:
    std::unordered_map<std::string, std::vector<Edge>> adjList;
public:
    void addEdge(const std::string& src, const std::string& dest, double dist, int danger, bool blocked);
    void toggleRoadBlock(const std::string& src, const std::string& dest, bool blocked);
    bool isRoadBlocked(const std::string& src, const std::string& dest) const;
    const std::unordered_map<std::string, std::vector<Edge>>& getAdjList() const;
    std::vector<std::string> getNodes() const;
    bool hasNode(const std::string& node) const;
};

#endif
