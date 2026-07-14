#include "data.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <algorithm>
#include <cctype>

std::vector<std::string> DataManager::split(const std::string& s, char delimiter) {
    std::vector<std::string> tokens;
    std::string token;
    std::istringstream tokenStream(s);
    while (std::getline(tokenStream, token, delimiter)) {
        tokens.push_back(token);
    }
    return tokens;
}

std::string DataManager::trim(const std::string& s) {
    auto wsfront = std::find_if_not(s.begin(), s.end(), [](unsigned char c) { return std::isspace(c); });
    auto wsback = std::find_if_not(s.rbegin(), s.rend(), [](unsigned char c) { return std::isspace(c); }).base();
    return (wsback <= wsfront ? std::string() : std::string(wsfront, wsback));
}

bool DataManager::loadRoads(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open roads file: " << filepath << std::endl;
        return false;
    }
    roads.clear();
    std::string line;
    std::getline(file, line); // header
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty()) continue;
        auto tokens = split(line, ',');
        if (tokens.size() >= 5) {
            Road road;
            road.source = trim(tokens[0]);
            road.destination = trim(tokens[1]);
            try {
                road.distance = std::stod(trim(tokens[2]));
                road.danger_level = std::stoi(trim(tokens[3]));
                road.blocked = (trim(tokens[4]) == "1");
                roads.push_back(road);
            } catch (...) {
                continue;
            }
        }
    }
    return true;
}

bool DataManager::loadHospitals(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open hospitals file: " << filepath << std::endl;
        return false;
    }
    hospitals.clear();
    std::string line;
    std::getline(file, line); // header
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty()) continue;
        auto tokens = split(line, ',');
        if (tokens.size() >= 5) {
            Hospital h;
            h.name = trim(tokens[0]);
            h.sector = trim(tokens[1]);
            try {
                h.capacity = std::stoi(trim(tokens[2]));
                h.beds_available = std::stoi(trim(tokens[3]));
                h.contact = trim(tokens[4]);
                hospitals.push_back(h);
            } catch (...) {
                continue;
            }
        }
    }
    return true;
}

bool DataManager::loadShelters(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open shelters file: " << filepath << std::endl;
        return false;
    }
    shelters.clear();
    std::string line;
    std::getline(file, line); // header
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty()) continue;
        auto tokens = split(line, ',');
        if (tokens.size() >= 5) {
            Shelter s;
            s.name = trim(tokens[0]);
            s.sector = trim(tokens[1]);
            try {
                s.capacity = std::stoi(trim(tokens[2]));
                s.spaces_available = std::stoi(trim(tokens[3]));
                s.status = trim(tokens[4]);
                shelters.push_back(s);
            } catch (...) {
                continue;
            }
        }
    }
    return true;
}

bool DataManager::loadTeams(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open teams file: " << filepath << std::endl;
        return false;
    }
    teams.clear();
    std::string line;
    std::getline(file, line); // header
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty()) continue;
        auto tokens = split(line, ',');
        if (tokens.size() >= 5) {
            RescueTeam t;
            t.name = trim(tokens[0]);
            t.sector = trim(tokens[1]);
            try {
                t.size = std::stoi(trim(tokens[2]));
                t.specialty = trim(tokens[3]);
                t.contact = trim(tokens[4]);
                teams.push_back(t);
            } catch (...) {
                continue;
            }
        }
    }
    return true;
}

bool DataManager::loadCoordinates(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open coordinates file: " << filepath << std::endl;
        return false;
    }
    coordinates.clear();
    std::string line;
    std::getline(file, line); // header
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty()) continue;
        auto tokens = split(line, ',');
        if (tokens.size() >= 3) {
            try {
                std::string nodeName = trim(tokens[0]);
                double lat = std::stod(trim(tokens[1]));
                double lon = std::stod(trim(tokens[2]));
                coordinates[nodeName] = {lat, lon};
            } catch (...) {
                continue;
            }
        }
    }
    return true;
}

