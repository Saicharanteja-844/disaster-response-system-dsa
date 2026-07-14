// Routing & Leaflet Map Controller - National Disaster Response Navigation System

// Geographical Coordinates mapping Indian locations to Sector nodes
const nodeCoords = {
  "Chennai": [13.0827, 80.2707],
  "Hyderabad": [17.3850, 78.4867],
  "Bengaluru": [12.9716, 77.5946],
  "Mumbai": [19.0760, 72.8777],
  "Patna": [25.5941, 85.1376],
  "Guwahati": [26.1445, 91.7362],
  "Srinagar": [34.0837, 74.7973],
  "Kochi": [9.9312, 76.2673],
  "Visakhapatnam": [17.6868, 83.2185],
  "Bhubaneswar": [20.2961, 85.8245],
  "Puri": [19.8135, 85.8312],
  "Paradeep": [20.3164, 86.6105],
  "Kakinada": [16.9891, 82.2475],
  "Vijayawada": [16.5062, 80.6480],
  "Kolkata": [22.5726, 88.3639],
  "Gangtok": [27.3314, 88.6138],
  "Shillong": [25.5788, 91.8833],
  "Imphal": [24.8170, 93.9368],
  "Itanagar": [27.0844, 93.6053],
  "Dehradun": [30.3165, 78.0322],
  "Shimla": [31.1048, 77.1734],
  "Manali": [32.2396, 77.1887],
  "Dharamshala": [32.2190, 76.3234],
  "Joshimath": [30.5506, 79.5660],
  "Kedarnath": [30.7352, 79.0669],
  "Nainital": [29.3803, 79.4630],
  "Darjeeling": [27.0410, 88.2627],
  "Leh": [34.1526, 77.5771],
  "Kullu": [31.9578, 77.1095],
  "Mandi": [31.5892, 76.9182],
  "Jammu": [32.7266, 74.8570],
  "New Delhi": [28.6139, 77.2090],
  "Lucknow": [26.8467, 80.9462],
  "Nagpur": [21.1458, 79.0882],
  "Pune": [18.5204, 73.8567],
  "Bhopal": [23.2599, 77.4126],
  "Siliguri": [26.7271, 88.3953],
  "Puducherry": [11.9416, 79.8083],
  "Chandigarh": [30.7333, 76.7794],
  "Rishikesh": [30.0869, 78.2676],
  "Mysuru": [12.2958, 76.6394]
};

// Predefined disaster-affected blocked roads (alphabetically ordered keys)
const predefinedBlockages = {
  "flood": ["Guwahati:Siliguri", "Kolkata:Patna", "Chennai:Vijayawada"],
  "cyclone": ["Bhubaneswar:Visakhapatnam", "Chennai:Puducherry"],
  "landslide": ["Chandigarh:Shimla", "Jammu:Srinagar"],
  "earthquake": ["Jammu:Srinagar", "Dehradun:Rishikesh"],
  "fire": ["Bengaluru:Mysuru", "Bhopal:Nagpur"]
};

// Global App States
let nodes = [];
let roads = [];
let activeBlockages = new Set(); // set of "NodeA:NodeB" (always alphabetically sorted to avoid duplicates)
let selectedSource = "";
let selectedDestination = "";
let currentPath = [];
let traversalAnimationSequence = [];
let currentResourceTab = "hospitals";
let traversalActiveVisitIndex = -1;
let currentViewMode = "map"; // "map" or "graph"
let currentRouteHospitals = [];
let currentRouteShelters = [];
let currentRouteTeams = [];

// Leaflet Map layer variables
let map;
let tileLayer;
let mapMarkers = {};
let mapLines = [];

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Leaflet Map centered around Central India for national view
  map = L.map('network-map').setView([22.5, 78.5], 5);

  // Load OpenStreetMap tiles
  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    minZoom: 4,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Set up dynamic clear button
  const clearBtn = document.getElementById('clear-blocks-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearAllBlockages);

  // Sync dropdown start selection changes to emergency logs
  document.getElementById('route-source').addEventListener('change', (e) => {
    selectedSource = e.target.value;
    clearRouteResults();
    drawMapLayers();
    fetchSectorResources(selectedSource);
  });

  document.getElementById('route-dest').addEventListener('change', (e) => {
    selectedDestination = e.target.value;
    clearRouteResults();
    drawMapLayers();
  });

  // Re-trigger calculation when switching routing algorithms
  document.getElementById('route-algo').addEventListener('change', () => {
    if (selectedSource && selectedDestination) {
      triggerRouteCalculation();
    }
  });

  // Set default blockages for the default disaster type (flood)
  const defaultDisaster = document.getElementById('route-disaster') ? document.getElementById('route-disaster').value : 'flood';
  const defaultBlocks = predefinedBlockages[defaultDisaster] || [];
  defaultBlocks.forEach(key => activeBlockages.add(key));

  // Initial load
  loadGraphData().then(() => {
    // Show New Delhi resources by default on load
    fetchSectorResources("New Delhi");
  });

  // Fetch actual live weather data for New Delhi from Open-Meteo
  fetchLiveWeather();

  // Allow clicking anywhere on the map background to select the nearest command sector
  map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    let nearestNode = "";
    let minDistance = Infinity;
    
    for (const nodeName in nodeCoords) {
      const coord = nodeCoords[nodeName];
      const dist = Math.pow(coord[0] - lat, 2) + Math.pow(coord[1] - lng, 2);
      if (dist < minDistance) {
        minDistance = dist;
        nearestNode = nodeName;
      }
    }
    
    if (nearestNode) {
      handleMarkerClick(nearestNode);
    }
  });
});

