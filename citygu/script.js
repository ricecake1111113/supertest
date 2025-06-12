// Game Configuration
const config = {
    baseScorePerCity: 10,
    populationMultiplier: 0.001,
    initialZoom: 7,
    mapStyle: 'satellite' // 'satellite' or 'streets'
};

// Game State
let guessedCities = [];
let totalPopulation = 0;
let score = 0;
let markers = [];
let currentSort = 'added';
let markerSizeMode = 'fixed';
let fixedSize = 8;
let populationScale = 10;

// Initialize Leaflet Map
const map = L.map('map').setView([44.5, -63.5], config.initialZoom);

// Map Layers
const baseLayers = {
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    }),
    'Streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    })
};

baseLayers[config.mapStyle === 'satellite' ? 'Satellite' : 'Streets'].addTo(map);

// DOM Elements
const cityInput = document.getElementById('city-input');
const countDisplay = document.getElementById('count');
const populationDisplay = document.getElementById('population');
const scoreDisplay = document.getElementById('score');
const messageDiv = document.getElementById('message');
const csvFileInput = document.getElementById('csv-file');
const importCsvBtn = document.getElementById('import-csv');
const markerSizeSelect = document.getElementById('marker-size');
const fixedSizeSelect = document.getElementById('fixed-size');
const populationScaleDiv = document.getElementById('population-scale');
const populationSlider = document.getElementById('population-slider');

// Sample Nova Scotia Cities Data
let cities = [
    { id: 11, name: "Halifax", lat: 44.65107, lon: -63.582687, population: 348634 },
    { id: 38, name: "Sydney", lat: 46.136389, lon: -60.195556, population: 30960 },
    // ... Add all other cities from your CSV
];

// Initialize Game
function initGame() {
    updateStats();
    setupEventListeners();
    updateMarkerSizeControls();
}

// Plot a city on the map
function plotCity(city) {
    const radius = calculateMarkerSize(city.population);
    
    const marker = L.circleMarker([city.lat, city.lon], {
        radius: radius,
        fillColor: "#e74c3c",
        color: "#c0392b",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        cityId: city.id
    }).addTo(map);

    marker.bindPopup(`<b>${city.name}</b><br>Population: ${city.population.toLocaleString()}`);
    markers.push(marker);
    updateCityList();
}

function calculateMarkerSize(population) {
    if (markerSizeMode === 'population') {
        // Logarithmic scale to handle large population differences
        const minSize = 3;
        const maxSize = 20;
        const minPop = 100;
        const maxPop = 500000;
        
        const scale = Math.log10(population / minPop) / Math.log10(maxPop / minPop);
        return minSize + (maxSize - minSize) * Math.min(Math.max(scale, 0), 1) * (populationScale / 10);
    } else {
        return fixedSize;
    }
}

function updateAllMarkerSizes() {
    markers.forEach(marker => {
        const city = cities.find(c => c.id === marker.options.cityId);
        if (city) {
            marker.setRadius(calculateMarkerSize(city.population));
        }
    });
}

function updateMarkerSizeControls() {
    if (markerSizeSelect.value === 'fixed') {
        fixedSizeSelect.style.display = 'block';
        populationScaleDiv.style.display = 'none';
        markerSizeMode = 'fixed';
        fixedSize = parseInt(fixedSizeSelect.value);
    } else {
        fixedSizeSelect.style.display = 'none';
        populationScaleDiv.style.display = 'flex';
        markerSizeMode = 'population';
        populationScale = parseInt(populationSlider.value);
    }
    updateAllMarkerSizes();
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
    messageDiv.className = type;
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
        if (!guessedCities.some(c => c.id === foundCity.id)) {
            guessedCities.push({
                id: foundCity.id,
                name: foundCity.name,
                population: foundCity.population
            });
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
                id: parseInt(id),
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

// Update city list
function updateCityList() {
    const cityList = document.getElementById('city-list');
    cityList.innerHTML = '';

    // Sort cities
    const sortedCities = [...guessedCities];
    switch(currentSort) {
        case 'alpha':
            sortedCities.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'population':
            sortedCities.sort((a, b) => b.population - a.population);
            break;
        case 'added':
        default:
            // Already in added order
            break;
    }

    sortedCities.forEach(city => {
        const item = document.createElement('div');
        item.className = 'city-item';
        item.dataset.cityId = city.id;
        
        item.innerHTML = `
            <span>${city.name}</span>
            <span class="city-population">${city.population.toLocaleString()}</span>
        `;
        
        item.addEventListener('click', () => highlightCity(city.id));
        cityList.appendChild(item);
    });
}

// Highlight city on map
function highlightCity(cityId) {
    // Remove all highlights
    document.querySelectorAll('.city-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    markers.forEach(marker => {
        marker.setStyle({color: '#c0392b'});
    });

    // Find and highlight the selected city
    const cityItem = document.querySelector(`.city-item[data-city-id="${cityId}"]`);
    if (cityItem) {
        cityItem.classList.add('highlighted');
        cityItem.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }

    const marker = markers.find(m => m.options.cityId === cityId);
    if (marker) {
        marker.setStyle({color: '#ffeb3b'});
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 10));
        marker.openPopup();
    }
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

    document.getElementById('sort-alpha').addEventListener('click', () => {
        currentSort = 'alpha';
        updateCityList();
    });
    
    document.getElementById('sort-population').addEventListener('click', () => {
        currentSort = 'population';
        updateCityList();
    });
    
    document.getElementById('sort-added').addEventListener('click', () => {
        currentSort = 'added';
        updateCityList();
    });

    markerSizeSelect.addEventListener('change', updateMarkerSizeControls);
    fixedSizeSelect.addEventListener('change', updateMarkerSizeControls);
    populationSlider.addEventListener('input', () => {
        populationScale = parseInt(populationSlider.value);
        updateAllMarkerSizes();
    });
}

// Start the game
initGame();