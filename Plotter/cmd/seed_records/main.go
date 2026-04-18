// cmd/seed_records/main.go
// Seeds the database with ~10 000 frequency requests and ~2 500 assignments.
// Pulls existing users, units, and workboxes from the DB so foreign keys are valid.
// Safe to re-run — each invocation appends new rows; it does not truncate first.
//
// Usage:
//
//	go run ./cmd/seed_records [--requests N] [--assignments N]
//
// Defaults: 10 000 requests, 2 500 assignments.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// ── Reference data pools ──────────────────────────────────────────────────────

var purposes = []string{
	"Ground-to-air voice coordination",
	"UHF SATCOM uplink",
	"Tactical data link",
	"Air traffic control",
	"Combat search and rescue",
	"Close air support coordination",
	"Intelligence, surveillance, and reconnaissance",
	"Electronic warfare support",
	"Base operations support",
	"Emergency command and control",
	"Interoperability with coalition forces",
	"Logistics coordination",
	"Training exercise support",
	"Special operations communications",
	"Air refueling coordination",
	"Airborne early warning",
	"Precision approach radar",
	"Ground combat element comms",
	"Maritime coordination",
	"Joint terminal attack controller support",
}

var requestTypes = []string{"new_assignment", "modification", "renewal", "cancellation"}
var requestTypeWeights = []int{60, 20, 15, 5} // %

var priorities = []string{"routine", "priority", "urgent", "emergency"}
var priorityWeights = []int{70, 20, 8, 2}

var statuses = []string{"pending", "under_review", "approved", "denied"}
var statusWeights = []int{25, 15, 50, 10}

var emissionDesignators = []string{
	"16K0F3E", "6K00A3E", "200HF3E", "8K10F3E",
	"40M0D1D", "1M20D7W", "2M16G7W", "5M00D7D",
	"200KF3E", "100KA3E",
}

var antennaMakeModels = []string{
	"Harris WBHF AN/PRC-117G",
	"Motorola XTS 5000",
	"Kenwood TK-5710",
	"L3Harris RF-7800S-MP",
	"Thales AN/PRC-148",
	"Barrett 2050",
	"Icom IC-F9021",
	"Raytheon MIDS-LVT",
	"Rockwell Collins ARC-210",
	"Northrop Grumman LMR-9000",
}

var antennaTypes = []string{
	"Omnidirectional", "Directional", "Yagi", "Log-periodic",
	"Parabolic dish", "Dipole", "Whip", "JTIDS blade",
}

var assignmentTypes = []string{"primary", "alternate", "emergency", "tactical"}
var assignmentTypeWeights = []int{55, 25, 10, 10}

var netNames = []string{
	"BLACKBIRD NET", "EAGLE NET", "FALCON NET", "HAWK NET",
	"OSPREY NET", "RAPTOR NET", "VIPER NET", "WARHAWK NET",
	"THUNDER NET", "LIGHTNING NET", "STORM NET", "ANVIL NET",
	"IRON FIST NET", "STEEL RAIN NET", "TALON NET", "SABRE NET",
	"DAGGER NET", "LANCE NET", "ARROW NET", "SHIELD NET",
}

var callsigns = []string{
	"HALO", "BANDIT", "WOLF", "EAGLE", "COBRA", "VIPER", "SHARK",
	"GHOST", "PANTHER", "DRAGON", "RAVEN", "HAWK", "FALCON", "BEAR",
	"TITAN", "BLADE", "ARROW", "LANCE", "SABRE", "LANCE",
}

// Frequency bands (MHz) with relative weights
type freqBand struct {
	min, max float64
	label    string
	weight   int
}

var freqBands = []freqBand{
	{2, 30, "HF", 10},
	{30, 88, "VHF-low", 15},
	{108, 174, "VHF-high", 20},
	{225, 400, "UHF-mil", 30},
	{400, 512, "UHF-high", 10},
	{764, 869, "L-band", 5},
	{1350, 1390, "L-band-2", 5},
	{2900, 3100, "S-band", 5},
}

var sfafRecordTypes = []string{"P", "S", "T", "A"}
var sfafRecordTypeWeights = []int{35, 35, 20, 10}

// ── Helpers ───────────────────────────────────────────────────────────────────

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func weightedPick(items []string, weights []int, r *rand.Rand) string {
	total := 0
	for _, w := range weights {
		total += w
	}
	n := r.Intn(total)
	cum := 0
	for i, w := range weights {
		cum += w
		if n < cum {
			return items[i]
		}
	}
	return items[len(items)-1]
}

