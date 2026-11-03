"""Tareas de mantenimiento: `uv run python -m app.cli seed demo|completo`."""

import argparse
import sys
from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_engine
from app.seeds.demo import seed_demo


def seed(settings: Settings, name: str) -> str:
    if settings.app_env == "production":
        raise SystemExit("La semilla borra todos los datos: no se ejecuta con APP_ENV=production.")

    with Session(get_engine(settings.database_url)) as session:
        seed_demo(session, settings.zone)
    return f"Semilla {name} cargada."


def main(argv: Sequence[str] | None = None, settings: Settings | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    seed_parser = commands.add_parser("seed", help="Borra los datos y carga una semilla")
    seed_parser.add_argument("name", choices=["demo"])

    args = parser.parse_args(argv)
    print(seed(settings or get_settings(), args.name), file=sys.stdout)


if __name__ == "__main__":  # pragma: no cover
    main()
