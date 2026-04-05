// Initialize Map
// Using Jakarta coordinates as default
const map = L.map('map', {
    zoomControl: false // Disable default zoom to position it elsewhere if needed
}).setView([-6.2088, 106.8456], 13);

// Add colorful standard tile layer (Esri WorldStreetMap)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
}).addTo(map);

// Add zoom control to top right so it doesn't overlap our panel
L.control.zoom({
    position: 'topright'
}).addTo(map);

// Application State
let appMode = 'manual'; // 'manual' or 'gps'
let isTracking = false;
let trackingPath = [];
let trackingPolyline = null;
let currentWatchId = null;
let totalTrackingDistance = 0; // in meters
let points = [];
let markers = [];
let polyline = null;

// DOM Elements
const distanceValueEl = document.getElementById('distanceValue');
const instructionTextEl = document.getElementById('instructionText');
const resetBtn = document.getElementById('resetBtn');
const modeManualBtn = document.getElementById('modeManual');
const modeGpsBtn = document.getElementById('modeGps');
const startTrackBtn = document.getElementById('startTrackBtn');
const stopTrackBtn = document.getElementById('stopTrackBtn');

// Custom Icon for markers
const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div class='marker-pin'></div>",
    iconSize: [24, 32],
    iconAnchor: [12, 12]
});

// Map click event
map.on('click', function(e) {
    if (appMode !== 'manual') return;
    if (points.length >= 2) return; // Already have 2 points

    const latlng = e.latlng;
    points.push(latlng);

    // Add marker
    const marker = L.marker(latlng, { icon: customIcon }).addTo(map);
    markers.push(marker);

    updateUI();
});

