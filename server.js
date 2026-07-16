const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Helper to execute the C++ binary and return JSON
function runDisasterSystem(args, res) {
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'DisasterSystem.exe' : './DisasterSystem';
    const exePath = path.join(__dirname, binaryName);
    
    execFile(exePath, args, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.warn('C++ Execution Failed. Falling back to native JS engine. Error:', error.message);
            try {
                const { executeFallbackEngine } = require('./dsaEngine');
                const result = executeFallbackEngine(args);
                return res.json(result);
            } catch (fallbackError) {
                console.error('Fallback Engine Error:', fallbackError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Both C++ backend and JS fallback failed.',
                    details: fallbackError.message
                });
            }
        }
        
        try {
            const jsonOutput = JSON.parse(stdout);
            res.json(jsonOutput);
        } catch (parseError) {
            console.warn('JSON Parse Error for C++ output. Falling back to native JS engine. Stdout was:', stdout);
            try {
                const { executeFallbackEngine } = require('./dsaEngine');
                const result = executeFallbackEngine(args);
                return res.json(result);
            } catch (fallbackError) {
                return res.status(500).json({
                    status: 'error',
                    message: 'C++ parse failed and JS fallback failed.',
                    details: stdout
                });
            }
        }
    });
}

// 1. Get graph structure
app.get('/api/graph', (req, res) => {
    const blocked = req.query.blocked || '';
    const args = ['--graph'];
    if (blocked) {
        args.push('--block', blocked);
    }
    runDisasterSystem(args, res);
});

// 2. Calculate route
app.get('/api/route', (req, res) => {
    const { source, destination, blocked, algo, disaster } = req.query;
    if (!source || !destination) {
        return res.status(400).json({
            status: 'error',
            message: 'Source and destination query parameters are required.'
        });
    }
    
    const args = ['--route', source, destination];
    if (algo) {
        args.push('--algo', algo);
    }
    if (blocked) {
        args.push('--block', blocked);
    }
    if (disaster) {
        args.push('--disaster', disaster);
    }
    runDisasterSystem(args, res);
});

// 3. Traversal (BFS / DFS / Dijkstra / A*)
app.get('/api/traversal', (req, res) => {
    const { algo, source, blocked, destination, disaster } = req.query;
    if (!algo || !source) {
        return res.status(400).json({
            status: 'error',
            message: 'Algo and source query parameters are required.'
        });
    }
    
    const args = ['--traversal', algo, source];
    if (algo === 'astar') {
        if (!destination) {
            return res.status(400).json({
                status: 'error',
                message: 'A* traversal requires a destination parameters.'
            });
        }
        args.push(destination);
    }
    if (blocked) {
        args.push('--block', blocked);
    }
    if (disaster) {
        args.push('--disaster', disaster);
    }
    runDisasterSystem(args, res);
});

// 4. Get emergency resources
app.get('/api/resources', (req, res) => {
    const { sector } = req.query;
    if (!sector) {
        return res.status(400).json({
            status: 'error',
            message: 'Sector parameter is required.'
        });
    }
    runDisasterSystem(['--resources', sector], res);
});

// 4.1. Register a new resource (Hospital, Shelter, Team)
app.post('/api/resources', (req, res) => {
    const { type, name, sector, contact, capacity, beds_available, spaces_available, status, size, specialty } = req.body;
    
    if (!type || !name || !sector) {
        return res.status(400).json({
            status: 'error',
            message: 'Resource type, name, and sector are required.'
        });
    }

    // Sanitize values to prevent corrupting CSV layout (strip commas and newlines)
    const clean = (val) => String(val || '').replace(/,/g, ' ').replace(/\n/g, ' ').trim();
    
    const cleanName = clean(name);
    const cleanSector = clean(sector);
    const cleanContact = clean(contact);

    let csvLine = '';
    let filePath = '';

    if (type === 'hospitals') {
        const cleanCapacity = parseInt(capacity) || 100;
        const cleanBeds = beds_available !== undefined ? parseInt(beds_available) : cleanCapacity;
        csvLine = `\n${cleanName},${cleanSector},${cleanCapacity},${cleanBeds},${cleanContact}`;
        filePath = path.join(__dirname, 'data', 'hospitals.csv');
    } else if (type === 'shelters') {
        const cleanCapacity = parseInt(capacity) || 100;
        const cleanSpaces = spaces_available !== undefined ? parseInt(spaces_available) : cleanCapacity;
        const cleanStatus = clean(status || 'Active');
        csvLine = `\n${cleanName},${cleanSector},${cleanCapacity},${cleanSpaces},${cleanStatus}`;
        filePath = path.join(__dirname, 'data', 'shelters.csv');
    } else if (type === 'teams') {
        const cleanSize = parseInt(size || capacity) || 10;
        const cleanSpecialty = clean(specialty || 'General Rescue');
        csvLine = `\n${cleanName},${cleanSector},${cleanSize},${cleanSpecialty},${cleanContact}`;
        filePath = path.join(__dirname, 'data', 'teams.csv');
    } else {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid resource type. Supported: hospitals, shelters, teams.'
        });
    }

    fs.appendFile(filePath, csvLine, 'utf8', (err) => {
        if (err) {
            console.error(`Error appending to ${type} CSV:`, err);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to write resource to database.'
            });
        }
        res.json({
            status: 'success',
            message: `Resource registered successfully in ${type}.`
        });
    });
});

