"""REST API routes."""
import asyncio
import datetime
import json
import threading
from pathlib import Path

from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import SOURCE_DIR, OUTPUT_DIR
from app.db import get_db
from app.models import TaskRun, OpLog, Config, StrmFile
from app.services.state import task_state, log_op
from app.services.generator import run_scan, run_generate, run_cleanup
from app.services.websocket import ws_manager


router = APIRouter()


# --- Request/Response Models ---

class ConfigSetRequest(BaseModel):
    key: str
    value: str


class TriggerResponse(BaseModel):
    ok: bool
    task_id: str
    message: str


class StatusResponse(BaseModel):
    current_task: dict | None
    all_tasks: dict


class HistoryResponse(BaseModel):
    runs: list


class LogsResponse(BaseModel):
    logs: list


# --- Task triggering ---

async def _run_scan_bg(task_id: str, source_dir: str | None, output_dir: str | None,
                        incremental: bool):
    try:
        await run_scan(task_id,
                       source_dir=Path(source_dir) if source_dir else None,
                       output_dir=Path(output_dir) if output_dir else None,
                       incremental=incremental)
    except Exception as e:
        log_op("error", "scan", f"Unexpected error: {e}")
        task_state.finish(task_id, status="FAILED", error_message=str(e))
        await ws_manager.push_progress(task_id, "scan", "FAILED", error_message=str(e))


async def _run_generate_bg(task_id: str, source_dir: str | None, output_dir: str | None,
                            incremental: bool):
    try:
        await run_generate(task_id,
                           source_dir=Path(source_dir) if source_dir else None,
                           output_dir=Path(output_dir) if output_dir else None,
                           incremental=incremental)
    except Exception as e:
        log_op("error", "generate", f"Unexpected error: {e}")
        task_state.finish(task_id, status="FAILED", error_message=str(e))
        await ws_manager.push_progress(task_id, "generate", "FAILED", error_message=str(e))


async def _run_cleanup_bg(task_id: str, output_dir: str | None, dry_run: bool):
    try:
        await run_cleanup(task_id,
                          output_dir=Path(output_dir) if output_dir else None,
                          dry_run=dry_run)
    except Exception as e:
        log_op("error", "cleanup", f"Unexpected error: {e}")
        task_state.finish(task_id, status="FAILED", error_message=str(e))
        await ws_manager.push_progress(task_id, "cleanup", "FAILED", error_message=str(e))


@router.post("/api/tasks/scan", response_model=TriggerResponse)
async def trigger_scan(
    source_dir: str | None = None,
    incremental: bool = True,
    background_tasks: BackgroundTasks = None
):
    """Trigger a media scan."""
    task_id = task_state.start_task("scan")
    task_state.update(task_id, message="Queued for scanning...")
    asyncio.create_task(_run_scan_bg(task_id, source_dir, None, incremental))
    return TriggerResponse(ok=True, task_id=task_id,
                            message=f"Scan started (task {task_id})")


@router.post("/api/tasks/generate", response_model=TriggerResponse)
async def trigger_generate(
    source_dir: str | None = None,
    output_dir: str | None = None,
    incremental: bool = True,
):
    """Trigger STRM file generation."""
    task_id = task_state.start_task("generate")
    task_state.update(task_id, message="Queued for generation...")
    asyncio.create_task(_run_generate_bg(task_id, source_dir, output_dir, incremental))
    return TriggerResponse(ok=True, task_id=task_id,
                            message=f"Generation started (task {task_id})")


@router.post("/api/tasks/cleanup/execute", response_model=TriggerResponse)
async def trigger_cleanup(
    output_dir: str | None = None,
    dry_run: bool = True,
):
    """Trigger orphaned STRM cleanup."""
    task_id = task_state.start_task("cleanup")
    task_state.update(task_id, message="Queued for cleanup...")
    asyncio.create_task(_run_cleanup_bg(task_id, output_dir, dry_run))
    return TriggerResponse(ok=True, task_id=task_id,
                            message=f"Cleanup started (task {task_id}, dry_run={dry_run})")


@router.get("/api/tasks/status", response_model=StatusResponse)
async def get_status():
    """Get current task status / progress."""
    return StatusResponse(
        current_task=task_state.get_current(),
        all_tasks=task_state.get_all(),
    )


@router.get("/api/tasks/cleanup/preview")
async def preview_cleanup(db: Session = Depends(get_db)):
    """Preview orphaned STRM files (read-only, no deletion)."""
    orphans: list[str] = []
    all_strms = db.query(StrmFile).all()
    for rec in all_strms:
        source_path = Path(rec.source_path)
        if not source_path.exists():
            orphans.append(str(Path(rec.strm_path)))
    return {"files": orphans}


@router.get("/api/history", response_model=HistoryResponse)
async def get_history(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    """Get task run history."""
    runs = db.query(TaskRun).order_by(TaskRun.id.desc()).limit(limit).offset(offset).all()
    return HistoryResponse(runs=[
        {
            "id": r.id,
            "task_type": r.task_type,
            "status": r.status.upper() if r.status else None,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "total_items": r.total_items,
            "processed_items": r.processed_items,
            "created_files": r.created_files,
            "deleted_files": r.deleted_files,
            "error_message": r.error_message,
            "detail": r.detail,
        }
        for r in runs
    ])


@router.get("/api/logs", response_model=LogsResponse)
async def get_logs(limit: int = 100, offset: int = 0, level: str = "",
                    action: str = "", db: Session = Depends(get_db)):
    """Get operation logs."""
    query = db.query(OpLog)
    if level:
        query = query.filter(OpLog.level == level)
    if action:
        query = query.filter(OpLog.action == action)
    logs = query.order_by(OpLog.id.desc()).limit(limit).offset(offset).all()
    return LogsResponse(logs=[
        {
            "id": l.id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "level": l.level,
            "action": l.action,
            "message": l.message,
            "detail": l.detail,
        }
        for l in logs
    ])


@router.get("/api/config")
async def get_config(db: Session = Depends(get_db)):
    """Get current configuration."""
    rows = db.query(Config).all()
    return {r.key: r.value for r in rows}


@router.post("/api/config")
async def set_config(payload: ConfigSetRequest, db: Session = Depends(get_db)):
    """Set a configuration value."""
    existing = db.query(Config).filter(Config.key == payload.key).first()
    if existing:
        existing.value = payload.value
    else:
        db.add(Config(key=payload.key, value=payload.value))
    db.commit()
    log_op("info", "config", f"Config set: {payload.key} = {payload.value[:100]}")
    return {"ok": True, "key": payload.key, "value": payload.value}


@router.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get overall statistics."""
    total_strms = db.query(StrmFile).count()
    movie_strms = db.query(StrmFile).filter(StrmFile.media_type == 'movie').count()
    episode_strms = db.query(StrmFile).filter(StrmFile.media_type == 'episode').count()
    return {
        "total_strms": total_strms,
        "movie_strms": movie_strms,
        "episode_strms": episode_strms,
        "source_dir": str(SOURCE_DIR),
        "output_dir": str(OUTPUT_DIR),
    }
