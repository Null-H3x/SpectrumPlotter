# Field 530 Polygon Implementation

## Overview
This document describes the implementation of Field 530 (Authorized Areas) polygon support for MCEB Pub 7 compliant SFAF records.

## MCEB Pub 7 Field 530 Format

Field 530 contains authorized geographical areas using multi-line format:
- **530** - First coordinate point
- **530/2** - Second coordinate point
- **530/3** - Third coordinate point
- etc.

### Format Details
Each line contains:
- **Code**: `ART` (transmit), `ARR` (receive), or `ARB` (both)
- **Coordinates**: `DDMMSSN/SDDDMMSSE/W` format (e.g., `450000N0050000E`)

### Examples
```
530. ART,450000N0050000E
530/2. ART,453000N0052000E
530/3. ART,445900N0051000E
```

This defines a triangle for a transmitting station at three coordinate points.

## Database Schema

### Table: `sfaf_fields` (Existing)
Multi-occurrence fields are already stored in this table:
```sql
CREATE TABLE sfaf_fields (
    id UUID PRIMARY KEY,
    marker_id UUID REFERENCES markers(id),
    field_number VARCHAR(10),          -- e.g., "530"
    field_value TEXT,                  -- e.g., "ART,450000N0050000E"
    occurrence_number INT,             -- 1, 2, 3, etc.
    created_at TIMESTAMP
);
```

### Table: `sfaf_field_occurrences` (New - Optional)
Created for future use if needed for SFAF-based storage:
```sql
CREATE TABLE sfaf_field_occurrences (
    id UUID PRIMARY KEY,
    sfaf_id UUID REFERENCES sfaf(id),
    field_number VARCHAR(10),
    occurrence INT,
    value TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(sfaf_id, field_number, occurrence)
);
```

## Backend Implementation

### 1. Models (`models/sfaf_field_occurrence.go`)
```go
// Field530Coordinate - Single polygon vertex
type Field530Coordinate struct {
    Code      string  // ART, ARR, or ARB
    Latitude  float64 // Decimal degrees
    Longitude float64 // Decimal degrees
    RawValue  string  // Original SFAF format
}

// Field530Polygon - Complete polygon
type Field530Polygon struct {
    SFAFID      uuid.UUID
    Type        string // "transmit", "receive", "both"
    Coordinates []Field530Coordinate
    IsValid     bool   // true if 3+ points
}

// Field530PolygonResponse - API response
type Field530PolygonResponse struct {
    MarkerID       string
    SerialNumber   string
    Polygon        Field530Polygon
    RawOccurrences []SFAFFieldOccurrence
}
```

### 2. Service (`services/field530_service.go`)
```go
// ParseField530Coordinate - Parses a single Field 530 line
func ParseField530Coordinate(value string) (*Field530Coordinate, error)

// GetField530PolygonByMarkerID - Retrieves polygon for a marker
func GetField530PolygonByMarkerID(markerID uuid.UUID) (*Field530Polygon, error)

// GetAllField530Polygons - Retrieves all Field 530 polygons
func GetAllField530Polygons() ([]Field530PolygonResponse, error)

// ValidateField530Format - Validates Field 530 format
func ValidateField530Format(value string) error
```

#### Coordinate Parsing
The service parses MCEB Pub 7 coordinates (`DDMMSSN/SDDDMMSSE/W`) to decimal degrees:
- Latitude: 6 digits (DDMMSS) + N/S
- Longitude: 7 digits (DDDMMSS) + E/W

Example: `450000N0050000E` → 45.0°N, 5.0°E

### 3. Repository (`repositories/sfaf_repository.go`)
Added methods:
```go
// GetSFAFFieldsByMarkerAndField - Get all occurrences of a field
func GetSFAFFieldsByMarkerAndField(markerID uuid.UUID, fieldNumber string) ([]SFAFField, error)

// GetMarkersWithField - Get all markers with a specific field
func GetMarkersWithField(fieldNumber string) ([]uuid.UUID, error)

// GetMarkerByID - Get marker details
func GetMarkerByID(markerID uuid.UUID) (*Marker, error)
```

### 4. API Endpoints (`handlers/sfaf_handler.go`)

