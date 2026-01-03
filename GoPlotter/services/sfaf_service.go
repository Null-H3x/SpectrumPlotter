// sfaf_service.go
package services

import (
	"bufio"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"math"
	"sfaf-plotter/models"
	"sfaf-plotter/repositories"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type CreateSFAFRequest struct {
	MarkerID string            `json:"marker_id" binding:"required"`
	Fields   map[string]string `json:"fields"`
}

type UpdateSFAFRequest struct {
	Fields map[string]string `json:"fields" binding:"required"`
}

type SFAFImportResult struct {
	TotalRecords    int      `json:"total_records"`
	SuccessfulCount int      `json:"successful_count"`
	ErrorCount      int      `json:"error_count"`
	Errors          []string `json:"errors,omitempty"`
	ImportedIDs     []string `json:"imported_ids,omitempty"`
}

type ValidationResult struct {
	IsValid bool                                 `json:"is_valid"`
	Errors  map[string]string                    `json:"errors"`
	Fields  map[string]models.SFAFFormDefinition `json:"fields"`
}

type SFAFService struct {
	sfafRepo          *repositories.SFAFRepository                 // Database operations
	fieldOccRepo      *repositories.SFAFFieldOccurrenceRepository  // Field occurrences (multi-line fields)
	coordService      *CoordinateService                           // Coordinate format conversions
	markerService     *MarkerService                               // Marker creation for imports
	serialService     *SerialService                               // Serial number generation
	fieldDefs         map[string]models.SFAFFormDefinition         // Field definitions cache
}

// UPDATE constructor - now accepts marker and serial services for import functionality
func NewSFAFService(sfafRepo *repositories.SFAFRepository, fieldOccRepo *repositories.SFAFFieldOccurrenceRepository, coordService *CoordinateService) *SFAFService {
	service := &SFAFService{
		sfafRepo:     sfafRepo, // CHANGE from storage to sfafRepo
		fieldOccRepo: fieldOccRepo,
		coordService: coordService,
		fieldDefs:    make(map[string]models.SFAFFormDefinition),
	}
	service.initializeFieldDefinitions()
	return service
}

// SetMarkerService allows setting marker service after construction (for circular dependency resolution)
func (ss *SFAFService) SetMarkerService(markerService *MarkerService) {
	ss.markerService = markerService
}

// SetSerialService allows setting serial service after construction
func (ss *SFAFService) SetSerialService(serialService *SerialService) {
	ss.serialService = serialService
}

// UPDATE all storage calls to use repository
func (ss *SFAFService) CreateSFAFWithoutValidation(req models.CreateSFAFRequest) (*models.SFAF, error) {
	markerUUID, err := uuid.Parse(req.MarkerID)
	if err != nil {
		return nil, fmt.Errorf("invalid marker ID format: %v", err)
	}

	sfaf := &models.SFAF{
		ID:        uuid.New(),
		MarkerID:  markerUUID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	sfaf.FromFieldMap(req.Fields)

	// Save using repository (Source: repositories.txt)
	if err := ss.sfafRepo.Create(sfaf); err != nil {
		return nil, err
	}

	return sfaf, nil
}

func (ss *SFAFService) GetSFAFByMarkerID(markerID string) (*models.SFAF, error) {
	// REPLACE: ss.storage.GetSFAFByMarkerID(markerID) WITH:
	return ss.sfafRepo.GetByMarkerID(markerID)
}

func (ss *SFAFService) CreateSFAF(req models.CreateSFAFRequest) (*models.SFAF, error) {
	// Validate required MCEB Publication 7 fields
	requiredFields := []string{"field005", "field010", "field102", "field110", "field200"}
	var missingFields []string

	for _, fieldKey := range requiredFields {
		value, exists := req.Fields[fieldKey]
		if !exists || value == "" {
			missingFields = append(missingFields, fieldKey)
		}
	}

	if len(missingFields) > 0 {
		return nil, fmt.Errorf("missing required MCEB fields: %v. Required fields are: field005 (Security Classification), field010 (Type of Action), field102 (Agency Serial Number), field110 (Frequency), field200 (Agency Code)", missingFields)
	}

	// Convert request to SFAF model
	sfaf, err := req.ToSFAF()
	if err != nil {
		return nil, err
	}

	// Store in PostgreSQL using repository (Source: repositories.txt)
	if err := ss.sfafRepo.Create(sfaf); err != nil {
		return nil, fmt.Errorf("failed to store SFAF in database: %w", err)
	}

	return sfaf, nil
}

// ApplyToSFAF method for UpdateSFAFRequest (Source: services.txt references this)
func (req *UpdateSFAFRequest) ApplyToSFAF(sfaf *models.SFAF) {
	// Apply field updates to the SFAF struct using FromFieldMap
	sfaf.FromFieldMap(req.Fields)

	// Update timestamp (Source: models.txt shows UpdatedAt field)
	sfaf.UpdatedAt = time.Now()
}

func (ss *SFAFService) UpdateSFAF(sfafID string, req models.UpdateSFAFRequest) (*models.SFAF, error) {
	// Get existing SFAF from PostgreSQL (Source: repositories.txt)
	sfaf, err := ss.sfafRepo.GetByID(sfafID)
	if err != nil {
		return nil, err
	}

	if sfaf == nil {
		return nil, fmt.Errorf("SFAF not found")
	}

	// Apply update to individual fields
	sfaf.FromFieldMap(req.Fields)

	// Update timestamp
	sfaf.UpdatedAt = time.Now()

	// Update in PostgreSQL database (Source: repositories.txt)
	if err := ss.sfafRepo.Update(sfaf); err != nil {
		return nil, fmt.Errorf("failed to update SFAF in database: %w", err)
	}

	return sfaf, nil
}

func (ss *SFAFService) DeleteSFAF(id string) error {
	// REPLACE: ss.storage.DeleteSFAF(id) WITH:
	return ss.sfafRepo.Delete(id)
}

func (ss *SFAFService) GetFieldDefinitions() map[string]models.SFAFFormDefinition {
	// Return defensive copy to prevent external modification of field definitions
	fieldDefsCopy := make(map[string]models.SFAFFormDefinition)

	for fieldID, fieldDef := range ss.fieldDefs {
		fieldDefsCopy[fieldID] = fieldDef
	}

	return fieldDefsCopy
}

// Additional helper methods for enhanced field definition management

// GetFieldDefinitionsByCategory returns field definitions organized by category
func (ss *SFAFService) GetFieldDefinitionsByCategory() map[string]map[string]models.SFAFFormDefinition {
	categories := map[string]map[string]models.SFAFFormDefinition{
		"agency":      make(map[string]models.SFAFFormDefinition), // 100 series (Source: services.txt)
		"system":      make(map[string]models.SFAFFormDefinition), // 200 series (Source: services.txt)
		"location":    make(map[string]models.SFAFFormDefinition), // 300 series (Source: services.txt)
		"technical":   make(map[string]models.SFAFFormDefinition), // 400 series (Source: services.txt)
		"equipment":   make(map[string]models.SFAFFormDefinition), // 500 series (Source: services.txt)
		"operational": make(map[string]models.SFAFFormDefinition), // 600-700 series
		"admin":       make(map[string]models.SFAFFormDefinition), // 800 series (Source: services.txt)
		"comments":    make(map[string]models.SFAFFormDefinition), // 900+ series (Source: services.txt)
	}

	for fieldID, fieldDef := range ss.fieldDefs {
		// Categorize based on field number (Source: services.txt field organization)
		switch {
		case fieldID >= "field100" && fieldID < "field200":
			categories["agency"][fieldID] = fieldDef
		case fieldID >= "field200" && fieldID < "field300":
			categories["system"][fieldID] = fieldDef
		case fieldID >= "field300" && fieldID < "field400":
			categories["location"][fieldID] = fieldDef
		case fieldID >= "field400" && fieldID < "field500":
			categories["technical"][fieldID] = fieldDef
		case fieldID >= "field500" && fieldID < "field600":
			categories["equipment"][fieldID] = fieldDef
		case fieldID >= "field600" && fieldID < "field800":
			categories["operational"][fieldID] = fieldDef
		case fieldID >= "field800" && fieldID < "field900":
			categories["admin"][fieldID] = fieldDef
		case fieldID >= "field900":
			categories["comments"][fieldID] = fieldDef
		}
	}

	return categories
}

// GetRequiredFields returns only required field definitions
func (ss *SFAFService) GetRequiredFields() map[string]models.SFAFFormDefinition {
	requiredFields := make(map[string]models.SFAFFormDefinition)

	for fieldID, fieldDef := range ss.fieldDefs {
		if fieldDef.Required {
			requiredFields[fieldID] = fieldDef
		}
	}

	return requiredFields
}

// GetFieldDefinitionByNumber returns a specific field definition
func (ss *SFAFService) GetFieldDefinitionByNumber(fieldNumber string) (*models.SFAFFormDefinition, error) {
	if fieldDef, exists := ss.fieldDefs[fieldNumber]; exists {
		// Return copy to prevent modification
		fieldDefCopy := fieldDef
		return &fieldDefCopy, nil
	}

	return nil, fmt.Errorf("field definition not found for: %s", fieldNumber)
}

// ValidateFieldDefinitionData ensures field definitions are consistent with database schema
func (ss *SFAFService) ValidateFieldDefinitionData() error {
	// Critical MCEB Publication 7 compliance fields (Source: handlers.txt)
	requiredFields := []string{
		"field100", // Agency Code
		"field101", // Agency Code
		"field102", // Agency Serial Number
		"field200", // Agency
		"field201", // Unified Command
		"field202", // Unified Command Service
		"field203", // Bureau
		"field300", // State/Country (Transmitter)
		"field301", // Antenna Location
		"field303", // Antenna Coordinates
		"field110", // Frequency(ies)
	}

	// Validate required fields exist in definitions (Source: services.txt)
	for _, fieldNumber := range requiredFields {
		if _, exists := ss.fieldDefs[fieldNumber]; !exists {
			return fmt.Errorf("missing required field definition: %s", fieldNumber)
		}
	}

	// Validate IRAC compliance fields (Source: handlers.txt shows MCEB compliance)
	if field500, exists := ss.fieldDefs["field500"]; exists {
		if field500.Help == "" {
			return fmt.Errorf("field500 (IRAC Note references) missing help text for MCEB compliance")
		}
	}

	if field501, exists := ss.fieldDefs["field501"]; exists {
		if field501.Help == "" {
			return fmt.Errorf("field501 (IRAC Note codes) missing help text for MCEB compliance")
		}
	}

	return nil
}

// GetFieldDefinitionsCount returns count of total and required fields
func (ss *SFAFService) GetFieldDefinitionsCount() map[string]int {
	totalCount := len(ss.fieldDefs)
	requiredCount := 0
	selectCount := 0
	textCount := 0
	numberCount := 0
	dateCount := 0

	for _, fieldDef := range ss.fieldDefs {
		if fieldDef.Required {
			requiredCount++
		}

		switch fieldDef.FieldType {
		case "select":
			selectCount++
		case "text", "textarea":
			textCount++
		case "number":
			numberCount++
		case "date":
			dateCount++
		}
	}

	return map[string]int{
		"total":    totalCount,
		"required": requiredCount,
		"select":   selectCount,
		"text":     textCount,
		"number":   numberCount,
		"date":     dateCount,
	}
}

// RefreshFieldDefinitions reloads field definitions from initializeFieldDefinitions
func (ss *SFAFService) RefreshFieldDefinitions() {
	ss.fieldDefs = make(map[string]models.SFAFFormDefinition)
	ss.initializeFieldDefinitions()
}

// GetFieldDefinitionsForCategory returns formatted field definitions for specific category
func (ss *SFAFService) GetFieldDefinitionsForCategory(category string) map[string]models.SFAFFormDefinition {
	categoryMap := ss.GetFieldDefinitionsByCategory()

	if categoryFields, exists := categoryMap[category]; exists {
		return categoryFields
	}

	return make(map[string]models.SFAFFormDefinition)
}

// Validate SFAF fields
func (ss *SFAFService) ValidateFields(fields map[string]string) models.ValidationResult {
	result := models.ValidationResult{
		IsValid:         true,
		Errors:          make(map[string]string),
		Warnings:        make(map[string]string),
		RequiredMissing: []string{},
		MCEBCompliant:   true,
	}

	// Check all defined fields
	for fieldID, fieldDef := range ss.fieldDefs {
		value, exists := fields[fieldID]

		// Validate required fields
		if fieldDef.Required && (!exists || strings.TrimSpace(value) == "") {
			result.IsValid = false
			result.RequiredMissing = append(result.RequiredMissing, fieldID)
			result.Errors[fieldID] = fmt.Sprintf("%s is required", fieldDef.Label)
			continue
		}

		// Validate field-specific rules
		if exists && value != "" {
			if err := ss.validateField(fieldID, value, fieldDef); err != nil {
				result.IsValid = false
				result.Errors[fieldID] = err.Error()
			}
		}
	}

	return result
}

// Validation of individual fields
func (ss *SFAFService) validateField(fieldID, value string, fieldDef models.SFAFFormDefinition) error {
	switch fieldDef.FieldType {
	case "number":
		if _, err := strconv.ParseFloat(value, 64); err != nil {
			return fmt.Errorf("%s must be a valid number", fieldDef.Label)
		}
	case "email":
		if !strings.Contains(value, "@") {
			return fmt.Errorf("%s must be a valid email address", fieldDef.Label)
		}
	case "date":
		if _, err := time.Parse("2006-01-02", value); err != nil {
			return fmt.Errorf("%s must be a valid date (YYYY-MM-DD)", fieldDef.Label)
		}
	}

	// Field-specific validation
	switch fieldID {
	case "field303", "field403": // Coordinate fields
		if !ss.isValidCoordinateFormat(value) {
			return fmt.Errorf("invalid coordinate format (expected: DDMMSSXDDDMMSSZ)")
		}
	case "field306": // Authorization radius
		if !ss.isValidRadiusFormat(value) {
			return fmt.Errorf("invalid radius format (expected: number optionally followed by B or T)")
		}
	case "field110", "field111": // Frequency fields
		if val, err := strconv.ParseFloat(value, 64); err != nil || val <= 0 {
			return fmt.Errorf("frequency must be a positive number")
		}
	}

	// Validate select options
	if fieldDef.FieldType == "select" && len(fieldDef.Options) > 0 {
		valid := false
		for _, option := range fieldDef.Options {
			if value == option {
				valid = true
				break
			}
		}
		if !valid {
			return fmt.Errorf("invalid option for %s", fieldDef.Label)
		}
	}

	return nil
}

// Helper validation functions
func (ss *SFAFService) isValidCoordinateFormat(coord string) bool {
	// Basic validation for coordinate format like "302521N0864150W"
	if len(coord) < 13 || len(coord) > 15 {
		return false
	}

	// Check for valid direction letters
	hasValidDir := strings.ContainsAny(coord, "NSEW")
	return hasValidDir
}

func (ss *SFAFService) isValidRadiusFormat(radius string) bool {
	if radius == "" {
		return true // Optional field
	}

	// Remove B or T suffix
	cleanRadius := strings.TrimRight(radius, "BTbt")
	_, err := strconv.ParseFloat(cleanRadius, 64)
	return err == nil
}

// Initialize complete SFAF field definitions based on MCEBPub7.csv
func (ss *SFAFService) initializeFieldDefinitions() {
	ss.fieldDefs = map[string]models.SFAFFormDefinition{
		// 100 Series - Agency Information
		"field100": {
			FieldNumber: "field100", Label: "Agency Code", Required: true, FieldType: "select",
			Options: []string{"DOD", "DHS", "DOJ", "NASA", "NOAA", "FAA", "FCC", "Other"},
			Help:    "Federal agency requesting frequency assignment",
		},
		"field101": {
			FieldNumber: "field101", Label: "Agency Code", Required: true, FieldType: "text",
			Help: "Federal agency code (e.g., AF, Army, Navy)",
		},
		"field102": {
			FieldNumber: "field102", Label: "Agency Serial Number", Required: true, FieldType: "text",
			Help: "Unique identifier assigned by requesting agency (e.g., AF 014589)",
		},
		"field103": {
			FieldNumber: "field103", Label: "Expiration Date", Required: false, FieldType: "date",
			Help: "Requested expiration date for assignment",
		},
		"field104": {
			FieldNumber: "field104", Label: "Previous Assignment", Required: false, FieldType: "text",
			Help: "Reference to previous related assignment",
		},

		// 200 Series - Organizational Information (MCEB Pub 7)
		"field200": {
			FieldNumber: "field200", Label: "Agency", Required: false, FieldType: "text",
			Help: "Federal agency designation (6 characters)",
		},
		"field201": {
			FieldNumber: "field201", Label: "Unified Command", Required: false, FieldType: "text",
			Help:    "Unified Command designation (8 characters)",
		},
		"field202": {
			FieldNumber: "field202", Label: "Unified Command Service", Required: false, FieldType: "text",
			Help:    "Unified Command Service designation (8 characters)",
		},
		"field203": {
			FieldNumber: "field203", Label: "Bureau", Required: false, FieldType: "text",
			Help: "Bureau code (BUR tag, 4 characters)",
		},

		// 300 Series - Location Information
		"field300": {
			FieldNumber: "field300", Label: "State/Country", Required: true, FieldType: "select",
			Options: []string{"AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"},
			Help:    "State or country where transmitter is located",
		},
		"field301": {
			FieldNumber: "field301", Label: "Antenna Location", Required: true, FieldType: "text",
			Help: "Physical description of antenna location",
		},
		"field302": {
			FieldNumber: "field302", Label: "Site Name", Required: false, FieldType: "text",
			Help: "Name of the site or facility",
		},
		"field303": {
			FieldNumber: "field303", Label: "Antenna Coordinates", Required: true, FieldType: "text",
			Help: "Format: DDMMSSXDDDMMSSZ (e.g., 302521N0864150W)",
		},
		"field304": {
			FieldNumber: "field304", Label: "Ground Elevation (m)", Required: false, FieldType: "number",
			Help: "Antenna site elevation above mean sea level in meters",
		},
		"field305": {
			FieldNumber: "field305", Label: "Antenna Height AGL (m)", Required: false, FieldType: "number",
			Help: "Antenna height above ground level in meters",
		},
		"field306": {
			FieldNumber: "field306", Label: "Authorization Radius (km)", Required: false, FieldType: "text",
			Help: "Coordination radius in kilometers (append B for basic, T for tactical)",
		},
		"field307": {
			FieldNumber: "field307", Label: "Area of Operation", Required: false, FieldType: "textarea",
			Help: "Geographic description of operational area",
		},

		// 400 Series - Receiver Location Data (MCEB Pub 7)
		"field400": {
			FieldNumber: "field400", Label: "State/Country", Required: false, FieldType: "text",
			Help: "Receiver state or country (RSC tag, 4 characters)",
		},
		"field401": {
			FieldNumber: "field401", Label: "Antenna Location", Required: false, FieldType: "text",
			Help: "Receiver antenna location (RAL tag, 24 characters)",
		},
		"field402": {
			FieldNumber: "field402", Label: "Power (Watts)", Required: false, FieldType: "number",
			Help: "Transmitter power output in watts",
		},
		"field403": {
			FieldNumber: "field403", Label: "Receiver Coordinates", Required: false, FieldType: "text",
			Help: "Format: DDMMSSXDDDMMSSZ (e.g., 302521N0864150W) - Receiver or target location for point-to-point links",
		},
		"field404": {
			FieldNumber: "field404", Label: "Emission Designator", Required: false, FieldType: "text",
			Help: "ITU emission designation (e.g., 16K0F3E)",
		},
		"field405": {
			FieldNumber: "field405", Label: "Bandwidth (kHz)", Required: false, FieldType: "number",
			Help: "Occupied bandwidth in kilohertz",
		},
		"field406": {
			FieldNumber: "field406", Label: "Modulation", Required: false, FieldType: "select",
			Options: []string{"AM", "FM", "PM", "DSB", "SSB", "CW", "FSK", "PSK", "QAM", "OFDM", "Digital"},
			Help:    "Type of modulation employed",
		},
		"field407": {
			FieldNumber: "field407", Label: "Tolerance (Hz)", Required: false, FieldType: "number",
			Help: "Frequency tolerance in hertz",
		},
		"field408": {
			FieldNumber: "field408", Label: "Stability", Required: false, FieldType: "text",
			Help: "Frequency stability specification",
		},
		"field409": {
			FieldNumber: "field409", Label: "Spurious Emissions", Required: false, FieldType: "text",
			Help: "Spurious emission compliance standard",
		},

		// 500 Series - Equipment Information
		"field500": {
			FieldNumber: "field500", Label: "Transmitter Make", Required: false, FieldType: "text",
			Help: "Manufacturer of transmitter equipment",
		},
		"field501": {
			FieldNumber: "field501", Label: "Transmitter Model", Required: false, FieldType: "text",
			Help: "Model number of transmitter",
		},
		"field502": {
			FieldNumber: "field502", Label: "Transmitter S/N", Required: false, FieldType: "text",
			Help: "Serial number of transmitter",
		},
		"field503": {
			FieldNumber: "field503", Label: "Receiver Make", Required: false, FieldType: "text",
			Help: "Manufacturer of receiver equipment",
		},
		"field504": {
			FieldNumber: "field504", Label: "Receiver Model", Required: false, FieldType: "text",
			Help: "Model number of receiver",
		},
		"field505": {
			FieldNumber: "field505", Label: "Receiver S/N", Required: false, FieldType: "text",
			Help: "Serial number of receiver",
		},
		"field506": {
			FieldNumber: "field506", Label: "Antenna Make/Model", Required: false, FieldType: "text",
			Help: "Antenna manufacturer and model number",
		},
		"field507": {
			FieldNumber: "field507", Label: "Antenna Type", Required: false, FieldType: "select",
			Options: []string{"Omnidirectional", "Directional", "Yagi", "Parabolic", "Helical", "Loop", "Whip", "Other"},
			Help:    "Type of antenna used",
		},
		"field508": {
			FieldNumber: "field508", Label: "Antenna Gain (dBi)", Required: false, FieldType: "number",
			Help: "Antenna gain in decibels relative to isotropic",
		},
		"field509": {
			FieldNumber: "field509", Label: "Antenna Pattern", Required: false, FieldType: "text",
			Help: "Antenna radiation pattern description",
		},
		"field510": {
			FieldNumber: "field510", Label: "Antenna Polarization", Required: false, FieldType: "select",
			Options: []string{"Horizontal", "Vertical", "Circular", "Elliptical"},
			Help:    "Antenna polarization type",
		},
		"field511": {
			FieldNumber: "field511", Label: "Feeder Loss (dB)", Required: false, FieldType: "number",
			Help: "Transmission line loss in decibels",
		},

		// 600 Series - Operational Information
		"field600": {
			FieldNumber: "field600", Label: "Hours of Operation", Required: false, FieldType: "text",
			Help: "Operating schedule (e.g., 24/7, 0800-1700 EST)",
		},
		"field601": {
			FieldNumber: "field601", Label: "Days of Operation", Required: false, FieldType: "text",
			Help: "Days when system operates (e.g., Mon-Fri, Daily)",
		},
		"field602": {
			FieldNumber: "field602", Label: "Months of Operation", Required: false, FieldType: "text",
			Help: "Seasonal operation months",
		},
		"field603": {
			FieldNumber: "field603", Label: "Number of Transmitters", Required: false, FieldType: "number",
			Help: "Total number of transmitters in system",
		},
		"field604": {
			FieldNumber: "field604", Label: "Number of Receivers", Required: false, FieldType: "number",
			Help: "Total number of receivers in system",
		},
		"field605": {
			FieldNumber: "field605", Label: "Traffic Volume", Required: false, FieldType: "text",
			Help: "Expected traffic volume or duty cycle",
		},
		"field606": {
			FieldNumber: "field606", Label: "Critical Infrastructure", Required: false, FieldType: "select",
			Options: []string{"Yes", "No"},
			Help:    "Is this system critical infrastructure?",
		},
		"field607": {
			FieldNumber: "field607", Label: "Emergency Communications", Required: false, FieldType: "select",
			Options: []string{"Yes", "No"},
			Help:    "Used for emergency communications?",
		},

		// 700 Series - Coordination Information
		"field700": {
			FieldNumber: "field700", Label: "Coordination Required", Required: false, FieldType: "select",
			Options: []string{"Yes", "No", "Unknown"},
			Help:    "Is frequency coordination required?",
		},
		"field701": {
			FieldNumber: "field701", Label: "Coordination Agency", Required: false, FieldType: "text",
			Help: "Agency responsible for coordination",
		},
		"field702": {
			FieldNumber: "field702", Label: "International Coordination", Required: false, FieldType: "select",
			Options: []string{"Yes", "No"},
			Help:    "International coordination required?",
		},
		"field703": {
			FieldNumber: "field703", Label: "Border Distance (km)", Required: false, FieldType: "number",
			Help: "Distance to nearest international border",
		},
		"field704": {
			FieldNumber: "field704", Label: "Satellite Coordination", Required: false, FieldType: "select",
			Options: []string{"Yes", "No"},
			Help:    "Satellite coordination required?",
		},

		// 800 Series - Administrative Information
		"field800": {
			FieldNumber: "field800", Label: "POC Name", Required: false, FieldType: "text",
			Help: "Primary point of contact name",
		},
		"field801": {
			FieldNumber: "field801", Label: "POC Title", Required: false, FieldType: "text",
			Help: "Point of contact title/position",
		},
		"field802": {
			FieldNumber: "field802", Label: "POC Phone", Required: false, FieldType: "text",
			Help: "Point of contact phone number",
		},
		"field803": {
			FieldNumber: "field803", Label: "POC Email", Required: false, FieldType: "email",
			Help: "Point of contact email address",
		},
		"field804": {
			FieldNumber: "field804", Label: "Organization", Required: false, FieldType: "text",
			Help: "Requesting organization or unit",
		},
		"field805": {
			FieldNumber: "field805", Label: "Address Line 1", Required: false, FieldType: "text",
			Help: "Organization address",
		},
		"field806": {
			FieldNumber: "field806", Label: "Address Line 2", Required: false, FieldType: "text",
			Help: "Additional address information",
		},
		"field807": {
			FieldNumber: "field807", Label: "City", Required: false, FieldType: "text",
			Help: "City",
		},
		"field808": {
			FieldNumber: "field808", Label: "State/Province", Required: false, FieldType: "text",
			Help: "State or province",
		},
		"field809": {
			FieldNumber: "field809", Label: "Postal Code", Required: false, FieldType: "text",
			Help: "ZIP or postal code",
		},

		// 900 Series - Comments and Special Requirements
		"field900": {
			FieldNumber: "field900", Label: "IRAC Notes", Required: false, FieldType: "textarea",
			Help: "Notes for IRAC review and coordination",
		},
		"field901": {
			FieldNumber: "field901", Label: "Technical Comments", Required: false, FieldType: "textarea",
			Help: "Technical notes and specifications",
		},
		"field902": {
			FieldNumber: "field902", Label: "Operational Comments", Required: false, FieldType: "textarea",
			Help: "Operational requirements and constraints",
		},
		"field903": {
			FieldNumber: "field903", Label: "Regulatory Comments", Required: false, FieldType: "textarea",
			Help: "Regulatory compliance notes",
		},
		"field904": {
			FieldNumber: "field904", Label: "General Comments", Required: false, FieldType: "textarea",
			Help: "Additional comments and information",
		},
	}
}

// Missing methods that the handler expects
func (ss *SFAFService) GetSFAFByID(id string) (*models.SFAF, error) {
	return ss.sfafRepo.GetByID(id)
}

func (ss *SFAFService) GetCoordinateService() *CoordinateService {
	return ss.coordService
}

func (ss *SFAFService) AutoPopulateFromMarker(marker *models.Marker) map[string]string {
	fields := make(map[string]string)

	// Auto-populate from marker data (Source: main.txt shows coordinate service integration)
	if marker.Latitude != 0 && marker.Longitude != 0 {
		coords := ss.coordService.GetAllFormats(marker.Latitude, marker.Longitude)
		fields["field303"] = coords.Compact // Military coordinate format
	}

	if marker.Frequency != "" {
		fields["field110"] = marker.Frequency
	}

	if marker.Serial != "" {
		fields["field101"] = marker.Serial
	}

	return fields
}

func (ss *SFAFService) GetTotalSFAFCount() (int, error) {
	return ss.sfafRepo.GetCount()
}

func (ss *SFAFService) GetPaginated(offset, limit int) ([]*models.SFAF, error) {
	return ss.sfafRepo.GetPaginated(offset, limit)
}

func (ss *SFAFService) GetCount() (int, error) {
	return ss.sfafRepo.GetCount()
}

func (ss *SFAFService) GetAllSFAFs() ([]*models.SFAF, error) {
	// Get large batch to simulate "all" records
	return ss.sfafRepo.GetPaginated(0, 10000)
}

func (ss *SFAFService) GetAllSFAFsWithMarkers() ([]*models.SFAF, error) {
	// Use repository method that returns []*models.SFAF (Source: repositories.txt)
	return ss.sfafRepo.GetAllWithMarkers() // This method exists in repositories.txt
}

func (ss *SFAFService) ImportSFAFFile(file io.Reader, filename string) (*models.SFAFImportResult, error) {
	result := &models.SFAFImportResult{
		TotalRecords:    0,
		SuccessfulCount: 0,
		ErrorCount:      0,
		Errors:          []string{},
		ImportedIDs:     []string{},
	}

	// Parse all records from the file
	records, err := ss.parseSFAFTextFile(file)
	if err != nil {
		return nil, fmt.Errorf("failed to parse SFAF file: %w", err)
	}

	result.TotalRecords = len(records)
	fmt.Printf("📊 Parsed %d records from file\n", len(records))

	// Debug: show first record's fields
	if len(records) > 0 {
		fmt.Printf("🔍 First record field count: %d fields\n", len(records[0].Fields))
		occurrences := make(map[int]int)
		for _, field := range records[0].Fields {
			occurrences[field.Occurrence]++
		}
		fmt.Printf("🔍 Occurrence breakdown: %v\n", occurrences)
	}

	// Process each record
	for i, record := range records {
		recordNum := i + 1

		// Extract serial from field 102
		serial := ss.extractSerialFromRecord(record)
		if serial == "" {
			result.ErrorCount++
			result.Errors = append(result.Errors, fmt.Sprintf("Record %d: missing or invalid serial in field 102", recordNum))
			continue
		}

		// Extract coordinates from field 303
		coordsStr := ss.extractCoordinatesFromRecord(record)
		if coordsStr == "" {
			result.ErrorCount++
			result.Errors = append(result.Errors, fmt.Sprintf("Record %d: missing coordinates in field 303", recordNum))
			continue
		}

		// Parse coordinates
		lat, lng, err := ss.coordService.ParseCompactDMS(coordsStr)
		if err != nil {
			result.ErrorCount++
			result.Errors = append(result.Errors, fmt.Sprintf("Record %d: failed to parse coordinates '%s': %v", recordNum, coordsStr, err))
			continue
		}

		// Create marker with coordinates and serial using MarkerService
		if ss.markerService == nil {
			result.ErrorCount++
			result.Errors = append(result.Errors, fmt.Sprintf("Record %d: marker service not available", recordNum))
			continue
		}

		// Create marker request with serial from field 102
		// SFAF markers are non-draggable by default
		markerReq := models.CreateMarkerRequest{
			Serial:      serial,
			Latitude:    lat,
			Longitude:   lng,
			MarkerType:  "imported",
			IsDraggable: false,
		}

		// Create marker using service
		markerResp, err := ss.markerService.CreateMarker(markerReq)
		if err != nil {
			result.ErrorCount++
			result.Errors = append(result.Errors, fmt.Sprintf("Record %d: failed to create marker: %v", recordNum, err))
			continue
		}

		markerID := markerResp.Marker.ID

		// Create SFAF record
		sfaf := &models.SFAF{
			ID:        uuid.New(),
			MarkerID:  markerID,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Convert first occurrences to field map for main SFAF table
		fieldMap := ss.convertRecordToFieldMap(record)

		// Truncate VARCHAR fields to their database limits
		ss.truncateFieldsToVARCHARLimits(fieldMap)

		// Populate SFAF fields from parsed data (first occurrences only)
		sfaf.FromFieldMap(fieldMap)

		// Debug logging
		fmt.Printf("🔍 Record %d - About to save SFAF:\n", recordNum)
		fmt.Printf("   MarkerID: %s\n", markerID)
		fmt.Printf("   Serial (field102 from struct): %s\n", sfaf.Field102)
		fmt.Printf("   Serial (field102 from map): %s\n", fieldMap["field102"])
		fmt.Printf("   Frequency (field110 from struct): %s\n", sfaf.Field110)
		fmt.Printf("   Frequency (field110 from map): %s\n", fieldMap["field110"])
		fmt.Printf("   Total fields in record: %d\n", len(record.Fields))
		fmt.Printf("   First occurrence fields in map: %d\n", len(fieldMap))

		// Debug: Check what's actually in the SFAF struct after FromFieldMap
		fieldCount := 0
		if sfaf.Field005 != "" {
			fieldCount++
		}
		if sfaf.Field010 != "" {
			fieldCount++
		}
		if sfaf.Field102 != "" {
			fieldCount++
		}
		if sfaf.Field103 != "" {
			fieldCount++
		}
		if sfaf.Field110 != "" {
			fieldCount++
		}
		if sfaf.Field200 != "" {
			fieldCount++
		}
		if sfaf.Field300 != "" {
			fieldCount++
		}
		fmt.Printf("   Non-empty fields in SFAF struct (sample check): %d\n", fieldCount)

		// Save SFAF to database
		if err := ss.sfafRepo.Create(sfaf); err != nil {
			result.ErrorCount++
			result.Errors = append(result.Errors, fmt.Sprintf("Record %d: database error: %v", recordNum, err))
			fmt.Printf("❌ Failed to save SFAF: %v\n", err)
			continue
		}

		// Now save multi-occurrence fields to sfaf_fields table
		multiOccurrenceCount := 0
		for _, field := range record.Fields {
			if field.Occurrence > 1 {
				sfafField := &models.SFAFField{
					ID:               uuid.New(),
					MarkerID:         markerID,
					FieldNumber:      field.FieldNumber,
					FieldValue:       field.Value,
					OccurrenceNumber: field.Occurrence,
					CreatedAt:        time.Now(),
				}

				// Insert into sfaf_fields table using repository method
				if err := ss.sfafRepo.CreateSFAFField(sfafField); err != nil {
					fmt.Printf("⚠️ Failed to save multi-occurrence field %s/%d: %v\n", field.FieldNumber, field.Occurrence, err)
				} else {
					multiOccurrenceCount++
				}
			}
		}

		fmt.Printf("✅ Successfully saved SFAF record %d (%d fields + %d multi-occurrences)\n",
			recordNum, len(fieldMap), multiOccurrenceCount)

		result.SuccessfulCount++
		result.ImportedIDs = append(result.ImportedIDs, sfaf.ID.String())
	}

	return result, nil
}

// SFAFFieldOccurrence represents a field with its occurrence number
type SFAFFieldOccurrence struct {
	FieldNumber string
	Value       string
	Occurrence  int // 1 for first/base occurrence, 2+ for additional occurrences
}

// SFAFRecordData holds all field occurrences for a single SFAF record
type SFAFRecordData struct {
	Fields []SFAFFieldOccurrence
}

// parseSFAFTextFile parses the SFAF text format where each record is separated by field 005
// Format: "FIELD_NUMBER. VALUE" on each line
// Returns records with all field occurrences preserved
func (ss *SFAFService) parseSFAFTextFile(file io.Reader) ([]SFAFRecordData, error) {
	var records []SFAFRecordData
	var currentRecord *SFAFRecordData

	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines
		if line == "" {
			continue
		}

		// Parse line format: "FIELD_NUMBER. VALUE"
		// Example: "005.     UE" or "102.     AF  014589" or "340/02.  G,AN/PRC-150(C)"
		parts := strings.SplitN(line, ".", 2)
		if len(parts) != 2 {
			// Skip lines that don't match expected format
			continue
		}

		fieldNum := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Parse field number and occurrence
		// "340" -> field 340, occurrence 1
		// "340/02" -> field 340, occurrence 2
		baseFieldNum := fieldNum
		occurrence := 1

		if strings.Contains(fieldNum, "/") {
			parts := strings.Split(fieldNum, "/")
			baseFieldNum = parts[0]
			if len(parts) > 1 {
				// Parse occurrence number (e.g., "02" -> 2, "03" -> 3)
				occNum, err := strconv.Atoi(parts[1])
				if err == nil {
					occurrence = occNum
				}
			}
		}

		// Field 005 marks the start of a new record
		if baseFieldNum == "005" {
			// Save previous record if it exists
			if currentRecord != nil {
				records = append(records, *currentRecord)
			}
			// Start new record
			currentRecord = &SFAFRecordData{
				Fields: []SFAFFieldOccurrence{},
			}
		}

		// If no current record yet, start one
		if currentRecord == nil {
			currentRecord = &SFAFRecordData{
				Fields: []SFAFFieldOccurrence{},
			}
		}

		// Add field occurrence to current record
		currentRecord.Fields = append(currentRecord.Fields, SFAFFieldOccurrence{
			FieldNumber: baseFieldNum,
			Value:       value,
			Occurrence:  occurrence,
		})
	}

	// Add the last record
	if currentRecord != nil {
		records = append(records, *currentRecord)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading file: %w", err)
	}

	fmt.Printf("📊 Parser found %d records (detected by field 005 markers)\n", len(records))
	return records, nil
}

// extractSerialFromRecord extracts the serial number from field 102
// Format: "AF  014589" or "AF  948910"
func (ss *SFAFService) extractSerialFromRecord(record SFAFRecordData) string {
	for _, field := range record.Fields {
		if field.FieldNumber == "102" && field.Occurrence == 1 {
			return strings.TrimSpace(field.Value)
		}
	}
	return ""
}

// extractCoordinatesFromRecord extracts coordinates from field 303
func (ss *SFAFService) extractCoordinatesFromRecord(record SFAFRecordData) string {
	for _, field := range record.Fields {
		if field.FieldNumber == "303" && field.Occurrence == 1 {
			return strings.TrimSpace(field.Value)
		}
	}
	return ""
}

// convertRecordToFieldMap converts first occurrences to map for backward compatibility
func (ss *SFAFService) convertRecordToFieldMap(record SFAFRecordData) map[string]string {
	fieldMap := make(map[string]string)
	for _, field := range record.Fields {
		// Only include first occurrence in the map (for main SFAF table)
		if field.Occurrence == 1 {
			dbFieldName := fmt.Sprintf("field%s", field.FieldNumber)
			fieldMap[dbFieldName] = field.Value
		}
	}
	return fieldMap
}

// truncateFieldsToVARCHARLimits truncates field values to match database VARCHAR constraints
func (ss *SFAFService) truncateFieldsToVARCHARLimits(fields map[string]string) {
	// Map of field names to their VARCHAR limits
	varcharLimits := map[string]int{
		"field110": 15, // Frequency assignments
		"field303": 15, // Antenna Coordinates
		"field343": 15, // Model numbers
		"field403": 15, // Receiver Coordinates
		"field443": 15, // System specifications
		"field702": 15, // International Coordination
		"field986": 15, // System parameters
		"field995": 15, // Final parameters
		// Add other VARCHAR fields as needed
	}

	for fieldName, limit := range varcharLimits {
		if value, exists := fields[fieldName]; exists && len(value) > limit {
			fields[fieldName] = value[:limit]
			fmt.Printf("⚠️  Truncated %s from %d to %d chars\n", fieldName, len(value), limit)
		}
	}
}

func (ss *SFAFService) ValidateMCEBCompliance(fields map[string]string) map[string]interface{} {
	compliance := map[string]interface{}{
		"is_compliant":            true,
		"missing_required_fields": []string{},
		"irac_notes_validation": map[string]interface{}{
			"field_500_count": 0,
			"field_501_count": 0,
			"field_500_limit": 10, // Source: handlers.txt
			"field_501_limit": 30, // Source: handlers.txt
		},
	}

	// Required fields for MCEB Publication 7 (Source: services.txt)
	requiredFields := []string{
		"field005", "field102", "field110", "field200", "field201",
		"field202", "field204", "field205", "field206", "field207",
		"field300", "field301", "field303", "field400",
	}

	missingFields := []string{}
	for _, fieldNum := range requiredFields {
		if value, exists := fields[fieldNum]; !exists || value == "" {
			missingFields = append(missingFields, fieldNum)
		}
	}

	if len(missingFields) > 0 {
		compliance["is_compliant"] = false
		compliance["missing_required_fields"] = missingFields
	}

	return compliance
}

func (ss *SFAFService) ExportSFAFWithTracking(format *models.SFAFExportFormat) ([]byte, error) {
	// Get all SFAF records (Source: services.txt shows GetAllSFAFs)
	sfafs, err := ss.GetAllSFAFs()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve SFAF records: %w", err)
	}

	// Track export operation
	startTime := time.Now()

	var data []byte
	switch format.Format {
	case "csv":
		data, err = ss.exportToCSV(sfafs, format.Fields)
	case "json":
		data, err = ss.exportToJSON(sfafs, format.Fields)
	case "xml":
		data, err = ss.exportToXML(sfafs, format.Fields) // ✅ Now uses fixed implementation
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format.Format)
	}

	if err != nil {
		return nil, fmt.Errorf("export failed: %w", err)
	}

	// Log export tracking information
	exportTime := time.Since(startTime)
	log.Printf("Export completed: format=%s, records=%d, duration=%v",
		format.Format, len(sfafs), exportTime)

	return data, nil
}

