// Game Configuration
const config = {
    baseScorePerCity: 10,
    populationMultiplier: 0.001,
    initialZoom: 5,
    storageKey: 'canadaCityGuesserSave',
    provinceColors: {
        'AB': '#e6194b', 'BC': '#3cb44b', 'MB': '#ffe119',
        'NB': '#4363d8', 'NL': '#f58231', 'NT': '#911eb4',
        'NS': '#46f0f0', 'NU': '#f032e6', 'ON': '#bcf60c',
        'PE': '#fabebe', 'QC': '#008080', 'SK': '#e6beff',
        'YT': '#9a6324'
    },
    canadaBounds: [[41.7, -141.0], [83.1, -52.6]]
};

// Game State
let gameState = {
    guessedCities: [],
    totalPopulation: 0,
    score: 0,
    mapMode: 'street'
};

let markers = [];
let currentSort = 'added';
let markerSizeMode = 'fixed';
let fixedSize = 8;
let populationScale = 10;
let cities = [];
let map;
let baseLayers = {};

// DOM Elements
const elements = {
    cityInput: document.getElementById('city-input'),
    countDisplay: document.getElementById('count'),
    populationDisplay: document.getElementById('population'),
    scoreDisplay: document.getElementById('score'),
    messageDiv: document.getElementById('message'),
    resetBtn: document.getElementById('reset-btn'),
    markerSizeSelect: document.getElementById('marker-size'),
    fixedSizeSelect: document.getElementById('fixed-size'),
    populationScaleDiv: document.getElementById('population-scale'),
    populationSlider: document.getElementById('population-slider'),
    cityList: document.getElementById('city-list'),
    sortAlpha: document.getElementById('sort-alpha'),
    sortPopulation: document.getElementById('sort-population'),
    sortProvince: document.getElementById('sort-province'),
    sortAdded: document.getElementById('sort-added')
};

// Initialize Leaflet Map
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        maxBounds: config.canadaBounds,
        maxBoundsViscosity: 1.0
    }).setView([62, -95], config.initialZoom);

    // Define base layers (both without labels)
    baseLayers = {
        "Street Map": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            noWrap: true
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
            noWrap: true
        })
    };

    // Add default layer
    baseLayers["Street Map"].addTo(map);

    // Add zoom control
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Add layer control
    L.control.layers(baseLayers, null, {
        position: 'topright'
    }).addTo(map);
}

// Show message function
function showMessage(msg, type = 'info') {
    elements.messageDiv.textContent = msg;
    elements.messageDiv.className = `message ${type}`;
    setTimeout(() => {
        elements.messageDiv.textContent = '';
        elements.messageDiv.className = 'message';
    }, 3000);
}

// Parse TSV data
function parseTSV(tsvData) {
    const lines = tsvData.split('\n');
    const cities = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        
        const parts = trimmedLine.split('\t');
        if (parts.length !== 7) continue;

        try {
            cities.push({
                id: parseInt(parts[6].trim()),
                name: parts[0].trim(),
                province: parts[1].trim(),
                lat: parseFloat(parts[3].trim()),
                lon: parseFloat(parts[4].trim()),
                population: parseInt(parts[5].trim())
            });
        } catch (error) {
            console.warn('Error parsing city:', error);
        }
    }
    return cities;
}

// Load cities from TSV
async function loadCities() {
    try {
        const response = await fetch('cities.tsv');
        if (!response.ok) throw new Error('Failed to load city data');
        const tsvData = await response.text();
        cities = parseTSV(tsvData);
        return cities.length > 0;
    } catch (error) {
        console.error('Error loading cities:', error);
        showMessage("Failed to load city data", 'error');
        return false;
    }
}

// Plot city on map
function plotCity(city) {
    const radius = calculateMarkerSize(city.population);
    const provinceColor = config.provinceColors[city.province] || '#e74c3c';
    
    const marker = L.circleMarker([city.lat, city.lon], {
        radius: radius,
        fillColor: provinceColor,
        color: '#333',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        cityId: city.id
    }).addTo(map);

    marker.bindPopup(`<b>${city.name}, ${city.province}</b><br>Population: ${city.population.toLocaleString()}`);
    markers.push(marker);
    return marker;
}

