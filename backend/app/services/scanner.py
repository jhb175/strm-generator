"""Media scanner - traverses source directory and identifies movies/episodes."""
import hashlib
import re
import os
from pathlib import Path
from typing import Optional
from app.config import SOURCE_DIR


# Regex patterns for episode parsing
EPISODE_PATTERNS = [
    # "恶作剧之吻 - S02E09 - 第 9 集.mp4"
    re.compile(r'^(.+?)\s*-\s*S(\d{2})E(\d{2,3})\s*-\s*(.+)\.mp4$', re.IGNORECASE),
    # "Show - 1x09 - Title.mp4"
    re.compile(r'^(.+?)\s*-\s*(\d{1,2})x(\d{2,3})\s*-\s*(.+)\.mp4$', re.IGNORECASE),
    # "Show S01E01.mp4"
    re.compile(r'^(.+?)\s*S(\d{2})E(\d{2,3})\.mp4$', re.IGNORECASE),
]

# Regex for movie: "Title (Year).mp4"
MOVIE_PATTERN = re.compile(r'^(.+?)\s*\((\d{4})\)\.mp4$', re.IGNORECASE)

# Media extensions to scan
MEDIA_EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv'}


def _file_hash(path: Path) -> str:
    """Quick hash of file size + mtime for change detection."""
    stat = path.stat()
    return f"{stat.st_size}-{stat.st_mtime:.0f}"


def _guess_title_folder(folder_name: str) -> str:
    """Extract title from folder name, stripping year and extra info."""
    # "恶作剧之吻 (2005)" or "Breaking Bad (2008)"
    m = re.match(r'^(.+?)\s*(?:\(\d{4}\))?$', folder_name.strip())
    return m.group(1).strip() if m else folder_name.strip()


def _guess_title_from_filename(filename: str) -> str:
    """Extract title from a media filename."""
    # Remove extension
    name = Path(filename).stem
    # Try to strip episode info
    for pat in EPISODE_PATTERNS:
        m = pat.match(name)
        if m:
            return m.group(1).strip()
    # Try to strip year
    m = MOVIE_PATTERN.match(name)
    if m:
        return m.group(1).strip()
    return name.strip()


class MediaItem:
    def __init__(self, path: Path, media_type: str, title: str,
                 year: Optional[int] = None, season: Optional[int] = None,
                 episode: Optional[int] = None, episode_title: Optional[str] = None,
                 category: Optional[str] = None):
        self.path = path
        self.media_type = media_type  # 'movie' | 'episode'
        self.title = title
        self.year = year
        self.season = season
        self.episode = episode
        self.episode_title = episode_title
        self.category = category  # e.g. '国产剧', '美剧'

    def __repr__(self):
        return (f"<MediaItem {self.media_type}: {self.title}"
                f" S{self.season}E{self.episode} @ {self.path}>")


def scan_source_dir(source_dir: Path = None) -> tuple[list[MediaItem], list[str]]:
    """
    Scan source directory recursively for media files.
    Returns (items, errors).
    """
    if source_dir is None:
        source_dir = SOURCE_DIR

    items: list[MediaItem] = []
    errors: list[str] = []

    source_dir = Path(source_dir)
    if not source_dir.exists():
        errors.append(f"Source dir does not exist: {source_dir}")
        return items, errors

    # Walk movies
    movies_root = source_dir / "电影"
    if movies_root.exists():
        for folder in sorted(movies_root.iterdir()):
            if not folder.is_dir():
                continue
            title = _guess_title_folder(folder.name)
            # Extract year from folder name: "Title (Year)"
            year = None
            m = re.match(r'.+\((\d{4})\)', folder.name)
            if m:
                year = int(m.group(1))
            # Find media files
            for f in sorted(folder.iterdir()):
                if f.suffix.lower() not in MEDIA_EXTS:
                    continue
                items.append(MediaItem(
                    path=f,
                    media_type='movie',
                    title=title,
                    year=year,
                ))

    # Walk TV shows
    shows_root = source_dir / "电视剧"
    if shows_root.exists():
        for category_folder in sorted(shows_root.iterdir()):
            if not category_folder.is_dir():
                continue
            category = category_folder.name
            for show_folder in sorted(category_folder.iterdir()):
                if not show_folder.is_dir():
                    continue
                title = _guess_title_folder(show_folder.name)
                # Extract year
                year = None
                m = re.match(r'.+\((\d{4})\)', show_folder.name)
                if m:
                    year = int(m.group(1))
                # Find Season folders
                for season_folder in sorted(show_folder.iterdir()):
                    if not season_folder.is_dir():
                        continue
                    # Parse season: "Season 1" or "Season X"
                    season = None
                    sm = re.match(r'[Ss]eason\s*(\d+)', season_folder.name)
                    if sm:
                        season = int(sm.group(1))
                    else:
                        # Maybe just a number folder
                        sm = re.match(r'^(\d+)$', season_folder.name.strip())
                        if sm:
                            season = int(sm.group(1))
                    if season is None:
                        continue
                    # Find episode files
                    for ep_file in sorted(season_folder.iterdir()):
                        if ep_file.suffix.lower() not in MEDIA_EXTS:
                            continue
                        episode = None
                        episode_title = None
                        matched_title = title
                        for pat in EPISODE_PATTERNS:
                            m = pat.match(ep_file.stem)
                            if m:
                                matched_title = m.group(1).strip()
                                season = int(m.group(2))
                                episode = int(m.group(3))
                                if len(m.groups) >= 4:
                                    episode_title = m.group(4).strip()
                                break
                        if episode is None:
                            # Couldn't parse episode number - skip or use filename index
                            errors.append(f"Could not parse episode from: {ep_file}")
                            continue
                        items.append(MediaItem(
                            path=ep_file,
                            media_type='episode',
                            title=matched_title,
                            year=year,
                            season=season,
                            episode=episode,
                            episode_title=episode_title,
                            category=category,
                        ))

    return items, errors