// Helper: Format road key consistently (sorted alphabetically)
function getRoadKey(nodeA, nodeB) {
  return nodeA < nodeB ? `${nodeA}:${nodeB}` : `${nodeB}:${nodeA}`;
}

// Fetch graph structure
async function loadGraphData() {
  try {
    // Generate blocked list parameter
    const blockedParam = Array.from(activeBlockages).join(',');
    const response = await fetch(`/api/graph?blocked=${blockedParam}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      nodes = data.nodes;
      roads = data.roads;
      
      // Update dropdown selections
      populateDropdowns(nodes);
      
      // Initialize blockages list in sidebar on first load
      renderBlockagesList();
      
      // Render layers on Leaflet map
      drawMapLayers();

      // Update sidebar Graph Statistics
      updateGraphStatistics();
    }
  } catch (error) {
    console.error("Error loading graph:", error);
  }
}

// Update sidebar graph topology numbers
function updateGraphStatistics() {
  document.getElementById('stats-nodes').textContent = nodes.length;
  document.getElementById('stats-edges').textContent = roads.length / 2; // bidirectional duplicates
  document.getElementById('stats-blocked').textContent = activeBlockages.size;
  document.getElementById('stats-components').textContent = getConnectedComponentsCount();
}

// Graph connected components calculator using BFS
function getConnectedComponentsCount() {
  if (nodes.length === 0) return 0;
  
  const visited = new Set();
  let count = 0;
  
  // Build adjacency list in Javascript
  const adj = {};
  nodes.forEach(n => adj[n] = []);
  roads.forEach(r => {
    const key = getRoadKey(r.source, r.destination);
    const isBlocked = r.blocked || activeBlockages.has(key);
    if (!isBlocked) {
      adj[r.source].push(r.destination);
      adj[r.destination].push(r.source);
    }
  });
  
  nodes.forEach(node => {
    if (!visited.has(node)) {
      count++;
      const queue = [node];
      visited.add(node);
      
      while (queue.length > 0) {
        const u = queue.shift();
        if (adj[u]) {
          adj[u].forEach(v => {
            if (!visited.has(v)) {
              visited.add(v);
              queue.push(v);
            }
          });
        }
      }
    }
  });
  
  return count;
}

// Populate dropdown select inputs
function populateDropdowns(nodeList) {
  const srcSelect = document.getElementById('route-source');
  const destSelect = document.getElementById('route-dest');
  const resSectorSelect = document.getElementById('res-sector');
  
  // Save selections
  const prevSrc = selectedSource;
  const prevDest = selectedDestination;
  const prevResSector = resSectorSelect ? resSectorSelect.value : "";
  
  // Clear options
  srcSelect.innerHTML = '<option value="" disabled selected>Select start node...</option>';
  destSelect.innerHTML = '<option value="" disabled selected>Select destination...</option>';
  if (resSectorSelect) {
    resSectorSelect.innerHTML = '<option value="" disabled selected>Select sector...</option>';
  }
  
  nodeList.forEach(node => {
    // Add start option
    const optSrc = document.createElement('option');
    optSrc.value = node;
    optSrc.textContent = node;
    srcSelect.appendChild(optSrc);
    
    // Add dest option
    const optDest = document.createElement('option');
    optDest.value = node;
    optDest.textContent = node;
    destSelect.appendChild(optDest);

    // Add res sector option
    if (resSectorSelect) {
      const optRes = document.createElement('option');
      optRes.value = node;
      optRes.textContent = node;
      resSectorSelect.appendChild(optRes);
    }
  });
  
  // Restore selections
  if (nodeList.includes(prevSrc)) srcSelect.value = prevSrc;
  if (nodeList.includes(prevDest)) destSelect.value = prevDest;
  if (resSectorSelect && nodeList.includes(prevResSector)) resSectorSelect.value = prevResSector;
}

// Render active blockages list in sidebar
function renderBlockagesList() {
  const container = document.getElementById('blockages-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  document.getElementById('blockages-count').textContent = activeBlockages.size;
  
  // Find all unique roads in the dataset to build toggles
  const uniqueRoads = [];
  const seenKeys = new Set();
  
  roads.forEach(road => {
    const key = getRoadKey(road.source, road.destination);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRoads.push({
        key: key,
        display: `${road.source} ↔ ${road.destination}`,
        distance: road.distance,
        blocked: road.blocked || activeBlockages.has(key)
      });
    }
  });
  
  // Sort alphabetically by label
  uniqueRoads.sort((a, b) => a.display.localeCompare(b.display));
  
  uniqueRoads.forEach(item => {
    const div = document.createElement('div');
    div.className = `blockage-item ${item.blocked ? 'checked' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.blocked;
    checkbox.id = `block-${item.key}`;
    checkbox.addEventListener('change', () => toggleBlockage(item.key));
    
    const label = document.createElement('label');
    label.htmlFor = `block-${item.key}`;
    label.textContent = item.display;
    
    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });
}

// Toggle a single blockage
function toggleBlockage(roadKey) {
  if (activeBlockages.has(roadKey)) {
    activeBlockages.delete(roadKey);
  } else {
    activeBlockages.add(roadKey);
  }
  
  // Refresh graph data and recalculate route if we have active selections
  loadGraphData().then(() => {
    if (selectedSource && selectedDestination) {
      triggerRouteCalculation();
    }
  });
}

// Clear all blockages
function clearAllBlockages() {
  activeBlockages.clear();
  clearRouteResults();
  loadGraphData().then(() => {
    if (selectedSource && selectedDestination) {
      triggerRouteCalculation();
    }
  });
}

// Clear calculated path variables and panels
function clearRouteResults() {
  currentPath = [];
  currentRouteHospitals = [];
  currentRouteShelters = [];
  currentRouteTeams = [];
  const resPanel = document.getElementById('results-panel');
  if (resPanel) resPanel.style.display = 'none';
  const compPanel = document.getElementById('comparison-panel');
  if (compPanel) compPanel.style.display = 'none';
}

// Retrieve coordinates based on map view mode (Geographic vs Circular schematic graph)
function getNodeCoord(nodeName) {
  if (currentViewMode === 'graph') {
    const idx = nodes.indexOf(nodeName);
    if (idx === -1) return nodeCoords[nodeName] || [22.5, 78.5];
    
    // Circular layout centers around Nagpur for national scale
    const center = [21.1458, 79.0882];
    const radius = 4.0; // visual degree radius
    const angle = (idx * 2 * Math.PI) / nodes.length;
    return [
      center[0] + radius * Math.sin(angle),
      center[1] + radius * Math.cos(angle)
    ];
  }
  return nodeCoords[nodeName];
}

// Get algorithm specific route line coloring
function getAlgorithmColor(algo) {
  if (algo === 'dijkstra') return '#00f0ff'; // Blue
  if (algo === 'astar') return '#39ff14';    // Green
  if (algo === 'bfs') return '#ff6b00';      // Orange
  if (algo === 'dfs') return '#d000ff';      // Purple
  return 'var(--info)';
}

// Draw elements on Leaflet Map
function drawMapLayers() {
  // 1. Clear previous polylines
  mapLines.forEach(line => map.removeLayer(line));
  mapLines = [];
  
  // 2. Clear previous markers
  for (const nodeName in mapMarkers) {
    map.removeLayer(mapMarkers[nodeName]);
  }
  mapMarkers = {};
  
  // 3. Draw roads as polylines
  roads.forEach(road => {
    const srcCoord = getNodeCoord(road.source);
    const destCoord = getNodeCoord(road.destination);
    
    if (!srcCoord || !destCoord) return;
    
    const key = getRoadKey(road.source, road.destination);
    const isBlocked = road.blocked || activeBlockages.has(key);
    const isOnPath = isRoadOnCurrentPath(road.source, road.destination);
    
    let lineColor = 'rgba(255, 255, 255, 0.25)';
    let lineWidth = 3.5;
    let lineDash = null;
    
    if (isOnPath) {
      const activeAlgo = document.getElementById('route-algo').value;
      lineColor = getAlgorithmColor(activeAlgo);
      lineWidth = 6;
    } else if (isBlocked) {
      lineColor = 'var(--primary)'; // red/crimson
      lineWidth = 3.5;
      lineDash = '5, 8';
    }
    
    const polyline = L.polyline([srcCoord, destCoord], {
      color: lineColor,
      weight: lineWidth,
      dashArray: lineDash,
      opacity: isOnPath ? 0.95 : 0.65
    }).addTo(map);
    
    // Hover details tooltip on road connections
    polyline.bindTooltip(
      `<strong>Road: ${road.source} ↔ ${road.destination}</strong><br>
       Distance: ${road.distance} km<br>
       Hazard Danger: ${road.danger_level}/5<br>
       Status: <span style="color:${isBlocked ? 'var(--primary)' : 'var(--success)'}">${isBlocked ? 'Blocked (Hazardous)' : 'Open'}</span>`, 
      { sticky: true }
    );
    
    // Toggle blockages directly by clicking road line on the map
    polyline.on('click', () => {
      toggleBlockage(key);
    });
    
    mapLines.push(polyline);
  });
  
  // 4. Draw node marker overlays
  nodes.forEach(nodeName => {
    const coord = getNodeCoord(nodeName);
    if (!coord) return;
    
    const isSource = nodeName === selectedSource;
    const isDest = nodeName === selectedDestination;
    const isOnPath = currentPath.includes(nodeName);
    
    // Traversal simulation highlight
    const isTraversalVisited = traversalAnimationSequence.indexOf(nodeName) !== -1 && 
                               traversalAnimationSequence.indexOf(nodeName) <= traversalActiveVisitIndex;
    
    // Hide node markers from map until selected as source/destination or part of optimal path/traversal
    if (!isSource && !isDest && !isOnPath && !isTraversalVisited) {
      return;
    }
    
    let markerClass = 'custom-map-marker';
    if (isSource) markerClass += ' source-marker';
    else if (isDest) markerClass += ' dest-marker';
    else if (isTraversalVisited) markerClass += ' traversal-visited';
    else if (isOnPath) markerClass += ' path-marker';
    
    // Determine abbreviation for node marker badge
    let shortName = nodeName.substring(0, 2).toUpperCase();
    if (nodeName === "Connaught Place") shortName = "CP";
    else if (nodeName === "Rajouri Garden") shortName = "RG";
    else if (nodeName === "Uttam Nagar") shortName = "UN";
    else if (nodeName === "Mayur Vihar") shortName = "MV";
    else if (nodeName === "Karol Bagh") shortName = "KB";
    else shortName = nodeName.substring(0, 1).toUpperCase();
    
    const customIcon = L.divIcon({
      className: markerClass,
      html: `<span>${shortName}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    
    const marker = L.marker(coord, { icon: customIcon }).addTo(map);
    
    // Color search scanning nodes dynamically too
    if (isTraversalVisited && !isSource && !isDest) {
      const activeAlgo = document.getElementById('route-algo').value;
      const el = marker.getElement();
      if (el) {
        el.style.borderColor = getAlgorithmColor(activeAlgo);
        el.style.boxShadow = `0 0 15px ${getAlgorithmColor(activeAlgo)}`;
        el.style.transform = 'scale(1.2)';
      }
    }

    // Color active path nodes dynamically
    if (isOnPath && !isSource && !isDest) {
      const activeAlgo = document.getElementById('route-algo').value;
      const el = marker.getElement();
      if (el) {
        el.style.borderColor = getAlgorithmColor(activeAlgo);
        el.style.boxShadow = `0 0 12px ${getAlgorithmColor(activeAlgo)}`;
      }
    }
    
    // Clicking marker sets start/destination
    marker.on('click', () => {
      handleMarkerClick(nodeName);
    });
    
    // Bind dynamic resource details tooltip on hover
    bindMarkerTooltip(marker, nodeName);
    
    mapMarkers[nodeName] = marker;
  });
  
  // 5. Fit bounds to calculated path and draw route polyline + satellite resources if active
  if (currentPath.length > 1) {
    const pathLatLngs = currentPath.map(node => getNodeCoord(node)).filter(c => c);
    if (pathLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(pathLatLngs), { padding: [50, 50] });
    }

    // Draw prominent continuous path line
    const activeAlgo = document.getElementById('route-algo').value;
    const pathPolyline = L.polyline(pathLatLngs, {
      color: getAlgorithmColor(activeAlgo),
      weight: 7,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    mapLines.push(pathPolyline);

    // Draw satellite Hospital markers along the path
    currentRouteHospitals.forEach(hosp => {
      const nodeCoord = getNodeCoord(hosp.sector);
      if (nodeCoord) {
        // Offset slightly to bottom-left
        const offsetCoord = [nodeCoord[0] - 0.0035, nodeCoord[1] - 0.005];
        const hospitalIcon = L.divIcon({
          className: 'resource-map-marker hospital-marker',
          html: `<i class="fa-solid fa-hospital"></i>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const rMarker = L.marker(offsetCoord, { icon: hospitalIcon }).addTo(map);
        rMarker.bindTooltip(`<strong>Hospital: ${hosp.name}</strong><br>Beds Available: ${hosp.beds_available}/${hosp.capacity}`, { sticky: true });
        mapLines.push(rMarker);
      }
    });

    // Draw satellite Shelter markers along the path
    currentRouteShelters.forEach(shelt => {
      const nodeCoord = getNodeCoord(shelt.sector);
      if (nodeCoord) {
        // Offset slightly to bottom-right
        const offsetCoord = [nodeCoord[0] - 0.0035, nodeCoord[1] + 0.005];
        const shelterIcon = L.divIcon({
          className: 'resource-map-marker shelter-marker',
          html: `<i class="fa-solid fa-tents"></i>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const rMarker = L.marker(offsetCoord, { icon: shelterIcon }).addTo(map);
        rMarker.bindTooltip(`<strong>Shelter: ${shelt.name}</strong><br>Capacity Occupied: ${Math.round((1 - shelt.spaces_available/shelt.capacity)*100)}%`, { sticky: true });
        mapLines.push(rMarker);
      }
    });

    // Draw satellite Rescue Team markers along the path
    currentRouteTeams.forEach(team => {
      const nodeCoord = getNodeCoord(team.sector);
      if (nodeCoord) {
        // Offset slightly to top
        const offsetCoord = [nodeCoord[0] + 0.005, nodeCoord[1]];
        const teamIcon = L.divIcon({
          className: 'resource-map-marker team-marker',
          html: `<i class="fa-solid fa-truck-medical"></i>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const rMarker = L.marker(offsetCoord, { icon: teamIcon }).addTo(map);
        rMarker.bindTooltip(`<strong>Team: ${team.name}</strong><br>Specialty: ${team.specialty}`, { sticky: true });
        mapLines.push(rMarker);
      }
    });
  }
}

// Bind live hover tooltips pulling resource stats per node
async function bindMarkerTooltip(marker, nodeName) {
  marker.bindTooltip(`<strong>${nodeName} COMMAND CENTER</strong><br>Loading active emergency resources...`, {
    direction: 'top',
    offset: [0, -14],
    sticky: false
  });
  
  try {
    const response = await fetch(`/api/resources?sector=${nodeName}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      const hCount = data.hospitals.length;
      const sCount = data.shelters.length;
      const tCount = data.teams.length;
      
      let tooltipContent = `
        <div style="font-family:var(--font-family); padding:2px;">
          <strong style="color:var(--text-primary); font-family:var(--font-heading); display:block; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:6px;">${nodeName.toUpperCase()} COMMAND</strong>
          <span style="color:var(--warning); display:block; margin:2px 0;"><i class="fa-solid fa-hospital"></i> Hospitals: <strong>${hCount}</strong></span>
          <span style="color:var(--info); display:block; margin:2px 0;"><i class="fa-solid fa-tents"></i> Shelters: <strong>${sCount}</strong></span>
          <span style="color:var(--success); display:block; margin:2px 0;"><i class="fa-solid fa-truck-medical"></i> Rescue Teams: <strong>${tCount}</strong></span>
        </div>
      `;
      marker.setTooltipContent(tooltipContent);
    }
  } catch(e) {
    marker.setTooltipContent(`<strong>${nodeName}</strong><br>Failed to retrieve resources stats.`);
  }
}

// Check if a road connection lies on the current calculated path
function isRoadOnCurrentPath(src, dest) {
  if (currentPath.length < 2) return false;
  
  for (let i = 0; i < currentPath.length - 1; i++) {
    const u = currentPath[i];
    const v = currentPath[i + 1];
    if ((u === src && v === dest) || (u === dest && v === src)) {
      return true;
    }
  }
  return false;
}

// Handle Map marker clicks to toggle start / end nodes
function handleMarkerClick(nodeName) {
  if (!selectedSource || (selectedSource && selectedDestination)) {
    // Set start node
    selectedSource = nodeName;
    selectedDestination = "";
    clearRouteResults();
    
    // Sync resources subtab panel to the selected sector
    fetchSectorResources(selectedSource);
  } else {
    // Set end node
    if (selectedSource === nodeName) {
      alert("Source and Destination sectors must be different.");
      return;
    }
    selectedDestination = nodeName;
  }
  
  // Update select input displays
  document.getElementById('route-source').value = selectedSource;
  document.getElementById('route-dest').value = selectedDestination;
  
  // Redraw layers
  drawMapLayers();
  
  // Trigger pathfinding if both selected
  if (selectedSource && selectedDestination) {
    triggerRouteCalculation();
  }
}

// Handle submit form calculating route
window.calculateRoute = function(event) {
  event.preventDefault();
  selectedSource = document.getElementById('route-source').value;
  selectedDestination = document.getElementById('route-dest').value;
  triggerRouteCalculation();
};

// API Trigger pathfinding
async function triggerRouteCalculation() {
  if (!selectedSource || !selectedDestination) return;
  
  const blockedParam = Array.from(activeBlockages).join(',');
  const algo = document.getElementById('route-algo').value;
  const disaster = document.getElementById('route-disaster').value;
  const url = `/api/route?source=${selectedSource}&destination=${selectedDestination}&blocked=${blockedParam}&algo=${algo}&disaster=${disaster}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success') {
      animateSearchAndDraw(data);
    } else {
      currentPath = [];
      drawMapLayers();
      alert(data.message || "Failed to calculate a safe route.");
      document.getElementById('results-panel').style.display = 'none';
      document.getElementById('comparison-panel').style.display = 'none';
    }
  } catch (error) {
    console.error("Error calculating route:", error);
  }
}

// Fetch traversal visited order, flash animation, then draw final route line
async function animateSearchAndDraw(routeData) {
  const algo = document.getElementById('route-algo').value;
  const blockedParam = Array.from(activeBlockages).join(',');
  const disaster = document.getElementById('route-disaster').value;
  const url = `/api/traversal?algo=${algo}&source=${selectedSource}&destination=${selectedDestination}&blocked=${blockedParam}&disaster=${disaster}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success' && data.visited_order.length > 0) {
      traversalAnimationSequence = data.visited_order;
      traversalActiveVisitIndex = -1;
      currentPath = []; // hide path line during scan
      runSequentialScan(routeData);
    } else {
      // Fallback
      currentRouteHospitals = routeData.hospitals || [];
      currentRouteShelters = routeData.shelters || [];
      currentRouteTeams = routeData.teams || [];
      currentPath = routeData.path;
      drawMapLayers();
      displayRouteResults(routeData);
    }
  } catch (error) {
    currentRouteHospitals = routeData.hospitals || [];
    currentRouteShelters = routeData.shelters || [];
    currentRouteTeams = routeData.teams || [];
    currentPath = routeData.path;
    drawMapLayers();
    displayRouteResults(routeData);
  }
}

function runSequentialScan(routeData) {
  if (traversalActiveVisitIndex < traversalAnimationSequence.length - 1) {
    traversalActiveVisitIndex++;
    drawMapLayers();
    setTimeout(() => runSequentialScan(routeData), 120); // 120ms tick scanning animation
  } else {
    // Animation finished! Draw path and show details
    const lastTraversalSequence = [...traversalAnimationSequence];
    traversalAnimationSequence = [];
    traversalActiveVisitIndex = -1;
    currentRouteHospitals = routeData.hospitals || [];
    currentRouteShelters = routeData.shelters || [];
    currentRouteTeams = routeData.teams || [];
    currentPath = routeData.path;
    drawMapLayers();
    displayRouteResults(routeData, lastTraversalSequence);
  }
}

// Render route calculation results to Side Panel
function displayRouteResults(data, visitedSequence = []) {
  const panel = document.getElementById('results-panel');
  panel.style.display = 'block';

  // Set up disaster warning alert banner
  const disaster = document.getElementById('route-disaster').value;
  const alertBanner = document.getElementById('disaster-alert-banner');
  if (alertBanner) {
    if (disaster) {
      let disasterLabel = "";
      let blockedDesc = "";
      if (disaster === 'flood') {
        disasterLabel = "Flood Blockages Applied";
        blockedDesc = "Highways (Guwahati–Siliguri, Patna–Kolkata, Chennai–Vijayawada) are blocked due to flooding.";
      } else if (disaster === 'cyclone') {
        disasterLabel = "Cyclone Storm Warnings";
        blockedDesc = "Coastal routes (Visakhapatnam–Bhubaneswar, Chennai–Puducherry) are closed due to cyclone landfall.";
      } else if (disaster === 'landslide') {
        disasterLabel = "Landslide Debris Warning";
        blockedDesc = "Mountain highways (Shimla–Chandigarh, Jammu–Srinagar) are blocked by landslide debris.";
      } else if (disaster === 'earthquake') {
        disasterLabel = "Seismic Route Interruptions";
        blockedDesc = "Himalayan corridors (Jammu–Srinagar, Dehradun–Rishikesh) are shut down due to structural earthquake damage.";
      } else if (disaster === 'fire') {
        disasterLabel = "Forest Fire Risk Areas";
        blockedDesc = "Forest routes (Bengaluru–Mysuru, Nagpur–Bhopal) are blocked by active wildfires.";
      }

      document.getElementById('disaster-alert-title').innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${disasterLabel}`;
      document.getElementById('disaster-alert-message').textContent = `${blockedDesc} Alternative route calculated automatically.`;
      alertBanner.style.display = 'flex';
    } else {
      alertBanner.style.display = 'none';
    }
  }
  
  const activeAlgo = document.getElementById('route-algo').value;
  const algoDisplay = document.getElementById('route-algo-display');
  algoDisplay.textContent = activeAlgo.toUpperCase();
  algoDisplay.style.color = getAlgorithmColor(activeAlgo);
  
  document.getElementById('route-distance-display').textContent = `${data.total_distance.toFixed(1)} km`;
  
  // Est. time: approx 1.2 minutes per km + 3 minutes overhead per danger level index
  const estTime = Math.round(data.total_distance * 1.2 + (data.average_danger * 1.5));
  document.getElementById('route-time-display').textContent = `${estTime} mins`;
  
  const safetyEl = document.getElementById('route-danger-display');
  safetyEl.textContent = data.average_danger <= 1.5 ? "Low Hazard (Safe)" : 
                         (data.average_danger <= 3.0 ? "Medium Hazard (Caution)" : "Critical Hazard (Dangerous)");
  
  if (data.average_danger <= 1.5) safetyEl.style.color = 'var(--success)';
  else if (data.average_danger <= 3.0) safetyEl.style.color = 'var(--warning)';
  else safetyEl.style.color = 'var(--primary)';
  
  // Render path inline badges
  const stepsPath = document.getElementById('res-steps-path');
  stepsPath.innerHTML = '';
  
  data.path.forEach((node, idx) => {
    if (idx > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'path-arrow-divider';
      arrow.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
      stepsPath.appendChild(arrow);
    }
    const badge = document.createElement('span');
    badge.className = 'path-node-badge';
    badge.textContent = node;
    stepsPath.appendChild(badge);
  });

  // Render traversal sequence if available (Step 10: BFS/DFS Traversal)
  const travContainer = document.getElementById('traversal-order-container');
  const travPath = document.getElementById('res-traversal-path');
  
  if (visitedSequence && visitedSequence.length > 0 && (activeAlgo === 'bfs' || activeAlgo === 'dfs')) {
    travContainer.style.display = 'block';
    travPath.innerHTML = '';
    
    visitedSequence.forEach((node, idx) => {
      if (idx > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'path-arrow-divider';
        arrow.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
        travPath.appendChild(arrow);
      }
      const badge = document.createElement('span');
      badge.className = 'path-node-badge';
      badge.style.borderColor = 'var(--warning)';
      badge.style.boxShadow = '0 0 8px var(--warning-glow)';
      badge.textContent = node;
      travPath.appendChild(badge);
    });
  } else {
    travContainer.style.display = 'none';
  }
  
  // Performance indicators
  let complexityStr = "O(E log V)";
  if (activeAlgo === 'bfs' || activeAlgo === 'dfs') complexityStr = "O(V + E)";
  
  document.getElementById('perf-complexity').textContent = complexityStr;
  document.getElementById('perf-nodes').textContent = `${data.nodes_expanded} Nodes`;
  document.getElementById('perf-execution').textContent = `${data.execution_time_ms.toFixed(2)} ms`;
  
  // Render resources lists along path
  renderResourceList('hospitals', data.hospitals);
  renderResourceList('shelters', data.shelters);
  renderResourceList('teams', data.teams);

  // Trigger live comparisons
  triggerLiveComparisons();
}

// Query comparisons endpoint for side-by-side performance checks
async function triggerLiveComparisons() {
  if (!selectedSource || !selectedDestination) return;
  
  const blockedParam = Array.from(activeBlockages).join(',');
  const disaster = document.getElementById('route-disaster').value;
  const url = `/api/compare?source=${selectedSource}&destination=${selectedDestination}&blocked=${blockedParam}&disaster=${disaster}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success') {
      const compPanel = document.getElementById('comparison-panel');
      compPanel.style.display = 'block';
      
      const tbody = document.getElementById('comparison-table-rows');
      tbody.innerHTML = '';
      
      const activeAlgo = document.getElementById('route-algo').value;
      const names = {
        'dijkstra': 'Dijkstra',
        'astar': 'A*',
        'bfs': 'BFS (Hops)',
        'dfs': 'DFS (Depth)'
      };
      
      for (const algo in data.comparisons) {
        const item = data.comparisons[algo];
        if (!item.success) continue;
        
        const tr = document.createElement('tr');
        if (algo === activeAlgo) {
          tr.className = 'active-algo';
        }
        
        const estTime = Math.round(item.data.total_distance * 1.2 + (item.data.average_danger * 1.5));
        
        tr.innerHTML = `
          <td><strong style="color:${getAlgorithmColor(algo)}">${names[algo]}</strong></td>
          <td>${item.data.total_distance.toFixed(1)} km</td>
          <td>${estTime} mins</td>
          <td>${item.data.nodes_expanded} nodes</td>
        `;
        tbody.appendChild(tr);
      }
    }
  } catch (error) {
    console.error("Error fetching comparisons:", error);
  }
}

// Populate resource item logs in subtabs with clean badges & cards styling
function renderResourceList(type, list) {
  const container = document.getElementById(`res-list-${type}`);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!list || list.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding:1rem; font-size:0.8rem;">No resources found along path.</p>`;
    return;
  }
  
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'resource-item-card';
    
    if (type === 'hospitals') {
      const occPercent = Math.round((1 - (item.beds_available / item.capacity)) * 100);
      div.innerHTML = `
        <div class="resource-item-title">
          <span><i class="fa-solid fa-hospital text-blue" style="color:var(--info); margin-right:6px;"></i>${item.name}</span>
          <span class="badge" style="background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.2); color:var(--warning);">${item.sector}</span>
        </div>
        <div class="resource-item-meta">
          <span>Beds Available: <strong>${item.beds_available}</strong> / ${item.capacity}</span>
          <span>Occupancy: ${occPercent}%</span>
        </div>
        <div class="resource-contact">
          <i class="fa-solid fa-phone"></i> ${item.contact}
        </div>
      `;
    } else if (type === 'shelters') {
      const occPercent = Math.round((1 - (item.spaces_available / item.capacity)) * 100);
      div.innerHTML = `
        <div class="resource-item-title">
          <span><i class="fa-solid fa-tents" style="color:var(--warning); margin-right:6px;"></i>${item.name}</span>
          <span class="badge" style="background:rgba(6,182,212,0.1); border-color:rgba(6,182,212,0.2); color:var(--info);">${item.sector}</span>
        </div>
        <div class="resource-item-meta">
          <span>Spaces Available: <strong>${item.spaces_available}</strong> / ${item.capacity}</span>
          <span>Status: <strong style="color:var(--success)">${item.status}</strong> (${occPercent}% Full)</span>
        </div>
      `;
    } else if (type === 'teams') {
      div.innerHTML = `
        <div class="resource-item-title">
          <span><i class="fa-solid fa-truck-medical text-orange" style="color:var(--primary); margin-right:6px;"></i>${item.name}</span>
          <span class="badge" style="background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.2); color:var(--success);">${item.sector}</span>
        </div>
        <div class="resource-item-meta">
          <span>Specialty: <strong>${item.specialty}</strong></span>
          <span>Size: ${item.size} officers</span>
        </div>
        <div class="resource-contact">
          <i class="fa-solid fa-square-phone"></i> ${item.contact}
        </div>
      `;
    }
    
    container.appendChild(div);
  });
}

