# FARMLY — Backend & Persistence Guide

## Overview
FARMLY now has a fully integrated **Node.js + Express REST API Backend** with persistent data storage and automatic historical snapshots.

---

## What was Added:
1. **`server.js`**: The Express REST API backend:
   - Serves the frontend at `http://localhost:3000`
   - Handles REST endpoints for real-time farm data sync
   - Automatically maintains backups in `data/backups/`
2. **`data/farm_data.json`**: Central JSON database storing flock records, egg harvests, feed silos, vaccines, and finances.
3. **`data/backups/`**: Historical snapshot backups created automatically on updates.
4. **`start-server.bat`**: 1-click launcher to run the server and open FARMLY in your default browser.
5. **Live Connection Pill**: Displays real-time status in the header:
   - `● Backend Synced` (Green): Connected and saving directly to the database.
   - `● Saving to Server...` (Blue): Actively persisting updates.
   - `● Offline (Local)` (Orange): Running locally if the server is stopped.

---

## How to Run:

### Method 1: 1-Click Launcher (Easiest)
Double-click:
`c:\Users\abhinand roney\Downloads\FARMLY_poultry_farm_management\FARMLY\start-server.bat`
This starts the backend and automatically opens `http://localhost:3000` in your browser.

### Method 2: From Terminal
```powershell
cd "c:\Users\abhinand roney\Downloads\FARMLY_poultry_farm_management\FARMLY"
npm start
```
Then visit: `http://localhost:3000`

---

## REST API Endpoints:
* `GET /api/status` — Server health, uptime, and summary stats.
* `GET /api/farm` — Retrieve complete farm data.
* `PUT /api/farm` — Save and synchronize updated farm data.
* `POST /api/backup` — Force an immediate timestamped backup snapshot.
* `GET /api/backups` — View list of saved snapshots.
* `POST /api/restore/:filename` — Restore farm state from a previous snapshot.
* `POST /api/reset` — Reset the database to initial clean factory state.
