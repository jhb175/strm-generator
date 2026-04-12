"""REST API routes."""
import asyncio
import datetime
import json
import os
import threading
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import basic_auth
from app.config import SOURCE_DIR, OUTPUT_DIR
from app.db import get_db
from app.models import TaskRun, OpLog, Config, StrmFile
from app.services.state import task_state, log_op
from app.services.generator import run_scan, run_generate, run_cleanup, _cleanup_orphans_core
from app.services.websocket import ws_manager
from app.services.scheduler import get_scheduler_config, save_scheduler_config
from app.services.runtime_scheduler import runtime_scheduler


router = APIRouter(dependencies=[Depends(basic_auth)])


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


class SchedulerConfigPayload(BaseModel):
    enabled: bool
    cron: str
    description: str = ""


# --- Task triggering ---

async def _run_scan_bg(task_id: str, source_dir: str | None, output_dir: str | None,
                        incremental: bool):
    try:
        resolved_output = Path(output_dir) if output_dir else None
        await ws_manager.push_progress(task_id, "scan", "running", message="Checking orphaned STRM files before scan...")
        task_state.update(task_id, message="Checking orphaned STRM files before scan...")
        cleanup_result = await _cleanup_orphans_core(output_dir=resolved_output, dry_run=False, progress_task_id=task_id)
        log_op("info", "scan", f"Pre-scan orphan cleanup deleted {cleanup_result['deleted']} files")
        await ws_manager.push_progress(task_id, "scan", "running", message=f"Pre-check complete: removed {cleanup_result['deleted']} invalid STRM files. Starting scan and generation...")
        task_state.update(task_id, message=f"Pre-check complete: removed {cleanup_result['deleted']} invalid STRM files. Starting scan and generation...")
        await run_generate(task_id,
                           source_dir=Path(source_dir) if source_dir else None,
                           output_dir=resolved_output,
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
    """Trigger scan + STRM generation for the current source directory."""
    task_id = task_state.start_task("scan")
    task_state.update(task_id, message="Queued for scan and generation...")
    asyncio.create_task(_run_generate_bg(task_id, source_dir, None, incremental))
    return TriggerResponse(ok=True, task_id=task_id,
                            message=f"Scan and generation started (task {task_id})")


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
            "started_at": (r.started_at.replace(tzinfo=datetime.timezone.utc).isoformat() if r.started_at else None),
            "finished_at": (r.finished_at.replace(tzinfo=datetime.timezone.utc).isoformat() if r.finished_at else None),
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
            "created_at": (l.created_at.replace(tzinfo=datetime.timezone.utc).isoformat() if l.created_at else None),
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


@router.get("/api/scheduler")
async def get_scheduler(db: Session = Depends(get_db)):
    """Get scheduler configuration."""
    data = get_scheduler_config(db)
    snapshot = runtime_scheduler.snapshot()
    return {
        **data,
        "active": snapshot.active,
        "next_run_at": snapshot.next_run_at,
        "last_checked_at": snapshot.last_checked_at,
    }


@router.post("/api/scheduler")
async def set_scheduler(payload: SchedulerConfigPayload, db: Session = Depends(get_db)):
    """Persist scheduler configuration."""
    cron = payload.cron.strip()
    if not cron:
        raise HTTPException(status_code=400, detail="cron is required")

    saved = save_scheduler_config(
        db,
        {
            "enabled": payload.enabled,
            "cron": cron,
            "description": payload.description,
        },
    )
    log_op("info", "config", f"Scheduler config updated: enabled={saved['enabled']}, cron={saved['cron']}")
    snapshot = runtime_scheduler.snapshot()
    return {"ok": True, **saved, "active": snapshot.active, "next_run_at": snapshot.next_run_at, "last_checked_at": snapshot.last_checked_at}


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


@router.get("/api/emby/stats")
async def get_emby_stats():
    """Fetch Emby library statistics."""
    base_url = os.getenv("EMBY_URL", "").rstrip("/")
    api_key = os.getenv("EMBY_API_KEY", "")
    recent_range_days = int(os.getenv("EMBY_RECENT_DAYS", "7"))

    if not base_url or not api_key:
        return {
            "connected": False,
            "message": "尚未配置 Emby 连接信息",
            "movie_count": 0,
            "series_count": 0,
            "total_count": 0,
            "recent_added_count": 0,
            "recent_range_days": recent_range_days,
            "last_updated_at": None,
        }

    def fetch_json(path: str, params: dict | None = None):
        query = urlencode(params or {})
        url = f"{base_url}{path}"
        if query:
            url = f"{url}?{query}"
        req = Request(url, headers={"X-Emby-Token": api_key})
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        counts = fetch_json("/Items/Counts")
        movie_count = counts.get("MovieCount", 0)
        series_count = counts.get("SeriesCount", 0)
        total_count = movie_count + series_count

        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=recent_range_days)
        latest = fetch_json(
            "/Items",
            {
                "Recursive": "true",
                "IncludeItemTypes": "Movie,Series",
                "SortBy": "DateCreated",
                "SortOrder": "Descending",
                "Limit": "200",
                "Fields": "DateCreated",
            },
        )
        recent_added_count = 0
        for item in latest.get("Items", []):
            date_created = item.get("DateCreated")
            if not date_created:
                continue
            try:
                created_at = datetime.datetime.fromisoformat(date_created.replace("Z", "+00:00"))
                if created_at >= cutoff:
                    recent_added_count += 1
            except Exception:
                continue

        return {
            "connected": True,
            "message": "获取 Emby 统计成功",
            "movie_count": movie_count,
            "series_count": series_count,
            "total_count": total_count,
            "recent_added_count": recent_added_count,
            "recent_range_days": recent_range_days,
            "last_updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    except Exception as e:
        log_op("warning", "emby", f"Emby stats fetch failed: {e}")
        return {
            "connected": False,
            "message": f"获取 Emby 统计失败: {e}",
            "movie_count": 0,
            "series_count": 0,
            "total_count": 0,
            "recent_added_count": 0,
            "recent_range_days": recent_range_days,
            "last_updated_at": None,
        }
