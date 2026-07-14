#include "algorithms.h"
#include <queue>
#include <stack>
#include <unordered_set>
#include <unordered_map>
#include <limits>
#include <algorithm>
#include <cmath>
#include <chrono>

const double PI = 3.14159265358979323846;

RouteResult Algorithms::findShortestPath(const Graph& graph, const std::string& source, const std::string& destination) {
    RouteResult result;
    result.success = false;
    result.total_distance = 0.0;
    result.average_danger = 0.0;

    if (!graph.hasNode(source)) {
        result.message = "Source location '" + source + "' not found in the network.";
        return result;
    }
    if (!graph.hasNode(destination)) {
        result.message = "Destination location '" + destination + "' not found in the network.";
        return result;
    }

    std::unordered_map<std::string, double> dist;
    std::unordered_map<std::string, std::string> parent;
    std::unordered_map<std::string, double> actual_dist;
    std::unordered_map<std::string, int> path_danger_sum;
    std::unordered_map<std::string, int> path_node_count;

    const auto& adjList = graph.getAdjList();
    for (const auto& pair : adjList) {
        dist[pair.first] = std::numeric_limits<double>::infinity();
        actual_dist[pair.first] = 0.0;
        path_danger_sum[pair.first] = 0;
        path_node_count[pair.first] = 0;
    }

    // Min-heap priority queue: pair of (weight_cost, node_name)
    typedef std::pair<double, std::string> PQElement;
    std::priority_queue<PQElement, std::vector<PQElement>, std::greater<PQElement>> pq;

    auto startTime = std::chrono::high_resolution_clock::now();
    int nodesExpanded = 0;

    dist[source] = 0.0;
    actual_dist[source] = 0.0;
    pq.push({0.0, source});

    while (!pq.empty()) {
        auto top = pq.top();
        pq.pop();

        double d = top.first;
        std::string u = top.second;

        if (d > dist[u]) continue;
        nodesExpanded++;
        if (u == destination) break;

        if (adjList.find(u) == adjList.end()) continue;

        for (const auto& edge : adjList.at(u)) {
            if (edge.blocked) continue; // Skip blocked roads

            std::string v = edge.destination;
            // Cost calculation: weight is influenced by distance and danger level
            // A higher danger level increases the cost weight, encouraging safer paths
            double cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);

            if (dist[u] + cost < dist[v]) {
                dist[v] = dist[u] + cost;
                actual_dist[v] = actual_dist[u] + edge.distance;
                path_danger_sum[v] = path_danger_sum[u] + edge.danger_level;
                path_node_count[v] = path_node_count[u] + 1;
                parent[v] = u;
                pq.push({dist[v], v});
            }
        }
    }

    if (dist[destination] == std::numeric_limits<double>::infinity()) {
        result.message = "No safe route exists between " + source + " and " + destination + " (roads may be blocked).";
        return result;
    }

    // Reconstruct path
    std::vector<std::string> path;
    std::string curr = destination;
    while (curr != source) {
        path.push_back(curr);
        curr = parent[curr];
    }
    path.push_back(source);
    std::reverse(path.begin(), path.end());

    result.success = true;
    result.path = path;
    result.total_distance = actual_dist[destination];
    
    int count = path_node_count[destination];
    if (count > 0) {
        result.average_danger = static_cast<double>(path_danger_sum[destination]) / count;
    } else {
        result.average_danger = 1.0;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration = endTime - startTime;
    result.execution_time_ms = duration.count();
    result.nodes_expanded = nodesExpanded;

    result.message = "Safe route calculated successfully.";
    return result;
}

std::vector<std::string> Algorithms::runBFS(const Graph& graph, const std::string& source) {
    std::vector<std::string> order;
    if (!graph.hasNode(source)) return order;

    std::unordered_set<std::string> visited;
    std::queue<std::string> q;

    q.push(source);
    visited.insert(source);

    const auto& adjList = graph.getAdjList();

    while (!q.empty()) {
        std::string u = q.front();
        q.pop();
        order.push_back(u);

        if (adjList.find(u) == adjList.end()) continue;

        // Collect neighbors and sort alphabetically to ensure consistent traversal order
        std::vector<std::string> neighbors;
        for (const auto& edge : adjList.at(u)) {
            if (!edge.blocked) {
                neighbors.push_back(edge.destination);
            }
        }
        std::sort(neighbors.begin(), neighbors.end());

        for (const auto& v : neighbors) {
            if (visited.find(v) == visited.end()) {
                visited.insert(v);
                q.push(v);
            }
        }
    }

    return order;
}

