const fs = require('fs');
const path = require('path');

// Constants
const PI = 3.14159265358979323846;
const EARTH_RADIUS_KM = 6371.0;

// Helper to calculate Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * PI / 180.0;
    const dLon = (lon2 - lon1) * PI / 180.0;
    const rLat1 = lat1 * PI / 180.0;
    const rLat2 = lat2 * PI / 180.0;

    const a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
              Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0) * Math.cos(rLat1) * Math.cos(rLat2);
    const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
    return EARTH_RADIUS_KM * c;
}

// Simple CSV parser
function parseCSV(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
        return data;
    } catch (e) {
        console.error(`Failed to parse CSV file: ${filePath}`, e);
        return [];
    }
}

// Data Manager class mimicking C++ DataManager
class DataManager {
    constructor() {
        const isWin = process.platform === 'win32';
        let dataDir = path.join(__dirname, 'data');
        if (!isWin) {
            const tmpDir = '/tmp/data';
            if (fs.existsSync(tmpDir) && fs.readdirSync(tmpDir).length > 0) {
                dataDir = tmpDir;
            } else {
                dataDir = path.join(process.cwd(), 'data');
            }
        }
        this.coordinatesList = parseCSV(path.join(dataDir, 'coordinates.csv'));
        this.roadsList = parseCSV(path.join(dataDir, 'roads.csv'));
        this.hospitals = parseCSV(path.join(dataDir, 'hospitals.csv'));
        this.shelters = parseCSV(path.join(dataDir, 'shelters.csv'));
        this.teams = parseCSV(path.join(dataDir, 'teams.csv'));

        // Load coordinates map
        this.coordinates = {};
        this.coordinatesList.forEach(row => {
            const lat = parseFloat(row.Latitude || row.latitude);
            const lon = parseFloat(row.Longitude || row.longitude);
            const city = row.City || row.city;
            if (city && !isNaN(lat) && !isNaN(lon)) {
                this.coordinates[city] = { lat, lon };
            }
        });
    }

    getAffectedCities(disasterType) {
        if (disasterType === 'flood') {
            return new Set(["Guwahati", "Siliguri", "Patna", "Kolkata", "Chennai", "Vijayawada"]);
        } else if (disasterType === 'cyclone') {
            return new Set(["Visakhapatnam", "Bhubaneswar", "Chennai", "Puducherry"]);
        } else if (disasterType === 'landslide') {
            return new Set(["Shimla", "Chandigarh", "Jammu", "Srinagar"]);
        } else if (disasterType === 'earthquake') {
            return new Set(["Jammu", "Srinagar", "Dehradun", "Rishikesh"]);
        } else if (disasterType === 'fire') {
            return new Set(["Bengaluru", "Mysuru", "Nagpur", "Bhopal"]);
        }
        return new Set();
    }

    buildGraph(blockedStr = "", disasterType = "") {
        const affectedCities = this.getAffectedCities(disasterType);
        
        // Parse block list
        const blockedEdges = new Set();
        if (blockedStr) {
            blockedStr.split(',').forEach(pair => {
                const nodes = pair.split(':');
                if (nodes.length === 2) {
                    const n1 = nodes[0].trim();
                    const n2 = nodes[1].trim();
                    blockedEdges.add(`${n1}->${n2}`);
                    blockedEdges.add(`${n2}->${n1}`);
                }
            });
        }

        const nodes = Object.keys(this.coordinates);
        const adjList = {};
        nodes.forEach(n => {
            adjList[n] = [];
        });

        this.roadsList.forEach(row => {
            const src = row.Source || row.source;
            const dest = row.Destination || row.destination;
            const dist = parseFloat(row.Distance || row.distance);
            let danger = parseInt(row.DangerLevel || row.danger_level || '1', 10);
            const originalBlocked = (row.Blocked || row.blocked) === 'true';

            if (!src || !dest || isNaN(dist)) return;

            // Apply disaster weights adjustment
            if (disasterType && (affectedCities.has(src) || affectedCities.has(dest))) {
                danger = Math.min(5, danger + 2);
            }

            // Apply blocks
            const isBlocked = originalBlocked || blockedEdges.has(`${src}->${dest}`) || blockedEdges.has(`${dest}->${src}`);

            if (!adjList[src]) adjList[src] = [];
            if (!adjList[dest]) adjList[dest] = [];

            adjList[src].push({ destination: dest, distance: dist, danger_level: danger, blocked: isBlocked });
            adjList[dest].push({ destination: src, distance: dist, danger_level: danger, blocked: isBlocked });
        });

        return { nodes, adjList };
    }
}

