"use strict";
// API Base URL
const API_URL = "https://media2.edu.metropolia.fi/restaurant/api/v1";

//1. DOM Element Selection

//Directory Controls
const searchInput = document.querySelector("#restaurant-search");
const citySelect = document.querySelector("#city-filter");
const sortSelect = document.querySelector("#sort-order");
const restaurantCount = document.querySelector("restaurant-count");

// Directory Panel States & Container
const restaurantList = document.querySelector("#restaurant-list");
const loadingMessage = document.querySelector("loading-message");
const errorMessage = document.querySelector("#error-message");
const emptyMessage = document.querySelector("empty-message");

// Menu Panel Elements
const menuPlaceholder = document.querySelector("#menu-placeholder");
const selectedRestaurantBox = document.querySelector("#selected-restaurant");
const selectedName = document.querySelector("#selected-name");
const selectedAddress = document.querySelector("selected-address");

// Menu Controls & States
const dailyTab = document.querySelector("#daily-tab");
const weeklyTab = document.querySelector("#weekly-tab");
const menuLoading = document.querySelector("#menu-loading");
const menuError = document.querySelector("#menu-error");
const menuContent = document.querySelector("menu-content");

// 2. Application State Variables

let restaurants = []; // All raw restaurants fetched from API
let activeRestaurant = null; // currently selected restaurant object
let activeMenuType = "daily"; // 'daily' | 'weekly'
let map = null; //Leaflet map instance
let mapMarkers = []; // Active Leaflet markers array

// Dafault map center (Helsinki, Finland)
const DEFAULT_COORDS = [60.1699, 24.9384];
const DEFAULT_ZOOM = 11;

// 3. Reusable API Fetch Helper Function