func randomFreq(r *rand.Rand) (float64, string) {
	// pick band weighted
	total := 0
	for _, b := range freqBands {
		total += b.weight
	}
	n := r.Intn(total)
	cum := 0
	var band freqBand
	for _, b := range freqBands {
		cum += b.weight
		if n < cum {
			band = b
			break
		}
	}
	// random freq within band, rounded to 5 kHz
	span := band.max - band.min
	raw := band.min + r.Float64()*span
	rounded := float64(int(raw*200)) / 200.0 // nearest 5 kHz
	return rounded, fmt.Sprintf("%.4f", rounded)
}

func randDate(r *rand.Rand, base time.Time, minDays, maxDays int) time.Time {
	days := minDays + r.Intn(maxDays-minDays)
	return base.AddDate(0, 0, days)
}

func pick(items []string, r *rand.Rand) string {
	return items[r.Intn(len(items))]
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	nRequests := flag.Int("requests", 10000, "Number of frequency requests to create")
	nAssignments := flag.Int("assignments", 2500, "Number of frequency assignments to create")
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
		log.Fatalf("ping db: %v", err)
	}
	log.Println("Connected to database")

	// ── Load reference rows ───────────────────────────────────────────────────

	userIDs := loadUUIDs(db, `SELECT id FROM users WHERE is_active = true`)
	if len(userIDs) == 0 {
		log.Fatal("No active users found — run seed_test_isms first")
	}
	log.Printf("Loaded %d users", len(userIDs))

	unitIDs := loadUUIDs(db, `SELECT id FROM units WHERE is_active = true`)
	if len(unitIDs) == 0 {
		log.Fatal("No active units found")
	}
	log.Printf("Loaded %d units", len(unitIDs))

	workboxNames := loadStrings(db, `SELECT name FROM workboxes WHERE is_active = true`)
	if len(workboxNames) == 0 {
		log.Println("Warning: no workboxes found — routed_to_workbox will be NULL")
	}
	log.Printf("Loaded %d workboxes", len(workboxNames))

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	now := time.Now()

	// ── Seed frequency_requests ───────────────────────────────────────────────

	log.Printf("Inserting %d frequency requests…", *nRequests)
	inserted := 0
	batchSize := 500

	for start := 0; start < *nRequests; start += batchSize {
		end := start + batchSize
		if end > *nRequests {
			end = *nRequests
		}
		n := end - start

		placeholders := make([]string, 0, n)
		args := make([]interface{}, 0, n*22)
		col := 1

		for i := 0; i < n; i++ {
			freqMHz, freqStr := randomFreq(r)
			rangeMax := freqMHz + float64(r.Intn(50)+1)*0.025
			reqType := weightedPick(requestTypes, requestTypeWeights, r)
			status := weightedPick(statuses, statusWeights, r)
			priority := weightedPick(priorities, priorityWeights, r)
			unitID := unitIDs[r.Intn(len(unitIDs))]
			requestedBy := userIDs[r.Intn(len(userIDs))]
			startDate := randDate(r, now, -730, 30)
			endDate := randDate(r, startDate, 30, 730)
			purpose := pick(purposes, r)
			justification := fmt.Sprintf("%s — %s mission support requirement", pick(netNames, r), pick(callsigns, r))
			emission := pick(emissionDesignators, r)
			powerW := (r.Intn(20) + 1) * 5 // 5–100 W
			antModel := pick(antennaMakeModels, r)
			antType := pick(antennaTypes, r)
			netName := pick(netNames, r)
			callsign := fmt.Sprintf("%s %02d", pick(callsigns, r), r.Intn(99)+1)
			isEncrypted := r.Intn(3) == 0

			var routedTo interface{}
			if len(workboxNames) > 0 && status != "pending" && r.Intn(3) != 0 {
				routedTo = workboxNames[r.Intn(len(workboxNames))]
			}

			ph := make([]string, 22)
			for j := range ph {
				ph[j] = fmt.Sprintf("$%d", col)
				col++
			}
			placeholders = append(placeholders, "("+strings.Join(ph, ",")+")")

			args = append(args,
				uuid.New(),        // id
				unitID,            // unit_id
				requestedBy,       // requested_by
				reqType,           // request_type
				status,            // status
				priority,          // priority
				freqStr,           // requested_frequency
				freqMHz,           // frequency_range_min
				rangeMax,          // frequency_range_max
				purpose,           // purpose
				justification,     // justification
				emission,          // emission_designator
				powerW,            // power_watts
				antModel,          // antenna_make_model
				antType,           // antenna_type
				netName,           // net_name
				callsign,          // callsign
				isEncrypted,       // is_encrypted
				startDate,         // start_date
				endDate,           // end_date
				routedTo,          // routed_to_workbox
				now,               // created_at / updated_at (same column used twice via RETURNING — use created_at)
			)
		}

		query := `INSERT INTO frequency_requests
			(id, unit_id, requested_by, request_type, status, priority,
			 requested_frequency, frequency_range_min, frequency_range_max,
			 purpose, justification, emission_designator, power_watts,
			 antenna_make_model, antenna_type, net_name, callsign, is_encrypted,
			 start_date, end_date, routed_to_workbox, created_at)
			VALUES ` + strings.Join(placeholders, ",")

		if _, err := db.Exec(query, args...); err != nil {
			log.Fatalf("insert requests batch starting at %d: %v", start, err)
		}
		inserted += n
		log.Printf("  requests: %d / %d", inserted, *nRequests)
	}
	log.Printf("Inserted %d frequency requests", inserted)

	// ── Seed frequency_assignments ────────────────────────────────────────────

	log.Printf("Inserting %d frequency assignments…", *nAssignments)
	inserted = 0

	for start := 0; start < *nAssignments; start += batchSize {
		end := start + batchSize
		if end > *nAssignments {
			end = *nAssignments
		}
		n := end - start

		placeholders := make([]string, 0, n)
		args := make([]interface{}, 0, n*20)
		col := 1

		for i := 0; i < n; i++ {
			freqMHz, freqStr := randomFreq(r)
			recType := weightedPick(sfafRecordTypes, sfafRecordTypeWeights, r)
			asnType := weightedPick(assignmentTypes, assignmentTypeWeights, r)
			priority := weightedPick(priorities, priorityWeights, r)
			unitID := unitIDs[r.Intn(len(unitIDs))]
			createdBy := userIDs[r.Intn(len(userIDs))]
			assignDate := randDate(r, now, -1095, 0)
			expDate := randDate(r, assignDate, 365, 1825)
			emission := pick(emissionDesignators, r)
			powerW := (r.Intn(20) + 1) * 5
			netName := pick(netNames, r)
			callsign := fmt.Sprintf("%s %02d", pick(callsigns, r), r.Intn(99)+1)
			isEncrypted := r.Intn(4) == 0
			isActive := r.Intn(10) != 0 // 90% active

			serial := fmt.Sprintf("AF-%06d", r.Intn(999999)+1)

			var routedTo interface{}
			if len(workboxNames) > 0 && r.Intn(2) == 0 {
				routedTo = workboxNames[r.Intn(len(workboxNames))]
			}

			ph := make([]string, 20)
			for j := range ph {
				ph[j] = fmt.Sprintf("$%d", col)
				col++
			}
			placeholders = append(placeholders, "("+strings.Join(ph, ",")+")")

			args = append(args,
				uuid.New(),    // id
				unitID,        // unit_id
				serial,        // serial
				recType,       // sfaf_record_type
				freqStr,       // frequency
				freqMHz,       // frequency_mhz
				asnType,       // assignment_type
				priority,      // priority
				emission,      // emission_designator
				powerW,        // power_watts
				netName,       // net_name
				callsign,      // callsign
				isEncrypted,   // is_encrypted
				isActive,      // is_active
				createdBy,     // created_by
				assignDate,    // assignment_date
				expDate,       // expiration_date
				routedTo,      // routed_to_workbox
				now,           // created_at
				now,           // updated_at
			)
		}

		query := `INSERT INTO frequency_assignments
			(id, unit_id, serial, sfaf_record_type, frequency, frequency_mhz,
			 assignment_type, priority, emission_designator, power_watts,
			 net_name, callsign, is_encrypted, is_active, created_by,
			 assignment_date, expiration_date, routed_to_workbox, created_at, updated_at)
			VALUES ` + strings.Join(placeholders, ",")

		if _, err := db.Exec(query, args...); err != nil {
			log.Fatalf("insert assignments batch starting at %d: %v", start, err)
		}
		inserted += n
		log.Printf("  assignments: %d / %d", inserted, *nAssignments)
	}
	log.Printf("Inserted %d frequency assignments", inserted)

	log.Println("Done.")
}

// ── DB helpers ────────────────────────────────────────────────────────────────

func loadUUIDs(db *sql.DB, query string) []uuid.UUID {
	rows, err := db.Query(query)
	if err != nil {
		log.Fatalf("query %q: %v", query, err)
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			log.Fatalf("scan uuid: %v", err)
		}
		ids = append(ids, id)
	}
	return ids
}

func loadStrings(db *sql.DB, query string) []string {
	rows, err := db.Query(query)
	if err != nil {
		log.Fatalf("query %q: %v", query, err)
	}
	defer rows.Close()
	var vals []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			log.Fatalf("scan string: %v", err)
		}
		vals = append(vals, s)
	}
	return vals
}