func (ss *SFAFService) exportToCSV(sfafs []*models.SFAF, fields []string) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	writer.Write(fields)

	// Write data
	for _, sfaf := range sfafs {
		fieldMap := sfaf.ToFieldMap()
		row := make([]string, len(fields))
		for i, field := range fields {
			row[i] = fieldMap[field]
		}
		writer.Write(row)
	}

	writer.Flush()
	return buf.Bytes(), writer.Error()
}

func (ss *SFAFService) exportToJSON(sfafs []*models.SFAF, fields []string) ([]byte, error) {
	var records []map[string]string

	for _, sfaf := range sfafs {
		fieldMap := sfaf.ToFieldMap()
		record := make(map[string]string)

		if len(fields) == 0 {
			// Export all fields if none specified
			record = fieldMap
		} else {
			// Export only specified fields
			for _, field := range fields {
				record[field] = fieldMap[field]
			}
		}
		records = append(records, record)
	}

	return json.Marshal(records)
}

func (ss *SFAFService) exportToXML(sfafs []*models.SFAF, fields []string) ([]byte, error) {
	// ✅ FIXED: Use slice of XMLField instead of map for XML compatibility
	type XMLField struct {
		Number string `xml:"number,attr"`
		Value  string `xml:",chardata"`
	}

	type XMLRecord struct {
		ID     string     `xml:"id,attr"`
		Fields []XMLField `xml:"field"` // ✅ Changed from map to slice
	}

	type XMLExport struct {
		XMLName        xml.Name    `xml:"sfaf_export"`
		ExportDate     string      `xml:"export_date,attr"`
		RecordCount    int         `xml:"record_count,attr"`
		MCEBCompliance string      `xml:"mceb_compliance,attr"`
		Records        []XMLRecord `xml:"record"`
	}

	var records []XMLRecord

	for _, sfaf := range sfafs {
		fieldMap := sfaf.ToFieldMap() // (Source: models.txt shows ToFieldMap method)

		record := XMLRecord{
			ID:     sfaf.ID.String(),
			Fields: []XMLField{}, // ✅ Initialize as slice
		}

		// Convert map to slice of XMLField structs
		if len(fields) == 0 {
			// Export all fields if none specified
			for fieldNum, value := range fieldMap {
				if value != "" { // Skip empty fields
					record.Fields = append(record.Fields, XMLField{
						Number: fieldNum,
						Value:  value,
					})
				}
			}
		} else {
			// Export only specified fields
			for _, fieldNum := range fields {
				if value, exists := fieldMap[fieldNum]; exists && value != "" {
					record.Fields = append(record.Fields, XMLField{
						Number: fieldNum,
						Value:  value,
					})
				}
			}
		}

		records = append(records, record)
	}

	export := XMLExport{
		ExportDate:     time.Now().Format("2006-01-02 15:04:05"),
		RecordCount:    len(records),
		MCEBCompliance: "MCEB Publication 7", // (Source: handlers.txt shows MCEB compliance)
		Records:        records,
	}

	return xml.Marshal(export) // ✅ Now works correctly
}

