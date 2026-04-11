"""STRM file generator."""
import datetime
import json
import os
import re
from pathlib import Path
from typing import Optional

from app.config import OUTPUT_DIR, SOURCE_DIR
from app.db import SessionLocal
from app.models import StrmFile
from app.services.scanner import MediaItem, scan_source_dir
from app.services.state import task_state, log_op
from app.services.websocket import ws_manager


# The media reference path prefix inside the STRM file.
# e.g. /media/电视剧/国产剧/恶作剧之吻 (2005)/Season 2/恶作剧之吻 - S02E09 - 第 9 集.mp4
MEDIA_PREFIX = "/media"


def _build_strm_path(item: MediaItem, output_dir: Path = None) -> Path:
    """
    Build the destination STRM file path based on media type and metadata.
    
    Movie:   output/电影/[Title] ([Year]).strm
    Episode: output/电视剧/[Category]/[Title] ([Year])/Season X/[Title] - SXXEXX - [EpisodeTitle].strm
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR

    if item.media_type == 'movie':
        year_str = f" ({item.year})" if item.year else ""
        strm_name = f"{item.title}{year_str}.strm"
        return output_dir / "电影" / strm_name

    elif item.media_type == 'episode':
        year_str = f" ({item.year})" if item.year else ""
        cat = item.category or "其他"
        season_str = f"Season {item.season}"
        ep_num = f"S{item.season:02d}E{item.episode:02d}"
        ep_title = item.episode_title or f"第 {item.episode} 集"
        strm_name = f"{item.title} - {ep_num} - {ep_title}.strm"
        return output_dir / "电视剧" / cat / f"{item.title}{year_str}" / season_str / strm_name

    raise ValueError(f"Unknown media type: {item.media_type}")


def _build_media_ref_path(item: MediaItem) -> str:
    """
    Build the absolute path reference that goes inside the .strm file.
    e.g. /media/电视剧/国产剧/恶作剧之吻 (2005)/Season 2/恶作剧之吻 - S02E09 - 第 9 集.mp4
    """
    if item.media_type == 'movie':
        year_str = f" ({item.year})" if item.year else ""
        return f"{MEDIA_PREFIX}/电影/{item.title}{year_str}/{item.path.name}"

    elif item.media_type == 'episode':
        year_str = f" ({item.year})" if item.year else ""
        cat = item.category or "其他"
        season_str = f"Season {item.season}"
        ep_num = f"S{item.season:02d}E{item.episode:02d}"
        ep_title = item.episode_title or f"第 {item.episode} 集"
        return (f"{MEDIA_PREFIX}/电视剧/{cat}/{item.title}{year_str}/{season_str}/"
                f"{item.title} - {ep_num} - {ep_title}.mp4")

    raise ValueError(f"Unknown media type: {item.media_type}")


def _file_hash(path: Path) -> str:
    stat = path.stat()
    return f"{stat.st_size}-{stat.st_mtime:.0f}"


async def run_scan(task_id: str, source_dir: Path = None,
                   output_dir: Path = None, incremental: bool = True):
    """Run media scan and report results."""
    from app.services.scanner import scan_source_dir
    await ws_manager.push_progress(task_id, "scan", "running", message="Scanning source directory...")
    task_state.update(task_id, message="Scanning source directory...")

    items, errors = scan_source_dir(source_dir)

    task_state.update(task_id, total=len(items), processed=len(items),
                      message=f"Scan complete: {len(items)} media items found")
    await ws_manager.push_progress(task_id, "scan", "success",
                                   total=len(items), processed=len(items),
                                   message=f"Scan complete: {len(items)} items found",
                                   errors=errors)
    task_state.finish(task_id, status="success",
                      detail=json.dumps({"total": len(items), "errors": errors}))
    log_op("info", "scan", f"Scan complete: {len(items)} items, {len(errors)} errors",
           json.dumps({"total": len(items), "errors": errors[:50]}))


async def run_generate(task_id: str, source_dir: Path = None,
                        output_dir: Path = None, incremental: bool = True):
    """Run STRM generation."""
    from app.services.scanner import scan_source_dir

    if source_dir is None:
        source_dir = SOURCE_DIR
    if output_dir is None:
        output_dir = OUTPUT_DIR

    await ws_manager.push_progress(task_id, "generate", "running", message="Scanning media...")
    task_state.update(task_id, message="Scanning media...")

    items, errors = scan_source_dir(source_dir)

    task_state.update(task_id, total=len(items), processed=0, message="Generating STRM files...")
    await ws_manager.push_progress(task_id, "generate", "running",
                                   total=len(items), processed=0,
                                   message=f"Generating STRM files for {len(items)} items...")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        for i, item in enumerate(items):
            strm_path = _build_strm_path(item, output_dir)
            media_ref = _build_media_ref_path(item)
            file_hash = _file_hash(item.path)

            # Incremental: check if STRM already exists with same hash
            existing = db.query(StrmFile).filter(StrmFile.strm_path == str(strm_path)).first()
            if incremental and existing and existing.file_hash == file_hash:
                skipped += 1
                task_state.update(task_id, processed=i + 1,
                                  message=f"Skipping unchanged: {item.title}")
                await ws_manager.push_progress(task_id, "generate", "running",
                                               total=len(items), processed=i + 1,
                                               created_files=created, skipped_files=skipped,
                                               message=f"Skipping unchanged: {item.title}")
                continue

            # Ensure parent directory exists
            strm_path.parent.mkdir(parents=True, exist_ok=True)

            # Write STRM file
            strm_path.write_text(media_ref)

            # Update/insert DB record
            if existing:
                existing.source_path = str(item.path)
                existing.media_type = item.media_type
                existing.title = item.title
                existing.year = item.year
                existing.season = item.season
                existing.episode = item.episode
                existing.file_hash = file_hash
                existing.updated_at = datetime.datetime.utcnow()
            else:
                rec = StrmFile(
                    strm_path=str(strm_path),
                    source_path=str(item.path),
                    media_type=item.media_type,
                    title=item.title,
                    year=item.year,
                    season=item.season,
                    episode=item.episode,
                    file_hash=file_hash,
                    created_at=datetime.datetime.utcnow(),
                    updated_at=datetime.datetime.utcnow(),
                )
                db.add(rec)

            created += 1
            task_state.update(task_id, processed=i + 1, created_files=created,
                              message=f"Generated: {strm_path.name}")
            if i % 10 == 0 or i == len(items) - 1:
                await ws_manager.push_progress(task_id, "generate", "running",
                                               total=len(items), processed=i + 1,
                                               created_files=created, skipped_files=skipped,
                                               message=f"Generated {created}, skipped {skipped}...")
            db.commit()
    except Exception as e:
        db.rollback()
        log_op("error", "generate", f"Generate failed: {e}")
        task_state.finish(task_id, status="failed", error_message=str(e))
        await ws_manager.push_progress(task_id, "generate", "failed",
                                       error_message=str(e))
        return
    finally:
        db.close()

    log_op("info", "generate", f"Generated {created} STRM files, skipped {skipped}",
           json.dumps({"created": created, "skipped": skipped}))
    task_state.finish(task_id, status="success",
                      detail=json.dumps({"created": created, "skipped": skipped, "errors": len(errors)}))
    await ws_manager.push_progress(task_id, "generate", "success",
                                   total=len(items), processed=len(items),
                                   created_files=created, skipped_files=skipped,
                                   message=f"Done! Created {created}, skipped {skipped}")


async def run_cleanup(task_id: str, output_dir: Path = None,
                       dry_run: bool = True):
    """Remove orphaned STRM files (STRMs pointing to missing source files)."""
    if output_dir is None:
        output_dir = OUTPUT_DIR
    output_dir = Path(output_dir)

    await ws_manager.push_progress(task_id, "cleanup", "running", message="Scanning for orphaned STRMs...")
    task_state.update(task_id, message="Scanning for orphaned STRMs...")

    db = SessionLocal()
    deleted = 0
    orphans: list[str] = []
    try:
        all_strms = db.query(StrmFile).all()
        total = len(all_strms)
        task_state.update(task_id, total=total)

        for i, rec in enumerate(all_strms):
            strm_path = Path(rec.strm_path)
            source_path = Path(rec.source_path)

            # Check if source file still exists
            if not source_path.exists():
                orphans.append(str(strm_path))
                if not dry_run:
                    if strm_path.exists():
                        strm_path.unlink()
                    db.delete(rec)
                    deleted += 1
                    log_op("info", "cleanup", f"Deleted orphaned STRM: {strm_path}")
                else:
                    log_op("info", "cleanup", f"Would delete orphaned STRM: {strm_path}")

            task_state.update(task_id, processed=i + 1, deleted_files=deleted,
                              message=f"Checked {i+1}/{total}: found {len(orphans)} orphans")
            if i % 20 == 0:
                await ws_manager.push_progress(task_id, "cleanup", "running",
                                               total=total, processed=i + 1,
                                               deleted_files=deleted,
                                               orphans_found=len(orphans),
                                               message=f"Checked {i+1}/{total}...")
        db.commit()
    except Exception as e:
        db.rollback()
        log_op("error", "cleanup", f"Cleanup failed: {e}")
        task_state.finish(task_id, status="failed", error_message=str(e))
        await ws_manager.push_progress(task_id, "cleanup", "failed", error_message=str(e))
        return
    finally:
        db.close()

    action = "Deleted" if not dry_run else "Would delete"
    log_op("info", "cleanup", f"{action} {deleted} orphaned STRM files",
           json.dumps({"deleted": deleted, "orphans": orphans[:100]}))
    task_state.finish(task_id, status="success",
                      detail=json.dumps({"deleted": deleted, "dry_run": dry_run}))
    await ws_manager.push_progress(task_id, "cleanup", "success",
                                   total=total, processed=total, deleted_files=deleted,
                                   orphans_found=len(orphans),
                                   message=f"Done! {action} {deleted} orphaned files")
