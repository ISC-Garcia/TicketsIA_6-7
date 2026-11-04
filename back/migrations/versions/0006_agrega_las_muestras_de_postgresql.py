"""agrega las muestras de postgresql

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-03 09:41:28.944257

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "database_samples",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("connections", sa.Integer(), nullable=False),
        sa.Column("transactions", sa.BigInteger(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_database_samples_time", "database_samples", ["time"], unique=False)
    # Las consultas lentas salen de pg_stat_statements. Si el servidor no permite instalarla
    # (falta permiso o no está en shared_preload_libraries), el monitoreo lo informa sin fallar.
    op.execute(
        """
        DO $$
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_stat_statements no está disponible: %', SQLERRM;
        END
        $$
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_database_samples_time", table_name="database_samples")
    op.drop_table("database_samples")
