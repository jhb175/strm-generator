"""SQLAlchemy models."""
from sqlalchemy import Column, Integer, Float, Text, String, DateTime
from app.db import Base


class Config(Base):
    """Key-value config store."""
    __tablename__ = 'config'
    key = Column(String, primary_key=True)
    value = Column(Text)


class TaskRun(Base):
    """History of scan/generate/cleanup runs."""
    __tablename__ = 'task_runs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_type = Column(String, nullable=False)  # 'scan' | 'generate' | 'cleanup'
    status = Column(String, nullable=False)     # 'running' | 'success' | 'failed'
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    total_items = Column(Integer, default=0)
    processed_items = Column(Integer, default=0)
    created_files = Column(Integer, default=0)
    deleted_files = Column(Integer, default=0)
    error_message = Column(Text)
    detail = Column(Text)  # JSON blob for extra info


class StrmFile(Base):
    """Track generated STRM files for incremental updates."""
    __tablename__ = 'strm_files'
    id = Column(Integer, primary_key=True, autoincrement=True)
    strm_path = Column(String, unique=True, index=True)
    source_path = Column(String, index=True)
    media_type = Column(String)   # 'movie' | 'episode'
    title = Column(String)
    year = Column(Integer)
    season = Column(Integer)
    episode = Column(Integer)
    file_hash = Column(String)     # hash of source file for change detection
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class OpLog(Base):
    """Operation log entries."""
    __tablename__ = 'op_logs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime)
    level = Column(String)   # 'info' | 'warning' | 'error'
    action = Column(String)  # 'scan' | 'generate' | 'cleanup' | 'config'
    message = Column(Text)
    detail = Column(Text)