std::vector<std::string> Algorithms::runDFS(const Graph& graph, const std::string& source) {
    std::vector<std::string> order;
    if (!graph.hasNode(source)) return order;

    std::unordered_set<std::string> visited;
    std::stack<std::string> s;

    s.push(source);

    const auto& adjList = graph.getAdjList();

    while (!s.empty()) {
        std::string u = s.top();
        s.pop();

        if (visited.find(u) == visited.end()) {
            visited.insert(u);
            order.push_back(u);

            if (adjList.find(u) == adjList.end()) continue;

            // Collect neighbors, sort in reverse alphabetical order so that when pushed to stack,
            // they are popped in alphabetical order
            std::vector<std::string> neighbors;
            for (const auto& edge : adjList.at(u)) {
                if (!edge.blocked) {
                    neighbors.push_back(edge.destination);
                }
            }
            std::sort(neighbors.rbegin(), neighbors.rend());

            for (const auto& v : neighbors) {
                if (visited.find(v) == visited.end()) {
                    s.push(v);
                }
            }
        }
    }

    return order;
}

std::vector<std::string> Algorithms::runDijkstraTraversal(const Graph& graph, const std::string& source) {
    std::vector<std::string> order;
    if (!graph.hasNode(source)) return order;

    std::unordered_map<std::string, double> dist;
    const auto& adjList = graph.getAdjList();
    for (const auto& pair : adjList) {
        dist[pair.first] = std::numeric_limits<double>::infinity();
    }

    typedef std::pair<double, std::string> PQElement;
    std::priority_queue<PQElement, std::vector<PQElement>, std::greater<PQElement>> pq;

    dist[source] = 0.0;
    pq.push({0.0, source});
    std::unordered_set<std::string> visited;

    while (!pq.empty()) {
        auto top = pq.top();
        pq.pop();

        double d = top.first;
        std::string u = top.second;

        if (visited.find(u) != visited.end()) continue;
        visited.insert(u);
        order.push_back(u);

        if (adjList.find(u) == adjList.end()) continue;

        for (const auto& edge : adjList.at(u)) {
            if (edge.blocked) continue;
            std::string v = edge.destination;
            double cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);
            if (dist[u] + cost < dist[v]) {
                dist[v] = dist[u] + cost;
                pq.push({dist[v], v});
            }
        }
    }
    return order;
}

double Algorithms::haversine(double lat1, double lon1, double lat2, double lon2) {
    double dLat = (lat2 - lat1) * PI / 180.0;
    double dLon = (lon2 - lon1) * PI / 180.0;
    lat1 = lat1 * PI / 180.0;
    lat2 = lat2 * PI / 180.0;
    
    double a = sin(dLat/2.0) * sin(dLat/2.0) +
               sin(dLon/2.0) * sin(dLon/2.0) * cos(lat1) * cos(lat2);
    double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
    return 6371.0 * c; // Earth radius in km
}

RouteResult Algorithms::findAStarPath(const Graph& graph, const std::string& source, const std::string& destination, const std::unordered_map<std::string, std::pair<double, double>>& coordinates) {
    RouteResult result;
    result.success = false;
    result.total_distance = 0.0;
    result.average_danger = 0.0;

    if (!graph.hasNode(source)) {
        result.message = "Source location '" + source + "' not found in the network.";
        return result;
    }
    if (!graph.hasNode(destination)) {
        result.message = "Destination location '" + destination + "' not found in the network.";
        return result;
    }

    std::unordered_map<std::string, double> gScore;
    std::unordered_map<std::string, double> fScore;
    std::unordered_map<std::string, std::string> parent;
    std::unordered_map<std::string, double> actual_dist;
    std::unordered_map<std::string, int> path_danger_sum;
    std::unordered_map<std::string, int> path_node_count;

    const auto& adjList = graph.getAdjList();
    for (const auto& pair : adjList) {
        gScore[pair.first] = std::numeric_limits<double>::infinity();
        fScore[pair.first] = std::numeric_limits<double>::infinity();
        actual_dist[pair.first] = 0.0;
        path_danger_sum[pair.first] = 0;
        path_node_count[pair.first] = 0;
    }

    // Heuristic helper lambda
    auto getHeuristic = [&](const std::string& node) -> double {
        if (coordinates.find(node) == coordinates.end() || coordinates.find(destination) == coordinates.end()) {
            return 0.0;
        }
        auto p1 = coordinates.at(node);
        auto p2 = coordinates.at(destination);
        return haversine(p1.first, p1.second, p2.first, p2.second);
    };

    typedef std::pair<double, std::string> PQElement;
    std::priority_queue<PQElement, std::vector<PQElement>, std::greater<PQElement>> pq;

    auto startTime = std::chrono::high_resolution_clock::now();
    int nodesExpanded = 0;

    gScore[source] = 0.0;
    double h_src = getHeuristic(source);
    fScore[source] = h_src;
    pq.push({h_src, source});

    while (!pq.empty()) {
        auto top = pq.top();
        pq.pop();

        std::string u = top.second;
        nodesExpanded++;

        if (u == destination) break;

        if (adjList.find(u) == adjList.end()) continue;

        for (const auto& edge : adjList.at(u)) {
            if (edge.blocked) continue;

            std::string v = edge.destination;
            double cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);
            double tentative_gScore = gScore[u] + cost;

            if (tentative_gScore < gScore[v]) {
                gScore[v] = tentative_gScore;
                fScore[v] = tentative_gScore + getHeuristic(v);
                actual_dist[v] = actual_dist[u] + edge.distance;
                path_danger_sum[v] = path_danger_sum[u] + edge.danger_level;
                path_node_count[v] = path_node_count[u] + 1;
                parent[v] = u;
                pq.push({fScore[v], v});
            }
        }
    }

    if (gScore[destination] == std::numeric_limits<double>::infinity()) {
        result.message = "No safe route exists between " + source + " and " + destination + " (roads may be blocked).";
        return result;
    }

    // Reconstruct path
    std::vector<std::string> path;
    std::string curr = destination;
    while (curr != source) {
        path.push_back(curr);
        curr = parent[curr];
    }
    path.push_back(source);
    std::reverse(path.begin(), path.end());

    result.success = true;
    result.path = path;
    result.total_distance = actual_dist[destination];
    
    int count = path_node_count[destination];
    if (count > 0) {
        result.average_danger = static_cast<double>(path_danger_sum[destination]) / count;
    } else {
        result.average_danger = 1.0;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration = endTime - startTime;
    result.execution_time_ms = duration.count();
    result.nodes_expanded = nodesExpanded;

    result.message = "Optimal A* route calculated successfully.";
    return result;
}

