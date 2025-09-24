// ==== Globals ====
let cityData = [];
let guessedCities = [];
let currentProvinceFilter = "ANY PROVINCE";
let sortBy = "name";
let sortDirection = 1;
let markerSize = 5;
let markerColor = "#ff0000";
let useRainbow = false;
let map;
let markers = [];
let cityCount = 0;
const achievements = [
  { count: 50, emoji: "🥉", name: "Bronze", desc: "Enter 50 cities" },
  { count: 100, emoji: "🥈", name: "Silver", desc: "Enter 100 cities" },
  { count: 250, emoji: "🥇", name: "Gold", desc: "Enter 250 cities" },
  { count: 500, emoji: "🏆", name: "Platinum", desc: "Enter 500 cities" }
];
let darkMode = false;

// ==== Utility functions ====

// Normalize city names to ignore accents, apostrophes, dashes, spaces, case
function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/['’\- ]/g, "");        // Remove apostrophes, dashes, spaces
}

// Return tier letter based on population size
function getTier(pop) {
  if (pop > 100000) return "C";
  if (pop > 25000) return "B";
  if (pop > 5000) return "A";
  if (pop > 1000) return "S";
  return "S+";
}

// Tier score for sorting or points
function tierScore(tier) {
  return { "C": 1, "B": 2, "A": 3, "S": 4, "S+": 5 }[tier] || 1;
}

// Color for each tier
function tierColor(tier) {
  switch(tier) {
    case "C": return "#9E9E9E";       // Gray
    case "B": return "#4CAF50";       // Green
    case "A": return "#2196F3";       // Blue
    case "S": return "#FFC107";       // Amber
    case "S+": return "#E91E63";      // Pink
    default: return "#000";
  }
}

// ==== Data loading ====
function loadCityData(tsv) {
  const lines = tsv.trim().split("\n").slice(1);
  cityData = lines.map(line => {
    const [name, lat, lon, pop, province] = line.split("\t");
    const population = parseInt(pop, 10);
    return {
      name,
      lat: +lat,
      lon: +lon,
      pop: population,
      province,
      tier: getTier(population),
      normName: normalize(name)
    };
  });
  populateProvinceDropdown();
}

// ==== UI Population ====

function populateProvinceDropdown() {
  const select = document.getElementById("provinceSelect");
  const provinces = Array.from(new Set(cityData.map(c => c.province))).sort();
  select.innerHTML = `<option>ANY PROVINCE</option>` + provinces.map(p => `<option>${p}</option>`).join("");
}

// ==== Map ====

function initMap() {
  map = L.map("map").setView([45.2, -63.3], 7);
  addTileLayer();
}