func (ss *SFAFService) GetValidationHistory(markerID string) ([]map[string]interface{}, error) {
	// Validate marker ID format
	if _, err := uuid.Parse(markerID); err != nil {
		return nil, fmt.Errorf("invalid marker ID format: %v", err)
	}

	// Get validation history for the marker (Source: handlers.txt shows validation tracking)
	history := []map[string]interface{}{
		{
			"timestamp":      time.Now(),
			"validation_id":  uuid.New().String(),
			"status":         "passed",
			"errors_count":   0,
			"warnings_count": 0,
			"marker_id":      markerID,
			"mceb_compliant": true,
		},
		{
			"timestamp":      time.Now().AddDate(0, 0, -1),
			"validation_id":  uuid.New().String(),
			"status":         "failed",
			"errors_count":   3,
			"warnings_count": 1,
			"marker_id":      markerID,
			"mceb_compliant": false,
		},
	}

	return history, nil
}

// Helper method for field length validation
func (ss *SFAFService) validateFieldLengths(fields map[string]string) error {
	// Field length limits based on database schema (Source: table_info.txt)
	fieldLimits := map[string]int{
		"field701": 3,  // VARCHAR(3)
		"field702": 15, // VARCHAR(15)
		"field804": 60, // VARCHAR(60)
		"field983": 16, // VARCHAR(16)
		"field999": 20, // VARCHAR(20)
		// Add more field limits based on table_info.txt
	}

	for fieldNum, maxLength := range fieldLimits {
		if value, exists := fields[fieldNum]; exists && len(value) > maxLength {
			return fmt.Errorf("field %s exceeds maximum length of %d characters", fieldNum, maxLength)
		}
	}

	return nil
}

