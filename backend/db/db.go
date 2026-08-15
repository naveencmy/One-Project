package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
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
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
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
		config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
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
		parsed, parseErr := pgxpool.ParseConfig(kvStr)
		if parseErr == nil {
			parsed.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
			return parsed, nil
		}
		return nil, parseErr
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
	if err != nil {
		return err
	}

	teamProfiles := []struct {
		id, name, role, email, dept, accent, pin, avatar string
	}{
		{"PROF-001", "Naveen Kumar ME", "Team Lead", "nks3244587@gmail.com", "GenAI Core", "#5E6AD2", "4ee813262a515c9aace96ef879e65667855c4ec290ca31f5bd49eb69a5e05ae7", "https://avatars.githubusercontent.com/u/189141019?v=4&size=64"},
		{"PROF-002", "Mukesh T", "Principal DBA / MLOps", "mtdev8386@gmail.com", "Backend /Systems", "#10B981", "a5266239ab5a99c8456d926461b67c9953887f857fd3a7d86dc399e5012b9a5d", "https://media.licdn.com/dms/image/v2/D5603AQE4KLkWLfRCVw/profile-displayphoto-scale_400_400/B56ZjwuZI2HMAo-/0/1756385352773?e=1788393600&v=beta&t=DtexI3bPy8_EZTPd8k9Eq6fVAvWV5NDBBxa0EGuQ7JQ"},
		{"PROF-003", "Prithiv Krishna G", "Forward Deployment Engineer", "prithivkrishna1116@gmail.com", "CIC / Deployment", "#3B82F6", "aeb32cfe00d196040e9758c276853282721fbd222038a54e9ae04d6686066e1b", "https://media.licdn.com/dms/image/v2/D5603AQGI7IvLhdydYw/profile-displayphoto-scale_400_400/B56ZzJ1xcxH8Ag-/0/1772912845281?e=1788393600&v=beta&t=5Dv6ZFeIxF8k3NTQ7QlcF3aIyxcc8W9F4dcC9_Lkme0"},
		{"PROF-004", "MOHAMED SUHAIL J", "Business analyst", "mohamedsuhails507@gmail.com", "Gen AI", "#F59E0B", "594686bcfe8a1c52aa5c6ab2feadeac31c7fbc9815ad68487b60d946a12e4765", "https://media.licdn.com/dms/image/v2/D5603AQFzHYv-WMLFNQ/profile-displayphoto-shrink_400_400/B56ZU7f8K7GUAs-/0/1740459984578?e=1788393600&v=beta&t=BX0iwSCbFRUTTQdBnNUXk2gfl5SK5-lwUoyIsX4BxKk"},
	}

	for _, p := range teamProfiles {
		avatarArr := []string{}
		if p.avatar != "" {
			avatarArr = []string{p.avatar}
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO profile_data ("ProfileID", "Name", "Email", "Role", "Department", "AccentColor", "PinHash", "UpdatedAt", "Avatar")
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
			ON CONFLICT ("ProfileID") DO UPDATE SET
				"Name" = EXCLUDED."Name",
				"Email" = EXCLUDED."Email",
				"Role" = EXCLUDED."Role",
				"Department" = EXCLUDED."Department",
				"AccentColor" = EXCLUDED."AccentColor",
				"PinHash" = EXCLUDED."PinHash",
				"Avatar" = EXCLUDED."Avatar"
		`, p.id, p.name, p.email, p.role, p.dept, p.accent, p.pin, avatarArr)
		if err != nil {
			log.Printf("Error upserting profile %s: %v", p.id, err)
		}
	}

	return nil
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