// Algorithm classes mimicking C++ Algorithms
class Algorithms {
    // Dijkstra Route Calculation
    static findShortestPath(graph, source, destination) {
        const { adjList } = graph;
        if (!adjList[source] || !adjList[destination]) {
            return { success: false, message: "Source or Destination not found in coordinates dataset." };
        }

        const startTime = Date.now();
        const dist = {};
        const actual_dist = {};
        const parent = {};
        const path_danger_sum = {};
        const path_node_count = {};
        const visited = new Set();

        Object.keys(adjList).forEach(node => {
            dist[node] = Infinity;
            actual_dist[node] = 0.0;
            path_danger_sum[node] = 0;
            path_node_count[node] = 0;
        });

        dist[source] = 0.0;
        let nodesExpanded = 0;

        // Simple Dijkstra priority queue using array sorting (perfectly correct and robust for 41 cities)
        const pq = [{ score: 0.0, node: source }];

        while (pq.length > 0) {
            pq.sort((a, b) => a.score - b.score);
            const { score, node: u } = pq.shift();

            if (visited.has(u)) continue;
            visited.add(u);
            nodesExpanded++;

            if (u === destination) break;

            const neighbors = adjList[u] || [];
            for (const edge of neighbors) {
                if (edge.blocked) continue;

                const v = edge.destination;
                const cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);

                if (dist[u] + cost < dist[v]) {
                    dist[v] = dist[u] + cost;
                    actual_dist[v] = actual_dist[u] + edge.distance;
                    path_danger_sum[v] = path_danger_sum[u] + edge.danger_level;
                    path_node_count[v] = path_node_count[u] + 1;
                    parent[v] = u;
                    pq.push({ score: dist[v], node: v });
                }
            }
        }

        if (dist[destination] === Infinity) {
            return { success: false, message: "No safe route exists (roads may be blocked due to active disaster)." };
        }

        const path = [];
        let curr = destination;
        while (curr !== source) {
            path.push(curr);
            curr = parent[curr];
        }
        path.push(source);
        path.reverse();

        const count = path_node_count[destination];
        const average_danger = count > 0 ? (path_danger_sum[destination] / count) : 1.0;