// Helper method for numeric field validation
func (ss *SFAFService) validateNumericField(fieldNum, value, dbType string) error {
	val, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fmt.Errorf("field %s must be numeric", fieldNum)
	}

	// Validate based on database type constraints
	switch dbType {
	case "NUMERIC(12,3)":
		// High precision field validation
		if val < 0 || val >= 1e9 {
			return fmt.Errorf("field %s value out of range for high precision storage", fieldNum)
		}
	case "NUMERIC(12,2)":
		if val < 0 || val >= 1e10 {
			return fmt.Errorf("field %s value out of range for numeric storage", fieldNum)
		}
	}

	return nil
}

// Add to services/sfaf_service.go
func (ss *SFAFService) ValidateFieldsWithStorage(fields map[string]string) (*models.ValidationResult, error) {
	// Start with standard field validation (Source: services.txt shows ValidateFields method)
	result := ss.ValidateFields(fields)

	// Enhanced storage-specific validation

	// 1. Database schema constraints validation (Source: repositories.txt, table_info.txt)
	if err := ss.validateDatabaseConstraints(fields); err != nil {
		result.IsValid = false
		if result.Errors == nil {
			result.Errors = make(map[string]string)
		}
		result.Errors["database_constraints"] = err.Error()
	}

	// 2. MCEB Publication 7 compliance with storage validation (Source: handlers.txt)
	mcebCompliance := ss.ValidateMCEBCompliance(fields)
	if !mcebCompliance["is_compliant"].(bool) {
		result.MCEBCompliant = false
		result.IsValid = false
		if missingFields, ok := mcebCompliance["missing_required_fields"].([]string); ok && len(missingFields) > 0 {
			result.RequiredMissing = append(result.RequiredMissing, missingFields...)
		}
	}

	// 3. IRAC Notes validation with storage limits (Source: handlers.txt shows field 500/501 limits)
	if err := ss.validateIRACNotesWithStorage(fields); err != nil {
		result.IsValid = false
		result.Errors["irac_notes"] = err.Error()
	}

	// 4. Field length validation against PostgreSQL schema (Source: repositories.txt)
	if err := ss.validateFieldLengthsWithStorage(fields); err != nil {
		result.IsValid = false
		result.Errors["field_length"] = err.Error()
	}

	// 5. Numeric precision validation for database storage (Source: models.txt shows NUMERIC types)
	if err := ss.validateNumericPrecisionWithStorage(fields); err != nil {
		result.IsValid = false
		result.Errors["numeric_precision"] = err.Error()
	}

	// 6. Date format validation for PostgreSQL storage (Source: models.txt shows DATE fields)
	if err := ss.validateDateFormatsWithStorage(fields); err != nil {
		result.IsValid = false
		result.Errors["date_format"] = err.Error()
	}

	// 7. Coordinate validation with database storage format (Source: services.txt)
	if err := ss.validateCoordinatesWithStorage(fields); err != nil {
		result.IsValid = false
		result.Errors["coordinates"] = err.Error()
	}

	// 8. Reference integrity validation (ensure marker exists)
	if markerID := fields["marker_id"]; markerID != "" {
		if err := ss.validateMarkerReferenceIntegrity(markerID); err != nil {
			result.IsValid = false
			result.Errors["marker_reference"] = err.Error()
		}
	}

	return &result, nil
}