async function fetchData(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new console.error(
      `HTTP: error: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

// 4 Leaflet map Initialization in the #map continer & controls
function initMap() {
  const mapElement = document.querySelector("#map");

  if (!mapElement || typeof L === "undefined") return;

  // Create Leaflet map Centered at Helsinki
  map = L.map("map").setView(DEFAULT_COORDS, DEFAULT_ZOOM);

  // Add openStreetMap tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

//Updates Leaflet markers baased on the currently displayed restaurants

function updateMapMarkers(displayedRestaurants) {
  if (!map) return;
  // Clear existing markers from the map
  mapMarkers.forEach((marker) => map.removeLayer(marker));
  mapMarkers = [];

  const bounds = [];
  displayedRestaurants.forEach((restaurant) => {
    // Check if restaurant has location coordinates
    const coords = restaurant.location?.coordinates;
    if (!coords || coords.length < 2) return;

    // Metropolia Api GeoJSON format: [longitude, latitude] ->Leaflet uses [Latitude, longitude]
    const lat = coords[1];
    const lng = coords[0];
    //skip invalid coordinates
    if (isNaN(lat) || isNaN(lng) || lat === 0) return;
    const latLng = [lat, lng];
    bounds.push(latLng);
    // Create marker
    const marker = L.marker(latLng).addTo(map);

    // popup content
    const popupCotent = `<div style ="font-family",sans-serif;">
    <strong style ="font-size: 13px; color: #287a55;">${restaurant.name}</strong><br>
    <small style = "color: #666;">${restaurant.address || ""}, ${restaurant.city || ""}</small>
    </div>
    `;
    marker.bindPopup(popupCotent);
    // Click marker -> select restaurant in UI
    marker.on("click", () => {
      selectedRestaurant(restaurant);
    });
    mapMarkers.push(marker);
  });

  // Fit map view to visible markers if any exist
  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

// 5. Restaurant Renderimg & Filter Logic
function filterAndRenderRestaurants() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCity = citySelect.value;
  const sortOrder = sortSelect.value;

  // 1. Filter by search term (Name or City)
  let filtered = restaurants.filter((r) => {
    const nameMatch = r.name?.toLowerCase().includes(searchTerm);
    const cityMatch = r.city?.toLowerCase().includes(searchTerm);
    return nameMatch || cityMatch;
  });

  // 2. Filter by City dropdown
  if (selectedCity !== "all") {
    filtered = filtered.filter((r) => r.city === selectedCity);
  }

  // 3. Sort A-Z or Z-A
  filtered.sort((a, b) => {
    const nameA = a.name || "";
    const nameB = b.name || "";
    return sortOrder === "name-asc"
      ? nameA.localeCompare(nameB, "fi")
      : nameB.localeCompare(nameA, "fi");
  });

  // 4. update result count label
  restaurantCount.textContent = `${filtered.length} restaurant${filtered.length === 1 ? "" : "s"} found`;

  // 5. Toggle empty message
  if (filtered.length === 0) {
    emptyMessage.hidden = false;
  } else {
    emptyMessage.hidden = true;
  }
  // 6. Render cards to DOM
  renderRestaurantCards(filtered);

  // 7. Update Leaflet markers
  updateMapMarkers(filtered);
}

function renderRestaurantCards(list) {
  restaurantList.textContent = "";
  list.forEach((restaurant) => {
    const card = document.createElement("div");
    card.className = "restaurant-card";
    // Highlight active card
    if (activeRestaurant && activeRestaurant.id === restaurant.id) {
      card.classList.add("active");
    }
    // Symbol Icon
    const symbol = document.createElement("div");
    symbol.className = "restaurant-symbol";
    symbol.textContent = "🍴";
    // Text copy
    const copy = document.createElement("div");
    copy.className = "restaurant-card-copy";
    const nameSpan = document.createElement("span");
    nameSpan.className = "restaurant-card-name";
    nameSpan.textContent = restaurant.name;
    const addressSpan = document.createElement("span");
    addressSpan.className = "restaurant-card-address";
    addressSpan.textContent = `${restaurant.address || ""}${restaurant.city ? ", " + restaurant.city : ""}`;
    copy.appendChild(nameSpan);
    copy.appendChild(addressSpan);
    // Arrow icon
    const arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.textContent = "→";
    card.append(symbol);
    card.append(copy);
    card.appendChild(arrow);
    // Click event (event listener)
    card.addEventListener("click", () => {
      selectRestaurant(restaurant);
    });
    restaurantList.appendChild(card);
  });
}
// Populates the city dropdown with unique city options
function populateCityFilter() {
  const cities = [
    ...new Set(
      restaurants.map((r) => r.city?.trim()).filter((city) => Boolean(city)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fi"));

  // Clear existing options except except "All cities"
  citySelect.textContent = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "all";
  defaultOption.textContent = "All cities";
  citySelect.appendChild(defaultOption);

  cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    citySelect.appendChild(option);
  });
}
//------------------------------------
// 6 Selection & Menu Fetching
//------------------------------------
/**
 * Handles restaurant card/marker selection
 * @param {Object} restaurant - Selected restaurant data
 */

function selectRestaurant(restaurant) {
  activeRestaurant = restaurant;

  // Highlight selected card in UI list
  document.querySelectorAll(".restaurant-card").forEach((card) => {
    card.classList.remove("active");
  });
  // Re-render list to ensure highlight state is synchronized
  renderRestaurantCards(
    restaurants.filter((r) => {
      const term = searchInput.value.trim().toLowerCase();
      const city = citySelect.value;
      const matchesSearch =
        r.name?.toLowerCase().includes(term) ||
        r.city?.toLowerCase().includes(term);
      const matchesCity = city === "all" || r.city == city;
      return matchesSearch && matchesCity;
    }),
  );
  // Show selected panel, hide placeholder
  menuPlaceholder.hidden = true;
  selectedRestaurantBox.hidden = false;

  // Populate basic indormation

  selectedName.textContent = restaurant.name;
  selectedAddress.textContent = `${restaurant.address || ""}, ${restaurant.postalCode || ""} ${restaurant.city || ""}`;

  // center map on selected restaurant if coordinates exist
if (map && restaurant.location?.coordinates){
  const coords = restaurant.location.coordinates;
  if(coords[1] && coords[0]){
    map.setView([coords[1],coords[0]],15);
  }
}


}