std::vector<std::string> Algorithms::runAStarTraversal(const Graph& graph, const std::string& source, const std::string& destination, const std::unordered_map<std::string, std::pair<double, double>>& coordinates) {
    std::vector<std::string> order;
    if (!graph.hasNode(source) || !graph.hasNode(destination)) return order;

    std::unordered_map<std::string, double> gScore;
    std::unordered_map<std::string, double> fScore;
    const auto& adjList = graph.getAdjList();
    for (const auto& pair : adjList) {
        gScore[pair.first] = std::numeric_limits<double>::infinity();
        fScore[pair.first] = std::numeric_limits<double>::infinity();
    }

    auto getHeuristic = [&](const std::string& node) -> double {
        if (coordinates.find(node) == coordinates.end() || coordinates.find(destination) == coordinates.end()) {
            return 0.0;
        }
        auto p1 = coordinates.at(node);
        auto p2 = coordinates.at(destination);
        return haversine(p1.first, p1.second, p2.first, p2.second);
    };

    typedef std::pair<double, std::string> PQElement;
    std::priority_queue<PQElement, std::vector<PQElement>, std::greater<PQElement>> pq;

    gScore[source] = 0.0;
    double h_src = getHeuristic(source);
    fScore[source] = h_src;
    pq.push({h_src, source});
    
    std::unordered_set<std::string> visited;

    while (!pq.empty()) {
        auto top = pq.top();
        pq.pop();

        std::string u = top.second;

        if (visited.find(u) != visited.end()) continue;
        visited.insert(u);
        order.push_back(u);

        if (u == destination) break;

        if (adjList.find(u) == adjList.end()) continue;

        for (const auto& edge : adjList.at(u)) {
            if (edge.blocked) continue;

            std::string v = edge.destination;
            double cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);
            double tentative_gScore = gScore[u] + cost;

            if (tentative_gScore < gScore[v]) {
                gScore[v] = tentative_gScore;
                fScore[v] = tentative_gScore + getHeuristic(v);
                pq.push({fScore[v], v});
            }
        }
    }
    return order;
}