        return {
            success: true,
            path,
            total_distance: actual_dist[destination],
            average_danger,
            nodes_expanded: nodesExpanded,
            execution_time_ms: Date.now() - startTime
        };
    }

    // A* Route Calculation
    static findAStarPath(graph, source, destination, coordinates) {
        const { adjList } = graph;
        if (!adjList[source] || !adjList[destination]) {
            return { success: false, message: "Source or Destination not found in coordinates dataset." };
        }

        const startTime = Date.now();
        const gScore = {};
        const fScore = {};
        const actual_dist = {};
        const parent = {};
        const path_danger_sum = {};
        const path_node_count = {};
        const visited = new Set();

        Object.keys(adjList).forEach(node => {
            gScore[node] = Infinity;
            fScore[node] = Infinity;
            actual_dist[node] = 0.0;
            path_danger_sum[node] = 0;
            path_node_count[node] = 0;
        });

        function getHeuristic(node) {
            const p1 = coordinates[node];
            const p2 = coordinates[destination];
            if (!p1 || !p2) return 0.0;
            return haversine(p1.lat, p1.lon, p2.lat, p2.lon);
        }

        gScore[source] = 0.0;
        const h_src = getHeuristic(source);
        fScore[source] = h_src;

        const pq = [{ score: h_src, node: source }];
        let nodesExpanded = 0;

        while (pq.length > 0) {
            pq.sort((a, b) => a.score - b.score);
            const { node: u } = pq.shift();

            if (visited.has(u)) continue;
            visited.add(u);
            nodesExpanded++;

            if (u === destination) break;

            const neighbors = adjList[u] || [];
            for (const edge of neighbors) {
                if (edge.blocked) continue;

                const v = edge.destination;
                const cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);
                const tentative_gScore = gScore[u] + cost;

                if (tentative_gScore < gScore[v]) {
                    gScore[v] = tentative_gScore;
                    fScore[v] = tentative_gScore + getHeuristic(v);
                    actual_dist[v] = actual_dist[u] + edge.distance;
                    path_danger_sum[v] = path_danger_sum[u] + edge.danger_level;
                    path_node_count[v] = path_node_count[u] + 1;
                    parent[v] = u;
                    pq.push({ score: fScore[v], node: v });
                }
            }
        }

        if (gScore[destination] === Infinity) {
            return { success: false, message: "No safe route exists (roads may be blocked due to active disaster)." };
        }

        const path = [];
        let curr = destination;
        while (curr !== source) {
            path.push(curr);
            curr = parent[curr];
        }
        path.push(source);
        path.reverse();

        const count = path_node_count[destination];
        const average_danger = count > 0 ? (path_danger_sum[destination] / count) : 1.0;

        return {
            success: true,
            path,
            total_distance: actual_dist[destination],
            average_danger,
            nodes_expanded: nodesExpanded,
            execution_time_ms: Date.now() - startTime
        };
    }

    // BFS Route Path (shortest by number of hops)
    static findBFSPath(graph, source, destination) {
        const { adjList } = graph;
        const startTime = Date.now();
        const visited = new Set([source]);
        const q = [source];
        const parent = {};
        let nodesExpanded = 0;
        let found = false;

        while (q.length > 0) {
            const u = q.shift();
            nodesExpanded++;
            if (u === destination) {
                found = true;
                break;
            }

            const neighbors = (adjList[u] || [])
                .filter(edge => !edge.blocked)
                .map(edge => edge.destination)
                .sort(); // Consistent alphabet sort

            for (const v of neighbors) {
                if (!visited.has(v)) {
                    visited.add(v);
                    parent[v] = u;
                    q.push(v);
                }
            }
        }

        if (!found) {
            return { success: false, message: "No route exists between source and destination." };
        }

        const path = [];
        let curr = destination;
        while (curr !== source) {
            path.push(curr);
            curr = parent[curr];
        }
        path.push(source);
        path.reverse();

        // Calculate actual path metrics
        let total_distance = 0;
        let danger_sum = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const edges = adjList[path[i]] || [];
            const edge = edges.find(e => e.destination === path[i + 1]);
            if (edge) {
                total_distance += edge.distance;
                danger_sum += edge.danger_level;
            }
        }

        return {
            success: true,
            path,
            total_distance,
            average_danger: path.length > 1 ? (danger_sum / (path.length - 1)) : 1.0,
            nodes_expanded: nodesExpanded,
            execution_time_ms: Date.now() - startTime
        };
    }

    // DFS Route Path
    static findDFSPath(graph, source, destination) {
        const { adjList } = graph;
        const startTime = Date.now();
        const visited = new Set();
        const parent = {};
        const s = [source];
        let nodesExpanded = 0;
        let found = false;

        while (s.length > 0) {
            const u = s.pop();
            if (visited.has(u)) continue;
            visited.add(u);
            nodesExpanded++;

            if (u === destination) {
                found = true;
                break;
            }

            const neighbors = (adjList[u] || [])
                .filter(edge => !edge.blocked)
                .map(edge => edge.destination)
                .sort()
                .reverse(); // Reverse sort for correct stack order

            for (const v of neighbors) {
                if (!visited.has(v)) {
                    parent[v] = u;
                    s.push(v);
                }
            }
        }

        if (!found) {
            return { success: false, message: "No route exists between source and destination." };
        }

        const path = [];
        let curr = destination;
        while (curr !== source) {
            path.push(curr);
            curr = parent[curr];
        }
        path.push(source);
        path.reverse();

        let total_distance = 0;
        let danger_sum = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const edges = adjList[path[i]] || [];
            const edge = edges.find(e => e.destination === path[i + 1]);
            if (edge) {
                total_distance += edge.distance;
                danger_sum += edge.danger_level;
            }
        }

        return {
            success: true,
            path,
            total_distance,
            average_danger: path.length > 1 ? (danger_sum / (path.length - 1)) : 1.0,
            nodes_expanded: nodesExpanded,
            execution_time_ms: Date.now() - startTime
        };
    }

    // BFS Traversal visited order
    static runBFS(graph, source) {
        const { adjList } = graph;
        if (!adjList[source]) return [];
        const visited = new Set([source]);
        const q = [source];
        const order = [];

        while (q.length > 0) {
            const u = q.shift();
            order.push(u);

            const neighbors = (adjList[u] || [])
                .filter(edge => !edge.blocked)
                .map(edge => edge.destination)
                .sort();

            for (const v of neighbors) {
                if (!visited.has(v)) {
                    visited.add(v);
                    q.push(v);
                }
            }
        }
        return order;
    }

    // DFS Traversal visited order
    static runDFS(graph, source) {
        const { adjList } = graph;
        if (!adjList[source]) return [];
        const visited = new Set();
        const s = [source];
        const order = [];

        while (s.length > 0) {
            const u = s.pop();
            if (visited.has(u)) continue;
            visited.add(u);
            order.push(u);

            const neighbors = (adjList[u] || [])
                .filter(edge => !edge.blocked)
                .map(edge => edge.destination)
                .sort()
                .reverse();

            for (const v of neighbors) {
                if (!visited.has(v)) {
                    s.push(v);
                }
            }
        }
        return order;
    }

    // Dijkstra visited order
    static runDijkstraTraversal(graph, source) {
        const { adjList } = graph;
        if (!adjList[source]) return [];
        const dist = {};
        const visited = new Set();
        const order = [];

        Object.keys(adjList).forEach(node => {
            dist[node] = Infinity;
        });

        dist[source] = 0.0;
        const pq = [{ score: 0.0, node: source }];

        while (pq.length > 0) {
            pq.sort((a, b) => a.score - b.score);
            const { node: u } = pq.shift();

            if (visited.has(u)) continue;
            visited.add(u);
            order.push(u);

            const neighbors = adjList[u] || [];
            for (const edge of neighbors) {
                if (edge.blocked) continue;
                const v = edge.destination;
                const cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);

                if (dist[u] + cost < dist[v]) {
                    dist[v] = dist[u] + cost;
                    pq.push({ score: dist[v], node: v });
                }
            }
        }
        return order;
    }

    // A* visited order
    static runAStarTraversal(graph, source, destination, coordinates) {
        const { adjList } = graph;
        if (!adjList[source] || !adjList[destination]) return [];
        const gScore = {};
        const fScore = {};
        const visited = new Set();
        const order = [];

        Object.keys(adjList).forEach(node => {
            gScore[node] = Infinity;
            fScore[node] = Infinity;
        });

        function getHeuristic(node) {
            const p1 = coordinates[node];
            const p2 = coordinates[destination];
            if (!p1 || !p2) return 0.0;
            return haversine(p1.lat, p1.lon, p2.lat, p2.lon);
        }

        gScore[source] = 0.0;
        const h_src = getHeuristic(source);
        fScore[source] = h_src;
        const pq = [{ score: h_src, node: source }];

        while (pq.length > 0) {
            pq.sort((a, b) => a.score - b.score);
            const { node: u } = pq.shift();

            if (visited.has(u)) continue;
            visited.add(u);
            order.push(u);

            if (u === destination) break;

            const neighbors = adjList[u] || [];
            for (const edge of neighbors) {
                if (edge.blocked) continue;
                const v = edge.destination;
                const cost = edge.distance * (1.0 + (edge.danger_level - 1) * 0.3);
                const tentative_gScore = gScore[u] + cost;

                if (tentative_gScore < gScore[v]) {
                    gScore[v] = tentative_gScore;
                    fScore[v] = tentative_gScore + getHeuristic(v);
                    pq.push({ score: fScore[v], node: v });
                }
            }
        }
        return order;
    }

    // Connected Components using BFS/DFS
    static countComponents(graph) {
        const { adjList } = graph;
        const visited = new Set();
        let count = 0;

        Object.keys(adjList).forEach(node => {
            if (!visited.has(node)) {
                count++;
                // BFS traversal to mark all nodes in this component
                const q = [node];
                visited.add(node);
                while (q.length > 0) {
                    const u = q.shift();
                    const neighbors = (adjList[u] || [])
                        .filter(edge => !edge.blocked)
                        .map(edge => edge.destination);
                    for (const v of neighbors) {
                        if (!visited.has(v)) {
                            visited.add(v);
                            q.push(v);
                        }
                    }
                }
            }
        });
        return count;
    }
}

