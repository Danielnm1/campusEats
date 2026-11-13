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
const selectedRestaurant = document.querySelector("#selected-restaurant");
const selectedName = document.querySelector("#selected-name");
const SelectedAddress = document.querySelector("selected-address");

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
