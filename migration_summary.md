# Supabase PostgreSQL Migration Summary & Deployment Guide

## Overview
The Go backend for `naveencmy/One-Project` has been successfully refactored from local Excel storage (`workspace_data.xlsx`, `profile_data.xlsx`, `excelize`) to a scalable PostgreSQL database hosted on **Supabase** using `github.com/jackc/pgx/v5`.

---

## Changed Files & Removals

### Added Files
- `backend/db/db.go`: Connection pooling (`pgxpool`), database health checking (`Ping`), and automatic table schema migrations (`tracking_nodes`, `profile_data`, `team_roster`).
- `backend/postgres_store.go`: Complete database repository layer providing SQL queries for tracking nodes, user profiles, and team roster.
- `backend/main_test.go`: Unit tests for server health (`/healthz`) and authentication status (`/api/auth/status`).

### Modified Files
- `backend/main.go`: Updated router endpoints to use PostgreSQL store, added `/healthz` and `/api/health` HTTP 200 health check endpoints, default port changed to `8080`.
- `backend/go.mod`: Added `github.com/jackc/pgx/v5` and `github.com/google/uuid`; removed `github.com/xuri/excelize/v2`.
- `backend/Dockerfile`: Updated builder image to `golang:1.24-alpine`, default `PORT=8080`, exposing port `8080`.
- `.env` & `backend/.env`: Added `DATABASE_URL` configuration and updated port to `8080`.

### Deleted Excel & Unwanted Files
- `backend/excel_store.go` (Removed Excel file persistence engine)
- `backend/workspace_data.xlsx` (Removed Excel spreadsheet)
- `backend/profile_data.xlsx` (Removed Excel spreadsheet)
- `backend/server_new.exe`, `backend/server_new.exe~`, `backend/server_test.log`, `backend/server_test_err.log`, `backend/workspace-backend.exe` (Removed build artifacts and log files)

---

## Database Schemas Created (Supabase)

```sql
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
```

---

## Environment Variables

| Variable | Location | Value / Description |
| --- | --- | --- |
| `DATABASE_URL` | Environment / `.env` | `postgresql://postgres:[YOUR-PASSWORD]@db.wwfhsiwvjtezevoqtpka.supabase.co:5432/postgres` |
| `PORT` | Environment / `backend/.env` | `8080` (Default HTTP listening port for Render) |
| `ALLOWED_ORIGIN` | Environment / `backend/.env` | `*` or frontend origin URL |
| `VITE_API_BASE_URL` | Root `.env` | `http://localhost:8080/api` (Local) or `https://<your-render-app>.onrender.com/api` (Production) |

---

## Deployment Instructions for Render

1. **Create Web Service on Render**:
   - Repository: `naveencmy/One-Project`
   - Root Directory: `backend`
   - Environment: `Docker` (or `Go`)
   - Build Command: `go build -o server .`
   - Start Command: `./server`

2. **Configure Environment Variables in Render Dashboard**:
   - Set `DATABASE_URL` = `postgresql://postgres:[YOUR-PASSWORD]@db.wwfhsiwvjtezevoqtpka.supabase.co:5432/postgres`
   - Set `PORT` = `8080`
   - Set `ALLOWED_ORIGIN` = `https://<your-frontend-domain>`

3. **Health Check Path**:
   - Set Health Check Path in Render settings to `/healthz` or `/api/health`.

4. **Verify Deployment**:
   - `GET https://<your-render-app>.onrender.com/healthz` returns `{"database":"connected","status":"ok"}`.