RouteResult Algorithms::findBFSPath(const Graph& graph, const std::string& source, const std::string& destination) {
    RouteResult result;
    result.success = false;
    result.total_distance = 0.0;
    result.average_danger = 0.0;

    if (!graph.hasNode(source)) {
        result.message = "Source location '" + source + "' not found in the network.";
        return result;
    }
    if (!graph.hasNode(destination)) {
        result.message = "Destination location '" + destination + "' not found in the network.";
        return result;
    }

    auto startTime = std::chrono::high_resolution_clock::now();
    int nodesExpanded = 0;

    std::unordered_map<std::string, std::string> parent;
    std::unordered_set<std::string> visited;
    std::queue<std::string> q;

    q.push(source);
    visited.insert(source);
    bool found = false;

    const auto& adjList = graph.getAdjList();

    while (!q.empty()) {
        std::string u = q.front();
        q.pop();
        nodesExpanded++;

        if (u == destination) {
            found = true;
            break;
        }

        if (adjList.find(u) == adjList.end()) continue;

        for (const auto& edge : adjList.at(u)) {
            if (edge.blocked) continue;
            std::string v = edge.destination;
            if (visited.find(v) == visited.end()) {
                visited.insert(v);
                parent[v] = u;
                q.push(v);
            }
        }
    }

    if (!found) {
        result.message = "No safe route exists between " + source + " and " + destination + " (roads may be blocked).";
        return result;
    }

    // Reconstruct path
    std::vector<std::string> path;
    std::string curr = destination;
    while (curr != source) {
        path.push_back(curr);
        curr = parent[curr];
    }
    path.push_back(source);
    std::reverse(path.begin(), path.end());

    // Calculate details (distance, danger)
    double dist = 0.0;
    int dangerSum = 0;
    int edgesCount = 0;

    for (size_t i = 0; i < path.size() - 1; ++i) {
        std::string u = path[i];
        std::string v = path[i+1];
        if (adjList.find(u) != adjList.end()) {
            for (const auto& edge : adjList.at(u)) {
                if (edge.destination == v) {
                    dist += edge.distance;
                    dangerSum += edge.danger_level;
                    edgesCount++;
                    break;
                }
            }
        }
    }

    result.success = true;
    result.path = path;
    result.total_distance = dist;
    result.average_danger = edgesCount > 0 ? static_cast<double>(dangerSum) / edgesCount : 1.0;

    auto endTime = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration = endTime - startTime;
    result.execution_time_ms = duration.count();
    result.nodes_expanded = nodesExpanded;

    result.message = "Route calculated successfully using BFS.";
    return result;
}

RouteResult Algorithms::findDFSPath(const Graph& graph, const std::string& source, const std::string& destination) {
    RouteResult result;
    result.success = false;
    result.total_distance = 0.0;
    result.average_danger = 0.0;

    if (!graph.hasNode(source)) {
        result.message = "Source location '" + source + "' not found in the network.";
        return result;
    }
    if (!graph.hasNode(destination)) {
        result.message = "Destination location '" + destination + "' not found in the network.";
        return result;
    }

    auto startTime = std::chrono::high_resolution_clock::now();
    int nodesExpanded = 0;

    std::unordered_map<std::string, std::string> parent;
    std::unordered_set<std::string> visited;
    std::stack<std::string> s;

    s.push(source);
    bool found = false;

    const auto& adjList = graph.getAdjList();

    while (!s.empty()) {
        std::string u = s.top();
        s.pop();

        if (visited.find(u) != visited.end()) continue;
        visited.insert(u);
        nodesExpanded++;

        if (u == destination) {
            found = true;
            break;
        }

        if (adjList.find(u) == adjList.end()) continue;

        std::vector<std::string> neighbors;
        for (const auto& edge : adjList.at(u)) {
            if (!edge.blocked) {
                neighbors.push_back(edge.destination);
            }
        }
        std::sort(neighbors.rbegin(), neighbors.rend());

        for (const auto& v : neighbors) {
            if (visited.find(v) == visited.end()) {
                parent[v] = u;
                s.push(v);
            }
        }
    }

    if (!found) {
        result.message = "No safe route exists between " + source + " and " + destination + " (roads may be blocked).";
        return result;
    }

    // Reconstruct path
    std::vector<std::string> path;
    std::string curr = destination;
    while (curr != source) {
        path.push_back(curr);
        curr = parent[curr];
    }
    path.push_back(source);
    std::reverse(path.begin(), path.end());

    // Calculate details (distance, danger)
    double dist = 0.0;
    int dangerSum = 0;
    int edgesCount = 0;

    for (size_t i = 0; i < path.size() - 1; ++i) {
        std::string u = path[i];
        std::string v = path[i+1];
        if (adjList.find(u) != adjList.end()) {
            for (const auto& edge : adjList.at(u)) {
                if (edge.destination == v) {
                    dist += edge.distance;
                    dangerSum += edge.danger_level;
                    edgesCount++;
                    break;
                }
            }
        }
    }

    result.success = true;
    result.path = path;
    result.total_distance = dist;
    result.average_danger = edgesCount > 0 ? static_cast<double>(dangerSum) / edgesCount : 1.0;

    auto endTime = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration = endTime - startTime;
    result.execution_time_ms = duration.count();
    result.nodes_expanded = nodesExpanded;

    result.message = "Route calculated successfully using DFS.";
    return result;
}


