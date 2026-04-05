// js/markers.js - COMPLETE MARKER SYSTEM CONSOLIDATION
// Consolidates all marker functions from multiple files into single implementation

window.MarkerSystem = {
    // === STATE MANAGEMENT ===
    markers: new Map(),
    currentMarker: null,
    selectedMarkerId: null,
    isAddingMarker: false,
    map: null,
    icons: { manual: null, imported: null },
    coordinateCache: new Map(),
    initialized: false,

    // === INITIALIZATION ===
    init() {
        if (this.initialized) {
            console.warn('⚠️ MarkerSystem already initialized');
            return;
        }

        console.log('🚀 Initializing comprehensive marker system...');

        this.waitForMap();
        this.initializeIcons();
        this.setupEventHandlers();
        this.loadExistingMarkers();

        this.initialized = true;
        console.log('✅ MarkerSystem fully initialized');
    },

    setupEventHandlers() {
        // Add marker button
        const addBtn = document.getElementById('addMarkerBtn');
        if (addBtn && !addBtn.hasEventListener) {
            addBtn.addEventListener('click', () => this.toggleAddingMode());
            addBtn.hasEventListener = true;
        }

        // Clear all markers button
        const clearBtn = document.getElementById('clearAllMarkers');
        if (clearBtn && !clearBtn.hasEventListener) {
            clearBtn.addEventListener('click', () => this.clearAllMarkers());
            clearBtn.hasEventListener = true;
        }

        // Import button - FIXED: Use arrow function with inline implementation
        const importBtn = document.getElementById('importSFAFBtn');
        if (importBtn && !importBtn.hasEventListener) {
            importBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileInput = document.getElementById('sfafFile');
                const file = fileInput?.files[0];

                if (!file) {
                    this.showNotification('❌ Please select a SFAF file to import', 'error');
                    return;
                }

                // File validation
                const validExtensions = ['.txt', '.sfaf'];
                const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
                if (!validExtensions.includes(fileExtension)) {
                    this.showNotification('❌ Invalid file type. Please select a .txt or .sfaf file', 'error');
                    return;
                }

                try {
                    await this.importMarkers(file);
                    fileInput.value = '';
                } catch (error) {
                    console.error('Import failed:', error);
                }
            });
            importBtn.hasEventListener = true;
        }

        console.log('✅ Event handlers configured');
    },

    // === MAP INTEGRATION ===
    waitForMap() {
        const checkMap = () => {
            if (window.map && typeof window.map.on === 'function') {
                this.map = window.map;
                this.setupMapEvents();
                console.log('✅ Map integration complete');
                return true;
            }
            return false;
        };

        if (!checkMap()) {
            setTimeout(() => {
                if (checkMap()) return;
                setTimeout(checkMap, 500);
            }, 100);
        }
    },

    setupMapEvents() {
        if (!this.map) return;

        // Map click handler
        this.map.on('click', async (e) => {
            if (this.isAddingMarker) {
                await this.createMarkerFromClick(e.latlng.lat, e.latlng.lng);
                this.toggleAddingMode(); // Turn off adding mode
            }
        });

        // Mouse move for coordinates
        this.map.on('mousemove', this.debounce((e) => {
            this.showCoordinateTooltip(e);
        }, 100));

        console.log('✅ Map events configured');
    },

    // === ICON INITIALIZATION ===
    initializeIcons() {
        try {
            this.icons.manual = L.icon({
                iconUrl: '/images/marker-green.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                tooltipAnchor: [16, -28]
            });

            this.icons.imported = L.icon({
                iconUrl: '/images/marker-blue.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                tooltipAnchor: [16, -28]
            });

            // Make globally accessible (Source: map.txt compatibility)
            window.manualIcon = this.icons.manual;
            window.importedIcon = this.icons.imported;

            console.log('✅ Marker icons initialized');
        } catch (error) {
            console.warn('⚠️ Using default icons:', error);
            this.icons.manual = new L.Icon.Default();
            this.icons.imported = new L.Icon.Default();
            window.manualIcon = this.icons.manual;
            window.importedIcon = this.icons.imported;
        }
    },

    // === BULK OPERATIONS ===
    async clearAllMarkers() {
        if (!confirm('Clear all markers? This action cannot be undone.')) {
            return false;
        }

        try {
            console.log('🔄 Initiating comprehensive marker clearing...');

            // Call backend bulk delete API (Source: main.txt API endpoint)
            const response = await fetch('/api/markers', {
                method: 'DELETE'
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Backend deletion response:', result);

                // === COMPREHENSIVE FRONTEND STATE CLEANUP === (Source: map.txt pattern)

                // 1. Clear markers Map (primary storage)
                if (this.markers) {
                    this.markers.forEach(marker => {
                        try {
                            if (marker.remove) {
                                marker.remove();
                            } else if (this.map && this.map.removeLayer) {
                                this.map.removeLayer(marker);
                            }
                        } catch (error) {
                            console.warn('⚠️ Error removing individual marker:', error);
                        }
                    });
                    this.markers.clear();
                    console.log('✅ Markers Map cleared');
                }

                // 2. Clear global markers reference (Source: map.txt compatibility)
                if (window.markers) {
                    window.markers.clear();
                    console.log('✅ Global markers Map cleared');
                }

                // 3. Clear drawnItems layer group (Source: map.txt pattern)
                if (window.drawnItems && typeof window.drawnItems.clearLayers === 'function') {
                    window.drawnItems.clearLayers();
                    console.log('✅ DrawnItems layers cleared');
                }

                // 4. Remove ALL marker layers directly from map
                if (this.map) {
                    this.map.eachLayer(layer => {
                        if (layer instanceof L.Marker) {
                            this.map.removeLayer(layer);
                        }
                    });
                    console.log('✅ All marker layers removed from map');
                }

                // 5. Clear coordinate cache (Source: map.txt)
                if (this.coordinateCache) {
                    this.coordinateCache.clear();
                    console.log('✅ Coordinate cache cleared');
                }

                // 6. Clear current marker references
                this.currentMarker = null;
                this.selectedMarkerId = null;
                window.currentSelectedMarker = null;
                if (window.currentSFAFMarker) {
                    window.currentSFAFMarker = null;
                }
                console.log('✅ Current marker references cleared');

                // 7. Close sidebar if open (Source: buttonFunctions.txt)
                if (typeof window.closePersistentSidebar === 'function') {
                    window.closePersistentSidebar();
                }

                // 8. Force map redraw
                if (this.map && typeof this.map.invalidateSize === 'function') {
                    this.map.invalidateSize();
                }

                // 9. Enhanced DOM cleanup (Source: buttonFunctions.txt pattern)
                this.performDOMCleanup();

                this.showNotification('✅ All markers cleared successfully', 'success');
                return true;

            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

        } catch (error) {
            console.error('❌ Failed to clear all markers:', error);
            this.showNotification('❌ Failed to clear markers', 'error');
            return false;
        }
    },

    // Enhanced DOM cleanup
    performDOMCleanup() {
        const cleanupMarkerDOM = () => {
            // Target all potential marker elements
            const allMarkerElements = document.querySelectorAll(`
                .leaflet-marker-icon, 
                .leaflet-marker-shadow,
                .leaflet-marker-pane img,
                .leaflet-marker-pane div
            `);

            let elementsRemoved = 0;
            allMarkerElements.forEach(element => {
                try {
                    const parent = element.parentElement;
                    if (parent) {
                        parent.remove();
                    } else {
                        element.remove();
                    }
                    elementsRemoved++;
                } catch (error) {
                    // Ignore cleanup errors
                }
            });

            // Remove orphaned marker elements
            const orphanedElements = document.querySelectorAll('.leaflet-marker-icon, .leaflet-marker-shadow');
            orphanedElements.forEach(element => {
                try {
                    if (!element.offsetParent || !element.isConnected) {
                        element.remove();
                        elementsRemoved++;
                    }
                } catch (error) {
                    // Ignore cleanup errors
                }
            });

            console.log(`✅ DOM cleanup removed ${elementsRemoved} elements`);
        };

        // Run cleanup immediately and with delays to catch dynamic elements
        cleanupMarkerDOM();
        setTimeout(cleanupMarkerDOM, 50);
        setTimeout(cleanupMarkerDOM, 150);
    },

    // === IMPORT OPERATIONS ===
    async importMarkers(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showNotification('📥 Importing SFAF file...', 'info');

            const response = await fetch('/api/sfaf/import', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();

            if (result.success && result.markers) {
                result.markers.forEach(markerData => {
                    // Force imported marker properties (Source: buttonFunctions.txt)
                    const importedMarkerData = {
                        ...markerData,
                        lat: markerData.lat || markerData.Latitude,
                        lng: markerData.lng || markerData.Longitude,
                        type: 'imported',
                        is_draggable: false,
                        marker_type: 'imported'
                    };

                    this.addToMap(importedMarkerData);
                });

                this.showNotification(
                    `✅ Imported ${result.imported_count} markers with SFAF data`,
                    'success'
                );
                return true;
            }
        } catch (error) {
            console.error('❌ Import failed:', error);
            this.showNotification(`❌ Import failed: ${error.message}`, 'error');
            return false;
        }
    },

    async handleImportClick(e) {
        e.preventDefault();
        console.log('🔥 Import button clicked!');

        const fileInput = document.getElementById('sfafFile');
        const file = fileInput?.files[0];

        if (!file) {
            this.showNotification('❌ Please select a SFAF file to import', 'error');
            return;
        }

        // File validation logic
        const validExtensions = ['.txt', '.sfaf'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            this.showNotification('❌ Invalid file type. Please select a .txt or .sfaf file', 'error');
            return;
        }

        // Use existing importMarkers method
        await this.importMarkers(file);
        fileInput.value = ''; // Clear file input
    },

    // === COORDINATE UTILITIES ===
    async showCoordinateTooltip(e) {
        if (e.originalEvent.target.classList.contains('leaflet-container')) {
            try {
                const lat = e.latlng.lat.toFixed(4);
                const lng = e.latlng.lng.toFixed(4);
                const coordKey = `${lat},${lng}`;

                // Check cache first (Source: map.txt caching)
                if (this.coordinateCache.has(coordKey)) {
                    const cachedCoords = this.coordinateCache.get(coordKey);
                    this.displayCoordinateTooltip(e.latlng, cachedCoords);
                    return;
                }

                // Use Go API for coordinate conversion (Source: main.txt API endpoint)
                const response = await fetch(`/api/convert-coords?lat=${lat}&lng=${lng}`);
                if (response.ok) {
                    const coords = await response.json();
                    this.coordinateCache.set(coordKey, coords);
                    this.displayCoordinateTooltip(e.latlng, coords);
                }
            } catch (error) {
                console.error('Coordinate conversion failed:', error);
                this.hideCoordinateTooltip();
            }
        } else {
            this.hideCoordinateTooltip();
        }
    },

    displayCoordinateTooltip(latlng, coords) {
        const tooltip = document.getElementById('coordinate-tooltip');
        if (tooltip) {
            tooltip.innerHTML = `
                <div class="coordinate-display">
                    <b>Cursor Position</b><br>
                    <div>Decimal: ${coords.decimal}</div>
                    <div>DMS: ${coords.dms}</div>
                    <div>Compact: ${coords.compact}</div>
                </div>
            `;
            tooltip.style.left = event.clientX + 10 + 'px';
            tooltip.style.top = event.clientY - 10 + 'px';
            tooltip.style.display = 'block';
        }
    },

    hideCoordinateTooltip() {
        const tooltip = document.getElementById('coordinate-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    },

    // === POPUP CREATION === (Source: map.txt popup content)
    createPopupContent(markerData) {
        const serial = markerData.Serial || markerData.serial || 'Unknown';
        const frequency = markerData.Frequency || markerData.frequency || 'N/A';
        const type = markerData.MarkerType || markerData.type || 'manual';
        const notes = markerData.UserComments || markerData.notes || '';

        return `
            <div class="marker-popup">
                <h4>Marker ${serial}</h4>
                <p><strong>Coordinates:</strong> ${markerData.lat.toFixed(6)}, ${markerData.lng.toFixed(6)}</p>
                <p><strong>Frequency:</strong> ${frequency}</p>
                <p><strong>Type:</strong> <span class="marker-type-badge ${type}">${type}</span></p>
                ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                <div class="popup-actions">
                    <button onclick="window.MarkerSystem.centerMapOnMarker('${markerData.id}')" class="btn btn-sm">
                        🗺️ Center
                    </button>
                    <button onclick="window.MarkerSystem.editMarker('${markerData.id}')" class="btn btn-sm">
                        ✏️ Edit
                    </button>
                </div>
            </div>
        `;
    },

    // === HELPER FUNCTIONS === (Source: map.txt helper functions)
    centerMapOnMarker(markerId) {
        const marker = this.markers.get(markerId);
        if (marker && this.map) {
            this.map.setView(marker.getLatLng(), 15);
            marker.openPopup();
        }
    },

    editMarker(markerId) {
        const marker = this.markers.get(markerId);
        if (marker && window.SFAFIntegration && window.SFAFIntegration.openSidebar) {
            window.SFAFIntegration.openSidebar(markerId);
        }
    },

    // === UTILITY METHODS === (Source: Multiple files)
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showNotification(message, type) {
        if (typeof showSFAFStatusMessage === 'function') {
            showSFAFStatusMessage(message, type);
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    },

    // === DEBUG UTILITIES === (Source: map.txt debug functions)
    async debugMarkerCreation(lat, lng) {
        console.log('🧪 Debug: Testing marker creation...');

        const testData = {
            latitude: lat || 30.4382,
            longitude: lng || -86.7117,
            frequency: 'DEBUG_TEST',
            user_comments: 'Debug test marker',
            marker_type: 'manual'
        };

        try {
            console.log('🧪 Sending test data:', testData);

            const response = await fetch('/api/markers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });

            const responseText = await response.text();
            console.log('🧪 Raw response:', responseText);
            console.log('🧪 Response status:', response.status);
            console.log('🧪 Response headers:', [...response.headers.entries()]);

            if (response.ok) {
                try {
                    const parsed = JSON.parse(responseText);
                    console.log('🧪 Parsed response:', parsed);

                    // Test marker creation with parsed data
                    if (parsed.success || parsed.Success) {
                        const marker = parsed.marker || parsed.Marker;
                        const visualMarker = this.addToMap(marker);

                        if (visualMarker) {
                            console.log('🧪 ✅ Debug marker created successfully');
                            this.showNotification('✅ Debug marker created successfully', 'success');
                        } else {
                            console.log('🧪 ❌ Visual marker creation failed');
                        }
                    }
                } catch (e) {
                    console.log('🧪 Response is not JSON:', e);
                }
            } else {
                console.log('🧪 ❌ Server returned error status');
            }

        } catch (error) {
            console.error('🧪 Debug test failed:', error);
            this.showNotification('❌ Debug test failed', 'error');
        }
    },

    // === MAP INTEGRATION UTILITIES === (Source: map.txt helper functions)

    async createMarkerFromClick(lat, lng) {
        try {
            const marker = await this.createMarker({
                lat, lng,
                type: 'manual',
                fromClick: true
            });

            if (marker) {
                const serial = marker.markerData.serial || marker.markerData.Serial;
                this.showNotification(`✅ Marker ${serial} created successfully!`, 'success');
            }

            return marker;
        } catch (error) {
            console.error('❌ Failed to create marker from click:', error);
            this.showNotification(`❌ Failed to create marker: ${error.message}`, 'error');
            return null;
        }
    },

    centerMapOnMarker(markerId) {
        const marker = this.markers.get(markerId);
        if (marker && this.map) {
            this.map.setView(marker.getLatLng(), 15);
            marker.openPopup();
            console.log(`🗺️ Centered map on marker: ${markerId}`);
        }
    },

    editMarker(markerId) {
        const marker = this.markers.get(markerId);
        if (marker && window.SFAFIntegration && window.SFAFIntegration.openSidebar) {
            window.SFAFIntegration.openSidebar(markerId);
            console.log(`✏️ Opening editor for marker: ${markerId}`);
        }
    },

    async showMarkerOnMap(markerId) {
        const marker = this.markers.get(markerId);
        if (marker) {
            this.map.setView(marker.getLatLng(), 15);
            marker.openPopup();

            // Highlight marker temporarily
            const originalIcon = marker.getIcon();
            marker.setIcon(this.icons.manual);

            setTimeout(() => {
                marker.setIcon(originalIcon);
            }, 2000);
        }
    },

        removeMarkerFromMap(markerId) {
        // Enhanced removal logic from buttonFunctions.txt
        try {
            // Remove from markers Map storage
            if (this.markers.has(markerId)) {
                const marker = this.markers.get(markerId);
                
                if (marker.remove) {
                    marker.remove();
                } else if (this.map) {
                    this.map.removeLayer(marker);
                }
                
                this.markers.delete(markerId);
            }
            
            // Remove from drawnItems layer group
            if (this.drawnItems) {
                const layersToRemove = [];
                this.drawnItems.eachLayer(function(layer) {
                    if (layer.markerData && layer.markerData.id === markerId) {
                        layersToRemove.push(layer);
                    }
                });
                layersToRemove.forEach(layer => {
                    this.drawnItems.removeLayer(layer);
                });
            }
            
            // DOM cleanup (Source: buttonFunctions.txt)
            this.performDOMCleanup();
            
        } catch (error) {
            console.error('❌ Error removing marker from map:', error);
        }
    },

    // === MAP INTEGRATION FUNCTIONS === (from map.txt)
    loadExistingMarkers: async function () {
        // Use viewport-based loading for better performance with large datasets
        await this.loadMarkersInViewport();
    },

    loadMarkersInViewport: async function () {
        try {
            if (!window.map) {
                console.warn('Map not initialized yet');
                return;
            }

            // Initialize marker cluster group if not exists
            if (!window.markerClusterGroup) {
                window.markerClusterGroup = L.markerClusterGroup({
                    maxClusterRadius: 60,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    zoomToBoundsOnClick: true,
                    disableClusteringAtZoom: 15 // Show individual markers at zoom 15+
                });
                window.map.addLayer(window.markerClusterGroup);
            }

            // Get current map bounds
            const bounds = window.map.getBounds();
            const minLat = bounds.getSouth();
            const maxLat = bounds.getNorth();
            const minLng = bounds.getWest();
            const maxLng = bounds.getEast();

            // Fetch markers within viewport
            const response = await fetch(
                `/api/markers/bounds?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`
            );
            const data = await response.json();

            if (data.markers) {
                // Clear existing markers
                this.clearAllMarkers();

                // Add markers to cluster group
                data.markers.forEach(markerData => {
                    this.createMarkerOnMap(markerData);
                });

                console.log(`Loaded ${data.markers.length} markers in viewport (clustered)`);
            }
        } catch (error) {
            console.error('Failed to load markers in viewport:', error);
        }
    },

    clearAllMarkers: function () {
        if (window.markerClusterGroup) {
            window.markerClusterGroup.clearLayers();
        }
        if (window.markersLayer) {
            window.markersLayer.clearLayers();
        }
    },

    createMarkerOnMap: function (markerData) {
        const icon = markerData.type === 'imported' ? this.icons.imported : this.icons.manual;
        const marker = L.marker([markerData.lat, markerData.lng], {
            icon: icon,
            draggable: markerData.is_draggable !== false
        });

        // Store marker data and ID
        marker.markerId = markerData.id;
        marker.markerData = {
            ...markerData,
            lat: parseFloat(markerData.lat).toFixed(4),
            lng: parseFloat(markerData.lng).toFixed(4)
        };

        // Add to cluster group or map directly
        if (window.markerClusterGroup && markerData.type === 'imported') {
            // Add imported markers to cluster group
            window.markerClusterGroup.addLayer(marker);
        } else {
            // Add manual markers directly to map (not clustered)
            this.map.addLayer(marker);
            this.drawnItems.addLayer(marker);
        }
        this.markers.set(markerData.id, marker);

        // Update tooltip with DMS coordinates
        this.updateMarkerTooltip(marker);

        // Click handler
        marker.on('click', async () => {
            this.currentSelectedMarker = marker;
            if (window.SFAFIntegration && window.SFAFIntegration.openSidebar) {
                await window.SFAFIntegration.openSidebar(marker.markerId);
            }
        });

        // Drag handler
        marker.on('drag', this.handleMarkerDrag.bind(this, marker, markerData.id));

        return marker;
    },

    // === ADVANCED MARKER OPERATIONS ===
    async updateMarkerFromForm(markerId, formData) {
        try {
            const updateData = {
                latitude: parseFloat(formData.get('latitude')),
                longitude: parseFloat(formData.get('longitude')),
                frequency: formData.get('frequency'),
                user_comments: formData.get('user_comments')
            };

            const response = await fetch(`/api/markers/${markerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                const result = await response.json();

                // Update visual marker
                const marker = this.markers.get(markerId);
                if (marker) {
                    const newLatLng = [updateData.latitude, updateData.longitude];
                    marker.setLatLng(newLatLng);
                    marker.markerData = { ...marker.markerData, ...updateData };

                    // Update popup
                    const popupContent = this.createPopupContent(marker.markerData);
                    marker.setPopupContent(popupContent);
                }

                this.showNotification('✅ Marker updated successfully', 'success');
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Failed to update marker:', error);
            this.showNotification('❌ Failed to update marker', 'error');
            return false;
        }
    },

    async bulkDeleteMarkers(markerIds) {
        if (markerIds.length === 0) return true;

        try {
            const deletePromises = markerIds.map(async (markerId) => {
                const response = await fetch(`/api/markers/${markerId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.removeMarkerFromMap(markerId);
                    return { id: markerId, success: true };
                } else {
                    return { id: markerId, success: false, error: response.status };
                }
            });

            const results = await Promise.all(deletePromises);
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            if (failed === 0) {
                this.showNotification(`✅ Deleted ${successful} markers successfully`, 'success');
            } else {
                this.showNotification(`⚠️ Deleted ${successful} markers, ${failed} failed`, 'warning');
            }

            return failed === 0;

        } catch (error) {
            console.error('❌ Bulk delete failed:', error);
            this.showNotification('❌ Bulk delete operation failed', 'error');
            return false;
        }
    },

    // === SFAF INTEGRATION ===
    async createMarkerWithSFAF(coordinates, sfafData = {}) {
        try {
            // First create the marker
            const marker = await this.createMarker({
                lat: coordinates.lat,
                lng: coordinates.lng,
                type: 'manual',
                frequency: sfafData.frequency || '',
                comments: sfafData.comments || ''
            });

            if (marker && marker.markerData) {
                // Then create associated SFAF record
                const sfafResponse = await fetch('/api/sfaf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        marker_id: marker.markerData.id,
                        field_updates: {
                            '303': this.formatMilitaryCoordinates(coordinates.lat, coordinates.lng),
                            '110': sfafData.frequency || '',
                            '200': sfafData.agency || 'USAF',
                            '501': sfafData.comments || '',
                            '901': 'DRAFT'
                        }
                    })
                });

                if (sfafResponse.ok) {
                    const sfafResult = await sfafResponse.json();
                    console.log('✅ SFAF record created with marker');

                    // Update marker data with SFAF reference
                    marker.markerData.sfaf_id = sfafResult.sfaf?.id;

                    this.showNotification('✅ Marker created with SFAF record', 'success');
                } else {
                    console.warn('⚠️ Marker created but SFAF record failed');
                    this.showNotification('⚠️ Marker created but SFAF record failed', 'warning');
                }

                return marker;
            }

        } catch (error) {
            console.error('❌ Failed to create marker with SFAF:', error);
            this.showNotification(`❌ Failed to create marker: ${error.message}`, 'error');
            return null;
        }
    },

    formatMilitaryCoordinates(lat, lng) {
        // Convert decimal degrees to military DMS format
        const latDeg = Math.floor(Math.abs(lat));
        const latMin = Math.floor((Math.abs(lat) - latDeg) * 60);
        const latSec = Math.floor(((Math.abs(lat) - latDeg) * 60 - latMin) * 60);
        const latDir = lat >= 0 ? 'N' : 'S';

        const lngDeg = Math.floor(Math.abs(lng));
        const lngMin = Math.floor((Math.abs(lng) - lngDeg) * 60);
        const lngSec = Math.floor(((Math.abs(lng) - lngDeg) * 60 - lngMin) * 60);
        const lngDir = lng >= 0 ? 'E' : 'W';

        return `${latDeg.toString().padStart(2, '0')}${latMin.toString().padStart(2, '0')}${latSec.toString().padStart(2, '0')}${latDir}${lngDeg.toString().padStart(3, '0')}${lngMin.toString().padStart(2, '0')}${lngSec.toString().padStart(2, '0')}${lngDir}`;
    },

    async openSidebar(markerId) {
        try {
            console.log('🔍 Opening sidebar for marker:', markerId);

            const response = await fetch(`/api/sfaf/object-data/${markerId}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                // Open sidebar components (Source: index.txt sidebar controls)
                if (typeof window.openPersistentSidebar === 'function') {
                    window.openPersistentSidebar();
                }

                if (typeof window.manageObjectTabVisibility === 'function') {
                    window.manageObjectTabVisibility(true);
                }

                if (typeof window.switchTab === 'function') {
                    window.switchTab('object');
                }

                // Populate form (Source: map.txt SFAF form population)
                this.populateExistingSFAFForm(data);
            }
        } catch (error) {
            console.error('Failed to load SFAF data:', error);
        }
    },

    populateExistingSFAFForm(data) {
        // Set current marker reference
        window.currentSFAFMarker = data;

        // Populate coordinates (Source: map.txt coordinate sync)
        if (data.coordinates) {
            this.setFieldValue('field303', data.coordinates.compact);
            this.setFieldValue('field403', data.coordinates.compact);
        }

        // Populate SFAF fields (Source: map.txt SFAF mapping)
        if (data.sfaf_fields) {
            Object.entries(data.sfaf_fields).forEach(([fieldId, value]) => {
                this.setFieldValue(fieldId, value);
            });
        }
    },

    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
            return true;
        }
        return false;
    },

    async openSidebar(markerId) {
        try {
            console.log('🔍 Opening sidebar for marker:', markerId);

            const response = await fetch(`/api/sfaf/object-data/${markerId}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                // Open sidebar components (Source: index.txt sidebar controls)
                if (typeof window.openPersistentSidebar === 'function') {
                    window.openPersistentSidebar();
                }

                if (typeof window.manageObjectTabVisibility === 'function') {
                    window.manageObjectTabVisibility(true);
                }

                if (typeof window.switchTab === 'function') {
                    window.switchTab('object');
                }

                // Populate form (Source: map.txt SFAF form population)
                this.populateExistingSFAFForm(data);
            }
        } catch (error) {
            console.error('Failed to load SFAF data:', error);
        }
    },

    populateExistingSFAFForm(data) {
        // Set current marker reference
        window.currentSFAFMarker = data;

        // Populate coordinates (Source: map.txt coordinate sync)
        if (data.coordinates) {
            this.setFieldValue('field303', data.coordinates.compact);
            this.setFieldValue('field403', data.coordinates.compact);
        }

        // Populate SFAF fields (Source: map.txt SFAF mapping)
        if (data.sfaf_fields) {
            Object.entries(data.sfaf_fields).forEach(([fieldId, value]) => {
                this.setFieldValue(fieldId, value);
            });
        }
    },

    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
            return true;
        }
        return false;
    },

    // === SEARCH AND FILTER === (Source: db_viewer.txt search functionality)
    filterMarkers(searchTerm, typeFilter = null) {
        const filteredMarkers = new Map();

        this.markers.forEach((marker, id) => {
            const data = marker.markerData;
            let matches = true;

            // Text search
            if (searchTerm && searchTerm.trim() !== '') {
                const searchLower = searchTerm.toLowerCase();
                const searchableText = [
                    data.serial,
                    data.frequency,
                    data.notes,
                    data.UserComments,
                    data.lat?.toString(),
                    data.lng?.toString()
                ].filter(Boolean).join(' ').toLowerCase();

                matches = matches && searchableText.includes(searchLower);
            }

            // Type filter
            if (typeFilter && typeFilter !== 'all') {
                matches = matches && data.type === typeFilter;
            }

            if (matches) {
                filteredMarkers.set(id, marker);
            }
        });

        return filteredMarkers;
    },

    highlightFilteredMarkers(filteredMarkers) {
        // Reset all markers to normal opacity
        this.markers.forEach(marker => {
            marker.setOpacity(0.5);
        });

        // Highlight filtered markers
        filteredMarkers.forEach(marker => {
            marker.setOpacity(1.0);
        });
    },

    // === PERFORMANCE OPTIMIZATION === (Source: db_viewer.txt performance patterns)
    batchMarkerOperations(operations) {
        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < operations.length; i += batchSize) {
            batches.push(operations.slice(i, i + batchSize));
        }

        return batches.reduce((promise, batch) => {
            return promise.then(() => {
                return Promise.all(batch.map(op => this.executeOperation(op)));
            });
        }, Promise.resolve());
    },

    async executeOperation(operation) {
        switch (operation.type) {
            case 'create':
                return this.createMarker(operation.data);
            case 'update':
                return this.updateMarkerPosition(operation.id, operation.data.lat, operation.data.lng);
            case 'delete':
                return this.deleteMarker(operation.id);
            default:
                console.warn('Unknown operation type:', operation.type);
        }
    },

    // === INTEGRATION HELPERS === (Source: Multiple files integration)
    getMarkerStats() {
        const stats = {
            total: this.markers.size,
            manual: 0,
            imported: 0,
            withFrequency: 0,
            withSFAF: 0
        };

        this.markers.forEach(marker => {
            const data = marker.markerData;

            if (data.type === 'manual') stats.manual++;
            if (data.type === 'imported') stats.imported++;
            if (data.frequency && data.frequency.trim()) stats.withFrequency++;
            if (data.sfaf_id) stats.withSFAF++;
        });

        return stats;
    },

    // === EXPORT FUNCTIONS === (Source: db_viewer.txt export functionality)
    exportMarkersToCSV() {
        // Prepare CSV headers with MC4EB Publication 7, Change 1 compliance (Source: models.txt SFAF fields)
        const headers = [
            'ID',
            'Serial',
            'Latitude',
            'Longitude',
            'DMS_Coordinates',
            'Military_Compact',
            'Frequency',
            'Type',
            'Notes',
            'Is_Draggable',
            'Created_Date',
            'Updated_Date',
            'SFAF_Fields_Count'
        ];

        const rows = [headers];

        // Process all markers with comprehensive data extraction
        this.markers.forEach(marker => {
            const data = marker.markerData;

            // Format coordinates using military standards (Source: services.txt coordinate conversion)
            const dmsCoords = this.formatToDMS(data.lat, data.lng);
            const militaryCompact = this.formatMilitaryCoordinates(data.lat, data.lng);

            // Count associated SFAF fields (Source: db_viewer.txt SFAF integration)
            const sfafFieldsCount = this.getSFAFFieldsCount(data.id);

            rows.push([
                data.id || data.ID,
                data.serial || data.Serial || '',
                data.lat || data.latitude,
                data.lng || data.longitude,
                dmsCoords,
                militaryCompact,
                data.frequency || data.Frequency || '',
                data.type || data.MarkerType || 'manual',
                this.escapeCsvValue(data.notes || data.UserComments || ''),
                data.is_draggable ?? data.IsDraggable ?? true,
                data.created_at || data.CreatedAt || new Date().toISOString(),
                data.updated_at || data.UpdatedAt || new Date().toISOString(),
                sfafFieldsCount
            ]);
        });

        // Generate CSV content with proper escaping
        const csvContent = rows.map(row =>
            row.map(cell => this.formatCsvCell(cell)).join(',')
        ).join('\n');

        // Create and download file with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `SFAF_Markers_${timestamp}.csv`;

        this.downloadFile(csvContent, filename, 'text/csv');

        this.showNotification(`✅ Exported ${this.markers.size} markers to ${filename}`, 'success');
    },

    // === ENHANCED EXPORT UTILITIES === (Source: db_viewer.txt export patterns)
    async exportMarkersToEnhancedJSON() {
        const exportData = {
            type: 'SFAF_Markers_Export',
            exported_at: new Date().toISOString(),
            total_count: this.markers.size,
            compliance: 'MC4EB Publication 7, Change 1',
            version: '1.0',
            metadata: {
                system: 'SFAF Plotter',
                backend: 'PostgreSQL',
                coordinate_formats: ['Decimal', 'DMS', 'Military_Compact']
            },
            markers: []
        };

        // Enhanced marker data with coordinate conversions (Source: main.txt coordinate API)
        for (const [id, marker] of this.markers) {
            const data = marker.markerData;

            try {
                // Get coordinate formats using Go API (Source: main.txt coordinate conversion)
                const coordResponse = await fetch(`/api/convert-coords?lat=${data.lat}&lng=${data.lng}`);
                const coords = await coordResponse.json();

                // Get SFAF data if available (Source: handlers.txt SFAF integration)
                let sfafData = null;
                try {
                    const sfafResponse = await fetch(`/api/sfaf/object-data/${id}`);
                    const sfafResult = await sfafResponse.json();
                    if (sfafResult.success) {
                        sfafData = sfafResult.sfaf_fields;
                    }
                } catch (error) {
                    console.warn(`Could not load SFAF data for marker ${id}:`, error);
                }

                exportData.markers.push({
                    id: data.id,
                    serial: data.serial,
                    coordinates: {
                        decimal: { lat: data.lat, lng: data.lng },
                        dms: coords.dms,
                        compact: coords.compact
                    },
                    frequency: data.frequency,
                    type: data.type,
                    notes: data.notes,
                    properties: {
                        is_draggable: data.is_draggable,
                        created_at: data.created_at,
                        updated_at: data.updated_at
                    },
                    sfaf_data: sfafData,
                    compliance_status: this.validateMarkerCompliance(data)
                });
            } catch (error) {
                // Fallback for markers that can't be enhanced
                exportData.markers.push({
                    id: data.id,
                    serial: data.serial,
                    coordinates: { decimal: { lat: data.lat, lng: data.lng } },
                    frequency: data.frequency,
                    type: data.type,
                    notes: data.notes,
                    error: 'Enhanced data not available'
                });
            }
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `SFAF_Markers_Enhanced_${timestamp}.json`;

        this.downloadFile(
            JSON.stringify(exportData, null, 2),
            filename,
            'application/json'
        );

        this.showNotification(`✅ Enhanced export completed: ${filename}`, 'success');
    },

    // === BULK EXPORT OPERATIONS === (Source: db_viewer.txt bulk operations)
    async exportSelectedMarkers(format = 'csv') {
        const selectedMarkers = Array.from(this.markers.values())
            .filter(marker => this.selectedMarkers?.has(marker.markerData.id));

        if (selectedMarkers.length === 0) {
            this.showNotification('❌ No markers selected for export', 'error');
            return;
        }

        const tempMarkers = this.markers;
        this.markers = new Map();

        // Temporarily populate with selected markers
        selectedMarkers.forEach(marker => {
            this.markers.set(marker.markerData.id, marker);
        });

        try {
            if (format === 'csv') {
                this.exportMarkersToCSV();
            } else if (format === 'json') {
                await this.exportMarkersToEnhancedJSON();
            } else if (format === 'kml') {
                this.exportMarkersToKML();
            }
        } finally {
            // Restore original markers collection
            this.markers = tempMarkers;
        }
    },

    // === KML EXPORT === (Source: Geographic export patterns)
    exportMarkersToKML() {
        const kmlContent = this.generateKMLContent();
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `SFAF_Markers_${timestamp}.kml`;

        this.downloadFile(kmlContent, filename, 'application/vnd.google-earth.kml+xml');
        this.showNotification(`✅ Exported ${this.markers.size} markers to KML format`, 'success');
    },

    generateKMLContent() {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SFAF Plotter Markers Export</name>
    <description>Military Frequency Coordination Markers - MC4EB Publication 7, Change 1 Compliant</description>
    
    <!-- Manual Marker Style -->
    <Style id="manualMarkerStyle">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <!-- Imported Marker Style -->
    <Style id="importedMarkerStyle">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
`;

        // Add placemarks for each marker
        this.markers.forEach(marker => {
            const data = marker.markerData;
            const styleId = data.type === 'imported' ? 'importedMarkerStyle' : 'manualMarkerStyle';

            kml += `
    <Placemark>
      <name>${data.serial}</name>
      <description><![CDATA[
        <strong>Frequency:</strong> ${data.frequency}<br/>
        <strong>Type:</strong> ${data.type}<br/>
        <strong>Coordinates:</strong> ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}<br/>
        <strong>Notes:</strong> ${data.notes || 'No notes'}
      ]]></description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${data.lng},${data.lat},0</coordinates>
      </Point>
    </Placemark>`;
        });

        kml += `
  </Document>
</kml>`;

        return kml;
    },

    // === UTILITY FUNCTIONS === (Source: db_viewer.txt utility patterns)
    formatToDMS(lat, lng) {
        const formatCoord = (coord, isLat) => {
            const abs = Math.abs(coord);
            const deg = Math.floor(abs);
            const min = Math.floor((abs - deg) * 60);
            const sec = Math.floor(((abs - deg) * 60 - min) * 60);
            const dir = coord >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
            return `${deg}°${min}'${sec}"${dir}`;
        };

        return `${formatCoord(lat, true)} ${formatCoord(lng, false)}`;
    },

    toggleAddingMode() {
        this.isAddingMarker = !this.isAddingMarker;

        const btn = document.getElementById('addMarkerBtn');
        if (btn) {
            btn.textContent = this.isAddingMarker ? '❌ Cancel' : '📍 Add Marker';
            btn.style.backgroundColor = this.isAddingMarker ? '#f44336' : '#4CAF50';
        }

        if (this.map) {
            this.map.getContainer().style.cursor = this.isAddingMarker ? 'crosshair' : '';
        }

        if (typeof updateAddMarkerButton === 'function') {
            updateAddMarkerButton();
        }

        console.log(`📍 Marker adding mode: ${this.isAddingMarker ? 'ON' : 'OFF'}`);
    },

    formatMilitaryCoordinates(lat, lng) {
        // Convert to military compact format (DDMMSSNDDDMMSEW)
        const formatMilitary = (coord, isLat) => {
            const abs = Math.abs(coord);
            const deg = Math.floor(abs);
            const min = Math.floor((abs - deg) * 60);
            const sec = Math.floor(((abs - deg) * 60 - min) * 60);
            const dir = coord >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');

            if (isLat) {
                return `${deg.toString().padStart(2, '0')}${min.toString().padStart(2, '0')}${sec.toString().padStart(2, '0')}${dir}`;
            } else {
                return `${deg.toString().padStart(3, '0')}${min.toString().padStart(2, '0')}${sec.toString().padStart(2, '0')}${dir}`;
            }
        };

        return formatMilitary(lat, true) + formatMilitary(lng, false);
    },

    escapeCsvValue(value) {
        if (!value) return '';
        return value.toString().replace(/"/g, '""');
    },

    formatCsvCell(cell) {
        if (cell === null || cell === undefined) return '';
        const str = cell.toString();
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${this.escapeCsvValue(str)}"`;
        }
        return str;
    },

    getSFAFFieldsCount(markerId) {
        // This would be populated from SFAF data loaded separately
        // Returns count of SFAF fields for this marker
        return this.sfafFieldCounts?.get(markerId) || 0;
    },

    validateMarkerCompliance(markerData) {
        // MC4EB Publication 7, Change 1 compliance validation
        const issues = [];

        if (!markerData.frequency || markerData.frequency.trim() === '') {
            issues.push('Missing frequency data');
        }

        if (!markerData.lat || !markerData.lng) {
            issues.push('Missing coordinate data');
        }

        if (markerData.type === 'imported' && markerData.is_draggable) {
            issues.push('Imported markers should not be draggable');
        }

        return {
            compliant: issues.length === 0,
            issues: issues
        };
    },

    validateFrequencyCompliance(bands) {
        const issues = [];
        const total = Object.values(bands).reduce((a, b) => a + b, 0);

        if (bands.Unknown > total * 0.1) {
            issues.push('High percentage of unknown frequency classifications');
        }

        return {
            compliant: issues.length === 0,
            issues: issues,
            score: Math.max(0, 100 - (issues.length * 10))
        };
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up object URL
        setTimeout(() => URL.revokeObjectURL(url), 100);
    },

    // === COORDINATE UTILITIES === (from map.txt)
    coordinateCache: new Map(),

    async updateMarkerTooltip(marker) {
        const data = marker.markerData;
        const coordKey = `${data.lat},${data.lng}`;

        // Check cache first
        if (this.coordinateCache.has(coordKey)) {
            const cachedDMS = this.coordinateCache.get(coordKey);
            this.displayTooltip(marker, data, cachedDMS);
            return;
        }

        try {
            // API call to get DMS coordinates (Source: main.txt API endpoint)
            const response = await fetch(`/api/convert-coords?lat=${data.lat}&lng=${data.lng}`);

            if (response.ok) {
                const coords = await response.json();
                this.coordinateCache.set(coordKey, coords.dms);
                this.displayTooltip(marker, data, coords.dms);
            }
        } catch (error) {
            console.error('Coordinate conversion failed:', error);
        }
    },

    displayTooltip(marker, data, dmsCoords) {
        const tooltip = `
            <b>Manual Marker</b><br>
            DecDeg: ${data.lat}, ${data.lng}<br>
            DMS: ${dmsCoords}<br>
            Serial: ${data.serial}<br>
            Freq: ${data.frequency || 'N/A'}<br>
            Notes: ${data.notes || '(none)'}
        `;

        marker.bindTooltip(tooltip, {
            permanent: true,
            direction: 'top',
            offset: L.point(0, -15)
        }).openTooltip();
    },

    // === Handlers ===
    // === UTILITY METHODS === (Source: markers.txt correction)
    handleSave: async function (e) {
        e.preventDefault();
        console.log('💾 Save operation triggered');

        if (window.currentSFAFMarker) {
            try {
                const response = await fetch('/api/sfaf', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        marker_id: window.currentSFAFMarker.id,
                    })
                });

                if (response.ok) {
                    this.showNotification('✅ SFAF data saved successfully', 'success');
                }
            } catch (error) {
                console.error('❌ Save failed:', error);
                this.showNotification('❌ Save operation failed', 'error');
            }
        }
    },  // <-- ENSURE COMMA HERE

    handleMouseMove: function (e) {
        if (this.coordinateTooltip && typeof this.showCoordinateTooltip === 'function') {
            this.showCoordinateTooltip(e);
        }
    },

    // === IMPORT STATISTICS ===
    generateImportReport: async function () {  // <-- This should work now
        const importedMarkers = Array.from(this.markers.values())
            .filter(marker => marker.markerData.type === 'imported');
        if (importedMarkers.length === 0) {
            this.showNotification('❌ No imported markers found', 'error');
            return;
        }

        const report = {
            type: 'SFAF_Import_Report',
            generated_at: new Date().toISOString(),
            total_imported: importedMarkers.length,
            compliance: 'MC4EB Publication 7, Change 1',
            statistics: {
                with_frequency: importedMarkers.filter(m => m.markerData.frequency).length,
                with_notes: importedMarkers.filter(m => m.markerData.notes).length,
                frequency_bands: this.analyzeFrequencyBands(importedMarkers)
            },
            markers: importedMarkers.map(m => ({
                id: m.markerData.id,
                serial: m.markerData.serial,
                coordinates: { lat: m.markerData.lat, lng: m.markerData.lng },
                frequency: m.markerData.frequency,
                import_date: m.markerData.created_at
            }))
        };

        const filename = `SFAF_Import_Report_${new Date().toISOString().split('T')[0]}.json`;
        this.downloadFile(JSON.stringify(report, null, 2), filename, 'application/json');

        this.showNotification(`✅ Import report generated: ${filename}`, 'success');
    },

    analyzeFrequencyBands: function (markers) {
        const bands = { VHF: 0, UHF: 0, SHF: 0, EHF: 0, Unknown: 0 };

        markers.forEach(marker => {
            const freq = parseFloat(marker.markerData.frequency);
            if (isNaN(freq)) {
                bands.Unknown++;
            } else if (freq >= 30 && freq < 300) {
                bands.VHF++;
            } else if (freq >= 300 && freq < 3000) {
                bands.UHF++;
            } else if (freq >= 3000 && freq < 30000) {
                bands.SHF++;
            } else if (freq >= 30000) {
                bands.EHF++;
            } else {
                bands.Unknown++;
            }
        });

        return bands;
    },
    generateFrequencyReport: function (bands, totalMarkers) {
        const report = {
            distribution: bands,
            compliance: this.validateFrequencyCompliance(bands),
            recommendations: this.generateFrequencyRecommendations(bands)
        };
        return report;
    },

    generateFrequencyRecommendations: function (bands) {
        const recommendations = [];
        const total = Object.values(bands).reduce((a, b) => a + b, 0);

        if (bands.Unknown > total * 0.1) {
            recommendations.push('Review and classify unknown frequency entries');
        }

        if (bands.UHF > total * 0.8) {
            recommendations.push('Consider VHF alternatives to reduce UHF congestion');
        }

        return recommendations;
    }
};

// Global accessibility bindings
window.createMarker = window.MarkerSystem.createMarkerFromClick?.bind(window.MarkerSystem);
window.addMarkerToMap = window.MarkerSystem.addToMap?.bind(window.MarkerSystem);
window.createMarkerOnMap = function(markerData) {
    if (window.MarkerSystem && window.MarkerSystem.addToMap) {
        return window.MarkerSystem.addToMap(markerData);
    } else {
        console.error('❌ MarkerSystem not available');
        return null;
    }
};

window.clearAllMarkers = function() {
    if (window.MarkerSystem && window.MarkerSystem.clearAllMarkers) {
        return window.MarkerSystem.clearAllMarkers();
    }
};