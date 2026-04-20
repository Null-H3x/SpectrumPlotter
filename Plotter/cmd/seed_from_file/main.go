// cmd/seed_from_file/main.go
// Parses a Pub7 SFAF text file and inserts records into the sfafs table.
//
// Rules:
//   - Skips records whose field102 serial already exists in the DB.
//   - Occurrence 1 of each field goes into the sfafs column (field<NNN>).
//   - Occurrences 2+ go into sfaf_field_occurrences.
//   - Repeated field numbers without /NN suffix (e.g. multiple 502 lines)
//     are treated as continuation and joined with a space.
//   - field303 coordinates are parsed to create a linked marker.
//
// Usage:
//
//	go run ./cmd/seed_from_file [--file example.txt]
package main

import (
	"bufio"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// ── SFAF text parser ──────────────────────────────────────────────────────────

var lineRe = regexp.MustCompile(`^(\d{3})(?:/(\d+))?\.[ \t]+(.+)$`)

// sfafRecord holds all parsed values for one SFAF record.
// Primary key: field102 (serial number).
// occurrences[fieldNum] is a 1-based slice; index 0 = occurrence 1.
type sfafRecord struct {
	occurrences map[string][]string // fieldNum → []value (index 0 = occ 1)
}

func (r *sfafRecord) primary(field string) string {
	vals := r.occurrences[field]
	if len(vals) == 0 {
		return ""
	}
	return vals[0]
}

// parseFile splits the file into records separated by blank lines.
func parseFile(path string) ([]sfafRecord, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var records []sfafRecord
	cur := &sfafRecord{occurrences: make(map[string][]string)}
	hasData := false

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")

		if strings.TrimSpace(line) == "" {
			if hasData {
				records = append(records, *cur)
				cur = &sfafRecord{occurrences: make(map[string][]string)}
				hasData = false
			}
			continue
		}

		m := lineRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}

		fieldNum := m[1]
		occStr := m[2]
		value := strings.TrimSpace(m[3])
		hasData = true

		existing := cur.occurrences[fieldNum]

		if occStr == "" {
			// No explicit occurrence number.
			if len(existing) == 0 {
				// First time seeing this field.
				cur.occurrences[fieldNum] = []string{value}
			} else {
				// Continuation line — append to occurrence 1 with a space.
				existing[0] = existing[0] + " " + value
				cur.occurrences[fieldNum] = existing
			}
		} else {
			occ, _ := strconv.Atoi(occStr)
			if occ < 1 {
				occ = 1
			}
			// Grow slice to fit.
			for len(existing) < occ {
				existing = append(existing, "")
			}
			existing[occ-1] = value
			cur.occurrences[fieldNum] = existing
		}
	}
	if hasData {
		records = append(records, *cur)
	}
	return records, scanner.Err()
}

// ── Type maps ─────────────────────────────────────────────────────────────────

// dateFields are stored as DATE in the sfafs table. Value format: YYYYMMDD.
var dateFields = map[string]bool{
	"140": true, "141": true, "142": true, "143": true,
	"805": true, "904": true, "911": true, "927": true, "928": true,
}

// intFields are stored as INTEGER.
var intFields = map[string]bool{
	"316": true, "317": true, "319": true,
	"356": true, "361": true,
	"416": true, "417": true, "419": true,
	"461": true,
	"470": true, "471": true, "472": true,
	"957": true, "964": true, "965": true,
}

// numericFields are stored as NUMERIC.
var numericFields = map[string]bool{
	"315": true, "321": true,
	"357": true, "358": true, "359": true, "360": true, "364": true, "365": true,
	"415": true,
	"457": true, "458": true, "459": true, "460": true,
	"926": true,
}

