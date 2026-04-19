// cmd/seed_sfafs/main.go
// Seeds the database with realistic SFAF records.
// Pulls existing markers from the DB for foreign key linkage (optional).
// Safe to re-run — appends rows, does not truncate.
//
// Usage:
//
//	go run ./cmd/seed_sfafs [--count N]
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
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// ── Reference pools ───────────────────────────────────────────────────────────

var agencies = []string{"AF", "ARMY", "NAVY", "USMC", "USCG", "DHS", "DOE"}

var unifiedCommands = []string{"USCENTCOM", "USEUCOM", "USINDOPACOM", "USNORTHCOM", "USSOUTHCOM", "USSOCOM", "USTRANSCOM"}

var states = []string{"AL", "AK", "AZ", "CA", "CO", "FL", "GA", "HI", "IL", "KY", "MD", "NC", "NM", "NV", "OK", "SC", "TX", "VA", "WA"}

var locations = []string{
	"Eglin AFB", "Hurlburt Field", "MacDill AFB", "Patrick SFB", "Tyndall AFB",
	"Fort Bragg", "Fort Campbell", "Fort Hood", "Fort Lewis", "Fort Benning",
	"Camp Pendleton", "Twenty-nine Palms", "Quantico", "Cherry Point",
	"Naval Station Norfolk", "NAS Pensacola", "NAS Whidbey Island",
	"Peterson SFB", "Schriever SFB", "Buckley SFB",
	"Joint Base Lewis-McChord", "Joint Base San Antonio", "Joint Base Andrews",
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

var purposeCodes = []string{"P", "S", "E", "T", "R"}
var statusCodes = []string{"A", "P", "C", "R"}
var recordTypes = []string{"N", "M", "R"}

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
	powers := []string{"1", "2", "5", "10", "20", "50", "100", "200", "500"}
	return pick(powers)
}

func serial(n int) string { return fmt.Sprintf("A%07d", n) }

func coords() string {
	lat := 25.0 + rand.Float64()*24.0
	lng := -125.0 + rand.Float64()*58.0
	latDir := "N"
	lngDir := "W"
	if lng > 0 {
		lngDir = "E"
	}
	return fmt.Sprintf("%07.4f%s%08.4f%s", lat, latDir, -lng, lngDir)
}

func randomDate(from, to time.Time) time.Time {
	delta := to.Unix() - from.Unix()
	return time.Unix(from.Unix()+rand.Int63n(delta), 0)
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	count := flag.Int("count", 500, "number of SFAF records to create")
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
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("failed to connect: %v", err)
	}
	log.Printf("✓ Connected — seeding %d SFAF records", *count)

	// Fetch existing marker IDs for optional linkage
	rows, _ := db.Query(`SELECT id FROM markers ORDER BY random() LIMIT 2000`)
	var markerIDs []string
	if rows != nil {
		for rows.Next() {
			var id string
			rows.Scan(&id)
			markerIDs = append(markerIDs, id)
		}
		rows.Close()
	}

	now := time.Now()
	past := now.AddDate(-3, 0, 0)
	future := now.AddDate(5, 0, 0)

	inserted := 0
	for i := 0; i < *count; i++ {
		id := uuid.New()
		ser := serial(100000 + i)

		startDate := randomDate(past, now)
		expDate := randomDate(now, future)

		var markerID *string
		if len(markerIDs) > 0 && rand.Intn(3) != 0 {
			m := markerIDs[rand.Intn(len(markerIDs))]
			markerID = &m
		}

		_, err := db.Exec(`
			INSERT INTO sfafs (
				id, marker_id,
				field102, field103, field110, field114, field115,
				field200, field201, field207,
				field300, field301, field303,
				field340, field341,
				field400, field401,
				field007, field010,
				field140, field143,
				created_at, updated_at
			) VALUES (
				$1,  $2,
				$3,  $4,  $5,  $6,  $7,
				$8,  $9,  $10,
				$11, $12, $13,
				$14, $15,
				$16, $17,
				$18, $19,
				$20, $21,
				NOW(), NOW()
			)`,
			id, markerID,
			ser,                       // field102 - serial
			expDate.Format("20060102"), // field103 - expiration
			freqMHz(),                 // field110 - frequency
			pick(emissionDesignators), // field114 - emission designator
			erpWatts(),                // field115 - ERP watts
			pick(agencies),            // field200 - agency
			pick(unifiedCommands),     // field201 - unified command
			pick(locations),           // field207 - station
			pick(states),              // field300 - state
			pick(locations),           // field301 - antenna location
			coords(),                  // field303 - coordinates
			pick(equipmentMakes),      // field340 - equipment make
			pick(equipmentModels),     // field341 - equipment model
			pick(states),              // field400 - receiver state
			pick(locations),           // field401 - receiver location name
			pick(recordTypes),         // field007 - record type
			pick(statusCodes),         // field010 - status
			startDate,                 // field140 - start date
			expDate,                   // field143 - expiration date
		)
		if err != nil {
			log.Printf("row %d failed: %v", i, err)
			continue
		}
		inserted++
		if inserted%100 == 0 {
			log.Printf("  %d / %d inserted", inserted, *count)
		}
	}

	log.Printf("✓ Done — inserted %d SFAF records", inserted)
}
