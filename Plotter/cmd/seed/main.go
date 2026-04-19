// cmd/seed/main.go
// Seeds the database with realistic SFAF records.
//
// Each record:
//   - Has a proper 10-char serial: 1-4 alphas (left-justified, space-padded to 4) + 6 zero-padded digits
//   - Satisfies every field marked globally required in sfaf_required_fields
//   - Auto-creates a linked marker derived from the field303 coordinate
//
// Safe to re-run — appends rows, does not truncate.
//
// Usage:
//
//	go run ./cmd/seed [--count N]
//
// Default: 500 records.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// ── Serial number ─────────────────────────────────────────────────────────────
// Format: [1-4 alphas, left-justified, space-padded to 4][6 digits] = 10 chars

// Approved SFAF serial prefixes (MC4EB Pub 7)
var serialPrefixes = []string{"N", "AR", "MC", "CG", "AF"}

func sfafSerial(prefix string, n int) string {
	return fmt.Sprintf("%-4s%06d", prefix, n)
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

// coords generates a random CONUS coordinate in SFAF format: DDMMSSNDDDMMSSWcoords returns exactly 15 chars
func coords() string {
	lat := 25.0 + rand.Float64()*24.0  // 25–49 N
	lng := 70.0 + rand.Float64()*55.0  // 70–125 W
	latD := int(lat)
	latM := int((lat - float64(latD)) * 60)
	latS := int(((lat-float64(latD))*60-float64(latM)) * 60)
	lngD := int(lng)
	lngM := int((lng - float64(lngD)) * 60)
	lngS := int(((lng-float64(lngD))*60-float64(lngM)) * 60)
	return fmt.Sprintf("%02d%02d%02dN%03d%02d%02dW", latD, latM, latS, lngD, lngM, lngS)
}

// parseCoords converts a 15-char SFAF coordinate string to decimal lat/lng.
func parseCoords(s string) (lat, lng float64, err error) {
	if len(s) != 15 {
		return 0, 0, fmt.Errorf("invalid length %d", len(s))
	}
	parse := func(sub string) (float64, error) { f, e := strconv.ParseFloat(sub, 64); return f, e }
	latD, e1 := parse(s[0:2])
	latM, e2 := parse(s[2:4])
	latS, e3 := parse(s[4:6])
	lngD, e4 := parse(s[7:10])
	lngM, e5 := parse(s[10:12])
	lngS, e6 := parse(s[12:14])
	for _, e := range []error{e1, e2, e3, e4, e5, e6} {
		if e != nil {
			return 0, 0, e
		}
	}
	lat = latD + latM/60 + latS/3600
	if s[6] == 'S' {
		lat = -lat
	}
	lng = lngD + lngM/60 + lngS/3600
	if s[14] == 'W' {
		lng = -lng
	}
	return lat, lng, nil
}

// ── Reference pools ───────────────────────────────────────────────────────────

var agencies = []string{"AF", "ARMY", "NAVY", "USMC", "USCG", "DHS", "DOE"}

// VARCHAR(8) max
var unifiedCommands = []string{"CENTCOM", "EUCOM", "INDOPAC", "NORTHCOM", "SOUTHCOM", "SOCOM", "TRANSCOM"}

// VARCHAR(8) max
var unifiedCommandServices = []string{"AF", "ARMY", "NAVY", "USMC", "USCG"}

var states = []string{"AL", "AK", "AZ", "CA", "CO", "FL", "GA", "HI", "IL", "KY", "MD", "NC", "NM", "NV", "OK", "SC", "TX", "VA", "WA"}

// VARCHAR(18) max — field207
var stationsShort = []string{
	"Eglin AFB", "Hurlburt Field", "MacDill AFB", "Patrick SFB", "Tyndall AFB",
	"Fort Bragg", "Fort Campbell", "Fort Hood", "Fort Lewis", "Fort Benning",
	"Camp Pendleton", "29 Palms", "Quantico", "Cherry Point",
	"NAVSTA Norfolk", "NAS Pensacola", "Peterson SFB", "Schriever SFB",
	"Buckley SFB", "JB Lewis-McChord", "JB San Antonio", "JB Andrews",
}

// VARCHAR(24) max — field301, field401
var locations = []string{
	"Eglin AFB", "Hurlburt Field", "MacDill AFB", "Patrick SFB",
	"Fort Bragg", "Fort Campbell", "Fort Hood", "Fort Benning",
	"Camp Pendleton", "29 Palms", "Quantico", "Cherry Point",
	"NAVSTA Norfolk", "NAS Pensacola", "Peterson SFB", "Schriever SFB",
	"Joint Base Andrews", "JB Lewis-McChord", "JB San Antonio",
}

// VARCHAR(18) max — field302, field403
var siteNames = []string{
	"Main Gate", "Flightline", "HQ Building", "Motor Pool",
	"Range Control", "EOD Compound", "Intel Annex", "CP Alpha",
	"OP Bravo", "FOB Charlie", "COP Delta", "Ops Center",
}

var emissionDesignators = []string{
	"16K0F3E", "6K00A3E", "200HF3E", "8K10F3E", "40M0D1D",
	"1M20D7W", "2M16G7W", "5M00D7D", "200KF3E", "100KA3E",
	"25K0F3E", "10K0F3E", "50K0F3E",
}

var equipmentMakes = []string{
	"Harris", "Motorola", "Kenwood", "L3Harris", "Thales",
	"Barrett", "Icom", "Raytheon", "Rockwell Collins", "Northrop Grumman",
	"General Dynamics", "Viasat", "Cubic", "EF Johnson",
}

var equipmentModels = []string{
	"AN/PRC-117G", "XTS 5000", "TK-5710", "RF-7800S-MP", "AN/PRC-148",
	"2050 HF", "IC-F9021", "MIDS-LVT", "ARC-210", "LMR-9000",
	"AN/PRC-152A", "AN/PRC-163", "AN/VRC-110", "AN/MRC-145",
}

var classificationCodes = []string{"U", "C", "S"}
var statusCodes = []string{"A", "P", "C", "R"}
var recordTypes = []string{"N", "M", "R"}
var stationClasses = []string{"FB", "ML", "MO", "FX", "FS", "AM"}
var freqTolerances = []string{"A", "B", "C", "D", "E"}
var purposeCodes = []string{"P", "S", "E", "T", "R"}

// ── Helpers ───────────────────────────────────────────────────────────────────

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func pick(s []string) string { return s[rand.Intn(len(s))] }

func freqMHz() string {
	bands := [][2]float64{
		{30, 88}, {108, 174}, {225, 400}, {400, 512}, {764, 869},
	}
	b := bands[rand.Intn(len(bands))]
	f := b[0] + rand.Float64()*(b[1]-b[0])
	return fmt.Sprintf("%.4f", f)
}

func erpWatts() string {
	return pick([]string{"1", "2", "5", "10", "20", "50", "100", "200", "500"})
}

func randomDate(from, to time.Time) time.Time {
	delta := to.Unix() - from.Unix()
	return time.Unix(from.Unix()+rand.Int63n(delta), 0)
}

// ── Generator map ─────────────────────────────────────────────────────────────
// Keys are bare field numbers ("005", "102") matching sfaf_required_fields.field_number.
// serial and coordStr are passed in per-record so generators can access them.

func buildGenerators(serial, coordStr string, now, past, future time.Time) map[string]func() interface{} {
	return map[string]func() interface{}{
		"005": func() interface{} { return "DEMO" },
		"006": func() interface{} { return pick(classificationCodes) },
		"007": func() interface{} { return pick(recordTypes) },
		"010": func() interface{} { return pick(statusCodes) },
		"013": func() interface{} { return pick(agencies) },
		"100": func() interface{} { return pick(agencies) },
		"101": func() interface{} { return pick(agencies) },
		"102": func() interface{} { return serial },
		"103": func() interface{} { return randomDate(now, future).Format("20060102") },
		"110": func() interface{} { return freqMHz() },
		"111": func() interface{} { return freqMHz() },
		"113": func() interface{} { return pick(stationClasses) },
		"114": func() interface{} { return pick(emissionDesignators) },
		"115": func() interface{} { return erpWatts() },
		"116": func() interface{} { return pick(freqTolerances) },
		"117": func() interface{} { return pick(freqTolerances) },
		"118": func() interface{} { return pick(freqTolerances) },
		"130": func() interface{} { return pick(purposeCodes) },
		"131": func() interface{} { return pick(purposeCodes) },
		"140": func() interface{} { return randomDate(past, now) },
		"141": func() interface{} { return randomDate(past, now) },
		"142": func() interface{} { return randomDate(past, now) },
		"143": func() interface{} { return randomDate(now, future) },
		"144": func() interface{} { return pick(statusCodes) },
		"200": func() interface{} { return pick(agencies) },
		"201": func() interface{} { return pick(unifiedCommands) },
		"202": func() interface{} { return pick(unifiedCommandServices) },
		"203": func() interface{} { return pick(agencies[:4]) }, // VARCHAR(4)
		"204": func() interface{} { return pick(stationsShort) },
		"205": func() interface{} { return pick(stationsShort) },
		"206": func() interface{} { return pick(stationsShort) },
		"207": func() interface{} { return pick(stationsShort) },
		"208": func() interface{} { return pick(agencies) },
		"209": func() interface{} { return pick(stationsShort) },
		"300": func() interface{} { return pick(states) },
		"301": func() interface{} { return pick(locations) },
		"302": func() interface{} { return pick(siteNames) },
		"303": func() interface{} { return coordStr },
		"304": func() interface{} { return fmt.Sprintf("%d", rand.Intn(9999)) },
		"306": func() interface{} { return fmt.Sprintf("%d", rand.Intn(999)) },
		"340": func() interface{} { return pick(equipmentMakes) },
		"341": func() interface{} { return pick(equipmentModels) },
		"342": func() interface{} { return pick(stationClasses) },
		"343": func() interface{} { return pick(equipmentModels[:8]) }, // VARCHAR(15)
		"344": func() interface{} { return pick(emissionDesignators[:6]) }, // VARCHAR(6)
		"345": func() interface{} { return pick(agencies[:5])[:2] }, // VARCHAR(2)
		"346": func() interface{} { return erpWatts() },
		"347": func() interface{} { return erpWatts() },
		"348": func() interface{} { return pick(emissionDesignators) },
		"349": func() interface{} { return pick(freqTolerances) },
		"357": func() interface{} { return float64(rand.Intn(200)-50) / 10.0 },  // Antenna Gain dBi, NUMERIC(5,2)
		"362": func() interface{} { return fmt.Sprintf("%03d", rand.Intn(360)) }, // Antenna Orientation 000-359, VARCHAR(3)
		"363": func() interface{} { return pick([]string{"H", "V", "C", "X"}) }, // Antenna Polarization, VARCHAR(1)
		"400": func() interface{} { return pick(states) },
		"401": func() interface{} { return pick(locations) },
		"403": func() interface{} { return pick(siteNames) },
		"406": func() interface{} { return coordStr },
		"407": func() interface{} { return pick(stationClasses) },
		"408": func() interface{} { return pick(emissionDesignators) },
		"440": func() interface{} { return pick(equipmentMakes) },
		"442": func() interface{} { return pick(equipmentModels) },
		"443": func() interface{} { return pick(emissionDesignators) },
		"500": func() interface{} { return fmt.Sprintf("NOTE%03d", rand.Intn(100)) },
		"501": func() interface{} { return fmt.Sprintf("N%03d", rand.Intn(100)) },
		"502": func() interface{} { return pick(agencies) },
		"503": func() interface{} { return pick(purposeCodes) },
		"504": func() interface{} { return pick(statusCodes) },
		"506": func() interface{} { return pick(purposeCodes) },
		"511": func() interface{} { return pick([]string{"C2", "ISR", "LOG", "FIRES", "MANEUVER", "AVIATION", "SOCOM", "MEDEVAC"}) }, // Major Function Identifier, VARCHAR(30)
		"700": func() interface{} { return pick(agencies) },
		"701": func() interface{} { return pick(agencies) },
		"702": func() interface{} { return pick(unifiedCommands) },
		"704": func() interface{} { return pick(unifiedCommandServices) },
		"707": func() interface{} { return pick(stationsShort) },
		"710": func() interface{} { return pick(states) },
		"711": func() interface{} { return pick(locations) },
		"716": func() interface{} { return pick(stationClasses) },
		"801": func() interface{} { return pick(agencies) },
		"803": func() interface{} { return pick(agencies) },
		"804": func() interface{} { return pick(agencies) },
		"805": func() interface{} { return randomDate(past, future) },
		"806": func() interface{} { return pick(agencies) },
		"901": func() interface{} { return pick(purposeCodes) },
		"903": func() interface{} { return pick(stationClasses) },
		"904": func() interface{} { return randomDate(past, future) },
		"905": func() interface{} { return pick(agencies) },
		"906": func() interface{} { return pick(locations) },
		"907": func() interface{} { return pick(statusCodes) },
		"910": func() interface{} { return pick(stationsShort) },
	}
}

// ── Base fields always seeded (bare numbers) ──────────────────────────────────
var baseFields = []string{
	"005", "007", "010",
	"102", "103", "110", "113", "114", "115", "116",
	"140", "143",
	"200", "201", "202", "207",
	"300", "301", "302", "303",
	"340", "341",
	"400", "401",
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	count := flag.Int("count", 500, "number of SFAF records to seed")
	flag.Parse()

	_ = godotenv.Load()

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", ""),
		getEnv("DB_NAME", "sfaf_plotter"),
		getEnv("DB_SSLMODE", "disable"),
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("connect: %v", err)
	}

	// ── Load globally required fields ─────────────────────────────────────
	reqRows, err := db.Query(
		`SELECT field_number FROM sfaf_required_fields WHERE scope_type = 'global' ORDER BY field_number`)
	if err != nil {
		log.Fatalf("query required fields: %v", err)
	}
	fieldSet := make(map[string]bool)
	orderedFields := append([]string{}, baseFields...)
	for _, f := range baseFields {
		fieldSet[f] = true
	}
	for reqRows.Next() {
		var fn string
		reqRows.Scan(&fn)
		if !fieldSet[fn] {
			fieldSet[fn] = true
			orderedFields = append(orderedFields, fn)
		}
	}
	reqRows.Close()

	now := time.Now()
	past := now.AddDate(-3, 0, 0)
	future := now.AddDate(5, 0, 0)

	log.Printf("✓ Connected — seeding %d SFAF records (%d fields per row)", *count, len(orderedFields))

	inserted := 0
	for i := 0; i < *count; i++ {
		prefix := pick(serialPrefixes)
		ser := sfafSerial(prefix, 100000+i)
		coord := coords()

		lat, lng, err := parseCoords(coord)
		if err != nil {
			log.Printf("row %d: bad coords %q: %v — skipping", i, coord, err)
			continue
		}

		freq := freqMHz()
		gens := buildGenerators(ser, coord, now, past, future)

		// Warn once per run about required fields with no generator
		if i == 0 {
			for fn := range fieldSet {
				if _, ok := gens[fn]; !ok {
					log.Printf("  WARNING: field %s marked required but has no generator — will be NULL", fn)
				}
			}
		}

		tx, err := db.Begin()
		if err != nil {
			log.Printf("row %d: begin tx: %v", i, err)
			continue
		}

		// Create marker from field303
		markerID := uuid.New()
		_, err = tx.Exec(`
			INSERT INTO markers (id, serial, latitude, longitude, frequency, marker_type, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'sfaf', NOW(), NOW())`,
			markerID, ser, lat, lng, freq)
		if err != nil {
			tx.Rollback()
			log.Printf("row %d: insert marker: %v", i, err)
			continue
		}

		// Build dynamic SFAF INSERT
		cols := []string{"id", "marker_id"}
		placeholders := []string{"$1", "$2"}
		args := []interface{}{uuid.New(), markerID}
		argN := 3

		for _, fn := range orderedFields {
			gen, ok := gens[fn]
			if !ok {
				continue
			}
			cols = append(cols, "field"+fn)
			placeholders = append(placeholders, fmt.Sprintf("$%d", argN))
			args = append(args, gen())
			argN++
		}

		cols = append(cols, "sfaf_record_type", "created_at", "updated_at")
		recordType := pick([]string{"A", "P", "S", "T"})
		placeholders = append(placeholders,
			fmt.Sprintf("$%d", argN),
			fmt.Sprintf("$%d", argN+1),
			fmt.Sprintf("$%d", argN+2))
		args = append(args, recordType, now, now)

		query := fmt.Sprintf("INSERT INTO sfafs (%s) VALUES (%s)",
			strings.Join(cols, ", "),
			strings.Join(placeholders, ", "))

		if _, err := tx.Exec(query, args...); err != nil {
			tx.Rollback()
			log.Printf("row %d: insert sfaf: %v", i, err)
			continue
		}

		if err := tx.Commit(); err != nil {
			log.Printf("row %d: commit: %v", i, err)
			continue
		}

		inserted++
		if inserted%100 == 0 {
			log.Printf("  %d / %d inserted", inserted, *count)
		}
	}

	log.Printf("✓ Done — inserted %d SFAF records with auto-generated markers", inserted)
}
