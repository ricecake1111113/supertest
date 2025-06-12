// Game Configuration
const config = {
    baseScorePerCity: 10,
    populationMultiplier: 0.001,
    initialZoom: 7
};

// Game State
let guessedCities = [];
let totalPopulation = 0;
let score = 0;

// Initialize Leaflet Map
const map = L.map('map').setView([44.5, -63.5], config.initialZoom);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// DOM Elements
const cityInput = document.getElementById('city-input');
const countDisplay = document.getElementById('count');
const populationDisplay = document.getElementById('population');
const scoreDisplay = document.getElementById('score');
const messageDiv = document.getElementById('message');
const csvFileInput = document.getElementById('csv-file');
const importCsvBtn = document.getElementById('import-csv');

// Sample Nova Scotia Cities Data (fallback if CSV not loaded)
let cities = [
    { name: "Halifax", lat: 44.65107, lon: -63.582687, population: 348634 },
    { name: "Sydney", lat: 46.136389, lon: -60.195556, population: 30960 },
    // ... Add other cities from your list
];

// Initialize Game
function initGame() {
    updateStats();
    setupEventListeners();
}

// Plot a city on the map
function plotCity(city) {
    const marker = L.circleMarker([city.lat, city.lon], {
        radius: 6,
        fillColor: "#e74c3c",
        color: "#c0392b",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(`<b>${city.name}</b><br>Population: ${city.population.toLocaleString()}`);

    // Center map on the new city
    map.setView([city.lat, city.lon], map.getZoom());
}

// Update game statistics
function updateStats() {
    countDisplay.textContent = guessedCities.length;
    populationDisplay.textContent = totalPopulation.toLocaleString();
    scoreDisplay.textContent = score.toLocaleString();
}

// Show temporary message
function showMessage(msg, type = 'info') {
    messageDiv.textContent = msg;
    messageDiv.className = type; // 'info', 'error', 'success'
    setTimeout(() => messageDiv.textContent = '', 3000);
}

// Calculate score based on population
function calculateScore(population) {
    return Math.floor(config.baseScorePerCity + (population * config.populationMultiplier));
}

// Handle city guessing
function handleCityGuess() {
    const cityName = cityInput.value.trim();
    if (!cityName) return;

    const foundCity = cities.find(c => 
        c.name.toLowerCase() === cityName.toLowerCase()
    );

    if (foundCity) {
        if (!guessedCities.includes(foundCity.name)) {
            guessedCities.push(foundCity.name);
            totalPopulation += foundCity.population;
            score += calculateScore(foundCity.population);
            plotCity(foundCity);
            updateStats();
            showMessage(`Correct! ${foundCity.name} added.`, 'success');
        } else {
            showMessage(`${foundCity.name} was already guessed!`, 'error');
        }
    } else {
        showMessage("City not found in Nova Scotia!", 'error');
    }
    cityInput.value = '';
}

// Import cities from CSV
function importCitiesFromCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        const lines = csvData.split('\n');
        cities = [];
        
        lines.slice(1).forEach(line => {
            if (!line.trim()) return;
            const [name, province, country, lat, lon, population, id] = line.split('\t');
            cities.push({
                name: name.trim(),
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                population: parseInt(population)
            });
        });
        
        showMessage(`Loaded ${cities.length} cities from CSV`, 'success');
    };
    reader.readAsText(file);
}

// Set up event listeners
function setupEventListeners() {
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCityGuess();
    });

    importCsvBtn.addEventListener('click', () => {
        csvFileInput.click();
    });

    csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            importCitiesFromCSV(e.target.files[0]);
        }
    });
}

// Start the game
initGame();