// API Dispatch handler mimicking main.cpp output interface
function executeFallbackEngine(args) {
    const dm = new DataManager();
    const arg1 = args[0];

    // Read disaster parameter
    let disaster = "";
    const disasterIdx = args.indexOf('--disaster');
    if (disasterIdx !== -1 && disasterIdx + 1 < args.length) {
        disaster = args[disasterIdx + 1];
    }

    // Read block list parameter
    let blocked = "";
    const blockIdx = args.indexOf('--block');
    if (blockIdx !== -1 && blockIdx + 1 < args.length) {
        blocked = args[blockIdx + 1];
    }

    const graph = dm.buildGraph(blocked, disaster);

    if (arg1 === '--graph') {
        const printedEdges = new Set();
        const roads = [];

        Object.keys(graph.adjList).forEach(src => {
            const neighbors = graph.adjList[src];
            neighbors.forEach(edge => {
                const dest = edge.destination;
                const key1 = `${src}->${dest}`;
                const key2 = `${dest}->${src}`;
                if (!printedEdges.has(key1) && !printedEdges.has(key2)) {
                    printedEdges.add(key1);
                    roads.push({
                        source: src,
                        destination: dest,
                        distance: edge.distance,
                        danger_level: edge.danger_level,
                        blocked: edge.blocked
                    });
                }
            });
        });

        const nodes = Object.keys(dm.coordinates).map(name => ({
            name,
            lat: dm.coordinates[name].lat,
            lon: dm.coordinates[name].lon
        }));

        const components = Algorithms.countComponents(graph);

        return {
            status: "success",
            nodes,
            roads,
            components
        };
    } else if (arg1 === '--route') {
        const src = args[1];
        const dest = args[2];

        let routeAlgo = "dijkstra";
        const algoIdx = args.indexOf('--algo');
        if (algoIdx !== -1 && algoIdx + 1 < args.length) {
            routeAlgo = args[algoIdx + 1];
        }

        let res;
        if (routeAlgo === 'astar') {
            res = Algorithms.findAStarPath(graph, src, dest, dm.coordinates);
        } else if (routeAlgo === 'bfs') {
            res = Algorithms.findBFSPath(graph, src, dest);
        } else if (routeAlgo === 'dfs') {
            res = Algorithms.findDFSPath(graph, src, dest);
        } else {
            res = Algorithms.findShortestPath(graph, src, dest);
        }

        if (!res.success) {
            return {
                status: "failed",
                message: res.message
            };
        }

        const pathNodes = new Set(res.path);

        const hospitals = dm.hospitals.filter(h => pathNodes.has(h.sector || h.Sector));
        const shelters = dm.shelters.filter(s => pathNodes.has(s.sector || s.Sector));
        const teams = dm.teams.filter(t => pathNodes.has(t.sector || t.Sector));

        return {
            status: "success",
            source: src,
            destination: dest,
            total_distance: res.total_distance,
            average_danger: res.average_danger,
            path: res.path,
            hospitals,
            shelters,
            teams,
            nodes_expanded: res.nodes_expanded,
            execution_time_ms: res.execution_time_ms
        };
    } else if (arg1 === '--traversal') {
        const algo = args[1];
        const src = args[2];
        let visitedOrder = [];

        if (algo === 'bfs') {
            visitedOrder = Algorithms.runBFS(graph, src);
        } else if (algo === 'dfs') {
            visitedOrder = Algorithms.runDFS(graph, src);
        } else if (algo === 'dijkstra') {
            visitedOrder = Algorithms.runDijkstraTraversal(graph, src);
        } else if (algo === 'astar') {
            const dest = args[3];
            visitedOrder = Algorithms.runAStarTraversal(graph, src, dest, dm.coordinates);
        }

        return {
            status: "success",
            algorithm: algo,
            source: src,
            visited_order: visitedOrder
        };
    } else if (arg1 === '--resources') {
        const targetSector = args[1];
        const hospitals = dm.hospitals.filter(h => (h.sector || h.Sector) === targetSector);
        const shelters = dm.shelters.filter(s => (s.sector || s.Sector) === targetSector);
        const teams = dm.teams.filter(t => (t.sector || t.Sector) === targetSector);

        return {
            status: "success",
            sector: targetSector,
            hospitals,
            shelters,
            teams
        };
    }

    return { status: "error", message: "Unknown fallback argument directive." };
}

module.exports = { executeFallbackEngine };