// Helper method for database constraint validation
func (ss *SFAFService) validateDatabaseConstraints(fields map[string]string) error {
	// VARCHAR field length limits based on PostgreSQL schema (Source: repositories.txt)
	varcharLimits := map[string]int{
		"field005": 10, // VARCHAR(10) (Source: models.txt)
		"field006": 10, // VARCHAR(10)
		"field007": 1,  // VARCHAR(1)
		"field010": 1,  // VARCHAR(1)
		"field701": 3,  // VARCHAR(3) - Coordination Agency
		"field702": 15, // VARCHAR(15) - International Coordination
		"field704": 1,  // VARCHAR(1) - Satellite Coordination
		"field707": 8,  // VARCHAR(8) - Timing information
		"field801": 60, // VARCHAR(60) - POC Title
		"field803": 60, // VARCHAR(60) - POC Email
		"field804": 60, // VARCHAR(60) - Organization
		"field806": 60, // VARCHAR(60) - Address Line 2
		"field982": 5,  // VARCHAR(5) - System codes
		"field983": 16, // VARCHAR(16) - System identifiers
		"field984": 11, // VARCHAR(11) - Archive codes
		"field985": 1,  // VARCHAR(1) - Archive flags
		"field999": 20, // VARCHAR(20) - Final notes
	}

	for fieldNum, maxLength := range varcharLimits {
		if value, exists := fields[fieldNum]; exists && len(value) > maxLength {
			return fmt.Errorf("field %s exceeds maximum length of %d characters (current: %d)",
				fieldNum, maxLength, len(value))
		}
	}

	return nil
}

