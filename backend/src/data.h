#ifndef DATA_H
#define DATA_H

#include <string>
#include <vector>
#include <unordered_map>

struct PlaceCoordinate {
    std::string node;
    double latitude;
    double longitude;
};

struct Road {
    std::string source;
    std::string destination;
    double distance;
    int danger_level;
    bool blocked;
};

struct Hospital {
    std::string name;
    std::string sector;
    int capacity;
    int beds_available;
    std::string contact;
};

struct Shelter {
    std::string name;
    std::string sector;
    int capacity;
    int spaces_available;
    std::string status;
};

struct RescueTeam {
    std::string name;
    std::string sector;
    int size;
    std::string specialty;
    std::string contact;
};

class DataManager {
public:
    std::vector<Road> roads;
    std::vector<Hospital> hospitals;
    std::vector<Shelter> shelters;
    std::vector<RescueTeam> teams;

    bool loadRoads(const std::string& filepath);
    bool loadHospitals(const std::string& filepath);
    bool loadShelters(const std::string& filepath);
    bool loadTeams(const std::string& filepath);
    bool loadCoordinates(const std::string& filepath);
    
    std::unordered_map<std::string, std::pair<double, double>> coordinates;
    
    static std::vector<std::string> split(const std::string& s, char delimiter);
    static std::string trim(const std::string& s);
};

#endif
