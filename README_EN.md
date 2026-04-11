# STRM Generator

## Project Introduction
STRM Generator is an automated tool built with FastAPI and React, designed to scan cloud drives or local storage for media files and generate corresponding `.strm` stub files. This allows for seamless streaming in media servers like Emby, Jellyfin, or Plex, saving massive amounts of local storage space.

## Features
- **Automated Scanning**: Deeply traverses specified directory structures to automatically discover media files (e.g., mp4, mkv, avi).
- **Batch STRM Generation**: Rapidly generates structurally consistent `.strm` files for massive media libraries.
- **Intuitive Web UI**: Offers a modern, responsive management interface to monitor generation progress and status at any time.
- **Directory Mapping Support**: Flexibly maps cloud drive mount paths to externally accessible direct links or playback paths.
- **Lightweight & Easy Deployment**: Decoupled frontend and backend architecture, providing a one-click deployment solution via Docker Compose.

## Directory Structure
```text
strm-project/
├── backend/            # FastAPI backend service
├── frontend/           # React + TypeScript frontend UI
├── docker-compose.yml  # Docker Compose configuration file
└── README.md           # Project documentation
```

## Quick Start

### Prerequisites
- Docker and Docker Compose installed

### One-Click Start
```bash
git clone <repository_url>
cd strm-project
docker-compose up -d
```

### Access URLs
- Frontend Management UI: `http://localhost:8888`
- Backend API: `http://localhost:3011`

## Directory Mapping Guide

| Mount Type | Container Path | Host Path | Description |
| --- | --- | --- | --- |
| Source Directory | `/data/clouddrive/gdrive` | Your cloud drive mount path | Location of actual media files |
| Output Directory | `/opt/strm_yesy/output` | Your desired STRM output path | Directory read by media servers (e.g., Emby) |

## STRM File Format Example
A `.strm` file is essentially a plain text file containing the direct playback link or mount path of the actual media file.

**Example:**
If the source file path is `/data/clouddrive/gdrive/Movies/Avatar.mkv`, the generated `Avatar.strm` file content might be:
```text
http://your-direct-link-domain/Movies/Avatar.mkv
```
Or it may point directly to a local mount path (depending on your configuration).

## API Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/login` | POST | User login, retrieve Token |
| `/api/scan` | POST | Trigger directory scan and STRM generation task |
| `/api/status` | GET | Get progress and status of the current task |
| `/api/config` | GET | Retrieve current system mapping configuration |
| `/api/config` | PUT | Update system mapping configuration |

## Configuration Guide

### Environment Variables
Can be configured by modifying `docker-compose.yml` or the `.env` file:
- `SOURCE_DIR`: Media source directory (Default: `/data/clouddrive/gdrive`)
- `OUTPUT_DIR`: STRM file output directory (Default: `/opt/strm_yesy/output`)

### Default Credentials
Upon the first startup, log in using the following default credentials:
- **Username:** `admin`
- **Password:** `strm2026`
*(It is recommended to change the default password immediately after logging in)*

## FAQ

**Q: What if the media server cannot recognize the generated STRM files?**
A: Ensure the media server has read permissions for the `/opt/strm_yesy/output` directory, and the links within the STRM files are accessible by the media server.

**Q: How do I rescan an updated directory?**
A: Click the "Rescan" button in the Web UI, or send a `POST /api/scan` request via the API.

## License
MIT License.