// sfafsColumns is the set of field numbers that have a dedicated column in sfafs.
// Derived from \d sfafs — only these are written to the sfafs row.
var sfafsColumns = map[string]bool{
	"005": true, "006": true, "007": true, "010": true,
	"013": true, "014": true, "015": true, "016": true, "017": true, "018": true, "019": true, "020": true,
	"102": true, "103": true, "105": true, "106": true, "107": true, "108": true,
	"110": true, "111": true, "112": true, "113": true, "114": true, "115": true,
	"116": true, "117": true, "118": true,
	"130": true, "131": true,
	"140": true, "141": true, "142": true, "143": true, "144": true,
	"145": true, "146": true, "147": true, "151": true, "152": true,
	"200": true, "201": true, "202": true, "203": true, "204": true,
	"205": true, "206": true, "207": true, "208": true, "209": true,
	"300": true, "301": true, "302": true, "303": true, "304": true, "306": true,
	"315": true, "316": true, "317": true, "318": true, "319": true, "321": true,
	"340": true, "341": true, "342": true, "343": true, "344": true, "345": true,
	"346": true, "347": true, "348": true, "349": true,
	"354": true, "355": true, "356": true, "357": true, "358": true, "359": true,
	"360": true, "361": true, "362": true, "363": true, "364": true, "365": true, "373": true, "374": true,
	"400": true, "401": true, "403": true, "406": true, "407": true, "408": true,
	"415": true, "416": true, "417": true, "418": true, "419": true,
	"440": true, "442": true, "443": true, "453": true, "454": true, "455": true,
	"456": true, "457": true, "458": true, "459": true, "460": true, "461": true,
	"462": true, "463": true, "470": true, "471": true, "472": true, "473": true,
	"500": true, "501": true, "502": true, "503": true, "504": true, "506": true,
	"511": true, "512": true, "513": true, "520": true, "521": true, "530": true, "531": true,
	"701": true, "702": true, "704": true, "707": true, "710": true, "711": true, "716": true,
	"801": true, "803": true, "804": true, "805": true, "806": true,
	"901": true, "903": true, "904": true, "905": true, "906": true, "907": true, "910": true,
	"911": true, "924": true, "926": true, "927": true, "928": true,
	"952": true, "953": true, "956": true, "957": true, "958": true, "959": true,
	"963": true, "964": true, "965": true,
	"982": true, "983": true, "984": true, "985": true, "986": true, "987": true, "988": true,
	"989": true, "990": true, "991": true, "992": true, "993": true, "994": true, "995": true,
	"996": true, "997": true, "998": true, "999": true,
}

// ── Coordinate parser ─────────────────────────────────────────────────────────