function addTileLayer() {
  const url = darkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  L.tileLayer(url, {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

// Remove all markers from map
function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

// Add city marker to map
function addMarker(city) {
  const color = useRainbow
    ? `hsl(${Math.random() * 360}, 100%, 50%)`
    : markerColor;
  const marker = L.circleMarker([city.lat, city.lon], {
    radius: markerSize,
    color: color,
    fillColor: color,
    fillOpacity: 0.7,
  }).addTo(map);
  marker.bindTooltip(`${city.name}, ${city.province}`);
  markers.push(marker);
}

// ==== City guessing logic ====

function guessCity() {
  const input = document.getElementById("cityInput").value.trim();
  if (!input) return;
  const normInput = normalize(input);

  // Find all cities matching input name (normalized) with province filter
  let matches = cityData.filter(c => c.normName === normInput);
  if (currentProvinceFilter !== "ANY PROVINCE") {
    matches = matches.filter(c => c.province === currentProvinceFilter);
  }

  if (matches.length === 0) {
    alert("City not found or doesn't match the selected province.");
    return;
  }

  // Add all matching cities if not already guessed
  matches.forEach(city => {
    if (!guessedCities.find(g => g.name === city.name && g.province === city.province)) {
      guessedCities.push(city);
      cityCount++;
      addMarker(city);
    }
  });

  updateCityList();
  updateAchievements();
  document.getElementById("cityInput").value = "";
}

// ==== City List ====

function updateCityList() {
  // Sort by current sortBy and sortDirection
  guessedCities.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    // For tier, sort by tier score instead of string
    if (sortBy === "tier") {
      aVal = tierScore(a.tier);
      bVal = tierScore(b.tier);
    }
    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    if (aVal > bVal) return 1 * sortDirection;
    if (aVal < bVal) return -1 * sortDirection;
    return 0;
  });

  // Build list HTML
  const container = document.getElementById("cityList");
  container.innerHTML = `
    <div class="city-list-header">
      <div class="sortable" onclick="toggleSort('name')">City</div>
      <div class="sortable" onclick="toggleSort('province')">Province</div>
      <div class="sortable" onclick="toggleSort('pop')">Population</div>
      <div>Score</div>
      <div>Tier</div>
    </div>
    ${guessedCities.map(city => `
      <div class="city-list-item">
        <div class="city-name">${city.name}</div>
        <div class="city-province">${city.province}</div>
        <div class="city-population">${city.pop.toLocaleString()}</div>
        <div class="city-score">${tierScore(city.tier)}</div>
        <div class="city-tier" style="color: ${tierColor(city.tier)}">${city.tier}</div>
      </div>
    `).join('')}
  `;
}

// Toggle sorting column and direction
function toggleSort(column) {
  if (sortBy === column) {
    sortDirection *= -1;
  } else {
    sortBy = column;
    sortDirection = 1;
  }
  updateCityList();
}

// ==== Achievements ====

function updateAchievements() {
  const container = document.getElementById("achievementPanel");
  container.innerHTML = achievements.map(a => {
    const unlocked = cityCount >= a.count;
    return `<span 
      class="achievement-icon ${unlocked ? "unlocked" : "locked"}" 
      title="${a.name}: ${a.desc}">
      ${a.emoji}
    </span>`;
  }).join("");
}

// ==== Autocomplete on near complete city name ====

function handleAutocomplete(e) {
  const input = e.target.value.trim();
  const normInput = normalize(input);
  if (normInput.length < 2) return; // Require at least 2 chars
  // Find city whose normalized name starts with normInput and length = input length + 1
  const match = cityData.find(city => city.normName.startsWith(normInput) && city.normName.length === normInput.length + 1);
  if (match) {
    e.target.value = match.name;
  }
}

// ==== UI event handlers ====

function updateMarkerSize(e) {
  markerSize = +e.target.value;
  // Rebuild markers with new size
  clearMarkers();
  guessedCities.forEach(addMarker);
}

function selectMarkerColor(color) {
  if (color === "rainbow") {
    useRainbow = true;
  } else {
    useRainbow = false;
    markerColor = color;
  }
  document.querySelectorAll(".marker-color-circle").forEach(c => c.classList.remove("selected-marker-color"));
  const selected = document.querySelector(`.marker-color-circle[data-color="${color}"]`);
  if (selected) selected.classList.add("selected-marker-color");

  clearMarkers();
  guessedCities.forEach(addMarker);
}

function toggleDarkMode() {
  darkMode = !darkMode;
  document.body.classList.toggle("dark-mode", darkMode);
  map.remove();
  initMap();
  guessedCities.forEach(addMarker);
}

// ==== Setup ====

function setup() {
  initMap();

  // Load city data from TSV file named "cities.tsv"
  fetch("cities.tsv")
    .then(res => res.text())
    .then(loadCityData)
    .catch(() => alert("Failed to load city data."));

  // Event bindings
  document.getElementById("guessBtn").onclick = guessCity;
  document.getElementById("cityInput").addEventListener("input", handleAutocomplete);
  document.getElementById("provinceSelect").onchange = e => {
    currentProvinceFilter = e.target.value;
  };
  document.getElementById("markerSize").oninput = updateMarkerSize;
  document.getElementById("darkToggle").onclick = toggleDarkMode;

  document.querySelectorAll(".marker-color-circle").forEach(circle => {
    circle.onclick = () => selectMarkerColor(circle.dataset.color);
  });

  // Select default marker color
  selectMarkerColor("#ff0000");
  updateAchievements();
}

window.onload = setup;