// Calculate marker size
function calculateMarkerSize(population) {
    if (markerSizeMode === 'population') {
        const minSize = 3;
        const maxSize = 20;
        const minPop = 100;
        const maxPop = 3000000;
        const scale = Math.log10(population / minPop) / Math.log10(maxPop / minPop);
        return minSize + (maxSize - minSize) * Math.min(Math.max(scale, 0), 1) * (populationScale / 10);
    }
    return fixedSize;
}

// Update all marker sizes
function updateAllMarkerSizes() {
    markers.forEach(marker => {
        const city = cities.find(c => c.id === marker.options.cityId);
        if (city) marker.setRadius(calculateMarkerSize(city.population));
    });
}

// Update marker size controls visibility
function updateMarkerSizeControls() {
    markerSizeMode = elements.markerSizeSelect.value;
    
    if (markerSizeMode === 'fixed') {
        elements.fixedSizeSelect.style.display = 'inline-block';
        elements.populationScaleDiv.style.display = 'none';
        fixedSize = parseInt(elements.fixedSizeSelect.value);
    } else {
        elements.fixedSizeSelect.style.display = 'none';
        elements.populationScaleDiv.style.display = 'flex';
        populationScale = parseInt(elements.populationSlider.value);
    }
    updateAllMarkerSizes();
}

// Strict city matching that requires exact names
function findCity(input) {
    const normalizedInput = input.trim().toLowerCase();
    const [cityPart, provincePart] = normalizedInput.split(/,|\s+/).map(s => s.trim());
    
    // Try different matching patterns
    for (const city of cities) {
        const cityNameLower = city.name.toLowerCase();
        const provinceLower = city.province.toLowerCase();
        
        // 1. Exact match of city name only
        if (cityNameLower === normalizedInput) return city;
        
        // 2. Exact match with province
        if (provincePart && `${cityNameLower}, ${provinceLower}` === normalizedInput) {
            return city;
        }
        
        // 3. Match when user includes province (looser matching)
        if (provincePart && cityNameLower.includes(cityPart) && provinceLower.includes(provincePart)) {
            return city;
        }
    }
    return null;
}

// Normalize strings by removing accents/diacritics
function normalizeString(str) {
    return str.normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Remove accents
              .replace(/\s+/g, ' ').trim();    // Normalize spaces
}

// Handle city guess
function handleCityGuess() {
    const userInput = elements.cityInput.value.trim();
    if (!userInput) return;

    const foundCity = findCity(userInput);

    if (foundCity) {
        if (!gameState.guessedCities.includes(foundCity.id)) {
            gameState.guessedCities.unshift(foundCity.id);
            gameState.totalPopulation += foundCity.population;
            gameState.score += calculateScore(foundCity.population);
            plotCity(foundCity);
            updateStats();
            updateCityList();
            saveGameState();
            showMessage(`Correct! ${foundCity.name}, ${foundCity.province} added.`, 'success');
            highlightCity(foundCity.id);
            elements.cityList.scrollTop = 0;
        } else {
            showMessage(`${foundCity.name} was already guessed!`, 'error');
        }
    } else {
        showMessage("City not found! Try including province (e.g., 'Toronto, Ontario')", 'error');
    }
    elements.cityInput.value = '';
}

// Calculate score
function calculateScore(population) {
    return Math.floor(config.baseScorePerCity + (population * config.populationMultiplier));
}

// Save game state
function saveGameState() {
    localStorage.setItem(config.storageKey, JSON.stringify(gameState));
}

// Load game state
function loadGameState() {
    const savedState = localStorage.getItem(config.storageKey);
    if (savedState) {
        gameState = JSON.parse(savedState);
        gameState.guessedCities.forEach(cityId => {
            const city = cities.find(c => c.id === cityId);
            if (city) plotCity(city);
        });
        updateStats();
    }
}

// Update stats
function updateStats() {
    elements.countDisplay.textContent = gameState.guessedCities.length;
    elements.populationDisplay.textContent = gameState.totalPopulation.toLocaleString();
    elements.scoreDisplay.textContent = gameState.score.toLocaleString();
}

// Remove city from game
function removeCity(cityId) {
    const cityIndex = gameState.guessedCities.indexOf(cityId);
    if (cityIndex !== -1) {
        // Remove from guessed cities
        gameState.guessedCities.splice(cityIndex, 1);
        
        // Remove marker from map
        const markerIndex = markers.findIndex(m => m.options.cityId === cityId);
        if (markerIndex !== -1) {
            map.removeLayer(markers[markerIndex]);
            markers.splice(markerIndex, 1);
        }
        
        // Update population and score
        const city = cities.find(c => c.id === cityId);
        if (city) {
            gameState.totalPopulation -= city.population;
            gameState.score -= calculateScore(city.population);
        }
        
        // Save and update
        saveGameState();
        updateStats();
        updateCityList();
    }
}

