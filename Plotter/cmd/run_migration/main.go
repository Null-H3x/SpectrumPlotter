// cmd/run_migration/main.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}

	if len(os.Args) < 2 {
		log.Fatal("Usage: run_migration [--mark-applied] <file.sql> [file2.sql ...]")
	}

	markOnly := os.Args[1] == "--mark-applied"
	files := os.Args[1:]
	if markOnly {
		files = os.Args[2:]
		if len(files) == 0 {
			log.Fatal("Usage: run_migration --mark-applied <file.sql> [file2.sql ...]")
		}
	}

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
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Printf("✓ Connected to %s@%s/%s",
		getEnv("DB_USER", "postgres"),
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_NAME", "sfaf_plotter"),
	)

	for _, f := range files {
		if markOnly {
			if err := markApplied(db, f); err != nil {
				log.Fatalf("✗ %s: %v", filepath.Base(f), err)
			}
		} else {
			if err := applyMigration(db, f); err != nil {
				log.Fatalf("✗ %s: %v", filepath.Base(f), err)
			}
		}
	}
}

func applyMigration(db *sql.DB, migrationFile string) error {
	version := filepath.Base(migrationFile)

	var exists bool
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists); err != nil {
		return fmt.Errorf("checking schema_migrations: %w", err)
	}
	if exists {
		log.Printf("⏭  Already applied: %s", version)
		return nil
	}

	sqlBytes, err := os.ReadFile(migrationFile)
	if err != nil {
		return fmt.Errorf("reading file: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("starting transaction: %w", err)
	}

	if _, err := tx.Exec(string(sqlBytes)); err != nil {
		tx.Rollback()
		return fmt.Errorf("executing SQL: %w", err)
	}

	if _, err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
		tx.Rollback()
		return fmt.Errorf("recording migration: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing: %w", err)
	}

	log.Printf("✓ Applied: %s", version)
	return nil
}

func markApplied(db *sql.DB, migrationFile string) error {
	version := filepath.Base(migrationFile)
	_, err := db.Exec(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, version)
	if err != nil {
		return fmt.Errorf("recording migration: %w", err)
	}
	log.Printf("✓ Marked applied: %s", version)
	return nil
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