func parseCoords(s string) (lat, lng float64, err error) {
	if len(s) != 15 {
		return 0, 0, fmt.Errorf("invalid coord length %d", len(s))
	}
	p := func(sub string) (float64, error) { return strconv.ParseFloat(sub, 64) }
	latD, e1 := p(s[0:2])
	latM, e2 := p(s[2:4])
	latS, e3 := p(s[4:6])
	lngD, e4 := p(s[7:10])
	lngM, e5 := p(s[10:12])
	lngS, e6 := p(s[12:14])
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

// ── DB helpers ────────────────────────────────────────────────────────────────

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func toDBValue(fieldNum, raw string) (interface{}, error) {
	if raw == "" {
		return nil, nil
	}
	if dateFields[fieldNum] {
		t, err := time.Parse("20060102", raw)
		if err != nil {
			return nil, fmt.Errorf("field %s: bad date %q: %v", fieldNum, raw, err)
		}
		return t, nil
	}
	if intFields[fieldNum] {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("field %s: bad int %q: %v", fieldNum, raw, err)
		}
		return n, nil
	}
	if numericFields[fieldNum] {
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, fmt.Errorf("field %s: bad numeric %q: %v", fieldNum, raw, err)
		}
		return f, nil
	}
	return raw, nil
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	filePath := flag.String("file", "example.txt", "path to SFAF text file")
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

	records, err := parseFile(*filePath)
	if err != nil {
		log.Fatalf("parse file: %v", err)
	}
	log.Printf("Parsed %d records from %s", len(records), *filePath)

	inserted, skipped, failed := 0, 0, 0

	for i, rec := range records {
		serial := rec.primary("102")
		if serial == "" {
			log.Printf("record %d: no field102 — skipping", i+1)
			skipped++
			continue
		}

		// Check if already exists.
		var exists bool
		err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM sfafs WHERE field102 = $1)`, serial).Scan(&exists)
		if err != nil {
			log.Printf("record %d (%s): existence check failed: %v", i+1, serial, err)
			failed++
			continue
		}
		if exists {
			skipped++
			continue
		}

		tx, err := db.Begin()
		if err != nil {
			log.Printf("record %d (%s): begin tx: %v", i+1, serial, err)
			failed++
			continue
		}

		// Create marker from field303 if available.
		var markerID *uuid.UUID
		if coord := rec.primary("303"); coord != "" {
			lat, lng, err := parseCoords(coord)
			if err != nil {
				log.Printf("record %d (%s): bad coord %q: %v", i+1, serial, coord, err)
			} else {
				mid := uuid.New()
				markerID = &mid
				freq := rec.primary("110")
				_, err = tx.Exec(`
					INSERT INTO markers (id, serial, latitude, longitude, frequency, marker_type, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, 'sfaf', NOW(), NOW())`,
					mid, serial, lat, lng, freq)
				if err != nil {
					tx.Rollback()
					log.Printf("record %d (%s): insert marker: %v", i+1, serial, err)
					failed++
					continue
				}
			}
		}

		// Build sfafs INSERT from occurrence-1 values of all column fields.
		cols := []string{"id"}
		placeholders := []string{"$1"}
		args := []interface{}{uuid.New()}
		argN := 2

		if markerID != nil {
			cols = append(cols, "marker_id")
			placeholders = append(placeholders, fmt.Sprintf("$%d", argN))
			args = append(args, *markerID)
			argN++
		}

		for fieldNum, vals := range rec.occurrences {
			if !sfafsColumns[fieldNum] || len(vals) == 0 || vals[0] == "" {
				continue
			}
			v, err := toDBValue(fieldNum, vals[0])
			if err != nil {
				log.Printf("record %d (%s): %v — skipping field", i+1, serial, err)
				continue
			}
			cols = append(cols, "field"+fieldNum)
			placeholders = append(placeholders, fmt.Sprintf("$%d", argN))
			args = append(args, v)
			argN++
		}

		cols = append(cols, "created_at", "updated_at")
		placeholders = append(placeholders, fmt.Sprintf("$%d", argN), fmt.Sprintf("$%d", argN+1))
		args = append(args, time.Now(), time.Now())

		query := fmt.Sprintf("INSERT INTO sfafs (%s) VALUES (%s)",
			strings.Join(cols, ", "),
			strings.Join(placeholders, ", "))

		var sfafID uuid.UUID
		queryReturning := query + " RETURNING id"
		err = tx.QueryRow(queryReturning, args...).Scan(&sfafID)
		if err != nil {
			tx.Rollback()
			log.Printf("record %d (%s): insert sfaf: %v", i+1, serial, err)
			failed++
			continue
		}

		// Insert occurrences 2+ into sfaf_field_occurrences.
		occErr := false
		for fieldNum, vals := range rec.occurrences {
			for occ := 2; occ <= len(vals); occ++ {
				if vals[occ-1] == "" {
					continue
				}
				_, err := tx.Exec(`
					INSERT INTO sfaf_field_occurrences (sfaf_id, field_number, occurrence, value)
					VALUES ($1, $2, $3, $4)
					ON CONFLICT (sfaf_id, field_number, occurrence) DO NOTHING`,
					sfafID, fieldNum, occ, vals[occ-1])
				if err != nil {
					log.Printf("record %d (%s): insert occurrence %s/%d: %v", i+1, serial, fieldNum, occ, err)
					occErr = true
					break
				}
			}
			if occErr {
				break
			}
		}
		if occErr {
			tx.Rollback()
			failed++
			continue
		}

		if err := tx.Commit(); err != nil {
			log.Printf("record %d (%s): commit: %v", i+1, serial, err)
			failed++
			continue
		}

		inserted++
		if inserted%100 == 0 {
			log.Printf("  %d inserted so far...", inserted)
		}
	}

	log.Printf("Done — inserted: %d, skipped: %d, failed: %d", inserted, skipped, failed)
}
