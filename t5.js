"use strict";
// API Base URL
const API_URL = "https://media2.edu.metropolia.fi/restaurant/api/v1";

//1. DOM Element Selection

//Directory Controls
const searchInput = document.querySelector("#restaurant-search");
const citySelect = document.querySelector("#city-filter");
const sortSelect = document.querySelector("#sort-order");
const restaurantCount = document.querySelector("#restaurant-count");

// Directory Panel States & Container
const restaurantList = document.querySelector("#restaurant-list");
const loadingMessage = document.querySelector("#loading-message");
const errorMessage = document.querySelector("#error-message");
const emptyMessage = document.querySelector("#empty-message");

// Menu Panel Elements
const menuPlaceholder = document.querySelector("#menu-placeholder");
const selectedRestaurantBox = document.querySelector("#selected-restaurant");
const selectedName = document.querySelector("#selected-name");
const selectedAddress = document.querySelector("#selected-address");
const selectedFavBtn = document.querySelector("#selected-fav-btn");
// Menu Controls & States
const dailyTab = document.querySelector("#daily-tab");
const weeklyTab = document.querySelector("#weekly-tab");
const menuLoading = document.querySelector("#menu-loading");
const menuError = document.querySelector("#menu-error");
const menuContent = document.querySelector("#menu-content");

// Auth & Header User Controls
const openAuthBtn = document.querySelector("#open-auth-btn");
const userProfileBtn = document.querySelector("#user-profile-btn");
const navAvatar = document.querySelector("#nav-avatar");
const navAvatarFallback = document.querySelector("#nav-avatar-fallback");
const navUsername = document.querySelector("#nav-username");

// Auth Modal & Forms
const authModal = document.querySelector("#auth-modal");
const closeAuthBtn = document.querySelector("#close-auth-btn");
const loginModeTab = document.querySelector("#login-mode-tab");
const registerModeTab = document.querySelector("#register-mode-tab");
const authMessage = document.querySelector("#auth-message");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");

const profileModal = document.getElementById("profile-modal");
const closeProfileBtn = document.getElementById("close-profile-btn");
const profileMessage = document.getElementById("profile-message");
const profileAvatarImg = document.getElementById("profile-avatar-img");
const profileAvatarFallback = document.getElementById(
  "profile-avatar-fallback",
);
const profileDisplayUsername = document.getElementById(
  "profile-display-username",
);
const profileDisplayEmail = document.getElementById("profile-display-email");
const avatarForm = document.getElementById("avatar-form");
const avatarFileInput = document.getElementById("avatar-file");
const logoutBtn = document.getElementById("logout-btn");
const profileUpdateForm = document.getElementById("profile-update-form");
const editProfileModal = document.getElementById("edit-profile-modal");
const openEditProfileBtn = document.getElementById("open-edit-profile-btn");
const closeEditProfileBtn = document.getElementById("close-edit-profile-btn");
const editProfileMessage = document.getElementById("edit-profile-message");
const editUsernameInput = document.getElementById("edit-username");
const editEmailInput = document.getElementById("edit-email");
const editPasswordInput = document.getElementById("edit-password");

// 2. Application State Variables

let restaurants = []; // All raw restaurants fetched from API
let activeRestaurant = null; // currently selected restaurant object
let activeMenuType = "daily"; // 'daily' | 'weekly'
let map = null; //Leaflet map instance
let mapMarkers = []; // Active Leaflet markers array

let userCoords = null;
let userMarker = null;

const findNearestBtn = document.getElementById("find-nearest-btn");
const geoStatus = document.getElementById("geo-status");

// Base URL for uploaded user profile pictures on Metropolia server
const UPLOADS_URL = "https://media2.edu.metropolia.fi/restaurant/uploads";

let currentUser = null; // Logged-in user object from API
let authToken = localStorage.getItem("token") || null; // Saved JWT token

// Dafault map center (Helsinki, Finland)
const DEFAULT_COORDS = [60.1699, 24.9384];
const DEFAULT_ZOOM = 11;

// 3. Reusable API Fetch Helper Function

