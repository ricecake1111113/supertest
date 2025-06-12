// Game Configuration
const config = {
    baseScorePerCity: 10,
    populationMultiplier: 0.001,
    initialZoom: 5,
    mapStyle: 'satellite',
    storageKey: 'canadaCityGuesserSave',
    citiesCSV: 'cities.csv',
    mapBounds: {
        minLon: -141,
        maxLon: -52,
        minLat: 41,
        maxLat: 84
    }
};

// Game State
let gameState = {
    guessedCities: [],
    totalPopulation: 0,
    score: 0
};

let markers = [];
let currentSort = 'added';
let markerSizeMode = 'fixed';
let fixedSize = 8;
let populationScale = 10;
let cities = [];
let map;

// Initialize Leaflet Map
function initMap() {
    map = L.map('map').setView([62, -95], config.initialZoom);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    }).addTo(map);
}

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

// Load cities from CSV
async function loadCitiesFromCSV() {
    try {
        const response = await fetch(config.citiesCSV);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvData = await response.text();
        const lines = csvData.split('\n');
        
        cities = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const [name, province, country, lat, lon, population, id] = line.split('\t');
            cities.push({
                id: parseInt(id.trim()),
                name: name.trim(),
                province: province.trim(),
                lat: parseFloat(lat.trim()),
                lon: parseFloat(lon.trim()),
                population: parseInt(population.trim())
            });
        }
        
        console.log(`Successfully loaded ${cities.length} cities`);
        return true;
    } catch (error) {
        console.error("Error loading cities:", error);
        showMessage("Failed to load city data. Please ensure cities.csv is available.", "error");
        return false;
    }
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

// Find city with flexible matching
function findCity(input) {
    const normalizedInput = input.toLowerCase().trim();
    const [cityPart, provincePart] = normalizedInput.split(/,|\s+/).map(s => s.trim());
    
    // Try exact match first
    let foundCity = cities.find(c => 
        c.name.toLowerCase() === normalizedInput ||
        `${c.name.toLowerCase()}, ${c.province.toLowerCase()}` === normalizedInput
    );
    
    // Try partial matches
    if (!foundCity) {
        foundCity = cities.find(c => 
            c.name.toLowerCase().includes(normalizedInput) ||
            normalizedInput.includes(c.name.toLowerCase()) ||
            (cityPart && c.name.toLowerCase().includes(cityPart) &&
             (!provincePart || c.province.toLowerCase().includes(provincePart)))
        );
    }
    
    return foundCity;
}

// Plot city on map
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

    marker.bindPopup(`<b>${city.name}, ${city.province}</b><br>Population: ${city.population.toLocaleString()}`);
    markers.push(marker);
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

// Update marker sizes
function updateAllMarkerSizes() {
    markers.forEach(marker => {
        const city = cities.find(c => c.id === marker.options.cityId);
        if (city) marker.setRadius(calculateMarkerSize(city.population));
    });
}

// Update marker size controls
function updateMarkerSizeControls() {
    if (elements.markerSizeSelect.value === 'fixed') {
        elements.fixedSizeSelect.style.display = 'block';
        elements.populationScaleDiv.style.display = 'none';
        markerSizeMode = 'fixed';
        fixedSize = parseInt(elements.fixedSizeSelect.value);
    } else {
        elements.fixedSizeSelect.style.display = 'none';
        elements.populationScaleDiv.style.display = 'flex';
        markerSizeMode = 'population';
        populationScale = parseInt(elements.populationSlider.value);
    }
    updateAllMarkerSizes();
}

// Handle city guess
function handleCityGuess() {
    const userInput = elements.cityInput.value.trim();
    if (!userInput) return;

    const foundCity = findCity(userInput);

    if (foundCity) {
        if (!gameState.guessedCities.includes(foundCity.id)) {
            gameState.guessedCities.push(foundCity.id);
            gameState.totalPopulation += foundCity.population;
            gameState.score += calculateScore(foundCity.population);
            plotCity(foundCity);
            updateStats();
            updateCityList();
            saveGameState();
            showMessage(`Correct! ${foundCity.name}, ${foundCity.province} added.`, 'success');
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

// Update stats
function updateStats() {
    elements.countDisplay.textContent = gameState.guessedCities.length;
    elements.populationDisplay.textContent = gameState.totalPopulation.toLocaleString();
    elements.scoreDisplay.textContent = gameState.score.toLocaleString();
}

// Show message
function showMessage(msg, type = 'info') {
    elements.messageDiv.textContent = msg;
    elements.messageDiv.style.color = type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db';
    setTimeout(() => elements.messageDiv.textContent = '', 3000);
}

// Update city list
function updateCityList() {
    elements.cityList.innerHTML = '';

    const guessedCityObjects = gameState.guessedCities.map(id => 
        cities.find(c => c.id === id)
    ).filter(c => c);

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
        case 'added':
        default:
            sortedCities = guessedCityObjects;
            break;
    }

    sortedCities.forEach(city => {
        const item = document.createElement('div');
        item.className = 'city-item';
        item.dataset.cityId = city.id;
        
        item.innerHTML = `
            <span>${city.name}, ${city.province}</span>
            <span class="city-population">${city.population.toLocaleString()}</span>
        `;
        
        item.addEventListener('click', () => highlightCity(city.id));
        elements.cityList.appendChild(item);
    });
}

// Highlight city
function highlightCity(cityId) {
    document.querySelectorAll('.city-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    markers.forEach(marker => {
        marker.setStyle({color: '#c0392b'});
    });

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
    elements.populationSlider.addEventListener('input', () => {
        populationScale = parseInt(elements.populationSlider.value);
        updateAllMarkerSizes();
    });
}

// Initialize game
async function initGame() {
    initMap(); // Initialize map first
    
    const loaded = await loadCitiesFromCSV();
    if (!loaded) return;
    
    setupEventListeners();
    updateMarkerSizeControls();
    loadGameState();
    updateCityList();
    
    // Enable input now that cities are loaded
    elements.cityInput.disabled = false;
    elements.cityInput.placeholder = "Type any Canadian city...";
}

// Start the game
initGame();