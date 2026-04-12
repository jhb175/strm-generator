"""Scheduler configuration service."""
import json
from sqlalchemy.orm import Session

from app.models import Config

SCHEDULER_CONFIG_KEY = "scheduler_config"
DEFAULT_SCHEDULER_CONFIG = {
    "enabled": False,
    "cron": "0 3 * * *",
    "description": "",
}


def get_scheduler_config(db: Session) -> dict:
    row = db.query(Config).filter(Config.key == SCHEDULER_CONFIG_KEY).first()
    if not row or not row.value:
        return DEFAULT_SCHEDULER_CONFIG.copy()

    try:
        data = json.loads(row.value)
    except json.JSONDecodeError:
        return DEFAULT_SCHEDULER_CONFIG.copy()

    return {
        "enabled": bool(data.get("enabled", DEFAULT_SCHEDULER_CONFIG["enabled"])),
        "cron": str(data.get("cron", DEFAULT_SCHEDULER_CONFIG["cron"])),
        "description": str(data.get("description", DEFAULT_SCHEDULER_CONFIG["description"])),
    }


def save_scheduler_config(db: Session, payload: dict) -> dict:
    normalized = {
        "enabled": bool(payload.get("enabled", DEFAULT_SCHEDULER_CONFIG["enabled"])),
        "cron": str(payload.get("cron", DEFAULT_SCHEDULER_CONFIG["cron"])).strip(),
        "description": str(payload.get("description", DEFAULT_SCHEDULER_CONFIG["description"])).strip(),
    }

    row = db.query(Config).filter(Config.key == SCHEDULER_CONFIG_KEY).first()
    serialized = json.dumps(normalized, ensure_ascii=False)
    if row:
        row.value = serialized
    else:
        db.add(Config(key=SCHEDULER_CONFIG_KEY, value=serialized))
    db.commit()
    return normalized