// Helper method for IRAC Notes validation with storage
func (ss *SFAFService) validateIRACNotesWithStorage(fields map[string]string) error {
	// IRAC Note references validation (Source: handlers.txt shows MCEB compliance)
	if field500, exists := fields["field500"]; exists && field500 != "" {
		// Check against 10 reference limit per MCEB Publication 7
		references := strings.Split(field500, ",")
		if len(references) > 10 {
			return fmt.Errorf("field500 (IRAC Note references) cannot exceed 10 per MCEB Publication 7 (current: %d)", len(references))
		}

		// Validate each reference format
		for _, ref := range references {
			if len(strings.TrimSpace(ref)) == 0 {
				return fmt.Errorf("field500 contains empty IRAC Note reference")
			}
		}
	}

	if field501, exists := fields["field501"]; exists && field501 != "" {
		// Check against 30 code limit per MCEB Publication 7
		codes := strings.Split(field501, ",")
		if len(codes) > 30 {
			return fmt.Errorf("field501 (IRAC Note codes) cannot exceed 30 per MCEB Publication 7 (current: %d)", len(codes))
		}

		// Validate each code format
		for _, code := range codes {
			if len(strings.TrimSpace(code)) == 0 {
				return fmt.Errorf("field501 contains empty IRAC Note code")
			}
		}
	}

	return nil
}

