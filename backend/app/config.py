"""Application configuration."""
import os
from pathlib import Path

# Base paths - can be overridden via env vars
BASE_DIR = Path(os.environ.get("STRM_BASE_DIR", "/opt/strm_yesy"))
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Source (rclone mount)
SOURCE_DIR = Path(os.environ.get("STRM_SOURCE_DIR", "/data/clouddrive/gdrive"))

# Output (where STRM files are written)
OUTPUT_DIR = Path(os.environ.get("STRM_OUTPUT_DIR", "/opt/strm_yesy/output"))

# Path prefix written inside generated .strm files.
# Must match the media path visible to Emby/Jellyfin/Plex.
MEDIA_PREFIX = os.environ.get("STRM_MEDIA_PREFIX", "/media").rstrip("/") or "/media"

# Database
DB_PATH = DATA_DIR / "strm.db"

# Logging
LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
