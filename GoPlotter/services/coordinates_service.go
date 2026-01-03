// coordinates_service.go

package services

import (
	"fmt"
	"math"
	"sfaf-plotter/models"
)

type CoordinateService struct{}

func NewCoordinateService() *CoordinateService {
	return &CoordinateService{}
}

func (cs *CoordinateService) ConvertToDMS(decimal float64, isLongitude bool) string {
	absDecimal := math.Abs(decimal)
	degrees := int(absDecimal)
	minutesFloat := (absDecimal - float64(degrees)) * 60
	minutes := int(minutesFloat)
	seconds := int((minutesFloat - float64(minutes)) * 60) // Convert to int for 0 decimal places

	var direction string
	if isLongitude {
		if decimal < 0 {
			direction = "W"
		} else {
			direction = "E"
		}
	} else {
		if decimal < 0 {
			direction = "S"
		} else {
			direction = "N"
		}
	}

	return fmt.Sprintf("%d°%d'%d\" %s", degrees, minutes, seconds, direction)
}

func (cs *CoordinateService) DecimalToCompactDMS(decimal float64, isLongitude bool) string {
	absDecimal := math.Abs(decimal)
	degrees := int(absDecimal)
	minutesFloat := (absDecimal - float64(degrees)) * 60
	minutes := int(minutesFloat)
	seconds := int((minutesFloat - float64(minutes)) * 60)

	var direction string
	var degreesPadLength int

	if isLongitude {
		degreesPadLength = 3
		if decimal < 0 {
			direction = "W"
		} else {
			direction = "E"
		}
	} else {
		degreesPadLength = 2
		if decimal < 0 {
			direction = "S"
		} else {
			direction = "N"
		}
	}

	return fmt.Sprintf("%0*d%02d%02d%s",
		degreesPadLength, degrees, minutes, seconds, direction)
}

func (cs *CoordinateService) ConvertLatLngToCompactDMS(lat, lng float64) string {
	latDMS := cs.DecimalToCompactDMS(lat, false)
	lngDMS := cs.DecimalToCompactDMS(lng, true)
	return latDMS + lngDMS
}

func (cs *CoordinateService) GetAllFormats(lat, lng float64) models.CoordinateResponse {
	return models.CoordinateResponse{
		Decimal: fmt.Sprintf("%.4f, %.4f", lat, lng), // Always 4 decimal places
		DMS:     cs.ConvertToDMS(lat, false) + ", " + cs.ConvertToDMS(lng, true),
		Compact: cs.ConvertLatLngToCompactDMS(lat, lng),
	}
}

// ParseCompactDMS parses compact DMS format (e.g., "302521N0864150W") to decimal coordinates
// Format: DDMMSS[N|S]DDDMMSS[E|W]
func (cs *CoordinateService) ParseCompactDMS(compactDMS string) (lat, lng float64, err error) {
	// Remove any whitespace
	compactDMS = fmt.Sprintf("%s", compactDMS) // Trim spaces

	// Find the N/S delimiter for latitude
	var latStr, lngStr string
	var latDir, lngDir string

	// Find latitude direction (N or S)
	if len(compactDMS) < 13 {
		return 0, 0, fmt.Errorf("invalid compact DMS format: too short (expected at least 13 characters)")
	}

	// Format: DDMMSSN DDDMMSSW (6 digits + direction + 7 digits + direction = 15 chars)
	// Example: 302521N0864150W
	latStr = compactDMS[0:6]    // 302521
	latDir = string(compactDMS[6]) // N
	lngStr = compactDMS[7:14]   // 0864150
	lngDir = string(compactDMS[14]) // W

	// Parse latitude
	var latDeg, latMin, latSec int
	_, err = fmt.Sscanf(latStr, "%2d%2d%2d", &latDeg, &latMin, &latSec)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse latitude: %v", err)
	}

	lat = float64(latDeg) + float64(latMin)/60.0 + float64(latSec)/3600.0
	if latDir == "S" {
		lat = -lat
	}

	// Parse longitude
	var lngDeg, lngMin, lngSec int
	_, err = fmt.Sscanf(lngStr, "%3d%2d%2d", &lngDeg, &lngMin, &lngSec)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse longitude: %v", err)
	}

	lng = float64(lngDeg) + float64(lngMin)/60.0 + float64(lngSec)/3600.0
	if lngDir == "W" {
		lng = -lng
	}

	return lat, lng, nil
}
