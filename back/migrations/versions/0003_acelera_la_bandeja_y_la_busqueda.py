"""acelera el orden de la bandeja y la búsqueda de texto

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-03 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RANK = "CASE priority WHEN 'Crítica' THEN 0 WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END"
# Debe coincidir con app.services.tickets.SEARCH_TEXT para que PostgreSQL use el índice.
SEARCH_TEXT = "(id || ' ' || summary || ' ' || description || ' ' || area)"


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("priority_rank", sa.SmallInteger(), sa.Computed(RANK, persisted=True)),
    )
    op.drop_index("ix_tickets_bandeja", table_name="tickets")
    op.create_index(
        "ix_tickets_bandeja", "tickets", ["status", "priority_rank", "created_at", "id"]
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        f"CREATE INDEX ix_tickets_busqueda ON tickets USING gin ({SEARCH_TEXT} gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX ix_tickets_busqueda")
    op.drop_index("ix_tickets_bandeja", table_name="tickets")
    op.create_index("ix_tickets_bandeja", "tickets", ["status", "priority", "created_at"])
    op.drop_column("tickets", "priority_rank")
