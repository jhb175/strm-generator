"""Runtime scheduler for STRM periodic jobs."""
from __future__ import annotations

import asyncio
import contextlib
import datetime as dt
from dataclasses import dataclass
from typing import Optional

from croniter import croniter

from app.db import SessionLocal
from app.models import TaskRun
from app.services.scheduler import get_scheduler_config
from app.services.state import task_state, log_op
from app.services.generator import run_generate


@dataclass
class SchedulerSnapshot:
    enabled: bool
    cron: str
    description: str = ""
    next_run_at: Optional[str] = None
    last_checked_at: Optional[str] = None
    active: bool = False


class RuntimeScheduler:
    def __init__(self) -> None:
        self._loop_task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self._last_signature: Optional[str] = None
        self._last_fire_signature: Optional[str] = None
        self._running_lock = asyncio.Lock()

    def start(self) -> None:
        if self._loop_task and not self._loop_task.done():
            return
        self._stop = asyncio.Event()
        self._loop_task = asyncio.create_task(self._run_loop())
        log_op("info", "scheduler", "Runtime scheduler started")

    async def stop(self) -> None:
        self._stop.set()
        if self._loop_task:
            self._loop_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._loop_task
        self._loop_task = None

    def snapshot(self) -> SchedulerSnapshot:
        db = SessionLocal()
        try:
            cfg = get_scheduler_config(db)
        finally:
            db.close()

        now = dt.datetime.now(dt.timezone.utc)
        next_run_at = None
        if cfg.get("enabled"):
            try:
                base = now.replace(second=0, microsecond=0)
                next_run_at = croniter(cfg.get("cron") or "0 3 * * *", base).get_next(dt.datetime).isoformat()
            except Exception:
                next_run_at = None

        return SchedulerSnapshot(
            enabled=bool(cfg.get("enabled", False)),
            cron=str(cfg.get("cron", "0 3 * * *")),
            description=str(cfg.get("description", "")),
            next_run_at=next_run_at,
            last_checked_at=now.isoformat(),
            active=bool(self._loop_task and not self._loop_task.done()),
        )

    def _has_active_scheduled_run(self) -> bool:
        db = SessionLocal()
        try:
            active = db.query(TaskRun).filter(
                TaskRun.task_type == "scheduled_generate",
                TaskRun.status == "RUNNING",
            ).first()
            return active is not None
        finally:
            db.close()

    async def trigger_now(self, reason: str = "manual") -> None:
        if self._running_lock.locked():
            log_op("warning", "scheduler", f"Skip scheduled run because a task is already running in-process ({reason})")
            return
        if self._has_active_scheduled_run():
            log_op("warning", "scheduler", f"Skip scheduled run because another scheduled_generate is already marked RUNNING ({reason})")
            return
        async with self._running_lock:
            task_id = task_state.start_task("scheduled_generate")
            task_state.update(task_id, message=f"Scheduled run started ({reason})")
            try:
                await run_generate(task_id)
                log_op("info", "scheduler", f"Scheduled run finished ({reason})")
            except Exception as e:
                log_op("error", "scheduler", f"Scheduled run failed ({reason}): {e}")
                raise

    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            try:
                snapshot = self.snapshot()
                if snapshot.enabled:
                    await self._check_and_fire(snapshot)
            except Exception as e:
                log_op("error", "scheduler", f"Scheduler loop error: {e}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=30)
            except asyncio.TimeoutError:
                continue

    async def _check_and_fire(self, snapshot: SchedulerSnapshot) -> None:
        now = dt.datetime.now(dt.timezone.utc)
        current_minute = now.replace(second=0, microsecond=0)
        signature = f"{snapshot.cron}|{current_minute.isoformat()}"
        if self._last_signature == signature:
            return
        self._last_signature = signature

        try:
            itr = croniter(snapshot.cron, current_minute - dt.timedelta(minutes=1))
            expected = itr.get_next(dt.datetime)
        except Exception as e:
            log_op("warning", "scheduler", f"Invalid cron expression '{snapshot.cron}': {e}")
            return

        if expected != current_minute:
            return

        fire_signature = f"{snapshot.cron}|{expected.isoformat()}"
        if self._last_fire_signature == fire_signature:
            return
        self._last_fire_signature = fire_signature
        await self.trigger_now(reason=f"cron:{snapshot.cron}")


runtime_scheduler = RuntimeScheduler()
