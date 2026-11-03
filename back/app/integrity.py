"""Huella SHA-256 de cada ticket y cada evento (E9-05, P-9). Sin cadena de bloques (D-1).

La huella se calcula sobre el contenido del registro en una forma canónica: JSON con las
llaves ordenadas y las fechas en UTC. La API la recalcula en cada escritura desde un solo
lugar (`stamp`), así que un cambio hecho por fuera de la API, directo en la base, deja la
huella desactualizada y la verificación lo detecta. Un registro borrado no deja rastro: la
verificación no puede detectarlo.
"""

import hashlib
import json
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import Float, event, select
from sqlalchemy.orm import Session

from app.models import Backup, Event, Ticket

HASH_COLUMN = "content_sha256"
# `priority_rank` lo calcula PostgreSQL a partir de la prioridad, y el ID de un evento es un
# consecutivo que la base asigna al guardar: ninguno es contenido del registro.
SKIPPED = {
    Ticket: {HASH_COLUMN, "priority_rank"},
    Event: {HASH_COLUMN, "id"},
}


def hashed_columns(model: type[Ticket] | type[Event]) -> list[str]:
    skipped = SKIPPED[model]
    return [column.name for column in model.__table__.columns if column.name not in skipped]


def with_default(record: Ticket | Event, name: str) -> Any:
    """El valor que tendrá la columna al guardarse, aunque aún no se aplique su default."""
    value = getattr(record, name)
    column = type(record).__table__.columns[name]
    if value is None and column.default is not None:
        default = column.default
        value = default.arg(None) if default.is_callable else default.arg  # pyright: ignore[reportAttributeAccessIssue]
    # Un 2 guardado en una columna decimal vuelve de la base como 2.0: se compara como decimal.
    if isinstance(value, int) and isinstance(column.type, Float):
        return float(value)
    return value


def canonical(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return value


def digest(values: Mapping[str, Any], columns: list[str]) -> str:
    content = {name: canonical(values.get(name)) for name in columns}
    payload = json.dumps(content, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def digest_of(record: Ticket | Event) -> str:
    columns = hashed_columns(type(record))
    return digest({name: with_default(record, name) for name in columns}, columns)


@event.listens_for(Session, "before_flush")
def stamp(session: Session, *_: object) -> None:
    """Pone la huella a cada ticket y evento nuevo o modificado antes de guardarlo."""
    for record in [*session.new, *session.dirty]:
        if isinstance(record, Ticket | Event):
            record.content_sha256 = digest_of(record)


# Cuántos IDs alterados se devuelven como muestra; el conteo siempre es completo.
EXAMPLES = 20
BATCH = 5000


def verify_table(db: Session, model: type[Ticket] | type[Event]) -> dict[str, Any]:
    """Recalcula la huella de cada registro y la compara con la guardada."""
    table = model.__table__
    columns = hashed_columns(model)
    selected = [table.c[name] for name in dict.fromkeys(["id", *columns, HASH_COLUMN])]
    query = select(*selected).execution_options(yield_per=BATCH)
    verified = 0
    mismatched: list[str] = []
    for row in db.execute(query).mappings():
        verified += 1
        if row[HASH_COLUMN] != digest(row, columns):
            mismatched.append(row["id"] if model is Ticket else f"EV-{row['id']}")
    return {
        "name": table.name,
        "verified": verified,
        "mismatched": len(mismatched),
        "examples": mismatched[:EXAMPLES],
    }


def sha256_of(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def verify_backup(backup: Backup, folder: Path) -> str:
    path = folder / backup.file_name
    if not path.exists():
        return "No encontrado"
    return "Íntegro" if sha256_of(path) == backup.sha256 else "Alterado"
