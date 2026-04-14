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
	// Jammer parameters (SFAF field equivalents)
	FreqLow       string `json:"freq_low"`       // Field 110 format e.g. "M40.77"
	FreqHigh      string `json:"freq_high"`      // Field 110 – upper bound for band jamming
	EmissionDesig string `json:"emission_desig"` // Field 114
	Polarization  string `json:"polarization"`   // Field 363 e.g. "V","H","L","R"
	Power         string `json:"power"`          // Field 115 format e.g. "W50","K2"
	AntennaGain   string `json:"antenna_gain"`   // Field 357 in dBi e.g. "6"
	JammingSector string `json:"jamming_sector"` // Field 362 e.g. "ND","045","119 to 121"
	AntennaHeight string `json:"antenna_height"` // Field 359 in meters
	// Mission parameters
	StateCountry   string  `json:"state_country"`
	Location       string  `json:"location"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	RadiusKm       float64 `json:"radius_km"`
	MissionDate    string  `json:"mission_date"`
	Classification string  `json:"classification"`
	// Analysis parameters
	ThresholdDBW float64 `json:"threshold_dbw"` // Interference threshold in dBW (default -120)
}

type EWConflict struct {
	Serial           string  `json:"serial"`
	Frequency        string  `json:"frequency"`
	Agency           string  `json:"agency"`
	Location         string  `json:"location"`
	StationClass     string  `json:"station_class"`
	Status           string  `json:"status"`             // "JRFL" if also on JRFL
	DistanceKm       float64 `json:"distance_km"`
	ReceivedPowerDBW float64 `json:"received_power_dbw"` // I in dBW
	ICM              float64 `json:"icm"`                // Interference Conflict Margin (dB); positive = conflict
	FlagReason       string  `json:"flag_reason,omitempty"`
}

type EWDeconflictResponse struct {
	AssignmentConflicts []EWConflict `json:"assignment_conflicts"`
	JRFLConflicts       []EWConflict `json:"jrfl_conflicts"`
	CEOIConflicts       []EWConflict `json:"ceoi_conflicts"`
	FlaggedRecords      []EWConflict `json:"flagged_records"`
	JammerFreqMHz       [2]float64   `json:"jammer_freq_mhz"`
	TotalScanned        int          `json:"total_scanned"`
	ThresholdDBW        float64      `json:"threshold_dbw"`
}

// RunEWDeconfliction handles POST /api/tools/ew-deconfliction
func (h *ToolsHandler) RunEWDeconfliction(c *gin.Context) {
	var req EWDeconflictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Default interference threshold
	threshold := req.ThresholdDBW
	if threshold == 0 {
		threshold = -120.0
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

	// Parse jammer parameters
	jammerPowerW := parseSFAFPowerToWatts(req.Power)
	if jammerPowerW <= 0 {
		jammerPowerW = 10.0 // default 10W
	}
	jammerPowerDBW := 10 * math.Log10(jammerPowerW)

	jammerGainDBi, _ := strconv.ParseFloat(strings.TrimSpace(req.AntennaGain), 64)
	jammerPol := strings.ToUpper(strings.TrimSpace(req.Polarization))
	if jammerPol == "" {
		jammerPol = "V"
	}

	jammerSector := parseAntennaOrientation(req.JammingSector)
	hasJammerCoords := req.Latitude != 0 || req.Longitude != 0

	// Fetch all records (LEFT JOIN with markers)
	sfafs, err := h.sfafService.GetAllSFAFsWithMarkers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query database: " + err.Error()})
		return
	}

	resp := EWDeconflictResponse{
		AssignmentConflicts: []EWConflict{},
		JRFLConflicts:       []EWConflict{},
		CEOIConflicts:       []EWConflict{},
		FlaggedRecords:      []EWConflict{},
		JammerFreqMHz:       [2]float64{freqLowMHz, freqHighMHz},
		TotalScanned:        len(sfafs),
		ThresholdDBW:        threshold,
	}

	for _, sfaf := range sfafs {
		if sfaf.Field110 == "" {
			continue
		}

		// Frequency overlap check
		recFreqMHz, err := parseSFAFFreqToMHz(sfaf.Field110)
		if err != nil || recFreqMHz < freqLowMHz || recFreqMHz > freqHighMHz {
			continue
		}

		// Records without coordinates: flag for manual review, skip full analysis
		if !sfaf.HasCoords {
			resp.FlaggedRecords = append(resp.FlaggedRecords, EWConflict{
				Serial:       sfaf.Field102,
				Frequency:    sfaf.Field110,
				Agency:       sfaf.Field200,
				Location:     sfaf.Field301,
				StationClass: sfaf.Field113,
				FlagReason:   "No coordinates – manual review required",
			})
			continue
		}

		// Geographic radius filter
		distKm := haversineKm(req.Latitude, req.Longitude, sfaf.Latitude, sfaf.Longitude)
		if hasJammerCoords && req.RadiusKm > 0 && distKm > req.RadiusKm {
			continue
		}

		// ── Interference Power Level Model ──────────────────────────────────
		// I (dBW) = PT + GT - LCT + GR - LCR - LP - LPOL - FDR
		// LCT = LCR = 2 dB (fixed cable loss), FDR = 0 (co-channel assumption)

		// GT: jammer antenna gain toward victim
		var GT float64
		if hasJammerCoords && distKm > 0 {
			bearingToVictim := computeBearing(req.Latitude, req.Longitude, sfaf.Latitude, sfaf.Longitude)
			offAxisJammer := sectorOffAxisDeg(jammerSector, bearingToVictim)
			GT = antennaGainDB(jammerGainDBi, offAxisJammer)
		} else {
			GT = jammerGainDBi // no coords → assume mainbeam
		}

		// GR: victim antenna gain toward jammer
		var GR float64
		victimGainDBi := 0.0
		if sfaf.Field357 != nil {
			victimGainDBi = *sfaf.Field357
		}
		if hasJammerCoords && sfaf.Field362 != "" {
			bearingToJammer := computeBearing(sfaf.Latitude, sfaf.Longitude, req.Latitude, req.Longitude)
			victimSector := parseAntennaOrientation(sfaf.Field362)
			offAxisVictim := sectorOffAxisDeg(victimSector, bearingToJammer)
			GR = antennaGainDB(victimGainDBi, offAxisVictim)
		} else {
			GR = victimGainDBi // no orientation data → mainbeam (worst case for victim)
		}

		// LP: free-space path loss
		LP := 0.0
		if hasJammerCoords {
			safeDistKm := math.Max(distKm, 0.01)
			LP = freeSpaceLossDB(recFreqMHz, safeDistKm)
		}

		// LPOL: polarization mismatch loss
		LPOL := polarizationLossDB(jammerPol, sfaf.Field363)

		// Received interference power
		I := jammerPowerDBW + GT + GR - 4.0 - LP - LPOL

		// ICM: positive = conflict
		ICM := I - threshold

		conflict := EWConflict{
			Serial:           sfaf.Field102,
			Frequency:        sfaf.Field110,
			Agency:           sfaf.Field200,
			Location:         sfaf.Field301,
			StationClass:     sfaf.Field113,
			DistanceKm:       math.Round(distKm*10) / 10,
			ReceivedPowerDBW: math.Round(I*10) / 10,
			ICM:              math.Round(ICM*10) / 10,
		}

		if ICM >= 0 {
			resp.AssignmentConflicts = append(resp.AssignmentConflicts, conflict)
		}
		// If no jammer coords, fallback: report all freq-matching located records
		if !hasJammerCoords {
			resp.AssignmentConflicts = append(resp.AssignmentConflicts, conflict)
		}
	}

	c.JSON(http.StatusOK, resp)
}

// ─── Frequency parsing ───────────────────────────────────────────────────────

// parseSFAFFreqToMHz converts an SFAF Field 110 value to MHz.
// Format: prefix + numeric value where prefix is H(Hz), K(kHz), M(MHz), G(GHz), T(THz).
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
		return strconv.ParseFloat(s, 64)
	}
}

// parseSFAFPowerToWatts converts an SFAF Field 115 power string to watts.
// Format: prefix + numeric value where prefix is W(Watts), K(kW), M(MW), G(GW).
func parseSFAFPowerToWatts(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	prefix := strings.ToUpper(string(s[0]))
	num, err := strconv.ParseFloat(s[1:], 64)
	if err != nil {
		// Maybe it's already a plain number (watts)
		v, err2 := strconv.ParseFloat(s, 64)
		if err2 != nil {
			return 0
		}
		return v
	}
	switch prefix {
	case "W":
		return num
	case "K":
		return num * 1e3
	case "M":
		return num * 1e6
	case "G":
		return num * 1e9
	default:
		return num
	}
}

// ─── Propagation ─────────────────────────────────────────────────────────────

// freeSpaceLossDB returns the free-space path loss in dB.
// LP = 32.44 + 20·log₁₀(freqMHz) + 20·log₁₀(distKm)
func freeSpaceLossDB(freqMHz, distKm float64) float64 {
	if distKm <= 0 || freqMHz <= 0 {
		return 0
	}
	return 32.44 + 20*math.Log10(freqMHz) + 20*math.Log10(distKm)
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

// computeBearing returns the forward azimuth (0–360°, true north) from point 1 to point 2.
func computeBearing(lat1, lon1, lat2, lon2 float64) float64 {
	lat1R := lat1 * math.Pi / 180
	lat2R := lat2 * math.Pi / 180
	dLonR := (lon2 - lon1) * math.Pi / 180
	y := math.Sin(dLonR) * math.Cos(lat2R)
	x := math.Cos(lat1R)*math.Sin(lat2R) - math.Sin(lat1R)*math.Cos(lat2R)*math.Cos(dLonR)
	b := math.Atan2(y, x) * 180 / math.Pi
	return math.Mod(b+360, 360)
}

// ─── Antenna gain models ──────────────────────────────────────────────────────

// wolfgain computes the off-boresight antenna gain (dBi) for low-gain antennas
// with mainbeam gain 0 to < 9.33 dBi (Appendix C, SXXI Engineering Algorithms).
// GMAX is in dBi; theta is the off-axis angle in degrees.
func wolfgain(gmaxDBi, thetaDeg float64) float64 {
	theta := thetaDeg * math.Pi / 180
	Q := 3.0 * (1 + 3400*math.Exp(-0.77*gmaxDBi))
	g := gmaxDBi * math.Pow(1+(2*gmaxDBi/Q)*(1-math.Cos(theta)), -1.25)
	return g
}

// statgain computes the off-boresight antenna gain (dBi) for directional antennas
// with mainbeam gain >= 9.33 dBi (Appendix C, SXXI Engineering Algorithms).
// GMAX is in dBi; theta is the off-axis angle in degrees.
func statgain(gmaxDBi, thetaDeg float64) float64 {
	thetaRad := thetaDeg * math.Pi / 180

	// Breakpoint angles (degrees)
	thetaM := 50 * math.Sqrt(0.25*gmaxDBi+7) / math.Pow(10, gmaxDBi/20)
	var thetaR, thetaB float64

	if gmaxDBi >= 48 {
		// Very-high-gain
		thetaR = 27.466 * math.Pow(10, -0.03*gmaxDBi)
		thetaB = 48.0
	} else if gmaxDBi >= 22 {
		// High-gain
		thetaR = 250 / math.Pow(10, gmaxDBi/20)
		thetaB = 48.0
	} else {
		// Medium-gain (9.33 to 22 dBi)
		thetaR = 250 / math.Pow(10, gmaxDBi/20)
		thetaB = 131.8257 * math.Pow(10, -gmaxDBi/50)
	}

	switch {
	case thetaDeg <= thetaM:
		// Mainbeam region (theta in radians per SXXI algorithm)
		return gmaxDBi - 4*math.Pow(10, -0.4)*math.Pow(10, gmaxDBi/10)*thetaRad*thetaRad
	case thetaDeg <= thetaR:
		// Near-sidelobe shelf
		return 0.75*gmaxDBi - 7
	case thetaDeg <= thetaB:
		// Far-sidelobe region (theta in degrees)
		return 53 - gmaxDBi/2 - 25*math.Log10(thetaDeg)
	default:
		// Beyond thetaB
		if gmaxDBi >= 22 {
			return 11 - gmaxDBi/2
		}
		return 0
	}
}

// antennaGainDB returns antenna gain (dBi) at off-axis angle thetaDeg,
// selecting Wolfgain or Statgain based on mainbeam gain.
func antennaGainDB(gmaxDBi, thetaDeg float64) float64 {
	if thetaDeg <= 0 {
		return gmaxDBi
	}
	thetaDeg = math.Min(thetaDeg, 180)
	if gmaxDBi < 9.33 {
		return wolfgain(gmaxDBi, thetaDeg)
	}
	return statgain(gmaxDBi, thetaDeg)
}

// ─── Antenna orientation ─────────────────────────────────────────────────────

type antennaOrientation struct {
	IsOmni bool
	Low    float64 // azimuth degrees; for single-azimuth Low == High
	High   float64
}

// parseAntennaOrientation parses an SFAF Field 362 / jammer sector string.
// Accepts: "ND" (omni), "045" (fixed azimuth), "045 to 121" or "045-121" (sector).
func parseAntennaOrientation(s string) antennaOrientation {
	s = strings.TrimSpace(strings.ToUpper(s))
	if s == "" || s == "ND" {
		return antennaOrientation{IsOmni: true}
	}

	// Try "LLL to HHH" or "LLL-HHH"
	var parts []string
	if strings.Contains(s, " TO ") {
		parts = strings.SplitN(s, " TO ", 2)
	} else if strings.Contains(s, "-") {
		parts = strings.SplitN(s, "-", 2)
	}

	if len(parts) == 2 {
		lo, err1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		hi, err2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		if err1 == nil && err2 == nil {
			return antennaOrientation{Low: lo, High: hi}
		}
	}

	// Single azimuth
	az, err := strconv.ParseFloat(s, 64)
	if err == nil {
		return antennaOrientation{Low: az, High: az}
	}
	return antennaOrientation{IsOmni: true}
}

// angularDiffDeg returns the smallest angular difference between two bearings (0–180°).
func angularDiffDeg(a, b float64) float64 {
	diff := math.Abs(a - b)
	if diff > 180 {
		diff = 360 - diff
	}
	return diff
}

// isInSector returns true if bearing is within the arc from low to high (going clockwise).
func isInSector(low, high, bearing float64) bool {
	if low <= high {
		return bearing >= low && bearing <= high
	}
	// Wraps through north (e.g. 320 to 050)
	return bearing >= low || bearing <= high
}

// sectorOffAxisDeg returns the off-axis angle in degrees for a jammer/antenna sector
// relative to the direction toward a target at bearingDeg.
// From SXXI Ch18: if target is inside sector, orientation is set to match target (off-axis = 0).
// If outside, orientation is set to the nearest sector edge.
func sectorOffAxisDeg(orient antennaOrientation, bearingDeg float64) float64 {
	if orient.IsOmni {
		return 0 // omnidirectional: no off-axis reduction
	}
	if orient.Low == orient.High {
		// Fixed single azimuth
		return angularDiffDeg(orient.Low, bearingDeg)
	}
	// Sector: if bearing inside sector, jammer points at target → off-axis = 0
	if isInSector(orient.Low, orient.High, bearingDeg) {
		return 0
	}
	// Outside sector: use nearest edge
	d1 := angularDiffDeg(orient.Low, bearingDeg)
	d2 := angularDiffDeg(orient.High, bearingDeg)
	return math.Min(d1, d2)
}

// ─── Polarization ────────────────────────────────────────────────────────────

// polarizationLossDB returns the polarization mismatch loss in dB between
// transmitter and receiver antenna polarizations (Table 2-7, SXXI Appendix C).
// Polarization codes: V, H, F(45°), L(LHCP), R(RHCP), T(H+V), D(rotating), E(elliptical).
func polarizationLossDB(txPol, rxPol string) float64 {
	tx := strings.ToUpper(strings.TrimSpace(txPol))
	rx := strings.ToUpper(strings.TrimSpace(rxPol))
	if tx == "" {
		tx = "V"
	}
	if rx == "" {
		rx = "V"
	}
	if tx == rx {
		return 0
	}

	isLinear := func(p string) bool {
		return p == "H" || p == "V" || p == "F" || p == "J"
	}
	isCircular := func(p string) bool {
		return p == "L" || p == "R" || p == "T"
	}

	// Opposite linear polarizations (H vs V)
	if (tx == "H" && rx == "V") || (tx == "V" && rx == "H") {
		return 20
	}
	// Opposite circular (LHCP vs RHCP)
	if (tx == "L" && rx == "R") || (tx == "R" && rx == "L") {
		return 20
	}
	// Linear vs circular: 3 dB
	if (isLinear(tx) && isCircular(rx)) || (isCircular(tx) && isLinear(rx)) {
		return 3
	}
	// Elliptical (E) vs any linear or circular: ~2 dB
	if tx == "E" || rx == "E" {
		return 2
	}
	// Rotating (D) vs any: 0 (averaged over rotation)
	if tx == "D" || rx == "D" {
		return 0
	}
	return 3 // default conservative
}
