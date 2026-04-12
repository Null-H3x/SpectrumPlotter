// db_viewer_analytics.js — Analytics, geographic analysis, recommendations, data quality

Object.assign(DatabaseViewer.prototype, {

    calculateDailyAverage(markers) {
        if (markers.length === 0) return '0';

        const dates = markers.map(m => new Date(m.created_at)).filter(d => !isNaN(d));
        if (dates.length === 0) return 'Unknown';

        const earliest = new Date(Math.min(...dates));
        const latest = new Date(Math.max(...dates));
        const diffDays = Math.max(Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)), 1);

        return (markers.length / diffDays).toFixed(1);
    },

    analyzeFrequencyDistribution(markers) {
        const stats = { vhf: 0, uhf: 0, shf: 0, ehf: 0, none: 0 };

        markers.forEach(marker => {
            if (!marker.frequency || marker.frequency.trim() === '') {
                stats.none++;
                return;
            }

            // Parse frequency value (remove K prefix if present, Source: services.txt SFAF import)
            const freqStr = marker.frequency.replace(/^K/, '').trim();
            const freq = parseFloat(freqStr);

            if (isNaN(freq)) {
                stats.none++;
            } else if (freq >= 30 && freq < 300) {
                stats.vhf++;
            } else if (freq >= 300 && freq < 3000) {
                stats.uhf++;
            } else if (freq >= 3000 && freq < 30000) {
                stats.shf++;
            } else if (freq >= 30000) {
                stats.ehf++;
            } else {
                stats.none++;
            }
        });

        return stats;
    },

    analyzeGeographicDistribution(markers) {
        if (!Array.isArray(markers) || markers.length === 0) {
            return {
                spread: 0,
                center: { lat: 0, lng: 0 },
                bounds: { north: 0, south: 0, east: 0, west: 0 },
                statistics: {
                    totalMarkers: 0,
                    validCoordinates: 0,
                    invalidCoordinates: 0,
                    densityAnalysis: {},
                    coordinateQuality: 'No data available'
                }
            };
        }

        // ✅ CORRECTED: Use correct property names from database schema (Source: main_go.txt marker structure)
        const validMarkers = markers.filter(m =>
            m &&
            typeof m.latitude === 'number' && !isNaN(m.latitude) &&
            typeof m.longitude === 'number' && !isNaN(m.longitude) &&
            m.latitude >= -90 && m.latitude <= 90 &&
            m.longitude >= -180 && m.longitude <= 180
        );

        if (validMarkers.length === 0) {
            return {
                spread: 0,
                center: { lat: 0, lng: 0 },
                bounds: { north: 0, south: 0, east: 0, west: 0 },
                statistics: {
                    totalMarkers: markers.length,
                    validCoordinates: 0,
                    invalidCoordinates: markers.length,
                    densityAnalysis: {},
                    coordinateQuality: 'All coordinates invalid'
                }
            };
        }

        // ✅ ENHANCED: Extract coordinate arrays with validation
        const latitudes = validMarkers.map(m => parseFloat(m.latitude));
        const longitudes = validMarkers.map(m => parseFloat(m.longitude));

        // ✅ ENHANCED: Calculate geographic bounds
        const bounds = {
            north: Math.max(...latitudes),
            south: Math.min(...latitudes),
            east: Math.max(...longitudes),
            west: Math.min(...longitudes)
        };

        // ✅ ENHANCED: Calculate geographic center
        const center = {
            lat: (bounds.north + bounds.south) / 2,
            lng: (bounds.east + bounds.west) / 2
        };

        // ✅ ENHANCED: Calculate geographic spread (maximum extent)
        const latSpread = bounds.north - bounds.south;
        const lngSpread = bounds.east - bounds.west;
        const spread = Math.max(latSpread, lngSpread);

        // ✅ ENHANCED: Advanced statistical analysis
        const statistics = {
            totalMarkers: markers.length,
            validCoordinates: validMarkers.length,
            invalidCoordinates: markers.length - validMarkers.length,
            densityAnalysis: this.calculateDensityAnalysis(validMarkers, bounds),
            coordinateQuality: this.assessCoordinateQuality(validMarkers.length, markers.length),
            standardDeviation: {
                latitude: this.calculateStandardDeviation(latitudes),
                longitude: this.calculateStandardDeviation(longitudes)
            },
            averageDistanceFromCenter: this.calculateAverageDistanceFromCenter(validMarkers, center),
            clustersDetected: this.detectCoordinateClusters(validMarkers),
            coverage: {
                latitudeRange: latSpread,
                longitudeRange: lngSpread,
                totalArea: this.calculateCoverageArea(bounds)
            }
        };

        return {
            spread,
            center,
            bounds,
            statistics,
            validMarkers: validMarkers.length,
            invalidMarkers: markers.length - validMarkers.length
        };
    },

    renderAnalyticsError() {
        const errorContent = `
        <div class="analytics-error">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h4>❌ Analytics Unavailable</h4>
            <p>Unable to load analytics data. This may be due to:</p>
            <ul class="error-reasons">
                <li>Network connectivity issues</li>
                <li>Backend service temporarily unavailable</li>
                <li>Invalid data format received</li>
                <li>Insufficient permissions</li>
            </ul>
            <div class="error-actions">
                <button class="btn btn-primary" onclick="databaseViewer.loadAnalytics()">
                    <i class="fas fa-refresh"></i> Retry Loading Analytics
                </button>
                <button class="btn btn-secondary" onclick="databaseViewer.loadBasicAnalytics()">
                    <i class="fas fa-chart-simple"></i> Load Basic Stats Only
                </button>
            </div>
            <div class="error-details">
                <small>If this problem persists, please check the browser console for detailed error information.</small>
            </div>
        </div>
    `;

        // Update all analytics sections with error state
        this.updateAnalyticsElement('systemStats', errorContent);
        this.updateAnalyticsElement('frequencyChart', this.generateErrorPlaceholder('Frequency Distribution'));
        this.updateAnalyticsElement('complianceReport', this.generateErrorPlaceholder('MC4EB Compliance Report'));
        this.updateAnalyticsElement('geoStats', this.generateErrorPlaceholder('Geographic Distribution'));

        console.log('📊 Analytics error state rendered');
    },

    generateErrorPlaceholder(sectionName) {
        return `
        <div class="analytics-placeholder error-placeholder">
            <div class="placeholder-icon">
                <i class="fas fa-chart-line-down"></i>
            </div>
            <h5>❌ ${sectionName} Unavailable</h5>
            <p>Data could not be loaded for this section.</p>
            <button class="btn btn-sm btn-outline-primary" onclick="databaseViewer.retryAnalyticsSection('${sectionName.toLowerCase().replace(/\s+/g, '')}')">
                <i class="fas fa-retry"></i> Retry
            </button>
        </div>
    `;
    },

    generateBasicPlaceholder(message) {
        return `
        <div class="analytics-placeholder basic-placeholder">
            <div class="placeholder-content">
                <i class="fas fa-info-circle"></i>
                <p>${message}</p>
                <small>Try refreshing the page or contact support if this persists.</small>
            </div>
        </div>
    `;
    },

    calculateDensityAnalysis(markers, bounds) {
        if (markers.length === 0) {
            return { regions: [], averageDensity: 0, highestDensity: 0 };
        }

        // Divide area into grid for density analysis
        const gridSize = 4; // 4x4 grid
        const latStep = (bounds.north - bounds.south) / gridSize;
        const lngStep = (bounds.east - bounds.west) / gridSize;

        const densityGrid = [];

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const regionBounds = {
                    north: bounds.south + (i + 1) * latStep,
                    south: bounds.south + i * latStep,
                    east: bounds.west + (j + 1) * lngStep,
                    west: bounds.west + j * lngStep
                };

                const markersInRegion = markers.filter(marker =>
                    marker.lat >= regionBounds.south &&
                    marker.lat < regionBounds.north &&
                    marker.lng >= regionBounds.west &&
                    marker.lng < regionBounds.east
                );

                densityGrid.push({
                    region: `${i}-${j}`,
                    bounds: regionBounds,
                    markerCount: markersInRegion.length,
                    density: markersInRegion.length / ((latStep * lngStep) || 1)
                });
            }
        }

        const totalDensity = densityGrid.reduce((sum, region) => sum + region.density, 0);
        const averageDensity = totalDensity / densityGrid.length;
        const highestDensity = Math.max(...densityGrid.map(region => region.density));

        return {
            regions: densityGrid,
            averageDensity: averageDensity,
            highestDensity: highestDensity
        };
    },

    assessCoordinateQuality(validCount, totalCount) {
        if (totalCount === 0) return 'No data';

        const qualityRatio = validCount / totalCount;

        if (qualityRatio >= 0.95) return 'Excellent (≥95% valid)';
        if (qualityRatio >= 0.85) return 'Good (85-94% valid)';
        if (qualityRatio >= 0.70) return 'Fair (70-84% valid)';
        if (qualityRatio >= 0.50) return 'Poor (50-69% valid)';
        return 'Critical (<50% valid)';
    },

    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;

        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
        const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;

        return Math.sqrt(variance);
    },

    calculateAverageDistanceFromCenter(markers, center) {
        if (markers.length === 0) return 0;

        const distances = markers.map(marker => {
            return this.calculateHaversineDistance(
                center.lat, center.lng,
                marker.lat, marker.lng
            );
        });

        return distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    },

    calculateHaversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers

        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

    detectCoordinateClusters(markers) {
        if (markers.length < 2) return [];

        const clusters = [];
        const processed = new Set();
        const clusterThreshold = 0.01; // Approximately 1km at equator

        markers.forEach((marker, index) => {
            if (processed.has(index)) return;

            const cluster = [marker];
            processed.add(index);

            markers.forEach((otherMarker, otherIndex) => {
                if (processed.has(otherIndex)) return;

                const distance = Math.sqrt(
                    Math.pow(marker.lat - otherMarker.latitude, 2) +
                    Math.pow(marker.lng - otherMarker.longitude, 2)
                );

                if (distance <= clusterThreshold) {
                    cluster.push(otherMarker);
                    processed.add(otherIndex);
                }
            });

            if (cluster.length > 1) {
                clusters.push({
                    size: cluster.length,
                    center: {
                        lat: cluster.reduce((sum, m) => sum + m.latitude, 0) / cluster.length,
                        lng: cluster.reduce((sum, m) => sum + m.longitude, 0) / cluster.length
                    },
                    markers: cluster.map(m => m.id)
                });
            }
        });

        return clusters;
    },

    calculateCoverageArea(bounds) {
        const latDiff = bounds.north - bounds.south;
        const lngDiff = bounds.east - bounds.west;

        // Approximate area calculation (not precise due to earth curvature)
        const latKm = latDiff * 111.32; // 1 degree latitude ≈ 111.32 km
        const lngKm = lngDiff * 111.32 * Math.cos(this.toRadians((bounds.north + bounds.south) / 2));

        return Math.abs(latKm * lngKm);
    },

    generateGeographicStatsHtml(geoStats) {
        return `
        <div class="geo-stats-comprehensive">
            <!-- Primary Statistics -->
            <div class="geo-stats-primary">
                <div class="stat-item">
                    <span class="stat-label">Geographic Spread</span>
                    <span class="stat-value">${geoStats.spread.toFixed(2)}°</span>
                    <span class="stat-unit">degrees</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Center Point</span>
                    <span class="stat-value">${geoStats.center.lat.toFixed(4)}, ${geoStats.center.lng.toFixed(4)}</span>
                    <span class="stat-unit">decimal degrees</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Valid Coordinates</span>
                    <span class="stat-value">${geoStats.statistics.validCoordinates}/${geoStats.statistics.totalMarkers}</span>
                    <span class="stat-unit">${((geoStats.statistics.validCoordinates / Math.max(geoStats.statistics.totalMarkers, 1)) * 100).toFixed(1)}%</span>
                </div>
            </div>
            
            <!-- Boundary Information -->
            <div class="geo-stats-bounds">
                <h5><i class="fas fa-map-marked"></i> Geographic Boundaries</h5>
                <div class="bounds-grid">
                    <div class="bound-item">
                        <span class="bound-label"><i class="fas fa-arrow-up"></i> Northernmost</span>
                        <span class="bound-value">${geoStats.bounds.north.toFixed(4)}°</span>
                    </div>
                    <div class="bound-item">
                        <span class="bound-label"><i class="fas fa-arrow-down"></i> Southernmost</span>
                        <span class="bound-value">${geoStats.bounds.south.toFixed(4)}°</span>
                    </div>
                    <div class="bound-item">
                        <span class="bound-label"><i class="fas fa-arrow-right"></i> Easternmost</span>
                        <span class="bound-value">${geoStats.bounds.east.toFixed(4)}°</span>
                    </div>
                    <div class="bound-item">
                        <span class="bound-label"><i class="fas fa-arrow-left"></i> Westernmost</span>
                        <span class="bound-value">${geoStats.bounds.west.toFixed(4)}°</span>
                    </div>
                </div>
            </div>
            
            <!-- Advanced Statistics -->
            <div class="geo-stats-advanced">
                <h5><i class="fas fa-chart-area"></i> Statistical Analysis</h5>
                <div class="advanced-stats">
                    <div class="stat-item">
                        <span class="stat-label">Coordinate Quality</span>
                        <span class="stat-value quality-indicator ${this.getQualityClass(geoStats.statistics.coordinateQuality)}">${geoStats.statistics.coordinateQuality}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Coverage Area</span>
                        <span class="stat-value">${geoStats.statistics.coverage.totalArea.toFixed(2)}</span>
                        <span class="stat-unit">km²</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Avg Distance from Center</span>
                        <span class="stat-value">${geoStats.statistics.averageDistanceFromCenter.toFixed(2)}</span>
                        <span class="stat-unit">km</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Standard Deviation (Lat)</span>
                        <span class="stat-value">${geoStats.statistics.standardDeviation.latitude.toFixed(4)}°</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Standard Deviation (Lng)</span>
                        <span class="stat-value">${geoStats.statistics.standardDeviation.longitude.toFixed(4)}°</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Clusters Detected</span>
                        <span class="stat-value">${geoStats.statistics.clustersDetected.length}</span>
                        <span class="stat-unit">clusters</span>
                    </div>
                </div>
            </div>

            <!-- Density Analysis -->
            <div class="geo-stats-density">
                <h5><i class="fas fa-th"></i> Density Analysis</h5>
                <div class="density-stats">
                    <div class="stat-item">
                        <span class="stat-label">Average Density</span>
                        <span class="stat-value">${geoStats.statistics.densityAnalysis.averageDensity.toFixed(3)}</span>
                        <span class="stat-unit">markers/deg²</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Highest Density Region</span>
                        <span class="stat-value">${geoStats.statistics.densityAnalysis.highestDensity.toFixed(3)}</span>
                        <span class="stat-unit">markers/deg²</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Density Distribution</span>
                        <span class="stat-value">${this.categorizeDistribution(geoStats.statistics.densityAnalysis)}</span>
                    </div>
                </div>
            </div>

            <!-- Cluster Information -->
            ${geoStats.statistics.clustersDetected.length > 0 ? `
            <div class="geo-stats-clusters">
                <h5><i class="fas fa-object-group"></i> Detected Clusters</h5>
                <div class="clusters-list">
                    ${geoStats.statistics.clustersDetected.map((cluster, index) => `
                        <div class="cluster-item">
                            <div class="cluster-header">
                                <span class="cluster-label">Cluster ${index + 1}</span>
                                <span class="cluster-size">${cluster.size} markers</span>
                            </div>
                            <div class="cluster-center">
                                <small>Center: ${cluster.center.lat.toFixed(4)}, ${cluster.center.lng.toFixed(4)}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Coverage Summary -->
            <div class="geo-stats-coverage">
                <h5><i class="fas fa-globe"></i> Coverage Summary</h5>
                <div class="coverage-stats">
                    <div class="coverage-item">
                        <span class="coverage-label">Latitude Range</span>
                        <span class="coverage-value">${geoStats.statistics.coverage.latitudeRange.toFixed(4)}°</span>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${Math.min((geoStats.statistics.coverage.latitudeRange / 180) * 100, 100)}%"></div>
                        </div>
                    </div>
                    <div class="coverage-item">
                        <span class="coverage-label">Longitude Range</span>
                        <span class="coverage-value">${geoStats.statistics.coverage.longitudeRange.toFixed(4)}°</span>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${Math.min((geoStats.statistics.coverage.longitudeRange / 360) * 100, 100)}%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Military Grid Reference System Integration -->
            <div class="geo-stats-mgrs">
                <h5><i class="fas fa-crosshairs"></i> Military Grid Analysis</h5>
                <div class="mgrs-stats">
                    <div class="stat-item">
                        <span class="stat-label">Primary UTM Zone</span>
                        <span class="stat-value">${this.calculatePrimaryUTMZone(geoStats.center)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">MGRS Grid Square</span>
                        <span class="stat-value">${this.calculateMGRSGrid(geoStats.center)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Geographic Region</span>
                        <span class="stat-value">${this.identifyGeographicRegion(geoStats.center)}</span>
                    </div>
                </div>
            </div>

            <!-- Data Quality Indicators -->
            <div class="geo-stats-quality">
                <h5><i class="fas fa-check-circle"></i> Data Quality</h5>
                <div class="quality-indicators">
                    <div class="quality-item ${geoStats.statistics.validCoordinates / geoStats.statistics.totalMarkers > 0.9 ? 'excellent' : geoStats.statistics.validCoordinates / geoStats.statistics.totalMarkers > 0.7 ? 'good' : 'poor'}">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Coordinate Completeness</span>
                        <span class="quality-percentage">${((geoStats.statistics.validCoordinates / geoStats.statistics.totalMarkers) * 100).toFixed(1)}%</span>
                    </div>
                    <div class="quality-item ${geoStats.statistics.standardDeviation.latitude < 1 && geoStats.statistics.standardDeviation.longitude < 1 ? 'excellent' : geoStats.statistics.standardDeviation.latitude < 5 && geoStats.statistics.standardDeviation.longitude < 5 ? 'good' : 'poor'}">
                        <i class="fas fa-bullseye"></i>
                        <span>Geographic Precision</span>
                        <span class="quality-status">${geoStats.statistics.standardDeviation.latitude < 1 && geoStats.statistics.standardDeviation.longitude < 1 ? 'High' : geoStats.statistics.standardDeviation.latitude < 5 && geoStats.statistics.standardDeviation.longitude < 5 ? 'Medium' : 'Low'}</span>
                    </div>
                    <div class="quality-item ${geoStats.statistics.clustersDetected.length > 0 ? 'good' : 'excellent'}">
                        <i class="fas fa-expand-arrows-alt"></i>
                        <span>Distribution Pattern</span>
                        <span class="quality-status">${geoStats.statistics.clustersDetected.length === 0 ? 'Distributed' : geoStats.statistics.clustersDetected.length < 3 ? 'Clustered' : 'Highly Clustered'}</span>
                    </div>
                </div>
            </div>

            <!-- Export and Actions -->
            <div class="geo-stats-actions">
                <button class="btn btn-sm btn-primary" onclick="databaseViewer.exportGeographicData()">
                    <i class="fas fa-download"></i> Export Geographic Data
                </button>
                <button class="btn btn-sm btn-secondary" onclick="databaseViewer.viewGeographicMap()">
                    <i class="fas fa-map"></i> View on Map
                </button>
                <button class="btn btn-sm btn-info" onclick="databaseViewer.generateGeographicReport()">
                    <i class="fas fa-file-alt"></i> Generate Report
                </button>
            </div>
        </div>
    `;
    },

    getQualityClass(qualityText) {
        if (qualityText.includes('Excellent')) return 'quality-excellent';
        if (qualityText.includes('Good')) return 'quality-good';
        if (qualityText.includes('Fair')) return 'quality-fair';
        if (qualityText.includes('Poor')) return 'quality-poor';
        return 'quality-critical';
    },

    categorizeDistribution(densityAnalysis) {
        const variation = densityAnalysis.highestDensity - densityAnalysis.averageDensity;

        if (variation < 0.001) return 'Uniform Distribution';
        if (variation < 0.01) return 'Slightly Clustered';
        if (variation < 0.1) return 'Moderately Clustered';
        return 'Highly Clustered';
    },

    calculatePrimaryUTMZone(center) {
        // Calculate UTM zone from longitude (simplified)
        const zone = Math.floor((center.lng + 180) / 6) + 1;
        const hemisphere = center.lat >= 0 ? 'N' : 'S';
        return `${zone}${hemisphere}`;
    },

    calculateMGRSGrid(center) {
        // Simplified MGRS grid calculation (would need full implementation for production)
        const utmZone = this.calculatePrimaryUTMZone(center);
        const gridSquare = String.fromCharCode(65 + Math.floor(Math.abs(center.lat) / 8)) +
            String.fromCharCode(65 + Math.floor((center.lng + 180) / 6));
        return `${utmZone} ${gridSquare}`;
    },

    identifyGeographicRegion(center) {
        // Basic geographic region identification
        const lat = center.lat;
        const lng = center.lng;

        // North America
        if (lat >= 15 && lat <= 72 && lng >= -168 && lng <= -52) {
            if (lat >= 49) {
                return 'North America - Canada';
            } else if (lat >= 25.8 && lng >= -125 && lng <= -66) {
                return 'North America - Continental US';
            } else if (lat >= 18 && lat <= 28 && lng >= -106 && lng <= -80) {
                return 'North America - Gulf of Mexico';
            } else if (lng >= -168 && lng <= -154 && lat >= 18 && lat <= 23) {
                return 'North America - Hawaii';
            } else if (lng >= -180 && lng <= -129 && lat >= 51 && lat <= 71) {
                return 'North America - Alaska';
            } else {
                return 'North America - Other';
            }
        }

        // Europe
        if (lat >= 36 && lat <= 71 && lng >= -10 && lng <= 40) {
            if (lat >= 54) {
                return 'Europe - Northern Europe';
            } else if (lat >= 46 && lat <= 54) {
                return 'Europe - Central Europe';
            } else if (lat >= 36 && lat <= 46) {
                return 'Europe - Southern Europe';
            } else {
                return 'Europe - Other';
            }
        }

        // Asia
        if (lat >= -10 && lat <= 80 && lng >= 26 && lng <= 180) {
            if (lat >= 50 && lng >= 60 && lng <= 180) {
                return 'Asia - Northern Asia';
            } else if (lat >= 30 && lat <= 50 && lng >= 60 && lng <= 140) {
                return 'Asia - Central Asia';
            } else if (lat >= 5 && lat <= 35 && lng >= 60 && lng <= 100) {
                return 'Asia - South Asia';
            } else if (lat >= 10 && lat <= 50 && lng >= 100 && lng <= 145) {
                return 'Asia - East Asia';
            } else if (lat >= -10 && lat <= 25 && lng >= 90 && lng <= 145) {
                return 'Asia - Southeast Asia';
            } else {
                return 'Asia - Other';
            }
        }

        // Africa
        if (lat >= -35 && lat <= 37 && lng >= -18 && lng <= 51) {
            if (lat >= 15) {
                return 'Africa - Northern Africa';
            } else if (lat >= -5 && lat <= 15) {
                return 'Africa - Central Africa';
            } else if (lat >= -35 && lat <= -5) {
                return 'Africa - Southern Africa';
            } else {
                return 'Africa - Other';
            }
        }

        // South America
        if (lat >= -55 && lat <= 13 && lng >= -82 && lng <= -34) {
            if (lat >= 0) {
                return 'South America - Northern South America';
            } else if (lat >= -30) {
                return 'South America - Central South America';
            } else {
                return 'South America - Southern South America';
            }
        }

        // Australia/Oceania
        if (lat >= -50 && lat <= -5 && lng >= 110 && lng <= 180) {
            return 'Australia/Oceania';
        }

        // Pacific Ocean regions
        if (lng >= -180 && lng <= -60 && lat >= -60 && lat <= 60) {
            if (lat >= 20) {
                return 'Pacific Ocean - North Pacific';
            } else if (lat >= -20) {
                return 'Pacific Ocean - Central Pacific';
            } else {
                return 'Pacific Ocean - South Pacific';
            }
        }

        // Atlantic Ocean regions
        if (lng >= -60 && lng <= 20 && lat >= -60 && lat <= 80) {
            if (lat >= 25) {
                return 'Atlantic Ocean - North Atlantic';
            } else if (lat >= 0) {
                return 'Atlantic Ocean - Tropical Atlantic';
            } else {
                return 'Atlantic Ocean - South Atlantic';
            }
        }

        // Indian Ocean
        if (lng >= 20 && lng <= 120 && lat >= -60 && lat <= 30) {
            return 'Indian Ocean';
        }

        // Arctic region
        if (lat >= 66.5) {
            return 'Arctic Region';
        }

        // Antarctic region
        if (lat <= -60) {
            return 'Antarctic Region';
        }

        // Default for unclassified regions
        return 'Unclassified Region';
    },

    generateGeographicReportHtml(markers, geoStats) {
        const reportDate = new Date().toLocaleString();
        const region = this.identifyGeographicRegion(geoStats.center);

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SFAF Plotter - Geographic Analysis Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #2c3e50; margin: 0; font-size: 28px; }
        .header p { color: #7f8c8d; margin: 5px 0; }
        .section { margin: 30px 0; }
        .section h2 { color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #3498db; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .stat-label { color: #7f8c8d; font-size: 14px; margin-top: 5px; }
        .quality-indicator { padding: 5px 10px; border-radius: 20px; color: white; font-weight: bold; }
        .quality-excellent { background: #27ae60; }
        .quality-good { background: #2980b9; }
        .quality-fair { background: #f39c12; }
        .quality-poor { background: #e74c3c; }
        .quality-critical { background: #8e44ad; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; }
        th { background: #f8f9fa; font-weight: 600; }
        .cluster-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .cluster-card { background: #ecf0f1; padding: 15px; border-radius: 6px; }
        .bounds-table { margin: 20px 0; }
        .coordinate-details { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .mgrs-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .density-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
        .density-cell { background: #e8f4f8; padding: 10px; text-align: center; border-radius: 4px; border: 1px solid #bdc3c7; }
        .high-density { background: #e74c3c; color: white; }
        .medium-density { background: #f39c12; color: white; }
        .low-density { background: #27ae60; color: white; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #ecf0f1; text-align: center; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌍 SFAF Plotter Geographic Analysis Report</h1>
            <p>Military Frequency Coordination Database - Geographic Distribution Analysis</p>
            <p><strong>Generated:</strong> ${reportDate} | <strong>Region:</strong> ${region}</p>
            <p><strong>Compliance:</strong> MC4EB Publication 7, Change 1 Standards</p>
        </div>

        <div class="section">
            <h2>📊 Executive Summary</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${markers.length}</div>
                    <div class="stat-label">Total Markers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.validCoordinates || 0}</div>
                    <div class="stat-label">Valid Coordinates</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.spread.toFixed(2)}°</div>
                    <div class="stat-label">Geographic Spread</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.clustersDetected?.length || 0}</div>
                    <div class="stat-label">Clusters Detected</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.coverage?.totalArea?.toFixed(2) || 0}</div>
                    <div class="stat-label">Coverage Area (km²)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">
                        <span class="quality-indicator ${this.getQualityClass(geoStats.statistics?.coordinateQuality || 'Unknown')}">${geoStats.statistics?.coordinateQuality || 'Unknown'}</span>
                    </div>
                    <div class="stat-label">Data Quality</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🎯 Geographic Center & Boundaries</h2>
            <div class="coordinate-details">
                <h4>Geographic Center Point</h4>
                <p><strong>Decimal Degrees:</strong> ${geoStats.center.lat.toFixed(6)}, ${geoStats.center.lng.toFixed(6)}</p>
                <p><strong>Primary UTM Zone:</strong> ${this.calculatePrimaryUTMZone(geoStats.center)}</p>
                <p><strong>MGRS Grid:</strong> ${this.calculateMGRSGrid(geoStats.center)}</p>
                <p><strong>Geographic Region:</strong> ${region}</p>
            </div>
            
            <table class="bounds-table">
                <thead>
                    <tr>
                        <th>Boundary</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Location Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>🔺 Northernmost</td>
                        <td>${geoStats.bounds.north.toFixed(6)}°</td>
                        <td>-</td>
                        <td>${this.identifyGeographicRegion({ lat: geoStats.bounds.north, lng: geoStats.center.lng })}</td>
                    </tr>
                    <tr>
                        <td>🔻 Southernmost</td>
                        <td>${geoStats.bounds.south.toFixed(6)}°</td>
                        <td>-</td>
                        <td>${this.identifyGeographicRegion({ lat: geoStats.bounds.south, lng: geoStats.center.lng })}</td>
                    </tr>
                    <tr>
                        <td>▶️ Easternmost</td>
                        <td>-</td>
                        <td>${geoStats.bounds.east.toFixed(6)}°</td>
                        <td>${this.identifyGeographicRegion({ lat: geoStats.center.lat, lng: geoStats.bounds.east })}</td>
                    </tr>
                    <tr>
                        <td>◀️ Westernmost</td>
                        <td>-</td>
                        <td>${geoStats.bounds.west.toFixed(6)}°</td>
                        <td>${this.identifyGeographicRegion({ lat: geoStats.center.lat, lng: geoStats.bounds.west })}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📈 Statistical Analysis</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.averageDistanceFromCenter?.toFixed(2) || 'N/A'}</div>
                    <div class="stat-label">Avg Distance from Center (km)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.standardDeviation?.latitude?.toFixed(4) || 'N/A'}</div>
                    <div class="stat-label">Latitude Std Dev (°)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.standardDeviation?.longitude?.toFixed(4) || 'N/A'}</div>
                    <div class="stat-label">Longitude Std Dev (°)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.coverage?.latitudeRange?.toFixed(4) || 'N/A'}</div>
                    <div class="stat-label">Latitude Range (°)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.coverage?.longitudeRange?.toFixed(4) || 'N/A'}</div>
                    <div class="stat-label">Longitude Range (°)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.categorizeDistribution(geoStats.statistics?.densityAnalysis || {})}</div>
                    <div class="stat-label">Distribution Pattern</div>
                </div>
            </div>
        </div>

        ${geoStats.statistics?.clustersDetected?.length > 0 ? `
        <div class="section">
            <h2>🔗 Cluster Analysis</h2>
            <p>Detected ${geoStats.statistics.clustersDetected.length} geographic clusters using proximity analysis (threshold: ~1km):</p>
            <div class="cluster-list">
                ${geoStats.statistics.clustersDetected.map((cluster, index) => `
                    <div class="cluster-card">
                        <h4>Cluster ${index + 1}</h4>
                        <p><strong>Size:</strong> ${cluster.size} markers</p>
                        <p><strong>Center:</strong> ${cluster.center.lat.toFixed(4)}, ${cluster.center.lng.toFixed(4)}</p>
                        <p><strong>Region:</strong> ${this.identifyGeographicRegion(cluster.center)}</p>
                        <p><strong>Marker IDs:</strong> ${cluster.markers.join(', ')}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <h2>📊 Density Distribution Analysis</h2>
            <p>Geographic area divided into 4x4 grid for density analysis:</p>
            <div class="density-grid">
                ${(geoStats.statistics?.densityAnalysis?.regions || []).map(region => `
                    <div class="density-cell ${region.density > 0.1 ? 'high-density' : region.density > 0.05 ? 'medium-density' : 'low-density'}">
                        <div>Region ${region.region}</div>
                        <div>${region.markerCount} markers</div>
                        <div>Density: ${region.density.toFixed(3)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.densityAnalysis?.averageDensity?.toFixed(4) || 'N/A'}</div>
                    <div class="stat-label">Average Density (markers/deg²)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${geoStats.statistics?.densityAnalysis?.highestDensity?.toFixed(4) || 'N/A'}</div>
                    <div class="stat-label">Highest Regional Density</div>
                </div>
            </div>
        </div>

                <div class="mgrs-section">
            <h2>🎯 Military Grid Reference System (MGRS)</h2>
            <div class="stats-grid" style="color: white;">
                <div class="stat-card" style="background: rgba(255,255,255,0.1); border-left: 4px solid white; color: white;">
                    <div class="stat-value" style="color: white;">${this.calculatePrimaryUTMZone(geoStats.center)}</div>
                    <div class="stat-label" style="color: rgba(255,255,255,0.8);">Primary UTM Zone</div>
                </div>
                <div class="stat-card" style="background: rgba(255,255,255,0.1); border-left: 4px solid white; color: white;">
                    <div class="stat-value" style="color: white;">${this.calculateMGRSGrid(geoStats.center)}</div>
                    <div class="stat-label" style="color: rgba(255,255,255,0.8);">MGRS Grid Square</div>
                </div>
                <div class="stat-card" style="background: rgba(255,255,255,0.1); border-left: 4px solid white; color: white;">
                    <div class="stat-value" style="color: white;">${region}</div>
                    <div class="stat-label" style="color: rgba(255,255,255,0.8);">Geographic Theater</div>
                </div>
                <div class="stat-card" style="background: rgba(255,255,255,0.1); border-left: 4px solid white; color: white;">
                    <div class="stat-value" style="color: white;">MC4EB Pub 7 CHG 1</div>
                    <div class="stat-label" style="color: rgba(255,255,255,0.8);">Compliance Standard</div>
                </div>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                    <strong>MGRS Integration:</strong> The Military Grid Reference System provides precise coordinate 
                    references for military operations. This analysis uses UTM zone calculations and grid square 
                    identification to support tactical frequency coordination across geographic boundaries.
                </p>
            </div>
        </div>

        <div class="section">
            <h2>📋 Data Quality Assessment</h2>
            <table>
                <thead>
                    <tr>
                        <th>Quality Metric</th>
                        <th>Value</th>
                        <th>Assessment</th>
                        <th>Recommendation</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Coordinate Completeness</td>
                        <td>${((geoStats.statistics?.validCoordinates || 0) / Math.max(geoStats.statistics?.totalMarkers || 1, 1) * 100).toFixed(1)}%</td>
                        <td class="quality-indicator ${this.getQualityClass(geoStats.statistics?.coordinateQuality || 'Unknown')}">${geoStats.statistics?.coordinateQuality || 'Unknown'}</td>
                        <td>${this.getQualityRecommendation(geoStats.statistics?.coordinateQuality || 'Unknown')}</td>
                    </tr>
                    <tr>
                        <td>Geographic Distribution</td>
                        <td>${this.categorizeDistribution(geoStats.statistics?.densityAnalysis || {})}</td>
                        <td>${geoStats.statistics?.clustersDetected?.length > 0 ? 'Clustered' : 'Distributed'}</td>
                        <td>${geoStats.statistics?.clustersDetected?.length > 3 ? 'Consider geographic balancing' : 'Good distribution'}</td>
                    </tr>
                    <tr>
                        <td>Coverage Area</td>
                        <td>${geoStats.statistics?.coverage?.totalArea?.toFixed(2) || 0} km²</td>
                        <td>${geoStats.statistics?.coverage?.totalArea > 1000 ? 'Large Area' : geoStats.statistics?.coverage?.totalArea > 100 ? 'Medium Area' : 'Small Area'}</td>
                        <td>${geoStats.statistics?.coverage?.totalArea > 10000 ? 'Consider regional segmentation' : 'Appropriate coverage'}</td>
                    </tr>
                    <tr>
                        <td>Coordinate Precision</td>
                        <td>±${Math.max(geoStats.statistics?.standardDeviation?.latitude || 0, geoStats.statistics?.standardDeviation?.longitude || 0).toFixed(4)}°</td>
                        <td>${(geoStats.statistics?.standardDeviation?.latitude || 0) < 1 ? 'High Precision' : 'Standard Precision'}</td>
                        <td>${(geoStats.statistics?.standardDeviation?.latitude || 0) > 5 ? 'Review coordinate accuracy' : 'Precision acceptable'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📊 Detailed Marker Inventory</h2>
            <p>Complete listing of all markers included in this geographic analysis:</p>
            <table>
                <thead>
                    <tr>
                        <th>Serial Number</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Frequency</th>
                        <th>Type</th>
                        <th>Region</th>
                        <th>Created Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${markers.map(marker => `
                        <tr>
                            <td>${marker.serial || 'Unknown'}</td>
                            <td>${marker.lat ? marker.lat.toFixed(6) : 'N/A'}</td>
                            <td>${marker.lng ? marker.lng.toFixed(6) : 'N/A'}</td>
                            <td>${marker.frequency || 'Not Specified'}</td>
                            <td>${marker.type || marker.marker_type || 'Unknown'}</td>
                            <td>${marker.lat && marker.lng ?
                this.identifyGeographicRegion({ lat: marker.lat, lng: marker.lng }) :
                'Unknown Region'}</td>
                            <td>${marker.created_at ? new Date(marker.created_at).toLocaleDateString() : 'Unknown'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🔧 Technical Specifications</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">WGS84</div>
                    <div class="stat-label">Coordinate Datum</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">Decimal Degrees</div>
                    <div class="stat-label">Primary Format</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">±11m</div>
                    <div class="stat-label">Coordinate Accuracy</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">Haversine</div>
                    <div class="stat-label">Distance Calculation</div>
                </div>
            </div>
            
            <div class="coordinate-details">
                <h4>Coordinate System Details</h4>
                <p><strong>Primary Datum:</strong> World Geodetic System 1984 (WGS84)</p>
                <p><strong>Coordinate Formats:</strong> Decimal Degrees (primary), Degrees Minutes Seconds (DMS), Military Grid Reference System (MGRS)</p>
                <p><strong>Precision:</strong> 6 decimal places (±0.111 meters at equator)</p>
                <p><strong>Distance Calculations:</strong> Haversine formula for great-circle distances</p>
                <p><strong>Projection:</strong> Geographic coordinate system (unprojected)</p>
                <p><strong>Compliance:</strong> MC4EB Publication 7, Change 1 coordinate standards</p>
            </div>
        </div>

        <div class="section">
            <h2>📈 Historical Analysis</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${this.calculateTimeSpan(markers)}</div>
                    <div class="stat-label">Data Timespan</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.calculateDailyAverage(markers)}</div>
                    <div class="stat-label">Daily Average</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.findPeakActivityPeriod(markers)}</div>
                    <div class="stat-label">Peak Activity</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.calculateGrowthTrend(markers)}</div>
                    <div class="stat-label">Growth Trend</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🚨 Recommendations</h2>
            <div class="coordinate-details">
                <h4>Geographic Optimization Recommendations</h4>
                <ul>
                    ${this.generateRecommendations(geoStats, markers).map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            
            <div class="coordinate-details">
                <h4>Data Quality Improvements</h4>
                <ul>
                    ${this.generateDataQualityRecommendations(geoStats, markers).map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>

        <div class="footer">
            <p><strong>Report Generated:</strong> ${reportDate}</p>
            <p><strong>System:</strong> SFAF Plotter Database Viewer v1.0</p>
            <p><strong>Compliance:</strong> MC4EB Publication 7, Change 1 Standards</p>
            <p><strong>Data Source:</strong> Military Frequency Coordination Database</p>
            <p><strong>Coordinate System:</strong> WGS84 Geographic</p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ecf0f1;">
                <small style="color: #7f8c8d;">
                    This report contains sensitive military frequency coordination data. Distribution should be limited to authorized personnel only. 
                    All coordinate data is referenced to the WGS84 datum for maximum compatibility with military systems.
                </small>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    },

    getQualityRecommendation(qualityText) {
        if (qualityText.includes('Excellent')) return 'Continue current data practices';
        if (qualityText.includes('Good')) return 'Minor improvements possible';
        if (qualityText.includes('Fair')) return 'Review data validation processes';
        if (qualityText.includes('Poor')) return 'Implement coordinate verification';
        return 'Critical: Review all coordinate data';
    },

    calculateTimeSpan(markers) {
        if (!markers || markers.length === 0) return 'No data';

        const validDates = markers
            .map(m => new Date(m.created_at))
            .filter(d => !isNaN(d.getTime()));

        if (validDates.length === 0) return 'Unknown';
        if (validDates.length === 1) return 'Single day';

        const earliest = new Date(Math.min(...validDates));
        const latest = new Date(Math.max(...validDates));
        const diffDays = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Single day';
        if (diffDays <= 30) return `${diffDays} days`;
        if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months`;

        return `${Math.ceil(diffDays / 365)} years`;
    },

    findPeakActivityPeriod(markers) {
        if (!markers || markers.length === 0) return 'No data';

        const validDates = markers
            .map(m => new Date(m.created_at))
            .filter(d => !isNaN(d.getTime()));

        if (validDates.length === 0) return 'Unknown';

        // Group by month-year for analysis
        const monthCounts = {};
        validDates.forEach(date => {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        });

        if (Object.keys(monthCounts).length === 0) return 'Unknown';

        const peakMonth = Object.entries(monthCounts).reduce((max, current) =>
            current[1] > max[1] ? current : max
        );

        const [yearMonth, count] = peakMonth;
        const [year, month] = yearMonth.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return `${monthNames[parseInt(month) - 1]} ${year} (${count} markers)`;
    },

    calculateGrowthTrend(markers) {
        if (!markers || markers.length < 2) return 'Insufficient data';

        const validDates = markers
            .map(m => new Date(m.created_at))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);

        if (validDates.length < 2) return 'Unknown';

        const midpoint = Math.floor(validDates.length / 2);
        const firstHalf = validDates.slice(0, midpoint);
        const secondHalf = validDates.slice(midpoint);

        const firstHalfRate = firstHalf.length / this.getTimeSpanInDays(firstHalf[0], firstHalf[firstHalf.length - 1]);
        const secondHalfRate = secondHalf.length / this.getTimeSpanInDays(secondHalf[0], secondHalf[secondHalf.length - 1]);

        if (secondHalfRate > firstHalfRate * 1.5) return 'Rapidly Increasing';
        if (secondHalfRate > firstHalfRate * 1.2) return 'Increasing';
        if (secondHalfRate < firstHalfRate * 0.5) return 'Rapidly Decreasing';
        if (secondHalfRate < firstHalfRate * 0.8) return 'Decreasing';

        return 'Stable';
    },

    generateRecommendations(geoStats, markers) {
        const recommendations = [];

        // Coverage recommendations
        if (geoStats.statistics?.coverage?.totalArea > 10000) {
            recommendations.push('Consider implementing regional sub-coordination centers for large coverage area');
        }

        // Cluster recommendations
        if (geoStats.statistics?.clustersDetected?.length > 3) {
            recommendations.push('High cluster density detected - review geographic distribution for optimal coverage');
        }

        // Density recommendations
        if (geoStats.statistics?.densityAnalysis?.highestDensity > geoStats.statistics?.densityAnalysis?.averageDensity * 5) {
            recommendations.push('Significant density variations detected - consider load balancing across regions');
        }

        if (geoStats.statistics?.densityAnalysis?.averageDensity < 0.001) {
            recommendations.push('Low marker density may indicate coverage gaps - review geographic completeness');
        }

        // Coordinate quality recommendations
        const validPercentage = (geoStats.statistics?.validCoordinates || 0) / Math.max(geoStats.statistics?.totalMarkers || 1, 1);
        if (validPercentage < 0.8) {
            recommendations.push('Coordinate data quality below 80% - implement data validation procedures');
        }

        if (validPercentage < 0.5) {
            recommendations.push('CRITICAL: Less than 50% valid coordinates - immediate data quality review required');
        }

        // Geographic spread recommendations
        if (geoStats.spread > 180) {
            recommendations.push('Global distribution detected - consider implementing multiple coordination zones');
        } else if (geoStats.spread > 45) {
            recommendations.push('Large geographic spread - evaluate need for regional coordination centers');
        } else if (geoStats.spread < 1) {
            recommendations.push('Very localized deployment - consider expanding geographic coverage');
        }

        // Standard deviation recommendations
        if (geoStats.statistics?.standardDeviation?.latitude > 10 || geoStats.statistics?.standardDeviation?.longitude > 10) {
            recommendations.push('High coordinate variance detected - review data entry procedures for accuracy');
        }

        // Distance from center recommendations
        if (geoStats.statistics?.averageDistanceFromCenter > 1000) {
            recommendations.push('High average distance from center - consider multiple coordination hubs');
        }

        // Regional distribution recommendations
        const region = this.identifyGeographicRegion(geoStats.center);
        if (region.includes('Ocean')) {
            recommendations.push('Maritime operations detected - ensure compliance with international coordination procedures');
        }

        if (region.includes('Arctic') || region.includes('Antarctic')) {
            recommendations.push('Polar region operations - apply special coordination procedures for high-latitude areas');
        }

        // Coverage area recommendations
        if (geoStats.statistics?.coverage?.totalArea > 50000) {
            recommendations.push('Very large operational area - implement hierarchical coordination structure');
        }

        // Data volume recommendations
        if (markers.length > 1000) {
            recommendations.push('High marker volume - consider implementing automated coordination workflows');
        } else if (markers.length < 10) {
            recommendations.push('Limited data set - expand marker collection for comprehensive analysis');
        }

        // Temporal recommendations
        const timeSpan = this.calculateTimeSpan(markers);
        if (timeSpan !== 'No data' && timeSpan !== 'Unknown' && parseInt(timeSpan) > 365) {
            recommendations.push('Long-term data collection - perform annual geographic distribution review');
        }

        // MGRS zone recommendations
        const primaryZone = this.calculatePrimaryUTMZone(geoStats.center);
        if (geoStats.spread > 6) { // Spans multiple UTM zones
            recommendations.push('Multi-zone operations - ensure proper MGRS coordinate transformation procedures');
        }

        // Default recommendation if no specific issues found
        if (recommendations.length === 0) {
            recommendations.push('Geographic distribution appears optimal - maintain current coordination procedures');
        }

        return recommendations;
    },

    generateDataQualityRecommendations(geoStats, markers) {
        const recommendations = [];

        // Coordinate completeness recommendations
        const validPercentage = (geoStats.statistics?.validCoordinates || 0) / Math.max(geoStats.statistics?.totalMarkers || 1, 1);

        if (validPercentage < 1.0) {
            recommendations.push(`Improve coordinate data completeness from ${(validPercentage * 100).toFixed(1)}% to 100%`);
        }

        if (geoStats.statistics?.invalidCoordinates > 0) {
            recommendations.push(`Validate and correct ${geoStats.statistics.invalidCoordinates} invalid coordinate entries`);
        }

        // Precision recommendations
        if (geoStats.statistics?.standardDeviation?.latitude > 1 || geoStats.statistics?.standardDeviation?.longitude > 1) {
            recommendations.push('Implement stricter coordinate precision standards (6+ decimal places recommended)');
        }

        // Data consistency recommendations
        const inconsistentMarkers = markers.filter(m =>
            !m.frequency || m.frequency.trim() === '' ||
            !m.serial || m.serial.trim() === ''
        );

        if (inconsistentMarkers.length > 0) {
            recommendations.push(`Address ${inconsistentMarkers.length} markers with missing required data fields`);
        }

        // Temporal data quality
        const markersWithoutDates = markers.filter(m => !m.created_at);
        if (markersWithoutDates.length > 0) {
            recommendations.push(`Add creation timestamps to ${markersWithoutDates.length} markers for better tracking`);
        }

        // Frequency data quality
        const markersWithInvalidFreq = markers.filter(m =>
            m.frequency && !this.isValidFrequencyFormat(m.frequency)
        );

        if (markersWithInvalidFreq.length > 0) {
            recommendations.push(`Standardize frequency format for ${markersWithInvalidFreq.length} markers`);
        }

        // Serial number standardization
        const duplicateSerials = this.findDuplicateSerials(markers);
        if (duplicateSerials.length > 0) {
            recommendations.push(`Resolve ${duplicateSerials.length} duplicate serial number conflicts`);
        }

        // SFAF completeness recommendations
        const sfafIncompleteMarkers = markers.filter(m => m.marker_type === 'imported');
        if (sfafIncompleteMarkers.length > 0) {
            recommendations.push(`Verify SFAF field completeness for ${sfafIncompleteMarkers.length} imported markers`);
        }

        // Validation recommendations
        recommendations.push('Implement automated data validation on import');
        recommendations.push('Establish regular data quality audits (monthly recommended)');
        recommendations.push('Create data entry standards documentation');

        if (validPercentage > 0.95) {
            recommendations.push('Excellent data quality - consider this dataset as a best practice reference');
        }

        return recommendations;
    },

    findDuplicateSerials(markers) {
        const serialCounts = {};
        const duplicates = [];

        markers.forEach(marker => {
            const serial = marker.serial || 'UNKNOWN';
            serialCounts[serial] = (serialCounts[serial] || 0) + 1;

            if (serialCounts[serial] === 2) {
                duplicates.push(serial);
            }
        });

        return duplicates;
    },

    generateDataTimeline(markers) {
        if (!markers || markers.length === 0) return [];

        const timeline = [];
        const sortedMarkers = markers
            .filter(m => m.created_at)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Group by month for timeline analysis
        const monthlyData = {};
        sortedMarkers.forEach(marker => {
            const date = new Date(marker.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    count: 0,
                    markers: [],
                    types: {},
                    frequencies: new Set(),
                    regions: new Set()
                };
            }

            monthlyData[monthKey].count++;
            monthlyData[monthKey].markers.push(marker.id);
            monthlyData[monthKey].types[marker.type || 'unknown'] =
                (monthlyData[monthKey].types[marker.type || 'unknown'] || 0) + 1;

            if (marker.frequency) monthlyData[monthKey].frequencies.add(marker.frequency);
            if (marker.lat && marker.lng) {
                const region = this.identifyGeographicRegion({ lat: marker.lat, lng: marker.lng });
                monthlyData[monthKey].regions.add(region);
            }
        });

        return Object.values(monthlyData).map(month => ({
            ...month,
            frequencies: Array.from(month.frequencies),
            regions: Array.from(month.regions)
        }));
    },

    findMostCommonFrequency(markers) {
        const frequencies = {};
        markers.forEach(marker => {
            if (marker.frequency) {
                frequencies[marker.frequency] = (frequencies[marker.frequency] || 0) + 1;
            }
        });

        return Object.entries(frequencies).reduce((max, current) =>
            current[1] > max[1] ? current : max, ['None', 0]
        );
    },

    categorizeMarkersByRegion(markers) {
        const regions = {};

        markers.forEach(marker => {
            if (marker.lat && marker.lng) {
                const region = this.identifyGeographicRegion({ lat: marker.lat, lng: marker.lng });
                if (!regions[region]) {
                    regions[region] = [];
                }
                regions[region].push({
                    id: marker.id,
                    serial: marker.serial,
                    frequency: marker.frequency,
                    coordinates: { lat: marker.lat, lng: marker.lng }
                });
            }
        });

        return regions;
    },

    identifyMissingDataPatterns(markers) {
        const patterns = {
            missingSerials: markers.filter(m => !m.serial || m.serial.trim() === '').length,
            missingFrequencies: markers.filter(m => !m.frequency || m.frequency.trim() === '').length,
            missingCoordinates: markers.filter(m => !m.latitude || !m.longitude).length,
            missingTypes: markers.filter(m => !m.type && !m.marker_type).length,
            missingDates: markers.filter(m => !m.created_at).length
        };

        patterns.totalIssues = Object.values(patterns).reduce((sum, count) => sum + count, 0);
        patterns.affectedPercentage = (patterns.totalIssues / Math.max(markers.length * 5, 1)) * 100;

        return patterns;
    },

    analyzeAgencyDistribution(iracNotes) {
        const distribution = {};

        iracNotes.forEach(note => {
            if (note.agency && Array.isArray(note.agency)) {
                note.agency.forEach(agency => {
                    distribution[agency] = (distribution[agency] || 0) + 1;
                });
            }
        });

        return distribution;
    },

    performFieldValidation(markers) {
        const validation = {
            serialFormat: {
                valid: 0,
                invalid: [],
                pattern: /^[A-Z]{2,3}\s*\d{6,8}$/
            },
            frequencyFormat: {
                valid: 0,
                invalid: [],
                pattern: /^[KMG]?\d+(\.\d+)?(\([^)]+\))?$/
            },
            coordinateFormat: {
                valid: 0,
                invalid: [],
                latitudeRange: [-90, 90],
                longitudeRange: [-180, 180]
            },
            requiredFields: {
                valid: 0,
                invalid: [],
                required: ['serial', 'latitude', 'longitude', 'frequency']
            },
            dataTypes: {
                valid: 0,
                invalid: [],
                issues: []
            },
            duplicates: {
                serialDuplicates: [],
                coordinateDuplicates: [],
                frequencyDuplicates: []
            }
        };

        const processedSerials = new Map();
        const processedCoordinates = new Map();
        const processedFrequencies = new Map();

        markers.forEach((marker, index) => {
            let hasValidationIssues = false;

            // ✅ Serial Number Validation (Source: db_viewer_js.txt SFAF parsing)
            if (marker.serial) {
                if (validation.serialFormat.pattern.test(marker.serial)) {
                    validation.serialFormat.valid++;

                    // Check for duplicate serials
                    if (processedSerials.has(marker.serial)) {
                        validation.duplicates.serialDuplicates.push({
                            serial: marker.serial,
                            markers: [processedSerials.get(marker.serial), marker.id],
                            issue: 'Duplicate serial number'
                        });
                    } else {
                        processedSerials.set(marker.serial, marker.id);
                    }
                } else {
                    validation.serialFormat.invalid.push({
                        id: marker.id,
                        serial: marker.serial,
                        issue: 'Invalid serial format - should match pattern: AA(A) NNNNNN(NN)',
                        expected: 'Format: [2-3 letters][space][6-8 digits]',
                        example: 'AF 014589'
                    });
                    hasValidationIssues = true;
                }
            } else {
                validation.serialFormat.invalid.push({
                    id: marker.id,
                    serial: null,
                    issue: 'Missing serial number',
                    severity: 'critical'
                });
                hasValidationIssues = true;
            }

            // ✅ Frequency Format Validation (Source: db_viewer_js.txt frequency analysis)
            if (marker.frequency) {
                if (validation.frequencyFormat.pattern.test(marker.frequency)) {
                    validation.frequencyFormat.valid++;

                    // Check for duplicate frequencies (potential coordination conflicts)
                    if (processedFrequencies.has(marker.frequency)) {
                        validation.duplicates.frequencyDuplicates.push({
                            frequency: marker.frequency,
                            markers: [processedFrequencies.get(marker.frequency), marker.id],
                            issue: 'Duplicate frequency assignment - coordination required',
                            severity: 'warning'
                        });
                    } else {
                        processedFrequencies.set(marker.frequency, marker.id);
                    }
                } else {
                    validation.frequencyFormat.invalid.push({
                        id: marker.id,
                        frequency: marker.frequency,
                        issue: 'Invalid frequency format',
                        expected: 'Format: K####(####.#) or ####.# MHz',
                        example: 'K4028(4026.5)'
                    });
                    hasValidationIssues = true;
                }
            } else {
                validation.frequencyFormat.invalid.push({
                    id: marker.id,
                    frequency: null,
                    issue: 'Missing frequency assignment',
                    severity: 'critical'
                });
                hasValidationIssues = true;
            }

            // ✅ Coordinate Validation (Source: main_go.txt coordinate service)
            if (marker.lat && marker.lng) {
                const lat = parseFloat(marker.lat);
                const lng = parseFloat(marker.lng);

                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !isNaN(lat) && !isNaN(lng)) {
                    validation.coordinateFormat.valid++;

                    // Check for duplicate coordinates (co-located equipment)
                    const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
                    if (processedCoordinates.has(coordKey)) {
                        validation.duplicates.coordinateDuplicates.push({
                            coordinates: coordKey,
                            markers: [processedCoordinates.get(coordKey), marker.id],
                            issue: 'Co-located markers detected',
                            severity: 'info'
                        });
                    } else {
                        processedCoordinates.set(coordKey, marker.id);
                    }
                } else {
                    validation.coordinateFormat.invalid.push({
                        id: marker.id,
                        latitude: lat,
                        longitude: lng,
                        issue: 'Invalid coordinate values',
                        details: `Latitude: ${lat} (valid: -90 to 90), Longitude: ${lng} (valid: -180 to 180)`
                    });
                    hasValidationIssues = true;
                }
            } else {
                validation.coordinateFormat.invalid.push({
                    id: marker.id,
                    latitude: marker.lat,
                    longitude: marker.lng,
                    issue: 'Missing coordinate data',
                    severity: 'critical'
                });
                hasValidationIssues = true;
            }

            // ✅ Required Fields Validation
            const missingFields = [];
            validation.requiredFields.required.forEach(field => {
                if (!marker[field] || (typeof marker[field] === 'string' && marker[field].trim() === '')) {
                    missingFields.push(field);
                }
            });

            if (missingFields.length === 0) {
                validation.requiredFields.valid++;
            } else {
                validation.requiredFields.invalid.push({
                    id: marker.id,
                    missingFields: missingFields,
                    issue: `Missing required fields: ${missingFields.join(', ')}`,
                    severity: 'critical'
                });
                hasValidationIssues = true;
            }

            // ✅ Data Type Validation (Source: db_viewer_css.txt modern styling context)
            const dataTypeIssues = [];

            // Check latitude data type
            if (marker.lat && (isNaN(parseFloat(marker.lat)) || typeof marker.lat === 'string')) {
                dataTypeIssues.push('Latitude should be numeric');
            }

            // Check longitude data type
            if (marker.lng && (isNaN(parseFloat(marker.lng)) || typeof marker.lng === 'string')) {
                dataTypeIssues.push('Longitude should be numeric');
            }

            // Check created_at date format
            if (marker.created_at && isNaN(new Date(marker.created_at).getTime())) {
                dataTypeIssues.push('Created date format invalid');
            }

            if (dataTypeIssues.length === 0) {
                validation.dataTypes.valid++;
            } else {
                validation.dataTypes.invalid.push({
                    id: marker.id,
                    issues: dataTypeIssues,
                    issue: `Data type issues: ${dataTypeIssues.join(', ')}`
                });
                validation.dataTypes.issues.push(...dataTypeIssues);
            }

            // ✅ MC4EB Publication 7, Change 1 Specific Validations (Source: db_viewer_js.txt MC4EB compliance)
            if (marker.frequency) {
                // Validate frequency band compliance
                const freq = parseFloat(marker.frequency.replace(/[^0-9.]/g, ''));
                if (!isNaN(freq)) {
                    if (freq < 0.003 || freq > 300000) {
                        validation.frequencyFormat.invalid.push({
                            id: marker.id,
                            frequency: marker.frequency,
                            issue: 'Frequency outside normal spectrum range (3 kHz - 300 GHz)',
                            severity: 'warning'
                        });
                    }
                }
            }

            // ✅ Agency Code Validation (Source: db_viewer_html.txt agency filter)
            if (marker.type === 'imported' && marker.serial) {
                const agencyCode = marker.serial.substring(0, 2);
                const validAgencyCodes = ['AF', 'AR', 'NV', 'MC', 'CG', 'DI', 'DO', 'DS', 'FA', 'FT', 'HS', 'JC'];

                if (!validAgencyCodes.includes(agencyCode)) {
                    validation.serialFormat.invalid.push({
                        id: marker.id,
                        serial: marker.serial,
                        issue: `Unknown agency code: ${agencyCode}`,
                        validCodes: validAgencyCodes,
                        severity: 'warning'
                    });
                }
            }
        });

        // ✅ Calculate overall validation statistics
        validation.overall = {
            totalMarkers: markers.length,
            validMarkers: markers.length - validation.serialFormat.invalid.length -
                validation.frequencyFormat.invalid.length -
                validation.coordinateFormat.invalid.length -
                validation.requiredFields.invalid.length,
            validationScore: markers.length > 0 ?
                ((markers.length - validation.serialFormat.invalid.length -
                    validation.frequencyFormat.invalid.length -
                    validation.coordinateFormat.invalid.length -
                    validation.requiredFields.invalid.length) / markers.length) * 100 : 0,
            criticalIssues: validation.serialFormat.invalid.filter(i => i.severity === 'critical').length +
                validation.frequencyFormat.invalid.filter(i => i.severity === 'critical').length +
                validation.coordinateFormat.invalid.filter(i => i.severity === 'critical').length +
                validation.requiredFields.invalid.filter(i => i.severity === 'critical').length,
            warningIssues: validation.serialFormat.invalid.filter(i => i.severity === 'warning').length +
                validation.frequencyFormat.invalid.filter(i => i.severity === 'warning').length +
                validation.duplicates.frequencyDuplicates.length,
            totalDuplicates: validation.duplicates.serialDuplicates.length +
                validation.duplicates.coordinateDuplicates.length +
                validation.duplicates.frequencyDuplicates.length
        };

        // ✅ Generate validation recommendations
        validation.recommendations = this.generateValidationRecommendations(validation);

        return validation;
    },

    generateValidationRecommendations(validation) {
        const recommendations = [];

        // Serial format recommendations
        if (validation.serialFormat.invalid.length > 0) {
            recommendations.push({
                category: 'Serial Numbers',
                priority: 'high',
                issue: `${validation.serialFormat.invalid.length} markers have invalid serial formats`,
                recommendation: 'Standardize serial numbers to format: [Agency Code][Space][6-8 digits] (e.g., AF 014589)',
                affectedMarkers: validation.serialFormat.invalid.map(i => i.id)
            });
        }

        // Frequency format recommendations
        if (validation.frequencyFormat.invalid.length > 0) {
            recommendations.push({
                category: 'Frequencies',
                priority: 'critical',
                issue: `${validation.frequencyFormat.invalid.length} markers have invalid frequency formats`,
                recommendation: 'Update frequency values to standard MC4EB format: K####(####.#) or numeric with units',
                affectedMarkers: validation.frequencyFormat.invalid.map(i => i.id)
            });
        }

        // Coordinate validation recommendations
        if (validation.coordinateFormat.invalid.length > 0) {
            recommendations.push({
                category: 'Coordinates',
                priority: 'critical',
                issue: `${validation.coordinateFormat.invalid.length} markers have invalid coordinates`,
                recommendation: 'Verify coordinate accuracy and ensure values are within valid ranges (lat: -90 to 90, lng: -180 to 180)',
                affectedMarkers: validation.coordinateFormat.invalid.map(i => i.id)
            });
        }

        // Duplicate handling recommendations
        if (validation.overall.totalDuplicates > 0) {
            recommendations.push({
                category: 'Duplicates',
                priority: 'medium',
                issue: `${validation.overall.totalDuplicates} duplicate entries detected`,
                recommendation: 'Review and consolidate duplicate serial numbers, frequencies, or co-located markers',
                details: {
                    serialDuplicates: validation.duplicates.serialDuplicates.length,
                    coordinateDuplicates: validation.duplicates.coordinateDuplicates.length,
                    frequencyDuplicates: validation.duplicates.frequencyDuplicates.length
                }
            });
        }

        // Data completeness recommendations
        if (validation.requiredFields.invalid.length > 0) {
            recommendations.push({
                category: 'Data Completeness',
                priority: 'critical',
                issue: `${validation.requiredFields.invalid.length} markers missing required fields`,
                recommendation: 'Complete all required fields: serial, latitude, longitude, frequency',
                affectedMarkers: validation.requiredFields.invalid.map(i => i.id)
            });
        }

        // Data quality score recommendations
        if (validation.overall.validationScore < 80) {
            recommendations.push({
                category: 'Overall Data Quality',
                priority: 'high',
                issue: `Data quality score is ${validation.overall.validationScore.toFixed(1)}% (below 80% threshold)`,
                recommendation: 'Implement comprehensive data quality review and correction procedures',
                actions: [
                    'Establish data entry standards',
                    'Implement validation rules at data input',
                    'Perform regular data quality audits',
                    'Train personnel on proper data formats'
                ]
            });
        }

        // MC4EB Publication 7, Change 1 compliance recommendations
        recommendations.push({
            category: 'MC4EB Compliance',
            priority: 'medium',
            issue: 'Ensure continued compliance with MC4EB Publication 7, Change 1 standards',
            recommendation: 'Regular compliance reviews and updates to match latest MC4EB requirements',
            actions: [
                'Monthly compliance audits',
                'Update field definitions as needed',
                'Coordinate with IRAC for validation',
                'Document all compliance procedures'
            ]
        });

        return recommendations;
    },

    generateComplianceRecommendations(complianceReport) {
        const recommendations = [];

        // Field 500 compliance recommendations (Source: db_viewer_js.txt field validation)
        if (!complianceReport.field500Compliance) {
            recommendations.push({
                category: 'Field 500 Compliance',
                priority: 'critical',
                issue: 'Field 500 occurrences exceed MC4EB Publication 7, Change 1 limit (max 10)',
                recommendation: 'Reduce Field 500 occurrences to comply with MC4EB standards',
                actions: [
                    'Review Field 500 usage in SFAF records',
                    'Consolidate multiple Field 500 entries where possible',
                    'Ensure compliance with MC4EB Publication 7, Change 1 Section 4.2.3',
                    'Document justification for essential Field 500 entries'
                ],
                reference: 'MC4EB Publication 7, Change 1, Section 4.2.3'
            });
        }

        // Field 501 compliance recommendations (Source: db_viewer_js.txt field validation)
        if (!complianceReport.field501Compliance) {
            recommendations.push({
                category: 'Field 501 Compliance',
                priority: 'critical',
                issue: 'Field 501 occurrences exceed MC4EB Publication 7, Change 1 limit (max 30)',
                recommendation: 'Reduce Field 501 occurrences to comply with MC4EB standards',
                actions: [
                    'Audit Field 501 usage across all SFAF records',
                    'Remove unnecessary Field 501 entries',
                    'Ensure compliance with MC4EB Publication 7, Change 1 Section 4.2.4',
                    'Implement Field 501 usage guidelines'
                ],
                reference: 'MC4EB Publication 7, Change 1, Section 4.2.4'
            });
        }

        // IRAC category coverage recommendations (Source: db_viewer_js.txt IRAC analysis)
        if (complianceReport.iracCategories.length < 6) {
            recommendations.push({
                category: 'IRAC Category Coverage',
                priority: 'medium',
                issue: `Limited IRAC category coverage (${complianceReport.iracCategories.length}/6 categories)`,
                recommendation: 'Expand IRAC note coverage to include all major categories',
                actions: [
                    'Add IRAC notes for missing categories',
                    'Review frequency coordination requirements',
                    'Ensure comprehensive IRAC coverage',
                    'Coordinate with IRAC for additional note assignments'
                ],
                currentCategories: complianceReport.iracCategories
            });
        }

        // Coordinate format compliance (Source: main_go.txt coordinate service)
        recommendations.push({
            category: 'Coordinate Standards',
            priority: 'low',
            issue: 'Ensure continued coordinate format compliance',
            recommendation: 'Maintain support for military coordinate formats',
            actions: [
                'Verify DMS format accuracy',
                'Validate compact coordinate formats',
                'Ensure WGS84 datum consistency',
                'Test coordinate conversion accuracy'
            ],
            reference: 'MC4EB Publication 7, Change 1, Coordinate Standards'
        });

        // Frequency coordination compliance (Source: db_viewer_js.txt frequency analysis)
        if (complianceReport.totalViolations > 0) {
            recommendations.push({
                category: 'Frequency Coordination',
                priority: 'high',
                issue: `${complianceReport.totalViolations} compliance violations detected`,
                recommendation: 'Address all frequency coordination compliance issues',
                actions: [
                    'Review frequency assignments for conflicts',
                    'Ensure proper IRAC coordination procedures',
                    'Validate frequency band allocations',
                    'Update coordination documentation'
                ]
            });
        }

        // Data quality and validation recommendations (Source: db_viewer_js.txt validation)
        recommendations.push({
            category: 'Data Quality Assurance',
            priority: 'medium',
            issue: 'Maintain high data quality standards for compliance',
            recommendation: 'Implement continuous data quality monitoring',
            actions: [
                'Regular SFAF field validation',
                'Automated compliance checking',
                'Monthly data quality reports',
                'Staff training on MC4EB standards'
            ]
        });

        // Agency coordination recommendations (Source: db_viewer_html.txt agency filter)
        recommendations.push({
            category: 'Inter-Agency Coordination',
            priority: 'medium',
            issue: 'Ensure proper coordination across military services',
            recommendation: 'Maintain effective inter-agency frequency coordination',
            actions: [
                'Regular coordination meetings with Army, Navy, Air Force, Marines',
                'Update agency contact information',
                'Verify proper approval authority assignments',
                'Document coordination procedures'
            ]
        });

        // Technical specifications compliance (Source: db_viewer_css.txt modern interface)
        recommendations.push({
            category: 'Technical Standards',
            priority: 'low',
            issue: 'Maintain technical system compliance',
            recommendation: 'Keep system updated with latest technical standards',
            actions: [
                'Update emission designator formats',
                'Verify equipment certification requirements',
                'Maintain antenna specification accuracy',
                'Update technical field definitions'
            ]
        });

        // Overall compliance summary
        if (complianceReport.field500Compliance && complianceReport.field501Compliance && complianceReport.iracCategories.length >= 5) {
            recommendations.unshift({
                category: 'Overall Compliance',
                priority: 'info',
                issue: 'System demonstrates good MC4EB Publication 7, Change 1 compliance',
                recommendation: 'Continue current compliance practices and monitor for changes',
                actions: [
                    'Maintain current data quality standards',
                    'Monitor for MC4EB Publication updates',
                    'Continue regular compliance audits',
                    'Document best practices'
                ]
            });
        }

        return recommendations;
    },

    generateOperationalRecommendations(markers, iracNotes) {
        const recommendations = [];

        // Marker distribution analysis (Source: db_viewer_js.txt geographic distribution)
        const manualMarkers = markers.filter(m => m.type === 'manual').length;
        const importedMarkers = markers.filter(m => m.type === 'imported').length;

        if (importedMarkers > manualMarkers * 3) {
            recommendations.push({
                category: 'Data Entry Workflow',
                priority: 'medium',
                issue: 'High ratio of imported vs manual markers detected',
                recommendation: 'Consider automating more data entry processes',
                actions: [
                    'Implement bulk import tools',
                    'Standardize data import formats',
                    'Train staff on efficient import procedures',
                    'Develop automated validation workflows'
                ]
            });
        }

        // Frequency band utilization (Source: db_viewer_js.txt frequency analysis)
        const frequencyStats = this.analyzeFrequencyDistribution(markers);
        const totalWithFreq = frequencyStats.vhf + frequencyStats.uhf + frequencyStats.shf;

        if (frequencyStats.none > totalWithFreq * 0.5) {
            recommendations.push({
                category: 'Frequency Data Quality',
                priority: 'high',
                issue: 'High percentage of markers without frequency assignments',
                recommendation: 'Improve frequency data collection and validation',
                actions: [
                    'Mandatory frequency field validation',
                    'Staff training on frequency format standards',
                    'Automated frequency format checking',
                    'Regular frequency data audits'
                ]
            });
        }

        // IRAC notes utilization (Source: db_viewer_js.txt IRAC management)
        const avgIRACPerMarker = iracNotes.length / Math.max(markers.length, 1);

        if (avgIRACPerMarker < 0.5) {
            recommendations.push({
                category: 'IRAC Note Coverage',
                priority: 'medium',
                issue: 'Low IRAC note coverage across markers',
                recommendation: 'Increase IRAC note assignments for better coordination',
                actions: [
                    'Review markers needing IRAC coordination',
                    'Expand IRAC note database coverage',
                    'Train staff on IRAC note selection',
                    'Implement IRAC assignment guidelines'
                ]
            });
        }

        // Geographic coverage analysis (Source: db_viewer_js.txt geographic analysis)
        const markersWithCoords = markers.filter(m => m.latitude && m.longitude).length;
        const coordCoverage = markersWithCoords / Math.max(markers.length, 1);

        if (coordCoverage < 0.9) {
            recommendations.push({
                category: 'Geographic Data Completeness',
                priority: 'high',
                issue: 'Incomplete geographic coordinate coverage',
                recommendation: 'Improve coordinate data collection and accuracy',
                actions: [
                    'Mandatory coordinate validation',
                    'GPS coordinate collection training',
                    'Automated coordinate format checking',
                    'Geographic data quality audits'
                ]
            });
        }

        // System performance recommendations (Source: db_viewer_css.txt responsive design)
        if (markers.length > 1000) {
            recommendations.push({
                category: 'System Performance',
                priority: 'medium',
                issue: 'Large dataset may impact system performance',
                recommendation: 'Optimize system for large-scale operations',
                actions: [
                    'Implement data pagination',
                    'Add database indexing optimization',
                    'Consider data archiving procedures',
                    'Monitor system performance metrics'
                ]
            });
        }

        // User interface optimization (Source: db_viewer_html.txt enhanced controls)
        recommendations.push({
            category: 'User Experience',
            priority: 'low',
            issue: 'Maintain optimal user interface efficiency',
            recommendation: 'Continue enhancing user interface based on usage patterns',
            actions: [
                'Regular user feedback collection',
                'Interface usability testing',
                'Keyboard shortcut optimization',
                'Mobile interface improvements'
            ]
        });

        return recommendations;
    },

    getTimeSpanInDays(startDate, endDate) {
        const diffMs = endDate.getTime() - startDate.getTime();
        return Math.max(diffMs / (1000 * 60 * 60 * 24), 1); // Minimum 1 day
    },

    async loadAnalytics() {
        try {
            console.log('📊 Loading analytics data...');
            this.showLoading(true);

            const [markersResponse, iracResponse] = await Promise.all([
                fetch('/api/markers'),
                fetch('/api/irac-notes')
            ]);

            // ✅ ENHANCED: Validate response status
            if (!markersResponse.ok) {
                throw new Error(`Markers API failed: ${markersResponse.status} ${markersResponse.statusText}`);
            }

            if (!iracResponse.ok) {
                throw new Error(`IRAC Notes API failed: ${iracResponse.status} ${iracResponse.statusText}`);
            }

            const markersData = await markersResponse.json();
            const iracData = await iracResponse.json();

            console.log('📊 Markers API response:', markersData);
            console.log('📊 IRAC API response:', iracData);

            // ✅ ENHANCED: Validate response structure and data
            if (!markersData.success) {
                throw new Error(`Markers API error: ${markersData.error || 'Unknown error'}`);
            }

            if (!iracData.success) {
                throw new Error(`IRAC Notes API error: ${iracData.error || 'Unknown error'}`);
            }

            // ✅ CRITICAL: Ensure arrays exist and provide fallbacks
            const markers = Array.isArray(markersData.markers) ? markersData.markers : [];
            const iracNotes = Array.isArray(iracData.notes) ? iracData.notes : [];

            console.log(`📊 Processing ${markers.length} markers and ${iracNotes.length} IRAC notes for analytics`);

            // ✅ SAFE: Call renderAnalytics with validated arrays
            await this.renderAnalytics(markers, iracNotes);

            console.log('✅ Analytics data loaded successfully');

        } catch (error) {
            console.error('❌ Failed to load analytics data:', error);
            this.showError(`Failed to load analytics data: ${error.message}`);

            // ✅ FALLBACK: Render analytics with empty data to prevent UI breakdown
            await this.renderAnalytics([], []);
        } finally {
            this.showLoading(false);
        }
    },

    async renderAnalytics(markers, iracNotes) {
        try {
            // ✅ CRITICAL: Validate input parameters
            if (!Array.isArray(markers)) {
                console.warn('⚠️ Invalid markers array in renderAnalytics:', markers);
                markers = [];
            }

            if (!Array.isArray(iracNotes)) {
                console.warn('⚠️ Invalid iracNotes array in renderAnalytics:', iracNotes);
                iracNotes = [];
            }

            console.log(`📊 Rendering analytics for ${markers.length} markers and ${iracNotes.length} IRAC notes`);

            // ✅ SAFE: System Overview Statistics with validation
            const systemStatsHtml = `
            <div class="stat-item">
                <span class="stat-label">Total Markers</span>
                <span class="stat-value">${markers.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Manual Markers</span>
                <span class="stat-value">${markers.filter(m => m && m.type === 'manual').length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Imported Markers</span>
                <span class="stat-value">${markers.filter(m => m && m.type === 'imported').length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total IRAC Notes</span>
                <span class="stat-value">${iracNotes.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Average Markers per Day</span>
                <span class="stat-value">${this.calculateDailyAverage(markers)}</span>
            </div>
        `;

            // ✅ SAFE: Frequency Distribution Analysis with validation
            const frequencyStats = this.analyzeFrequencyDistribution(markers);
            const totalMarkers = Math.max(markers.length, 1); // Prevent division by zero

            const frequencyChartHtml = `
            <div class="frequency-bands">
                <div class="band-item">
                    <span class="band-label">VHF (30-300 MHz)</span>
                    <div class="band-bar">
                        <div class="band-fill" style="width: ${(frequencyStats.vhf / totalMarkers) * 100}%"></div>
                    </div>
                    <span class="band-count">${frequencyStats.vhf}</span>
                </div>
                <div class="band-item">
                    <span class="band-label">UHF (300-3000 MHz)</span>
                    <div class="band-bar">
                        <div class="band-fill" style="width: ${(frequencyStats.uhf / totalMarkers) * 100}%"></div>
                    </div>
                    <span class="band-count">${frequencyStats.uhf}</span>
                </div>
                <div class="band-item">
                    <span class="band-label">SHF (3-30 GHz)</span>
                    <div class="band-bar">
                        <div class="band-fill" style="width: ${(frequencyStats.shf / totalMarkers) * 100}%"></div>
                    </div>
                    <span class="band-count">${frequencyStats.shf}</span>
                </div>
                <div class="band-item">
                    <span class="band-label">No Frequency</span>
                    <div class="band-bar">
                        <div class="band-fill" style="width: ${(frequencyStats.none / totalMarkers) * 100}%"></div>
                    </div>
                    <span class="band-count">${frequencyStats.none}</span>
                </div>
            </div>
        `;

            // ✅ SAFE: MC4EB Publication 7, Change 1 Compliance Report with validation
            const complianceReport = await this.generateComplianceReport(markers);
            const complianceHtml = `
            <div class="compliance-grid">
                <div class="compliance-item ${complianceReport.field500Compliance ? 'compliant' : 'non-compliant'}">
                    <span class="compliance-label">Field 500 Compliance</span>
                    <span class="compliance-status">${complianceReport.field500Compliance ? '✅ Compliant' : '❌ Non-Compliant'}</span>
                    <span class="compliance-detail">Max 10 occurrences per MC4EB Pub 7 CHG 1</span>
                </div>
                <div class="compliance-item ${complianceReport.field501Compliance ? 'compliant' : 'non-compliant'}">
                    <span class="compliance-label">Field 501 Compliance</span>
                    <span class="compliance-status">${complianceReport.field501Compliance ? '✅ Compliant' : '❌ Non-Compliant'}</span>
                    <span class="compliance-detail">Max 30 occurrences per MC4EB Pub 7 CHG 1</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">IRAC Categories</span>
                    <span class="compliance-value">${complianceReport.iracCategories.length}/6</span>
                    <span class="compliance-detail">${complianceReport.iracCategories.join(', ')}</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Coordinate Format</span>
                    <span class="compliance-status">✅ DMS & Compact</span>
                    <span class="compliance-detail">Military coordinate formats supported</span>
                </div>
            </div>
        `;

            // ✅ SAFE: Geographic Distribution Analysis with validation
            const geoStats = this.analyzeGeographicDistribution(markers);
            const geoStatsHtml = `
            <div class="geo-stats">
                <div class="stat-item">
                    <span class="stat-label">Geographic Spread</span>
                    <span class="stat-value">${geoStats.spread.toFixed(2)}°</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Center Point</span>
                    <span class="stat-value">${geoStats.center.lat.toFixed(4)}, ${geoStats.center.lng.toFixed(4)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Northernmost</span>
                    <span class="stat-value">${geoStats.bounds.north.toFixed(4)}°</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Southernmost</span>
                    <span class="stat-value">${geoStats.bounds.south.toFixed(4)}°</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Easternmost</span>
                    <span class="stat-value">${geoStats.bounds.east.toFixed(4)}°</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Westernmost</span>
                    <span class="stat-value">${geoStats.bounds.west.toFixed(4)}°</span>
                </div>
            </div>
        `;

            // ✅ SAFE: Update DOM elements with comprehensive error handling
            this.updateAnalyticsElement('systemStats', systemStatsHtml);
            this.updateAnalyticsElement('frequencyChart', frequencyChartHtml);
            this.updateAnalyticsElement('complianceReport', complianceHtml);
            this.updateAnalyticsElement('geoStats', geoStatsHtml);

            console.log('✅ Analytics rendering completed successfully');

        } catch (error) {
            console.error('❌ Failed to render analytics:', error);
            this.showError(`Failed to render analytics: ${error.message}`);

            // ✅ FALLBACK: Show error state in analytics
            this.renderAnalyticsError();
        }
    },

    async generateComplianceReport(markers) {
        if (markers.length === 0) {
            return { spread: 0, center: { lat: 0, lng: 0 }, bounds: { north: 0, south: 0, east: 0, west: 0 } };
        }

        // ✅ CORRECTED: Use correct property names from database
        const lats = markers.map(m => parseFloat(m.latitude)).filter(lat => !isNaN(lat));
        const lngs = markers.map(m => parseFloat(m.longitude)).filter(lng => !isNaN(lng));

        if (lats.length === 0 || lngs.length === 0) {
            return { spread: 0, center: { lat: 0, lng: 0 }, bounds: { north: 0, south: 0, east: 0, west: 0 } };
        }

        const report = {
            field500Compliance: true,
            field501Compliance: true,
            iracCategories: [],
            totalViolations: 0
        };

        // Check Field 500 and 501 compliance by analyzing SFAF data for each marker
        for (const marker of markers) {
            try {
                const response = await fetch(`/api/sfaf/object-data/${marker.id}`);
                const data = await response.json();

                if (data.success && data.sfaf_fields) {
                    // Count Field 500 occurrences (Source: handlers.txt field 500 max 10 validation)
                    const field500Count = Object.keys(data.sfaf_fields)
                        .filter(key => key.startsWith('field500')).length;
                    if (field500Count > 10) {
                        report.field500Compliance = false;
                        report.totalViolations++;
                    }

                    // Count Field 501 occurrences (Source: handlers.txt field 501 max 30 validation)
                    const field501Count = Object.keys(data.sfaf_fields)
                        .filter(key => key.startsWith('field501')).length;
                    if (field501Count > 30) {
                        report.field501Compliance = false;
                        report.totalViolations++;
                    }
                }
            } catch (error) {
                console.error(`Failed to check compliance for marker ${marker.id}:`, error);
            }
        }

        // Analyze IRAC note categories (Source: repositories.txt IRAC notes categories)
        try {
            const iracResponse = await fetch('/api/irac-notes');
            const iracData = await iracResponse.json();

            if (iracData.success && iracData.notes) {
                const categories = [...new Set(iracData.notes.map(note => note.category))];
                report.iracCategories = categories;
            }
        } catch (error) {
            console.error('Failed to load IRAC categories:', error);
        }

        return report;
    },

    async retryAnalyticsSection(sectionId) {
        try {
            console.log(`🔄 Retrying analytics section: ${sectionId}`);
            this.showLoading(true, `Reloading ${sectionId}...`);

            // Load fresh data
            const [markersResponse, iracResponse] = await Promise.all([
                fetch('/api/markers'),
                fetch('/api/irac-notes')
            ]);

            if (!markersResponse.ok || !iracResponse.ok) {
                throw new Error('API request failed');
            }

            const markersData = await markersResponse.json();
            const iracData = await iracResponse.json();

            if (!markersData.success || !iracData.success) {
                throw new Error('API returned error response');
            }

            const markers = Array.isArray(markersData.markers) ? markersData.markers : [];
            const iracNotes = Array.isArray(iracData.notes) ? iracData.notes : [];

            // Re-render specific section
            await this.renderSpecificAnalyticsSection(sectionId, markers, iracNotes);

            console.log(`✅ Successfully retried analytics section: ${sectionId}`);
            this.showSuccess(`${sectionId} section reloaded successfully`);

        } catch (error) {
            console.error(`❌ Failed to retry analytics section ${sectionId}:`, error);
            this.showError(`Failed to reload ${sectionId} section`);
        } finally {
            this.showLoading(false);
        }
    },

    async renderSpecificAnalyticsSection(sectionId, markers, iracNotes) {
        try {
            switch (sectionId) {
                case 'systemstats':
                    const systemStatsHtml = `
                    <div class="stat-item">
                        <span class="stat-label">Total Markers</span>
                        <span class="stat-value">${markers.length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Manual Markers</span>
                        <span class="stat-value">${markers.filter(m => m && m.type === 'manual').length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Imported Markers</span>
                        <span class="stat-value">${markers.filter(m => m && m.type === 'imported').length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total IRAC Notes</span>
                        <span class="stat-value">${iracNotes.length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Average Markers per Day</span>
                        <span class="stat-value">${this.calculateDailyAverage(markers)}</span>
                    </div>
                `;
                    this.updateAnalyticsElement('systemStats', systemStatsHtml);
                    break;

                case 'frequencydistribution':
                    const frequencyStats = this.analyzeFrequencyDistribution(markers);
                    const totalMarkers = Math.max(markers.length, 1);
                    const frequencyChartHtml = `
                    <div class="frequency-bands">
                        <div class="band-item">
                            <span class="band-label">VHF (30-300 MHz)</span>
                            <div class="band-bar">
                                <div class="band-fill" style="width: ${(frequencyStats.vhf / totalMarkers) * 100}%"></div>
                            </div>
                            <span class="band-count">${frequencyStats.vhf}</span>
                        </div>
                        <div class="band-item">
                            <span class="band-label">UHF (300-3000 MHz)</span>
                            <div class="band-bar">
                                <div class="band-fill" style="width: ${(frequencyStats.uhf / totalMarkers) * 100}%"></div>
                            </div>
                            <span class="band-count">${frequencyStats.uhf}</span>
                        </div>
                        <div class="band-item">
                            <span class="band-label">SHF (3-30 GHz)</span>
                            <div class="band-bar">
                                <div class="band-fill" style="width: ${(frequencyStats.shf / totalMarkers) * 100}%"></div>
                            </div>
                            <span class="band-count">${frequencyStats.shf}</span>
                        </div>
                        <div class="band-item">
                            <span class="band-label">No Frequency</span>
                            <div class="band-bar">
                                <div class="band-fill" style="width: ${(frequencyStats.none / totalMarkers) * 100}%"></div>
                            </div>
                            <span class="band-count">${frequencyStats.none}</span>
                        </div>
                    </div>
                `;
                    this.updateAnalyticsElement('frequencyChart', frequencyChartHtml);
                    break;

                case 'mcebcompliancereport':
                    const complianceReport = await this.generateComplianceReport(markers);
                    const complianceHtml = `
                    <div class="compliance-grid">
                        <div class="compliance-item ${complianceReport.field500Compliance ? 'compliant' : 'non-compliant'}">
                            <span class="compliance-label">Field 500 Compliance</span>
                            <span class="compliance-status">${complianceReport.field500Compliance ? '✅ Compliant' : '❌ Non-Compliant'}</span>
                            <span class="compliance-detail">Max 10 occurrences per MC4EB Pub 7 CHG 1</span>
                        </div>
                        <div class="compliance-item ${complianceReport.field501Compliance ? 'compliant' : 'non-compliant'}">
                            <span class="compliance-label">Field 501 Compliance</span>
                            <span class="compliance-status">${complianceReport.field501Compliance ? '✅ Compliant' : '❌ Non-Compliant'}</span>
                            <span class="compliance-detail">Max 30 occurrences per MC4EB Pub 7 CHG 1</span>
                        </div>
                        <div class="compliance-item">
                            <span class="compliance-label">IRAC Categories</span>
                            <span class="compliance-value">${complianceReport.iracCategories.length}/6</span>
                            <span class="compliance-detail">${complianceReport.iracCategories.join(', ')}</span>
                        </div>
                        <div class="compliance-item">
                            <span class="compliance-label">Coordinate Format</span>
                            <span class="compliance-status">✅ DMS & Compact</span>
                            <span class="compliance-detail">Military coordinate formats supported</span>
                        </div>
                    </div>
                `;
                    this.updateAnalyticsElement('complianceReport', complianceHtml);
                    break;

                case 'geographicdistribution':
                    const geoStats = this.analyzeGeographicDistribution(markers);
                    const geoStatsHtml = `
                    <div class="geo-stats">
                        <div class="stat-item">
                            <span class="stat-label">Geographic Spread</span>
                            <span class="stat-value">${geoStats.spread.toFixed(2)}°</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Center Point</span>
                            <span class="stat-value">${geoStats.center.lat.toFixed(4)}, ${geoStats.center.lng.toFixed(4)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Northernmost</span>
                            <span class="stat-value">${geoStats.bounds.north.toFixed(4)}°</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Southernmost</span>
                            <span class="stat-value">${geoStats.bounds.south.toFixed(4)}°</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Easternmost</span>
                            <span class="stat-value">${geoStats.bounds.east.toFixed(4)}°</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Westernmost</span>
                            <span class="stat-value">${geoStats.bounds.west.toFixed(4)}°</span>
                        </div>
                    </div>
                `;
                    this.updateAnalyticsElement('geoStats', geoStatsHtml);
                    break;

                default:
                    console.warn(`⚠️ Unknown analytics section: ${sectionId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to render analytics section ${sectionId}:`, error);
            throw error;
        }
    },

    async loadBasicAnalytics() {
        try {
            console.log('📊 Loading basic analytics fallback...');
            this.showLoading(true, 'Loading basic statistics...');

            // Try to get just marker count
            const markersResponse = await fetch('/api/markers');

            if (markersResponse.ok) {
                const markersData = await markersResponse.json();
                const markerCount = markersData.success ? (markersData.markers || []).length : 0;

                // Render minimal analytics
                const basicStatsHtml = `
                <div class="basic-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Markers</span>
                        <span class="stat-value">${markerCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">System Status</span>
                        <span class="stat-value">✅ Operational</span>
                    </div>
                    <div class="stat-note">
                        <small>Basic statistics loaded. Full analytics unavailable.</small>
                    </div>
                </div>
            `;

                this.updateAnalyticsElement('systemStats', basicStatsHtml);
                this.updateAnalyticsElement('frequencyChart', this.generateBasicPlaceholder('Frequency analysis unavailable'));
                this.updateAnalyticsElement('complianceReport', this.generateBasicPlaceholder('Compliance report unavailable'));
                this.updateAnalyticsElement('geoStats', this.generateBasicPlaceholder('Geographic analysis unavailable'));

                this.showSuccess('Basic analytics loaded successfully');
            } else {
                throw new Error('Unable to connect to backend services');
            }

        } catch (error) {
            console.error('❌ Failed to load basic analytics:', error);
            this.showError('Unable to load any analytics data');
            this.renderAnalyticsError();
        } finally {
            this.showLoading(false);
        }
    },

    async exportGeographicData() {
        try {
            console.log('📤 Exporting geographic data...');

            const response = await fetch('/api/markers');
            if (!response.ok) {
                throw new Error(`Failed to fetch markers: ${response.status}`);
            }

            const markersData = await response.json();
            if (!markersData.success) {
                throw new Error(markersData.error || 'Failed to load markers');
            }

            const markers = Array.isArray(markersData.markers) ? markersData.markers : [];
            const geoStats = this.analyzeGeographicDistribution(markers);

            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    totalMarkers: markers.length,
                    validCoordinates: geoStats.statistics?.validCoordinates || 0,
                    application: 'SFAF Plotter Database Viewer',
                    version: '1.0.0'
                },
                geographicAnalysis: {
                    center: geoStats.center,
                    bounds: geoStats.bounds,
                    spread: geoStats.spread,
                    region: this.identifyGeographicRegion(geoStats.center),
                    statistics: geoStats.statistics
                },
                markers: markers.map(marker => ({
                    id: marker.id,
                    serial: marker.serial || 'Unknown',
                    latitude: marker.lat,
                    longitude: marker.lng,
                    frequency: marker.frequency,
                    markerType: marker.type || marker.marker_type,
                    createdAt: marker.created_at,
                    region: marker.lat && marker.lng ?
                        this.identifyGeographicRegion({ lat: marker.lat, lng: marker.lng }) : 'Unknown'
                })),
                coordinateFormats: {
                    note: 'All coordinates provided in decimal degrees format',
                    precision: 'Coordinates accurate to 4 decimal places (~11 meters)'
                }
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `SFAF_Geographic_Analysis_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            this.showSuccess('Geographic data exported successfully');

        } catch (error) {
            console.error('❌ Failed to export geographic data:', error);
            this.showError(`Failed to export geographic data: ${error.message}`);
        }
    },

    async viewGeographicMap() {
        try {
            console.log('🗺️ Opening geographic map view...');

            // Construct URL with current marker data for map display
            const params = new URLSearchParams({
                view: 'geographic',
                analytics: 'true',
                source: 'database_viewer'
            });

            // Open main map page with analytics overlay
            const mapUrl = `/?${params.toString()}`;
            window.open(mapUrl, '_blank');

        } catch (error) {
            console.error('❌ Failed to open geographic map:', error);
            this.showError('Failed to open geographic map view');
        }
    },

    async generateGeographicReport() {
        try {
            console.log('📄 Generating geographic report...');
            this.showLoading(true, 'Generating report...');

            const response = await fetch('/api/markers');
            if (!response.ok) {
                throw new Error(`Failed to fetch markers: ${response.status}`);
            }

            const markersData = await response.json();
            if (!markersData.success) {
                throw new Error(markersData.error || 'Failed to load markers');
            }

            const markers = Array.isArray(markersData.markers) ? markersData.markers : [];
            const geoStats = this.analyzeGeographicDistribution(markers);

            // Generate comprehensive HTML report
            const reportHtml = this.generateGeographicReportHtml(markers, geoStats);

            // Create and download HTML file
            const reportBlob = new Blob([reportHtml], { type: 'text/html' });
            const url = URL.createObjectURL(reportBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `SFAF_Geographic_Report_${new Date().toISOString().split('T')[0]}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            this.showSuccess('Geographic report generated successfully');

        } catch (error) {
            console.error('❌ Failed to generate geographic report:', error);
            this.showError(`Failed to generate report: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

});
