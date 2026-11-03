"""agrega la secuencia que numera los tickets nuevos

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-03 12:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Los tickets nuevos siguen al mayor número existente (TCK-200029 en la semilla demo).
    op.execute("CREATE SEQUENCE ticket_number_seq START 200030")
    op.execute(
        "SELECT setval('ticket_number_seq', "
        "GREATEST(200029, COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0))) FROM tickets"
    )


def downgrade() -> None:
    op.execute("DROP SEQUENCE ticket_number_seq")