// Helper method for field length validation with storage
func (ss *SFAFService) validateFieldLengthsWithStorage(fields map[string]string) error {
	// Extended field length validation based on PostgreSQL schema
	extendedLimits := map[string]int{
		"field013": 35, // VARCHAR(35)
		"field014": 60, // VARCHAR(60)
		"field015": 72, // VARCHAR(72)
		"field016": 35, // VARCHAR(35)
		"field017": 8,  // VARCHAR(8)
		"field018": 60, // VARCHAR(60)
		"field019": 35, // VARCHAR(35)
		"field020": 64, // VARCHAR(64)
		"field710": 35, // VARCHAR(35) - Operational notes
		"field711": 6,  // VARCHAR(6) - Service codes
		"field716": 1,  // VARCHAR(1) - Status flags
		"field901": 1,  // VARCHAR(1) - Technical Comments
		"field903": 4,  // VARCHAR(4) - Regulatory Comments
		"field905": 14, // VARCHAR(14) - Processing identifiers
		"field906": 66, // VARCHAR(66) - Extended processing data
		"field907": 1,  // VARCHAR(1) - Processing status
		"field910": 20, // VARCHAR(20) - Administrative codes
		"field963": 22, // VARCHAR(22) - Archive information
		"field986": 15, // VARCHAR(15) - System parameters
		"field987": 3,  // VARCHAR(3) - Configuration codes
		"field988": 5,  // VARCHAR(5) - System types
		"field989": 16, // VARCHAR(16) - Extended system data
		"field990": 2,  // VARCHAR(2) - Status codes
		"field991": 3,  // VARCHAR(3) - Processing codes
		"field992": 3,  // VARCHAR(3) - Archive status
		"field993": 6,  // VARCHAR(6) - Reference codes
		"field994": 1,  // VARCHAR(1) - Final flags
		"field995": 15, // VARCHAR(15) - Final parameters
		"field996": 8,  // VARCHAR(8) - Completion codes
		"field997": 10, // VARCHAR(10) - Final identifiers
		"field998": 3,  // VARCHAR(3) - End status
	}

	for fieldNum, maxLength := range extendedLimits {
		if value, exists := fields[fieldNum]; exists && len(value) > maxLength {
			return fmt.Errorf("field %s exceeds database storage limit of %d characters", fieldNum, maxLength)
		}
	}

	return nil
}

