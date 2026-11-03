"""Respaldos con `pg_dump` (E9-02, P-9). Solo se listan los que se ejecutaron de verdad."""

import hashlib
import subprocess
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Backup
from app.services.monitoring import wall_clock

Runner = Callable[[list[str]], subprocess.CompletedProcess[str]]
# Un respaldo fallido se reintenta una vez.
RETRIES = 1
LIST_DAYS = 7


def run_pg_dump(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, check=False)


def libpq_url(database_url: str) -> str:
    """`pg_dump` no entiende el prefijo de SQLAlchemy."""
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def last_line(output: str) -> str:
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return lines[-1] if lines else "pg_dump terminó con error y sin mensaje."


def attempt(
    db: Session, settings: Settings, runner: Runner, retry_of: Backup | None = None
) -> Backup:
    started_at = wall_clock(settings.zone)
    folder = settings.backup_folder
    folder.mkdir(parents=True, exist_ok=True)
    file_name = f"tickets-{started_at:%Y%m%d-%H%M%S}.dump"
    path = folder / file_name

    clock = time.perf_counter()
    command = [
        settings.pg_dump,
        "--format=custom",
        f"--file={path}",
        libpq_url(settings.database_url),
    ]
    try:
        result = runner(command)
        failure = last_line(result.stderr) if result.returncode else None
    except OSError as error:
        failure = f"No se pudo ejecutar {settings.pg_dump}: {error.strerror or error}"
    duration = round(time.perf_counter() - clock, 2)

    backup = Backup(
        started_at=started_at,
        duration_seconds=duration,
        file_name=file_name,
        retry_of_id=retry_of.id if retry_of else None,
    )
    if failure or not path.exists():
        path.unlink(missing_ok=True)
        backup.status = "Fallido"
        backup.detail = failure or "pg_dump no generó el archivo."
    else:
        backup.status = "Exitoso"
        backup.size_bytes = path.stat().st_size
        backup.sha256 = sha256_of(path)
    db.add(backup)
    db.commit()
    return backup


def run_backup(db: Session, settings: Settings, runner: Runner = run_pg_dump) -> list[Backup]:
    """Ejecuta el respaldo y, si falla, lo reintenta. Devuelve cada intento en orden."""
    attempts = [attempt(db, settings, runner)]
    while attempts[-1].status == "Fallido" and len(attempts) <= RETRIES:
        attempts.append(attempt(db, settings, runner, retry_of=attempts[-1]))
    return attempts


def recent_backups(db: Session, now: datetime, days: int = LIST_DAYS) -> list[Backup]:
    return list(
        db.scalars(
            select(Backup)
            .where(Backup.started_at >= now - timedelta(days=days))
            .order_by(Backup.started_at.desc(), Backup.id.desc())
        )
    )
