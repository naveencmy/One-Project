package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	Pool *pgxpool.Pool
	once sync.Once
)

func GetDatabaseURL() string {
	if url := strings.TrimSpace(os.Getenv("DATABASE_URL")); url != "" {
		return url
	}

	for _, envPath := range []string{".env", "../.env"} {
		if data, err := os.ReadFile(envPath); err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "DATABASE_URL=") {
					val := strings.TrimSpace(strings.TrimPrefix(line, "DATABASE_URL="))
					if val != "" {
						return val
					}
				}
			}
		}
	}

	return "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
}

func parsePoolConfig(connStr string) (*pgxpool.Config, error) {
	config, err := pgxpool.ParseConfig(connStr)
	if err == nil {
		return config, nil
	}

	cleaned := connStr
	if strings.HasPrefix(cleaned, "postgresql://") {
		cleaned = strings.TrimPrefix(cleaned, "postgresql://")
	} else if strings.HasPrefix(cleaned, "postgres://") {
		cleaned = strings.TrimPrefix(cleaned, "postgres://")
	}

	if idx := strings.Index(cleaned, "@"); idx != -1 {
		userInfo := cleaned[:idx]
		hostDbInfo := cleaned[idx+1:]

		var user, password string
		if uIdx := strings.Index(userInfo, ":"); uIdx != -1 {
			user = userInfo[:uIdx]
			password = userInfo[uIdx+1:]
		} else {
			user = userInfo
		}

		var hostPort, dbname string
		if dIdx := strings.Index(hostDbInfo, "/"); dIdx != -1 {
			hostPort = hostDbInfo[:dIdx]
			dbname = hostDbInfo[dIdx+1:]
		} else {
			hostPort = hostDbInfo
		}

		if qIdx := strings.Index(dbname, "?"); qIdx != -1 {
			dbname = dbname[:qIdx]
		}

		var host, port string
		if pIdx := strings.LastIndex(hostPort, ":"); pIdx != -1 {
			host = hostPort[:pIdx]
			port = hostPort[pIdx+1:]
		} else {
			host = hostPort
			port = "5432"
		}

		kvStr := fmt.Sprintf("host=%s port=%s user=%s password='%s' dbname=%s", host, port, user, password, dbname)
		return pgxpool.ParseConfig(kvStr)
	}

	return nil, err
}

func InitDB() (*pgxpool.Pool, error) {
	var initErr error
	once.Do(func() {
		connStr := GetDatabaseURL()
		config, err := parsePoolConfig(connStr)
		if err != nil {
			initErr = fmt.Errorf("unable to parse database url: %w", err)
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		pool, err := pgxpool.NewWithConfig(ctx, config)
		if err != nil {
			initErr = fmt.Errorf("unable to connect to database: %w", err)
			return
		}

		if err := pool.Ping(ctx); err != nil {
			initErr = fmt.Errorf("database ping failed: %w", err)
			return
		}

		Pool = pool

		if err := migrateSchema(ctx, pool); err != nil {
			initErr = fmt.Errorf("failed to migrate database schema: %w", err)
			return
		}

		log.Println("✅ PostgreSQL connection pool initialized and tables verified.")
	})

	return Pool, initErr
}

func Ping(ctx context.Context) error {
	if Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	return Pool.Ping(ctx)
}

func migrateSchema(ctx context.Context, pool *pgxpool.Pool) error {
	schemaSQL := `
	CREATE TABLE IF NOT EXISTS tracking_nodes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title TEXT NOT NULL,
		domain TEXT,
		status TEXT,
		metrics JSONB,
		tags TEXT[],
		created_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS profile_data (
		profile_id TEXT PRIMARY KEY,
		name TEXT,
		email TEXT,
		role TEXT,
		department TEXT,
		accent_color TEXT,
		pin_hash TEXT,
		updated_at TIMESTAMPTZ DEFAULT NOW(),
		avatar TEXT[]
	);

	CREATE TABLE IF NOT EXISTS team_roster (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		member_name TEXT NOT NULL,
		email TEXT,
		role TEXT,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	`

	_, err := pool.Exec(ctx, schemaSQL)
	return err
}

func loadPinFromEnv() string {
	clean := func(s string) string {
		s = strings.TrimSpace(s)
		return strings.ToLower(strings.Trim(s, "\"\r\n\t "))
	}

	if envHash := clean(os.Getenv("PIN_HASH")); envHash != "" && envHash != "true" && envHash != "false" {
		return envHash
	}

	for _, path := range []string{".env", "../.env"} {
		if data, err := os.ReadFile(path); err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "PIN_HASH=") {
					val := clean(strings.TrimPrefix(line, "PIN_HASH="))
					if val != "" && val != "true" && val != "false" {
						return val
					}
				}
			}
		}
	}
	return ""
}