async function fetchData(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `HTTP error: ${response.status} ${response.statusText}`,
    );
  }
  return data;
}
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (typeof L === "undefined") return Infinity;
  return L.latLng(lat1, lon1).distanceTo(L.latLng(lat2, lon2)) / 1000;
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
    const distanceLine =
      typeof restaurant.distanceKm === "number"
        ? `<br><small class="map-popup-address">${restaurant.distanceKm.toFixed(1)} km away</small>`
        : "";

    // Popup content
    const popupContent = `
      <div class="map-popup">
        <strong class="map-popup-title">${restaurant.name}</strong>
        <small class="map-popup-address">${restaurant.address || ""}, ${restaurant.city || ""}</small>
        ${distanceLine}
        </div>
    `;
    marker.bindPopup(popupContent);

    // Click marker -> select restaurant in UI
    marker.on("click", () => {
      selectRestaurant(restaurant);
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

  // 3. Sort: Favorite restaurant first, then A-Z or Z-A

  const favId = currentUser?.favouriteRestaurant;
  filtered.sort((a, b) => {
    if (sortOrder === "nearest" && userCoords) {
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    }

    if (favId) {
      if (a._id === favId && b._id !== favId) return -1;
      if (b._id === favId && a._id !== favId) return 1;
    }
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
    card.dataset.id = restaurant._id;
    // Highlight active card
    if (activeRestaurant && activeRestaurant._id === restaurant._id) {
      card.classList.add("active");
    }
    // Highlight favorite card
    const isFavorite = currentUser?.favouriteRestaurant === restaurant._id;
    if (isFavorite) {
      card.classList.add("is-favorite-card");
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
    if (
      typeof restaurant.distanceKm === "number" &&
      isFinite(restaurant.distanceKm)
    ) {
      const distBadge = document.createElement("span");
      distBadge.className = "distance-badge";
      distBadge.textContent = `${restaurant.distanceKm.toFixed(1)} km away`;
      copy.appendChild(distBadge);
    }
    // Favorite Star Button
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = `fav-btn${isFavorite ? " is-favorite" : ""}`;
    favBtn.textContent = isFavorite ? "★" : "☆";
    favBtn.setAttribute(
      "aria-label",
      isFavorite ? "Remove from favorites" : "Set as favorite restaurant",
    );
    favBtn.title = isFavorite ? "Your favorite restaurant" : "Set as favorite";

    favBtn.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevents selecting the card when clicking the star
      toggleFavoriteRestaurant(restaurant._id);
    });

    // Arrow icon
    const arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.textContent = "→";
    card.append(symbol);
    card.append(copy);
    card.append(favBtn);
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

function handleFindNearest() {
  if (!("geolocation" in navigator)) {
    geoStatus.textContent = "Geolocation is not supported by your browser.";
    geoStatus.className = "geo-status error";
    geoStatus.hidden = false;
    return;
  }

  findNearestBtn.disabled = true;
  geoStatus.textContent = "Locating you...";
  geoStatus.className = "geo-status";
  geoStatus.hidden = false;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      userCoords = { lat: latitude, lon: longitude };

      let closestRestaurant = null;

      restaurants.forEach((restaurant) => {
        const coords = restaurant.location?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const [restLon, restLat] = coords;
          if (!isNaN(restLat) && !isNaN(restLon) && restLat !== 0) {
            restaurant.distanceKm = calculateDistanceKm(
              latitude,
              longitude,
              restLat,
              restLon,
            );
            if (
              !closestRestaurant ||
              restaurant.distanceKm < closestRestaurant.distanceKm
            ) {
              closestRestaurant = restaurant;
            }
          }
        }
      });

      const nearestOption = sortSelect.querySelector('option[value="nearest"]');
      if (nearestOption) nearestOption.disabled = false;
      sortSelect.value = "nearest";

      citySelect.value = "all";
      searchInput.value = "";

      filterAndRenderRestaurants();

      if (map && typeof L !== "undefined") {
        if (userMarker) userMarker.remove();
        const userIcon = L.divIcon({
          className: "user-location-pin",
          html: '<span class="user-dot" aria-hidden="true"></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        userMarker = L.marker([latitude, longitude], { icon: userIcon })
          .addTo(map)
          .bindPopup("<strong>You are here</strong>");
      }

      if (closestRestaurant) {
        geoStatus.textContent = `Nearest: ${closestRestaurant.name} (${closestRestaurant.distanceKm.toFixed(1)} km away)`;
        selectRestaurant(closestRestaurant);
      }

      findNearestBtn.disabled = false;
    },
    (err) => {
      const messages = {
        1: "Location permission denied. Enable location access to find nearby restaurants.",
        2: "Unable to determine your location right now.",
        3: "Location request timed out. Please try again.",
      };
      geoStatus.textContent =
        messages[err.code] || "Could not determine your location.";
      geoStatus.className = "geo-status error";
      findNearestBtn.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
  );
}

//------------------------------------
// 6 Selection & Menu Fetching
//------------------------------------
function updateSelectedFavButton(restaurant) {
  if (!selectedFavBtn || !restaurant) return;
  const isFavorite = currentUser?.favouriteRestaurant === restaurant._id;
  selectedFavBtn.hidden = false;
  selectedFavBtn.textContent = isFavorite ? "★ Favorite" : "☆ Set Favorite";
  selectedFavBtn.classList.toggle("is-favorite", isFavorite);
}

/**
 * Handles restaurant card/marker selection
 * @param {Object} restaurant - Selected restaurant data
 */

function selectRestaurant(restaurant) {
  activeRestaurant = restaurant;

  // Highlight selected card in UI list
  document.querySelectorAll(".restaurant-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === restaurant._id);
  });

  // Show selected panel, hide placeholder
  menuPlaceholder.hidden = true;
  selectedRestaurantBox.hidden = false;

  // Populate basic indormation

  selectedName.textContent = restaurant.name;
  selectedAddress.textContent = `${restaurant.address || ""}, ${restaurant.postalCode || ""} ${restaurant.city || ""}`;
  updateSelectedFavButton(restaurant);
  // center map on selected restaurant if coordinates exist
  if (map && restaurant.location?.coordinates) {
    const coords = restaurant.location.coordinates;
    if (coords[1] && coords[0]) {
      map.setView([coords[1], coords[0]], 15);
    }
  }
  // Load menu for selected restaurant
  loadMenu();
}
/**
 * Fetches and displays daily or weekly menu for the active restaurant
 */

async function loadMenu() {
  if (!activeRestaurant) return;

  menuContent.textContent = "";
  menuError.textContent = "";
  menuError.hidden = true;
  menuLoading.hidden = false;
  menuLoading.textContent = `Loading ${activeMenuType} menu...`;

  try {
    const restaurantId = activeRestaurant._id;
    if (!restaurantId) {
      throw new Error("Selected restaurant has no valid _id.");
    }

    // Endpoints: /restaurants/daily/:id/en OR /restaurants/weekly/:id/en

    const menuEndpoint = `${API_URL}/restaurants/${activeMenuType}/${encodeURIComponent(restaurantId)}/en`;
    const menuData = await fetchData(menuEndpoint);
    menuLoading.hidden = true;
    displayMenuData(menuData);
  } catch (error) {
    menuLoading.hidden = true;
    menuError.hidden = false;
    menuError.textContent = `Could not load ${activeMenuType} menu: ${error.message}`;
    console.error("Menu load error:", error);
  }
}
/**
 * Renders daily or weekly menu courses inside #menu-content
 * @param {Object} menuData - Daily or weekly menu payload from Metropolia API
 */

function displayMenuData(menuData) {
  menuContent.textContent = "";
  // ------------------------------
  // A. Daily Menu Display Logic
  // ------------------------------

  if (activeMenuType === "daily") {
    const courses = menuData.courses;

    if (!Array.isArray(courses) || courses.length === 0) {
      menuContent.textContent = "No menu information available for today.";
      return;
    }
    courses.forEach((course) => {
      const courseCard = document.createElement("div");
      courseCard.className = "menu-course";
      const title = document.createElement("h5");
      title.textContent = course.name ?? "Unnamed course";
      const price = document.createElement("p");
      price.className = "course-price";
      price.textContent = `Price: ${course.price ?? "Student price"}`;
      const diets = document.createElement("p");
      diets.textContent = `Diets: ${course.diets ?? "N/A"}`;

      courseCard.appendChild(title);
      courseCard.appendChild(price);
      courseCard.appendChild(diets);

      menuContent.appendChild(courseCard);
    });
    // ------------------------------
    // B. Weekly Menu Display Logic
    // ------------------------------
  } else if (activeMenuType === "weekly") {
    const days = menuData.days;
    if (!Array.isArray(days) || days.length === 0) {
      menuContent.textContent = "No weekly menu information available.";
      return;
    }
    days.forEach((day) => {
      const dayBox = document.createElement("div");
      dayBox.className = "weekly-day-group";
      const dayHeading = document.createElement("h4");
      dayHeading.className = "weekly-day-heading";

      dayHeading.textContent = day.date || day.day || "day";

      dayBox.appendChild(dayHeading);
      if (!Array.isArray(day.courses) || day.courses.length === 0) {
        const noCourse = document.createElement("p");
        noCourse.className = "weekly-empty-day";
        noCourse.textContent = "No courses served on this day.";
        dayBox.appendChild(noCourse);
      } else {
        day.courses.forEach((course) => {
          const courseCard = document.createElement("div");
          courseCard.className = "menu-course weekly-course";

          const title = document.createElement("h5");
          title.textContent = course.name ?? "Unnamed course";

          const price = document.createElement("p");
          price.className = "course-price";
          price.textContent = `Price: ${course.price ?? "Student price"}`;
          const diets = document.createElement("p");
          diets.textContent = `Diets: ${course.diets ?? "N/A"}`;

          courseCard.append(title, price, diets);

          dayBox.appendChild(courseCard);
        });
      }

      menuContent.appendChild(dayBox);
    });
  }
}

// ----------------------------------------
// 7. Core Initialization & Event Listeners
// ----------------------------------------

/**
 * Loads master restaurant list on startup
 */
async function initApp() {
  loadingMessage.hidden = false;
  errorMessage.hidden = true;

  // Initialize Map
  initMap();
  try {
    const data = await fetchData(`${API_URL}/restaurants`);

    // Flexible data extraction
    if (Array.isArray(data)) {
      restaurants = data;
    } else if (Array.isArray(data.restaurants)) {
      restaurants = data.restaurants;
    } else if (Array.isArray(data.data)) {
      restaurants = data.data;
    } else {
      throw new Error("Invalid restaurant response format.");
    }
    loadingMessage.hidden = true;

    // Restore logged-in user if token exists
    await checkSavedSession();

    // Build city dropdown options & render initial state
    populateCityFilter();
    filterAndRenderRestaurants();
  } catch (error) {
    loadingMessage.hidden = true;
    errorMessage.hidden = false;
    errorMessage.textContent = `Could not load restaurants: ${error.message}`;
    console.error("App init error:", error);
  }
}
// Event Listeners for filters

searchInput.addEventListener("input", filterAndRenderRestaurants);
citySelect.addEventListener("change", filterAndRenderRestaurants);
if (findNearestBtn) {
  findNearestBtn.addEventListener("click", handleFindNearest);
}
sortSelect.addEventListener("change", filterAndRenderRestaurants);
selectedFavBtn.addEventListener("click", () => {
  if (activeRestaurant) {
    toggleFavoriteRestaurant(activeRestaurant._id);
  }
});

// Daily / weekly Tab Handlers

dailyTab.addEventListener("click", () => {
  if (activeMenuType === "daily") return;

  activeMenuType = "daily";
  dailyTab.classList.add("active");
  dailyTab.setAttribute("aria-pressed", "true");

  weeklyTab.classList.remove("active");
  weeklyTab.setAttribute("aria-pressed", "false");

  loadMenu();
});

weeklyTab.addEventListener("click", () => {
  if (activeMenuType === "weekly") return;

  activeMenuType = "weekly";
  weeklyTab.classList.add("active");
  weeklyTab.setAttribute("aria-pressed", "true");

  dailyTab.classList.remove("active");
  dailyTab.setAttribute("aria-pressed", "false");

  loadMenu();
});

// ----------------------------------------
// 8. Authentication & User Session
// ----------------------------------------

/**
 * Displays a feedback message inside the auth modal
 * @param {string} message - Text to show
 * @param {boolean} isError - True for red error, false for green success
 */
function showAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.hidden = false;
  authMessage.className = isError
    ? "status-message error-message"
    : "status-message success-message";
}

function clearAuthMessage() {
  authMessage.textContent = "";
  authMessage.hidden = true;
}

/**
 * Switches modal between 'login' and 'register' forms
 * @param {'login' | 'register'} mode
 */
function switchAuthMode(mode) {
  clearAuthMessage();
  const isLogin = mode === "login";

  loginModeTab.classList.toggle("active", isLogin);
  loginModeTab.setAttribute("aria-pressed", String(isLogin));

  registerModeTab.classList.toggle("active", !isLogin);
  registerModeTab.setAttribute("aria-pressed", String(!isLogin));

  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
}

/**
 * Updates top navigation bar based on whether currentUser is logged in
 */
function updateAuthUI() {
  if (currentUser) {
    openAuthBtn.hidden = true;
    userProfileBtn.hidden = false;
    navUsername.textContent = currentUser.username;

    if (currentUser.avatar) {
      navAvatar.src = `${UPLOADS_URL}/${currentUser.avatar}`;
      navAvatar.alt = `${currentUser.username}'s avatar`;
      navAvatar.hidden = false;
      navAvatarFallback.hidden = true;
    } else {
      navAvatar.hidden = true;
      navAvatarFallback.hidden = false;
      navAvatarFallback.textContent = currentUser.username
        .charAt(0)
        .toUpperCase();
    }
  } else {
    openAuthBtn.hidden = false;
    userProfileBtn.hidden = true;
    navAvatar.hidden = true;
    navAvatar.removeAttribute("src");
    navAvatarFallback.hidden = false;
  }
}
/**
 * Restores user session on page load if a JWT token is saved in localStorage
 */
async function checkSavedSession() {
  if (!authToken) return;

  try {
    const userData = await fetchData(`${API_URL}/users/token`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    currentUser = userData;
    updateAuthUI();
  } catch (error) {
    // Token expired or invalid -> clear stored session
    console.warn("Saved session invalid:", error.message);
    localStorage.removeItem("token");
    authToken = null;
    currentUser = null;
    updateAuthUI();
  }
}

/**
 * Handles new user registration via POST /users
 */
async function handleRegister(event) {
  event.preventDefault();
  clearAuthMessage();

  const username = registerForm.username.value.trim();
  const email = registerForm.email.value.trim();
  const password = registerForm.password.value;

  try {
    await fetchData(`${API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password }),
    });

    registerForm.reset();
    switchAuthMode("login");
    loginForm.username.value = username;
    showAuthMessage("Account created! Please log in.", false);
  } catch (error) {
    // Handle Metropolia server's outgoing SMTP mail error (535) gracefully
    if (error.message.includes("535")) {
      registerForm.reset();
      switchAuthMode("login");
      loginForm.username.value = username;
      showAuthMessage(
        "Account registered (confirmation email skipped by server). Please log in!",
        false,
      );
      return;
    }
    showAuthMessage(error.message, true);
  }
}

/**
 * Handles user login via POST /auth/login and stores JWT token
 */
async function handleLogin(event) {
  event.preventDefault();
  clearAuthMessage();

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;

  try {
    const result = await fetchData(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    authToken = result.token;
    currentUser = result.data;
    localStorage.setItem("token", authToken);

    loginForm.reset();
    updateAuthUI();
    filterAndRenderRestaurants();
    if (activeRestaurant) {
      updateSelectedFavButton(activeRestaurant);
    }
    authModal.close();
  } catch (error) {
    showAuthMessage(error.message, true);
  }
}

function openProfileModal() {
  if (!currentUser) return;

  profileMessage.hidden = true;
  profileDisplayUsername.textContent = currentUser.username;
  profileDisplayEmail.textContent = currentUser.email || "";

  if (currentUser.avatar) {
    profileAvatarImg.src = `${UPLOADS_URL}/${currentUser.avatar}`;
    profileAvatarImg.hidden = false;
    profileAvatarFallback.hidden = true;
  } else {
    profileAvatarImg.hidden = true;
    profileAvatarFallback.hidden = false;
    profileAvatarFallback.textContent = currentUser.username
      .charAt(0)
      .toUpperCase();
  }

  profileModal.showModal();
}

async function handleAvatarUpload(event) {
  event.preventDefault();
  if (!authToken || !avatarFileInput.files[0]) return;

  const formData = new FormData();
  formData.append("avatar", avatarFileInput.files[0]);

  try {
    const result = await fetchData(`${API_URL}/users/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    currentUser = result.data;
    updateAuthUI();
    openProfileModal();
    avatarForm.reset();

    profileMessage.textContent = "Profile picture updated!";
    profileMessage.className = "status-message success-message";
    profileMessage.hidden = false;
  } catch (error) {
    profileMessage.textContent = error.message;
    profileMessage.className = "status-message error-message";
    profileMessage.hidden = false;
  }
}

function openEditProfileModal() {
  if (!currentUser) return;
  editProfileMessage.hidden = true;
  editUsernameInput.value = currentUser.username || "";
  editEmailInput.value = currentUser.email || "";
  editPasswordInput.value = "";
  editProfileModal.showModal();
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  if (!authToken || !currentUser) return;

  const payload = {
    username: editUsernameInput.value.trim(),
    email: editEmailInput.value.trim(),
  };

  const newPassword = editPasswordInput.value.trim();
  if (newPassword) {
    payload.password = newPassword;
  }

  try {
    const result = await fetchData(`${API_URL}/users`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    currentUser = result.data || { ...currentUser, ...payload };
    updateAuthUI();
    editProfileModal.close();
    openProfileModal();

    profileMessage.textContent = "Account details updated!";
    profileMessage.className = "status-message success-message";
    profileMessage.hidden = false;
  } catch (error) {
    editProfileMessage.textContent = error.message;
    editProfileMessage.className = "status-message error-message";
    editProfileMessage.hidden = false;
  }
}

/**
 * Logs out the current user and clears localStorage token
 */
function logoutUser() {
  localStorage.removeItem("token");
  authToken = null;
  currentUser = null;
  updateAuthUI();
  filterAndRenderRestaurants();
  if (activeRestaurant) {
    updateSelectedFavButton(activeRestaurant);
  }
}
/**
 * Sets or toggles the logged-in user's favouriteRestaurant via PUT /users
 * @param {string} restaurantId - The _id of the restaurant to favorite
 */
async function toggleFavoriteRestaurant(restaurantId) {
  if (!currentUser || !authToken) {
    switchAuthMode("login");
    authModal.showModal();
    return;
  }

  const isAlreadyFavorite = currentUser.favouriteRestaurant === restaurantId;
  const newFavoriteId = isAlreadyFavorite ? "" : restaurantId;

  try {
    const result = await fetchData(`${API_URL}/users`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ favouriteRestaurant: newFavoriteId }),
    });

    currentUser = result.data || {
      ...currentUser,
      favouriteRestaurant: newFavoriteId,
    };

    filterAndRenderRestaurants();
    if (activeRestaurant) {
      updateSelectedFavButton(activeRestaurant);
    }
  } catch (error) {
    console.error("Failed to update favorite restaurant:", error.message);
    alert(`Could not update favorite: ${error.message}`);
  }
}

// Auth Modal & Form Event Listeners
openAuthBtn.addEventListener("click", () => {
  switchAuthMode("login");
  authModal.showModal();
});

closeAuthBtn.addEventListener("click", () => {
  authModal.close();
});

// Close modal when clicking outside the inner dialog box (on the backdrop)
authModal.addEventListener("click", (event) => {
  if (event.target === authModal) {
    authModal.close();
  }
});

userProfileBtn.addEventListener("click", openProfileModal);

closeProfileBtn.addEventListener("click", () => {
  profileModal.close();
});

profileModal.addEventListener("click", (event) => {
  if (event.target === profileModal) {
    profileModal.close();
  }
});

avatarForm.addEventListener("submit", handleAvatarUpload);

openEditProfileBtn.addEventListener("click", openEditProfileModal);
closeEditProfileBtn.addEventListener("click", () => editProfileModal.close());
editProfileModal.addEventListener("click", (event) => {
  if (event.target === editProfileModal) editProfileModal.close();
});
profileUpdateForm.addEventListener("submit", handleProfileUpdate);

logoutBtn.addEventListener("click", () => {
  logoutUser();
  profileModal.close();
});

loginModeTab.addEventListener("click", () => switchAuthMode("login"));
registerModeTab.addEventListener("click", () => switchAuthMode("register"));

registerForm.addEventListener("submit", handleRegister);
loginForm.addEventListener("submit", handleLogin);

// start Application on load
initApp();
