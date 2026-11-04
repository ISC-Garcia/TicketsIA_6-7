"""Tareas de mantenimiento: `uv run python -m app.cli seed demo|completo` y `... backup`."""

import argparse
import sys
from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_engine
from app.seeds.demo import seed_demo
from app.seeds.full import MissingDatasetError, seed_full
from app.services.backups import Runner, run_backup, run_pg_dump


def seed(settings: Settings, name: str) -> str:
    if settings.app_env == "production":
        raise SystemExit("La semilla borra todos los datos: no se ejecuta con APP_ENV=production.")

    with Session(get_engine(settings.database_url)) as session:
        if name == "demo":
            seed_demo(session, settings.zone, settings.now())
            return "Semilla demo cargada."
        try:
            added = seed_full(session, settings.zone, settings.data_dir, settings.now())
        except MissingDatasetError as error:
            raise SystemExit(str(error)) from error
        return f"Semilla completo cargada: demo y {added:,} tickets históricos."


def backup(settings: Settings, runner: Runner = run_pg_dump) -> str:
    """Respalda la base y registra cada intento. Termina con error si el último falló."""
    with Session(get_engine(settings.database_url)) as session:
        attempts = run_backup(session, settings, runner)
        lines = [
            f"{item.status}: {item.file_name}"
            + (f" (SHA-256 {item.sha256})" if item.sha256 else f" ({item.detail})")
            for item in attempts
        ]
        if attempts[-1].status == "Fallido":
            raise SystemExit("\n".join(lines))
        return "\n".join(lines)


def main(
    argv: Sequence[str] | None = None,
    settings: Settings | None = None,
    runner: Runner = run_pg_dump,
) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    seed_parser = commands.add_parser("seed", help="Borra los datos y carga una semilla")
    seed_parser.add_argument("name", choices=["demo", "completo"])
    commands.add_parser("backup", help="Respalda la base con pg_dump y registra el resultado")

    args = parser.parse_args(argv)
    settings = settings or get_settings()
    if args.command == "backup":
        print(backup(settings, runner), file=sys.stdout)
        return
    print(seed(settings, args.name), file=sys.stdout)


if __name__ == "__main__":  # pragma: no cover
    main()