async function updateUI() {
    if (points.length === 1) {
        instructionTextEl.textContent = "Klik titik kedua...";
        instructionTextEl.style.color = "#facc15"; // yellow-400
        instructionTextEl.style.backgroundColor = "rgba(250, 204, 21, 0.1)";
        instructionTextEl.style.borderColor = "rgba(250, 204, 21, 0.2)";
        resetBtn.disabled = false;
    } else if (points.length === 2) {
        instructionTextEl.textContent = "Menghitung rute perjalanan...";
        instructionTextEl.style.color = "#38bdf8"; // sky-400
        instructionTextEl.style.backgroundColor = "rgba(56, 189, 248, 0.1)";
        instructionTextEl.style.borderColor = "rgba(56, 189, 248, 0.2)";

        const p1 = points[0];
        const p2 = points[1];
        
        try {
            // Request route from OSRM
            // OSRM coordinates format is {longitude},{latitude}
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`);
            const data = await response.json();

            if (data.code === 'Ok' && data.routes.length > 0) {
                const route = data.routes[0];
                
                // Draw polyline based on road geometry
                polyline = L.geoJSON(route.geometry, {
                    style: {
                        color: '#3b82f6',
                        weight: 5,
                        opacity: 0.8,
                        lineJoin: 'round'
                    }
                }).addTo(map);

                // Update distance (convert meters to km)
                const distanceKm = (route.distance / 1000).toFixed(2);
                distanceValueEl.textContent = distanceKm;
                
                instructionTextEl.textContent = "Jarak jalur darat berhasil diukur!";
                instructionTextEl.style.color = "#4ade80";
                instructionTextEl.style.backgroundColor = "rgba(74, 222, 128, 0.1)";
                instructionTextEl.style.borderColor = "rgba(74, 222, 128, 0.2)";

                map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
            } else {
                throw new Error("No route found");
            }
        } catch (error) {
            console.error("OSRM Routing API Error:", error);
            
            // Fallback condition if route is not found or API fails: Draw straight dot line
            instructionTextEl.textContent = "Rute jalan tak ditemukan (garis lurus)";
            instructionTextEl.style.color = "#f87171"; // red-400
            instructionTextEl.style.backgroundColor = "rgba(248, 113, 113, 0.1)";
            instructionTextEl.style.borderColor = "rgba(248, 113, 113, 0.2)";
            
            polyline = L.polyline(points, {
                color: '#f43f5e', // rose-500
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10',
                lineJoin: 'round'
            }).addTo(map);

            const distanceMeters = p1.distanceTo(p2);
            distanceValueEl.textContent = (distanceMeters / 1000).toFixed(2);
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        }
    }
}

// Reset functionality
resetBtn.addEventListener('click', () => {
    // Remove markers and line from map
    markers.forEach(marker => map.removeLayer(marker));
    if (polyline) map.removeLayer(polyline);

    // Reset state
    points = [];
    markers = [];
    polyline = null;

    // Reset UI
    distanceValueEl.textContent = "0.00";
    instructionTextEl.textContent = "Menunggu titik pertama...";
    instructionTextEl.style.color = "var(--primary)";
    instructionTextEl.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
    instructionTextEl.style.borderColor = "rgba(59, 130, 246, 0.2)";
    resetBtn.disabled = true;
});

// GPS Location Functionality
const locateBtn = document.getElementById('locateBtn');
let userLocationMarker = null;

locateBtn.addEventListener('click', () => {
    map.locate({setView: true, maxZoom: 16});
    locateBtn.style.opacity = '0.6'; // Visual feedback while searching
});

map.on('locationfound', function(e) {
    locateBtn.style.opacity = '1';
    
    // Remove old location marker if exists
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }

    // Add a pulsing blue dot for user location
    userLocationMarker = L.circleMarker(e.latlng, {
        radius: 8,
        fillColor: "#3b82f6",
        color: "#ffffff",
        weight: 3,
        opacity: 1,
        fillOpacity: 1
    }).addTo(map);

    locateBtn.style.color = "#3b82f6"; // Highlight button icon
});

map.on('locationerror', function(e) {
    locateBtn.style.opacity = '1';
    alert("Gagal mengakses lokasi GPS. Pastikan Anda telah memberikan izin akses lokasi pada browser.");
});

// Mode Switch Logic
modeManualBtn.addEventListener('click', () => {
    if (isTracking) return; // Don't switch if currently tracking
    appMode = 'manual';
    modeManualBtn.classList.add('active');
    modeGpsBtn.classList.remove('active');
    
    resetBtn.style.display = 'block';
    startTrackBtn.style.display = 'none';
    stopTrackBtn.style.display = 'none';
    
    instructionTextEl.textContent = points.length === 0 ? "Menunggu titik pertama..." : "Gunakan tombol reset untuk ulang.";
    instructionTextEl.style.color = "var(--primary)";
    instructionTextEl.style.background = "rgba(59, 130, 246, 0.1)";
    instructionTextEl.style.borderColor = "rgba(59, 130, 246, 0.2)";
});

modeGpsBtn.addEventListener('click', () => {
    appMode = 'gps';
    modeGpsBtn.classList.add('active');
    modeManualBtn.classList.remove('active');
    
    resetBtn.style.display = 'none';
    
    if (isTracking) {
        stopTrackBtn.style.display = 'block';
        startTrackBtn.style.display = 'none';
    } else {
        startTrackBtn.style.display = 'block';
        stopTrackBtn.style.display = 'none';
        instructionTextEl.textContent = "Tekan Mulai untuk melacak perjalanan.";
        instructionTextEl.style.color = "var(--text-main)";
        instructionTextEl.style.backgroundColor = "transparent";
        instructionTextEl.style.borderColor = "transparent";
        
        let displayVal = (totalTrackingDistance / 1000).toFixed(2);
        distanceValueEl.textContent = displayVal;
    }
});

// GPS Tracking Logic
startTrackBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert("Geolokasi tidak didukung oleh browser Anda.");
        return;
    }
    
    // Clear previous tracking
    if (trackingPolyline) map.removeLayer(trackingPolyline);
    trackingPath = [];
    totalTrackingDistance = 0;
    distanceValueEl.textContent = "0.00";
    
    trackingPolyline = L.polyline([], {
        color: '#06b6d4', // cyan-500
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
    }).addTo(map);

    isTracking = true;
    startTrackBtn.style.display = 'none';
    stopTrackBtn.style.display = 'block';
    stopTrackBtn.classList.add('pulse-animation');
    
    instructionTextEl.textContent = "Sedang melacak perjalanan Anda...";
    instructionTextEl.style.color = "#ef4444"; // red-500
    instructionTextEl.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
    instructionTextEl.style.borderColor = "rgba(239, 68, 68, 0.2)";
    
    // Start watching position
    currentWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const newPoint = L.latLng(lat, lng);
            
            if (trackingPath.length > 0) {
                const prevPoint = trackingPath[trackingPath.length - 1];
                const distance = prevPoint.distanceTo(newPoint);
                totalTrackingDistance += distance;
                
                // Update display
                distanceValueEl.textContent = (totalTrackingDistance / 1000).toFixed(2);
            }
            
            trackingPath.push(newPoint);
            trackingPolyline.setLatLngs(trackingPath);
            
            // Center map on new location
            map.setView([lat, lng], 16);
            
            // Re-use userLocationMarker logically from earlier
            if (userLocationMarker) {
                userLocationMarker.setLatLng(newPoint);
            } else {
                userLocationMarker = L.circleMarker(newPoint, {
                    radius: 8,
                    fillColor: "#3b82f6",
                    color: "#ffffff",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);
            }
        },
        (error) => {
            console.error("GPS Watch Error:", error);
            instructionTextEl.textContent = "Gagal membaca GPS (" + error.message + ")";
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
});

stopTrackBtn.addEventListener('click', () => {
    isTracking = false;
    stopTrackBtn.classList.remove('pulse-animation');
    
    if (currentWatchId !== null) {
        navigator.geolocation.clearWatch(currentWatchId);
        currentWatchId = null;
    }
    
    startTrackBtn.style.display = 'block';
    stopTrackBtn.style.display = 'none';
    
    startTrackBtn.textContent = "Mulai Baru";
    instructionTextEl.textContent = "Pelacakan dihentikan.";
    instructionTextEl.style.color = "#10b981"; // emerald-500
    instructionTextEl.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
    instructionTextEl.style.borderColor = "rgba(16, 185, 129, 0.2)";
    
    if (trackingPolyline && trackingPath.length > 1) {
        map.fitBounds(trackingPolyline.getBounds(), { padding: [50, 50] });
    }
});