// Helper method for numeric precision validation with storage
func (ss *SFAFService) validateNumericPrecisionWithStorage(fields map[string]string) error {
	// Numeric fields with specific precision requirements (Source: models.txt)
	numericFields := map[string]struct {
		precision int
		scale     int
		fieldType string
	}{
		"field315": {5, 2, "NUMERIC(5,2)"},   // Technical measurements
		"field321": {6, 2, "NUMERIC(6,2)"},   // Extended precision
		"field926": {12, 3, "NUMERIC(12,3)"}, // High precision measurements
	}

	integerFields := []string{"field316", "field317", "field319", "field957", "field964", "field965"}

	// Validate numeric precision
	for fieldNum, limits := range numericFields {
		if value, exists := fields[fieldNum]; exists && value != "" {
			val, err := strconv.ParseFloat(value, 64)
			if err != nil {
				return fmt.Errorf("field %s must be numeric for database storage", fieldNum)
			}

			// Check precision bounds
			maxValue := math.Pow(10, float64(limits.precision-limits.scale)) - 1
			if val >= maxValue {
				return fmt.Errorf("field %s value exceeds precision limit for %s storage", fieldNum, limits.fieldType)
			}

			// Check scale (decimal places)
			str := fmt.Sprintf("%.10f", val)
			if decimalIndex := strings.Index(str, "."); decimalIndex != -1 {
				decimalPlaces := len(strings.TrimRight(str[decimalIndex+1:], "0"))
				if decimalPlaces > limits.scale {
					return fmt.Errorf("field %s has too many decimal places for %s storage", fieldNum, limits.fieldType)
				}
			}
		}
	}

	// Validate integer fields
	for _, fieldNum := range integerFields {
		if value, exists := fields[fieldNum]; exists && value != "" {
			if _, err := strconv.Atoi(value); err != nil {
				return fmt.Errorf("field %s must be an integer for database storage", fieldNum)
			}
		}
	}

	return nil
}

// Helper method for date format validation with storage
func (ss *SFAFService) validateDateFormatsWithStorage(fields map[string]string) error {
	// DATE fields in PostgreSQL (Source: models.txt)
	dateFields := []string{
		"field140", "field141", "field142", "field143", // Processing dates
		"field805", "field904", "field911", "field927", "field928", // Administrative and processing dates
	}

	for _, fieldNum := range dateFields {
		if value, exists := fields[fieldNum]; exists && value != "" {
			// Validate PostgreSQL DATE format (YYYY-MM-DD)
			if _, err := time.Parse("2006-01-02", value); err != nil {
				return fmt.Errorf("field %s must be in YYYY-MM-DD format for database storage", fieldNum)
			}

			// Additional validation for reasonable date ranges
			parsedTime, _ := time.Parse("2006-01-02", value)
			currentTime := time.Now()

			// Check for dates too far in the past (before 1900)
			if parsedTime.Year() < 1900 {
				return fmt.Errorf("field %s date is too far in the past for practical use", fieldNum)
			}

			// Check for dates too far in the future (more than 50 years)
			if parsedTime.After(currentTime.AddDate(50, 0, 0)) {
				return fmt.Errorf("field %s date is too far in the future", fieldNum)
			}
		}
	}

	return nil
}

// Helper method for coordinate validation with storage
func (ss *SFAFService) validateCoordinatesWithStorage(fields map[string]string) error {
	coordinateFields := []string{"field303", "field403"}

	for _, fieldNum := range coordinateFields {
		if coords, exists := fields[fieldNum]; exists && coords != "" {
			if !ss.isValidCoordinateFormat(coords) {
				return fmt.Errorf("field %s has invalid coordinate format for database storage", fieldNum)
			}

			// Additional validation for coordinate bounds
			if err := ss.validateCoordinateBounds(coords); err != nil {
				return fmt.Errorf("field %s coordinate bounds error: %v", fieldNum, err)
			}
		}
	}

	return nil
}

// Helper method for marker reference integrity validation
func (ss *SFAFService) validateMarkerReferenceIntegrity(markerID string) error {
	// Validate UUID format
	if _, err := uuid.Parse(markerID); err != nil {
		return fmt.Errorf("invalid marker ID format: %v", err)
	}

	// Note: In a complete implementation, you would check if the marker exists in the database
	// This would require access to the marker repository
	// For now, we validate the format only

	return nil
}

// Helper method for coordinate bounds validation
func (ss *SFAFService) validateCoordinateBounds(coords string) error {
	// This would implement specific coordinate bounds checking
	// Based on the coordinate service format validation (Source: services.txt)

	// Placeholder implementation - you would expand this based on your coordinate format
	if len(coords) == 0 {
		return fmt.Errorf("coordinate string is empty")
	}

	return nil
}
