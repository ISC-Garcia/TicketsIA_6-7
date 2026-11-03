"""agrega la huella sha256 de tickets y eventos

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-03 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.integrity import HASH_COLUMN, digest, hashed_columns
from app.models import Event, Ticket

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BATCH = 2000
DESCRIPTION = "Huella SHA-256 del contenido, para detectar cambios hechos por fuera de la API"


def fill(table: str, key: str, columns: list[str]) -> None:
    """Calcula la huella de los registros que ya existen, con la misma función que la API."""
    connection = op.get_bind()
    names = ", ".join(dict.fromkeys([key, *columns]))
    rows = connection.execute(sa.text(f"SELECT {names} FROM {table}")).mappings().all()
    update = sa.text(f"UPDATE {table} SET {HASH_COLUMN} = :hash WHERE {key} = :key")
    for start in range(0, len(rows), BATCH):
        batch = rows[start : start + BATCH]
        connection.execute(
            update, [{"hash": digest(row, columns), "key": row[key]} for row in batch]
        )


def upgrade() -> None:
    """Upgrade schema."""
    for table in ("tickets", "events"):
        op.add_column(table, sa.Column(HASH_COLUMN, sa.String(length=64), nullable=True))
        op.execute(f"COMMENT ON COLUMN {table}.{HASH_COLUMN} IS '{DESCRIPTION}'")
    fill("tickets", "id", hashed_columns(Ticket))
    fill("events", "id", hashed_columns(Event))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("events", HASH_COLUMN)
    op.drop_column("tickets", HASH_COLUMN)
