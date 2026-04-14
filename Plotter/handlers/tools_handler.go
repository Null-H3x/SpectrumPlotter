package handlers

import (
	"math"
	"net/http"
	"sfaf-plotter/services"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type ToolsHandler struct {
	sfafService *services.SFAFService
}

func NewToolsHandler(sfafService *services.SFAFService) *ToolsHandler {
	return &ToolsHandler{sfafService: sfafService}
}

// EWDeconflictRequest is the request body for an EW deconfliction analysis.
type EWDeconflictRequest struct {
	// Jammer parameters
	FreqLow        string `json:"freq_low"`         // e.g. "M40.77"
	FreqHigh       string `json:"freq_high"`        // same as FreqLow for single freq
	EmissionDesig  string `json:"emission_desig"`
	Polarization   string `json:"polarization"`
	Power          string `json:"power"`
	AntennaGain    string `json:"antenna_gain"`
	JammingSector  string `json:"jamming_sector"`
	AntennaHeight  string `json:"antenna_height"`
	// Mission parameters
	StateCountry   string  `json:"state_country"`
	Location       string  `json:"location"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	RadiusKm       float64 `json:"radius_km"`
	MissionDate    string  `json:"mission_date"`
	Classification string  `json:"classification"`
}

type EWConflict struct {
	Serial    string `json:"serial"`
	Frequency string `json:"frequency"`
	Agency    string `json:"agency"`
	Location  string `json:"location"`
	StationClass string `json:"station_class"`
	Status    string `json:"status"` // "JRFL" if also on JRFL
	DistanceKm float64 `json:"distance_km"`
}

type EWDeconflictResponse struct {
	AssignmentConflicts []EWConflict `json:"assignment_conflicts"`
	JRFLConflicts       []EWConflict `json:"jrfl_conflicts"`
	CEOIConflicts       []EWConflict `json:"ceoi_conflicts"`
	JammerFreqMHz       [2]float64   `json:"jammer_freq_mhz"` // [low, high]
	TotalScanned        int          `json:"total_scanned"`
}

// RunEWDeconfliction handles POST /api/tools/ew-deconfliction
func (h *ToolsHandler) RunEWDeconfliction(c *gin.Context) {
	var req EWDeconflictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Parse jammer frequency range to MHz
	freqLowMHz, err := parseSFAFFreqToMHz(req.FreqLow)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid freq_low: " + err.Error()})
		return
	}
	freqHighMHz := freqLowMHz
	if req.FreqHigh != "" && req.FreqHigh != req.FreqLow {
		freqHighMHz, err = parseSFAFFreqToMHz(req.FreqHigh)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid freq_high: " + err.Error()})
			return
		}
	}
	if freqHighMHz < freqLowMHz {
		freqLowMHz, freqHighMHz = freqHighMHz, freqLowMHz
	}

	// Fetch all records
	sfafs, err := h.sfafService.GetAllSFAFsWithMarkers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query database: " + err.Error()})
		return
	}

	resp := EWDeconflictResponse{
		AssignmentConflicts: []EWConflict{},
		JRFLConflicts:       []EWConflict{},
		CEOIConflicts:       []EWConflict{},
		JammerFreqMHz:       [2]float64{freqLowMHz, freqHighMHz},
		TotalScanned:        len(sfafs),
	}

	for _, sfaf := range sfafs {
		if sfaf.Field110 == "" {
			continue
		}

		// Check frequency overlap
		recFreqMHz, err := parseSFAFFreqToMHz(sfaf.Field110)
		if err != nil {
			continue
		}
		if recFreqMHz < freqLowMHz || recFreqMHz > freqHighMHz {
			continue
		}

		// Check geographic radius (if jammer has coordinates)
		distKm := 0.0
		if req.Latitude != 0 && req.Longitude != 0 && req.RadiusKm > 0 {
			distKm = haversineKm(req.Latitude, req.Longitude, sfaf.Latitude, sfaf.Longitude)
			if distKm > req.RadiusKm {
				continue
			}
		}

		conflict := EWConflict{
			Serial:       sfaf.Field102,
			Frequency:    sfaf.Field110,
			Agency:       sfaf.Field200,
			Location:     sfaf.Field301,
			StationClass: sfaf.Field113,
			DistanceKm:   math.Round(distKm*10) / 10,
		}
		resp.AssignmentConflicts = append(resp.AssignmentConflicts, conflict)
	}

	c.JSON(http.StatusOK, resp)
}

// parseSFAFFreqToMHz converts an SFAF field 110 value to MHz.
// Format: C followed by numeric value where C = H(Hz), K(kHz), M(MHz), G(GHz), T(THz)
func parseSFAFFreqToMHz(s string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, nil
	}
	prefix := strings.ToUpper(string(s[0]))
	num, err := strconv.ParseFloat(s[1:], 64)
	if err != nil {
		return 0, err
	}
	switch prefix {
	case "H":
		return num / 1e6, nil
	case "K":
		return num / 1e3, nil
	case "M":
		return num, nil
	case "G":
		return num * 1e3, nil
	case "T":
		return num * 1e6, nil
	default:
		// Assume MHz if no prefix
		return strconv.ParseFloat(s, 64)
	}
}

// haversineKm returns the great-circle distance in km between two lat/lng points.
func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