// Fetch resources for a specific sector and render them in the sidebar
async function fetchSectorResources(sectorName) {
  if (!sectorName) return;
  try {
    const response = await fetch(`/api/resources?sector=${sectorName}`);
    const data = await response.json();
    if (data.status === 'success') {
      renderResourceList('hospitals', data.hospitals);
      renderResourceList('shelters', data.shelters);
      renderResourceList('teams', data.teams);
    }
  } catch (error) {
    console.error("Error loading resources for sector:", error);
  }
}

// Handle Resource Subtabs
window.switchResourceTab = function(tabName) {
  currentResourceTab = tabName;
  document.querySelectorAll('.resource-tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.resource-list-content').forEach(cont => cont.classList.remove('active'));
  
  const activeBtn = Array.from(document.querySelectorAll('.resource-tab')).find(btn => btn.textContent.toLowerCase() === tabName);
  if (activeBtn) activeBtn.classList.add('active');
  
  document.getElementById(`res-list-${tabName}`).classList.add('active');
};

// Toggle light / dark commands console modes
window.toggleTheme = function() {
  const body = document.body;
  if (body.classList.contains('dark-theme')) {
    body.classList.remove('dark-theme');
    body.classList.add('light-theme');
    document.getElementById('theme-toggle-btn').innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    body.classList.remove('light-theme');
    body.classList.add('dark-theme');
    document.getElementById('theme-toggle-btn').innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
  // Force map layer redraw to apply theme tile filters correctly
  drawMapLayers();
};

// Visualizer layout switcher (OSM Map vs circular topology schematics)
window.setViewMode = function(mode) {
  if (currentViewMode === mode) return;
  currentViewMode = mode;
  
  const mapBtn = document.getElementById('view-map-btn');
  const graphBtn = document.getElementById('view-graph-btn');
  
  if (mode === 'map') {
    mapBtn.classList.add('active');
    graphBtn.classList.remove('active');
    tileLayer.addTo(map);
  } else {
    mapBtn.classList.remove('active');
    graphBtn.classList.add('active');
    map.removeLayer(tileLayer);
  }
  
  drawMapLayers();
};

// Popup modal management
window.openAboutModal = function() {
  document.getElementById('about-modal').style.display = 'flex';
};

window.closeAboutModal = function() {
  document.getElementById('about-modal').style.display = 'none';
};

// Fetch actual live weather data for New Delhi from Open-Meteo API
async function fetchLiveWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=temperature_2m,precipitation,weather_code,wind_speed_10m');
    const data = await res.json();
    if (data && data.current) {
      const temp = data.current.temperature_2m;
      const prec = data.current.precipitation;
      const wind = data.current.wind_speed_10m;
      
      let emergencyText = "";
      
      if (prec > 0) {
        emergencyText = `PRECIPITATION DETECTED (${prec}mm) | WATERLOGGING WATCH ACTIVE`;
      } else if (wind > 25) {
        emergencyText = `HIGH WINDS DETECTED (${wind} km/h) | GALE WARNING`;
      } else if (temp > 40) {
        emergencyText = `EXTREME HEAT DETECTED (${temp}°C) | THERMAL ALERT`;
      }
      
      const labelEl = document.querySelector('.status-label');
      const pulseEl = document.querySelector('.pulse-dot');
      
      if (emergencyText) {
        labelEl.textContent = `LIVE EMERGENCY: ${emergencyText}`;
        pulseEl.className = 'pulse-dot red';
        pulseEl.style.background = 'var(--primary)';
      } else {
        labelEl.textContent = `SYSTEM STABLE | NEW DELHI WEATHER: ${temp}°C | CLEAR CONDITIONS`;
        pulseEl.className = 'pulse-dot green';
        pulseEl.style.background = 'var(--success)';
      }
    }
  } catch (e) {
    console.error("Failed to fetch live weather", e);
  }
}

window.triggerRouteRecalculationIfPossible = function() {
  // Clear previous route details and lines immediately
  clearRouteResults();

  const disaster = document.getElementById('route-disaster').value;
  
  // Clear old blockages
  activeBlockages.clear();
  
  // Add predefined blockages for this disaster
  const blockList = predefinedBlockages[disaster] || [];
  blockList.forEach(key => activeBlockages.add(key));
  
  // Reload graph data, render the blockage checkboxes, redraw layers, and recalculate route
  loadGraphData().then(() => {
    if (selectedSource && selectedDestination) {
      triggerRouteCalculation();
    }
  });
};