// 4.5. Compare all 4 routing algorithms side-by-side
app.get('/api/compare', async (req, res) => {
    const { source, destination, blocked, disaster } = req.query;
    if (!source || !destination) {
        return res.status(400).json({
            status: 'error',
            message: 'Source and destination query parameters are required.'
        });
    }

    const algos = ['dijkstra', 'astar', 'bfs', 'dfs'];
    const results = {};

    try {
        const promises = algos.map(algo => {
            return new Promise((resolve) => {
                const isWindows = process.platform === 'win32';
                const binaryName = isWindows ? 'DisasterSystem.exe' : './DisasterSystem';
                const exePath = path.join(__dirname, binaryName);
                const args = ['--route', source, destination, '--algo', algo];
                if (blocked) {
                    args.push('--block', blocked);
                }
                if (disaster) {
                    args.push('--disaster', disaster);
                }
                execFile(exePath, args, { cwd: __dirname }, (error, stdout, stderr) => {
                    if (error) {
                        try {
                            const { executeFallbackEngine } = require('./dsaEngine');
                            const result = executeFallbackEngine(args);
                            resolve(result.status === 'success' ? { success: true, data: result } : { success: false, error: result.message });
                        } catch (fallbackError) {
                            resolve({ success: false, error: error.message });
                        }
                    } else {
                        try {
                            const output = JSON.parse(stdout);
                            resolve({ success: true, data: output });
                        } catch (e) {
                            try {
                                const { executeFallbackEngine } = require('./dsaEngine');
                                const result = executeFallbackEngine(args);
                                resolve(result.status === 'success' ? { success: true, data: result } : { success: false, error: 'JSON parse error' });
                            } catch (fallbackError) {
                                resolve({ success: false, error: 'JSON parse error' });
                            }
                        }
                    }
                });
            });
        });

        const outputs = await Promise.all(promises);
        algos.forEach((algo, index) => {
            results[algo] = outputs[index];
        });

        res.json({
            status: 'success',
            comparisons: results
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
});

// 5. Get disaster dashboard stats
app.get('/api/disaster-stats', (req, res) => {
    const jsonPath = path.join(__dirname, 'data', 'disasterData.json');
    fs.readFile(jsonPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading disaster stats:', err);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to read disaster stats dataset.'
            });
        }
        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            res.status(500).json({
                status: 'error',
                message: 'Disaster stats file contains invalid JSON.'
            });
        }
    });
});

// 6. Download project ZIP (from parent folder)
app.get('/api/download/code', (req, res) => {
    const zipPath = path.join(__dirname, '..', 'Disaster_Rescue_System.zip');
    res.download(zipPath, 'Disaster_Rescue_System.zip', (err) => {
        if (err) {
            console.error('Error sending zip file:', err);
            res.status(500).json({ status: 'error', message: 'Failed to download project ZIP file.' });
        }
    });
});

// 7. Download project report (from parent folder)
app.get('/api/download/report', (req, res) => {
    const reportPath = path.join(__dirname, '..', 'project_report.md');
    res.download(reportPath, 'Disaster_Response_Project_Report.md', (err) => {
        if (err) {
            console.error('Error sending report file:', err);
            res.status(500).json({ status: 'error', message: 'Failed to download project report.' });
        }
    });
});

// Serve frontend application index
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Disaster Rescue Navigation Server is running!`);
    console.log(` Port: ${PORT}`);
    console.log(` Web Portal: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