#### GET `/api/sfaf/field530/polygons`
Returns all Field 530 polygons in the system.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "marker_id": "uuid",
      "serial_number": "AF 014589",
      "polygon": {
        "sfaf_id": "uuid",
        "type": "transmit",
        "coordinates": [
          {
            "code": "ART",
            "latitude": 45.0,
            "longitude": 5.0,
            "raw_value": "ART,450000N0050000E"
          },
          ...
        ],
        "is_valid": true
      }
    }
  ]
}
```

#### GET `/api/sfaf/field530/marker/:marker_id`
Returns Field 530 polygon for a specific marker.

**Response:**
```json
{
  "success": true,
  "data": {
    "marker_id": "uuid",
    "serial_number": "AF 014589",
    "polygon": { ... }
  }
}
```

#### POST `/api/sfaf/field530/validate`
Validates Field 530 coordinate format.

**Request:**
```json
{
  "value": "ART,450000N0050000E"
}
```

**Response:**
```json
{
  "valid": true,
  "coordinate": {
    "code": "ART",
    "latitude": 45.0,
    "longitude": 5.0,
    "raw_value": "ART,450000N0050000E"
  }
}
```

## Import Process

The SFAF import process already handles multi-occurrence fields:

1. **Parse SFAF file** (`parseSFAFTextFile`)
   - Detects field continuation lines (e.g., `530/2`, `530/3`)
   - Stores occurrence number

2. **Save to database** (`ImportSFAFFile`)
   - First occurrence (`530`) → Saved to `sfaf` table `field530` column
   - Additional occurrences (`530/2`, `530/3`) → Saved to `sfaf_fields` table

3. **Field 530 retrieval**
   - Query `sfaf_fields` table WHERE `field_number = '530'`
   - Parse each occurrence to extract coordinates
   - Build polygon from ordered vertices

## Frontend Integration (To Be Implemented)

### 1. Fetch Polygons
```javascript
async function fetchField530Polygons() {
    const response = await fetch('/api/sfaf/field530/polygons');
    const data = await response.json();
    return data.data;
}
```

### 2. Display on Map
```javascript
function displayPolygon(polygon) {
    const coordinates = polygon.coordinates.map(coord => [
        coord.latitude,
        coord.longitude
    ]);

    const leafletPolygon = L.polygon(coordinates, {
        color: polygon.type === 'transmit' ? 'blue' :
               polygon.type === 'receive' ? 'green' : 'purple',
        fillOpacity: 0.3
    });

    leafletPolygon.addTo(map);
    leafletPolygon.bindPopup(`Serial: ${polygon.serial_number}`);
}
```

### 3. Create/Edit UI
Form to add Field 530 coordinates:
- Code selector (ART/ARR/ARB)
- Coordinate input (DDMMSSN/SDDDMMSSE/W format)
- Add/Remove coordinate buttons
- Preview polygon on map

## Testing

### Test Data Example
```
005.     UE
102.     AF  014589
110.     123.456 MHZ
303.     450000N0050000E
530.     ART,450000N0050000E
530/2.   ART,453000N0052000E
530/3.   ART,445900N0051000E
```

### API Testing
```bash
# Get all polygons
curl http://localhost:8080/api/sfaf/field530/polygons

# Get polygon by marker
curl http://localhost:8080/api/sfaf/field530/marker/{marker-uuid}

# Validate format
curl -X POST http://localhost:8080/api/sfaf/field530/validate \
  -H "Content-Type: application/json" \
  -d '{"value":"ART,450000N0050000E"}'
```

## Files Modified/Created

### Created:
- `migrations/008_create_sfaf_field_occurrences.sql`
- `models/sfaf_field_occurrence.go`
- `repositories/sfaf_field_occurrence_repository.go`
- `services/field530_service.go`

### Modified:
- `handlers/sfaf_handler.go` - Added Field 530 endpoints
- `repositories/sfaf_repository.go` - Added helper methods
- `main.go` - Registered routes and services
- `services/sfaf_service.go` - Updated constructor
- `web/static/js/db_viewer.js` - Updated field labels

## Next Steps

1. **Run Migration** - Create `sfaf_field_occurrences` table (optional)
2. **Frontend Visualization** - Display Field 530 polygons on map
3. **UI for Creation** - Form to create/edit Field 530 coordinates
4. **Testing** - Import SFAF files with Field 530 data
5. **Documentation** - User guide for Field 530 polygons

## Notes

- The existing `sfaf_fields` table is used for storage (marker-based)
- The new `sfaf_field_occurrences` table is created for future SFAF-based storage
- Parser handles both coordinate format and descriptive text (e.g., "SW WY,NE UT")
- Polygons require minimum 3 coordinates to be valid
- Coordinates are converted from DMS to decimal degrees for mapping