function updateCityList() {
    elements.cityList.innerHTML = '';

    const guessedCityObjects = gameState.guessedCities.map(id => 
        cities.find(c => c.id === id)
    ).filter(c => c);

    // Define sortedCities before using it
    let sortedCities;
    switch(currentSort) {
        case 'alpha':
            sortedCities = [...guessedCityObjects].sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'population':
            sortedCities = [...guessedCityObjects].sort((a, b) => b.population - a.population);
            break;
        case 'province':
            sortedCities = [...guessedCityObjects].sort((a, b) => 
                a.province.localeCompare(b.province) || a.name.localeCompare(b.name));
            break;
        default: // 'added'
            sortedCities = guessedCityObjects;
            break;
    }

    sortedCities.forEach((city, index) => {
        const item = document.createElement('div');
        item.className = 'city-item';
        if (currentSort === 'added' && index === 0) {
            item.classList.add('highlighted');
        }

        item.innerHTML = `
            <span class="city-name">${city.name}, ${city.province}</span>
            <span class="city-population">${city.population.toLocaleString()}</span>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-city';
        removeBtn.innerHTML = '<img src="https://static.thenounproject.com/png/390423-200.png" alt="Remove">';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCity(city.id);
        });
        
        item.appendChild(removeBtn);
        item.addEventListener('click', () => highlightCity(city.id));
        elements.cityList.appendChild(item);
    });
}

// Highlight city on map and list
function highlightCity(cityId) {
    // Remove highlights from all items
    document.querySelectorAll('.city-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    
    // Reset all markers to default color
    markers.forEach(marker => {
        const city = cities.find(c => c.id === marker.options.cityId);
        const provinceColor = city ? config.provinceColors[city.province] || '#e74c3c' : '#e74c3c';
        marker.setStyle({color: '#333', fillColor: provinceColor});
    });

    // Highlight list item
    const cityItem = document.querySelector(`.city-item[data-city-id="${cityId}"]`);
    if (cityItem) {
        cityItem.classList.add('highlighted');
        cityItem.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }

    // Highlight marker and center map
    const marker = markers.find(m => m.options.cityId === cityId);
    if (marker) {
        marker.setStyle({color: '#ffeb3b', weight: 3});
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 10));
        marker.openPopup();
    }
}

// Reset game
function resetGame() {
    if (confirm("Are you sure you want to reset all progress?")) {
        gameState = { guessedCities: [], totalPopulation: 0, score: 0 };
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        saveGameState();
        updateStats();
        updateCityList();
        showMessage("Game progress has been reset", "success");
    }
}

// Setup event listeners
function setupEventListeners() {
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCityGuess();
    });

    elements.resetBtn.addEventListener('click', resetGame);

    elements.sortAlpha.addEventListener('click', () => {
        currentSort = 'alpha';
        updateCityList();
    });
    
    elements.sortPopulation.addEventListener('click', () => {
        currentSort = 'population';
        updateCityList();
    });
    
    elements.sortProvince.addEventListener('click', () => {
        currentSort = 'province';
        updateCityList();
    });
    
    elements.sortAdded.addEventListener('click', () => {
        currentSort = 'added';
        updateCityList();
    });

    elements.markerSizeSelect.addEventListener('change', updateMarkerSizeControls);
    elements.fixedSizeSelect.addEventListener('change', updateMarkerSizeControls);
    elements.populationSlider.addEventListener('input', updateMarkerSizeControls);
}

// Initialize game
async function initGame() {
    initMap();
    
    // Show loading state
    elements.cityInput.disabled = true;
    elements.cityInput.placeholder = "Loading cities...";
    showMessage("Loading city data...", "info");
    
    // Load cities
    const success = await loadCities();
    if (!success) {
        elements.cityInput.placeholder = "City data failed to load";
        return;
    }
    
    // Initialize game
    setupEventListeners();
    updateMarkerSizeControls();
    loadGameState();
    updateCityList();
    
    // Enable input
    elements.cityInput.disabled = false;
    elements.cityInput.placeholder = "Type any Canadian city...";
    elements.cityInput.focus();
    showMessage("Game ready! Start guessing cities.", "success");
}

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);