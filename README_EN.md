# YingLink / STRM Media Bridge

## Overview
YingLink (STRM Media Bridge) is a **FastAPI + React + TypeScript** project for scanning media source folders, generating `.strm` files, and serving them to media servers such as **Emby**, **Jellyfin**, and **Plex**.

The project currently includes:
- Integrated frontend + backend deployment via Docker Compose
- Chinese web UI
- HTTP Basic Auth protection
- Emby statistics dashboard
- Task center with manual execution feedback
- Scheduler configuration support
- STRM output to a standard media library path

## Features
- **Automatic media scanning** for movies and TV shows
- **Batch STRM generation** for large libraries
- **Modern web UI** for configuration and monitoring
- **Task center** with execution status, history, and logs
- **Scheduler support** using Cron expressions
- **Emby statistics** including movies, series, total items, and recent additions
- **HTTP Basic Auth** without introducing a separate user system

## Tech Stack
- Backend: FastAPI
- Frontend: React + TypeScript + Vite
- Deployment: Docker Compose
- Auth: HTTP Basic Auth

## Quick Start

### Requirements
- Docker
- Docker Compose
- A mounted media source directory

### Start the project
```bash
git clone https://github.com/jhb175/strm-generator.git
cd strm-generator
docker compose up -d --build
```

### Default URLs
- Frontend: `http://localhost:8888`
- Backend API: `http://localhost:3011`

## STRM Content Format
Generated `.strm` files contain absolute paths accessible inside the media server container, for example:

```text
/media/电影/外语电影/The Man from Earth (2007)/The Man from Earth (2007) - 1080p.mkv
```

This means your media server container must mount both:
- `/strm` for reading `.strm` files
- `/media` for reading the real media files

## API Overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | GET | Health check (public) |
| `/api/tasks/scan` | POST | Scan and generate STRM files |
| `/api/tasks/generate` | POST | Run generation only |
| `/api/tasks/status` | GET | Get current task status |
| `/api/history` | GET | Get task history |
| `/api/logs` | GET | Get logs |
| `/api/config` | GET/POST | Read/save configuration |
| `/api/scheduler` | GET/POST | Read/save scheduler config |
| `/api/emby/stats` | GET | Get Emby statistics |

## Scheduler
The project supports saving Cron expressions for scheduled execution.

Examples:
- `0 * * * *` → run once every hour
- `0 3 * * *` → run every day at 03:00

## Security Notes
To avoid exposing this service as an unprotected public tool, at least follow these recommendations:

### 1. Change the default credentials
Do not keep example credentials in production. Override them with environment variables:

```bash
STRS_AUTH_USER=your_user
STRS_AUTH_PASS=your_strong_password
```

### 2. Do not expose the backend directly to the public internet
Recommended options:
- restrict to LAN only
- place it behind a reverse proxy
- limit source IP ranges
- enable HTTPS if it is remotely accessible

### 3. Keep media server mounts minimal
Only mount what is needed:
- `/strm`
- `/media`

Avoid exposing unnecessary host directories into containers.

### 4. Never commit real secrets to GitHub
Do not publish:
- Emby API keys
- real usernames or passwords
- private domains or internal paths
- SSH credentials or server access details

### 5. Protect your ports with a firewall
At minimum, review and restrict access to:
- `8888`
- `3011`
- `8096`

Allow only trusted sources whenever possible.

## FAQ

### Q1: Emby cannot recognize generated STRM files
Check these two things first:
1. Emby must mount `/strm`
2. Emby must mount `/media`

Also confirm that the path written inside the `.strm` file matches the real path visible inside the Emby container.

### Q2: Generation succeeded but the media library did not update
This is usually not a STRM generation issue. In most cases, Emby just has not refreshed the library yet. Trigger a library refresh manually or rely on the built-in scheduler.

### Q3: Why were some very high episode numbers missing before?
Older parsing logic only handled shorter episode numbers. The current version supports 4-digit episode numbers, such as:
- `S01E1046`
- `S01E1323`

## Repository
- GitHub: https://github.com/jhb175/strm-generator

## License
MIT
