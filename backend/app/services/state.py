"""Task state management."""
import datetime
import json
import threading
import uuid
from typing import Optional
from app.db import SessionLocal
from app.models import TaskRun, OpLog


class TaskState:
    """In-memory task state for currently running tasks."""

    def __init__(self):
        self._tasks: dict[str, dict] = {}
        self._lock = threading.Lock()

    def start_task(self, task_type: str) -> int:
        with self._lock:
            task_id = str(uuid.uuid4())[:8]
            self._tasks[task_id] = {
                "task_id": task_id,
                "task_type": task_type,
                "status": "RUNNING",
                "total": 0,
                "processed": 0,
                "created_files": 0,
                "deleted_files": 0,
                "message": "Starting...",
                "started_at": datetime.datetime.utcnow().isoformat(),
            }
            # Persist to DB
            db = SessionLocal()
            try:
                run = TaskRun(
                    task_type=task_type,
                    status="RUNNING",
                    started_at=datetime.datetime.utcnow(),
                    total_items=0,
                    processed_items=0,
                    created_files=0,
                    deleted_files=0,
                )
                db.add(run)
                db.commit()
                db.refresh(run)
                self._tasks[task_id]["db_id"] = run.id
            finally:
                db.close()
            return task_id

    def update(self, task_id: str, total: int = None, processed: int = None,
               message: str = None, created_files: int = None,
               deleted_files: int = None):
        with self._lock:
            if task_id not in self._tasks:
                return
            t = self._tasks[task_id]
            if total is not None:
                t["total"] = total
            if processed is not None:
                t["processed"] = processed
            if message is not None:
                t["message"] = message
            if created_files is not None:
                t["created_files"] = created_files
            if deleted_files is not None:
                t["deleted_files"] = deleted_files

    def finish(self, task_id: str, status: str = "success",
               error_message: str = None, detail: str = None):
        with self._lock:
            if task_id not in self._tasks:
                return
            t = self._tasks.pop(task_id)
            t["status"] = status
            t["finished_at"] = datetime.datetime.utcnow().isoformat()
            t["error_message"] = error_message
            t["detail"] = detail

            db = SessionLocal()
            try:
                run = db.query(TaskRun).filter(TaskRun.id == t["db_id"]).first()
                if run:
                    run.status = status
                    run.finished_at = datetime.datetime.utcnow()
                    run.total_items = t.get("total", 0)
                    run.processed_items = t.get("processed", 0)
                    run.created_files = t.get("created_files", 0)
                    run.deleted_files = t.get("deleted_files", 0)
                    run.error_message = error_message
                    run.detail = detail
                    db.commit()
            finally:
                db.close()

    def get(self, task_id: str) -> Optional[dict]:
        with self._lock:
            return self._tasks.get(task_id)

    def get_all(self) -> dict:
        with self._lock:
            return dict(self._tasks)

    def get_current(self) -> Optional[dict]:
        with self._lock:
            if self._tasks:
                return next(iter(self._tasks.values()))
            return None


task_state = TaskState()


def log_op(level: str, action: str, message: str, detail: str = None):
    """Write an operation log entry."""
    db = SessionLocal()
    try:
        entry = OpLog(
            created_at=datetime.datetime.utcnow(),
            level=level,
            action=action,
            message=message,
            detail=detail,
        )
        db.add(entry)
        db.commit()
    finally:
        db.close()
