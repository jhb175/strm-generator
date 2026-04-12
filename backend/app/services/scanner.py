"""Media scanner - traverses source directory and identifies movies/episodes."""
import hashlib
import re
import os
from pathlib import Path
from typing import Optional
from app.config import SOURCE_DIR


# Regex patterns for episode parsing
EPISODE_PATTERNS = [
    # "恶作剧之吻 - S02E09 - 第 9 集.mp4/.mkv"
    re.compile(r'^(.+?)\s*-\s*S(\d{2})E(\d{2,4})\s*-\s*(.+)\.(mp4|mkv|avi|mov|wmv)$', re.IGNORECASE),
    # "Show - 1x09 - Title.mp4/.mkv"
    re.compile(r'^(.+?)\s*-\s*(\d{1,2})x(\d{2,4})\s*-\s*(.+)\.(mp4|mkv|avi|mov|wmv)$', re.IGNORECASE),
    # "Show S01E01.mp4/.mkv"
    re.compile(r'^(.+?)\s*S(\d{2})E(\d{2,4})\.(mp4|mkv|avi|mov|wmv)$', re.IGNORECASE),
    # 使用 stem 匹配，无扩展名
    re.compile(r'^(.+?)\s*-\s*S(\d{2})E(\d{2,4})\s*-\s*(.+)$', re.IGNORECASE),
    re.compile(r'^(.+?)\s*-\s*(\d{1,2})x(\d{2,4})\s*-\s*(.+)$', re.IGNORECASE),
    re.compile(r'^(.+?)\s*S(\d{2})E(\d{2,4})$', re.IGNORECASE),
]

# Regex for movie: "Title (Year).mp4/.mkv/..."
MOVIE_PATTERN = re.compile(r'^(.+?)\s*\((\d{4})\)\.(mp4|mkv|avi|mov|wmv|m2ts|ts|iso)$', re.IGNORECASE)

# Media extensions to scan
MEDIA_EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m2ts', '.ts', '.iso'}


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

    # Walk movies: /电影/[分类]/[片名 (年份)]/[视频文件] or BDMV structure
    movies_root = source_dir / "电影"
    if movies_root.exists():
        for category_folder in sorted(movies_root.iterdir()):
            if not category_folder.is_dir():
                continue
            for folder in sorted(category_folder.iterdir()):
                if not folder.is_dir():
                    continue
                title = _guess_title_folder(folder.name)
                year = None
                m = re.match(r'.+\((\d{4})\)', folder.name)
                if m:
                    year = int(m.group(1))

                matched_movie = False
                for f in sorted(folder.iterdir()):
                    if f.is_file() and f.suffix.lower() in MEDIA_EXTS:
                        items.append(MediaItem(
                            path=f,
                            media_type='movie',
                            title=title,
                            year=year,
                            category=category_folder.name,
                        ))
                        matched_movie = True

                if matched_movie:
                    continue

                bdmv_stream = folder / 'BDMV' / 'STREAM'
                if bdmv_stream.exists() and bdmv_stream.is_dir():
                    m2ts_files = sorted([p for p in bdmv_stream.iterdir() if p.is_file() and p.suffix.lower() == '.m2ts'])
                    if m2ts_files:
                        # Pick the largest stream file as the main title by default.
                        main_file = max(m2ts_files, key=lambda p: p.stat().st_size)
                        items.append(MediaItem(
                            path=main_file,
                            media_type='movie',
                            title=title,
                            year=year,
                            category=category_folder.name,
                        ))
                        continue

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

                    if season is not None:
                        # Find episode files directly inside season folder
                        for ep_file in sorted(season_folder.iterdir()):
                            if not ep_file.is_file() or ep_file.suffix.lower() not in MEDIA_EXTS:
                                continue
                            episode = None
                            episode_title = None
                            matched_title = title
                            parsed_season = season
                            for pat in EPISODE_PATTERNS:
                                m = pat.match(ep_file.stem)
                                if m:
                                    matched_title = m.group(1).strip()
                                    parsed_season = int(m.group(2))
                                    episode = int(m.group(3))
                                    if len(m.groups()) >= 4:
                                        episode_title = m.group(4).strip()
                                    break
                            if episode is None:
                                errors.append(f"Could not parse episode from: {ep_file}")
                                continue
                            items.append(MediaItem(
                                path=ep_file,
                                media_type='episode',
                                title=matched_title,
                                year=year,
                                season=parsed_season,
                                episode=episode,
                                episode_title=episode_title,
                                category=category,
                            ))
                        continue

                    # Support non-standard TV structures like /电视剧/[分类]/[剧名]/BDMV/STREAM/*.m2ts
                    if season_folder.name.upper() == 'BDMV':
                        stream_dir = season_folder / 'STREAM'
                        if stream_dir.exists() and stream_dir.is_dir():
                            m2ts_files = sorted(
                                [p for p in stream_dir.iterdir() if p.is_file() and p.suffix.lower() == '.m2ts'],
                                key=lambda p: p.name,
                            )
                            existing_keys = {
                                (item.season, item.episode)
                                for item in items
                                if item.media_type == 'episode' and item.title == title and item.category == category
                            }
                            next_episode = 1
                            for ep_file in m2ts_files:
                                while (1, next_episode) in existing_keys:
                                    next_episode += 1
                                items.append(MediaItem(
                                    path=ep_file,
                                    media_type='episode',
                                    title=title,
                                    year=year,
                                    season=1,
                                    episode=next_episode,
                                    episode_title=f"BDMV {next_episode:02d}",
                                    category=category,
                                ))
                                existing_keys.add((1, next_episode))
                                next_episode += 1
                        continue

    return items, errors
