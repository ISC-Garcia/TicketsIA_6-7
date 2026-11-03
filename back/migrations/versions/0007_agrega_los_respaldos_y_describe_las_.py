"""agrega los respaldos y describe las tablas

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-03 10:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Las descripciones que el auditor lee en Monitoreo > Tablas. Viven en la base como COMMENT ON
# para que cualquier herramienta de PostgreSQL las muestre igual.
TABLES = {
    "users": (
        "Cuentas que pueden entrar al sistema, con su rol y su estado.",
        {
            "id": "Identificador interno",
            "username": "Usuario para iniciar sesión",
            "name": "Nombre completo",
            "role": "Rol: tecnico, coordinador o auditor",
            "active": "Falso si la cuenta está desactivada",
            "created_at": "Momento en que se creó la cuenta",
            "password_hash": "Contraseña cifrada con argon2",
            "must_change_password": "Verdadero si debe cambiar la contraseña temporal",
        },
    ),
    "tickets": (
        "Cada ticket de soporte: lo que se capturó, la clasificación de la IA y su atención.",
        {
            "id": "Identificador del ticket, como TCK-200003",
            "priority": "Prioridad: Crítica, Alta, Media o Baja",
            "priority_rank": "Orden de la prioridad para la bandeja, calculado",
            "area": "Área que reporta el problema",
            "device": "Dispositivo reportado o detectado en la descripción",
            "department": "Departamento que atiende",
            "status": "Estado: Abierto, En atención o Resuelto",
            "created_at": "Momento del registro",
            "reporter": "Persona que reporta",
            "technician_username": "Técnico asignado",
            "summary": "Resumen corto de la descripción",
            "description": "Descripción que analiza la IA",
            "highlights": "Fragmentos que la IA resaltó",
            "analysis": "Resultado completo del análisis de la IA",
            "resolution_hours": "Horas que tomó resolverlo",
            "resolved_at": "Momento en que se resolvió",
            "resolved_by_username": "Técnico que lo resolvió",
            "solution": "Solución aplicada",
            "edited_after_close": "Verdadero si se corrigió después de resolverse",
        },
    ),
    "events": (
        "Bitácora: cada acción sobre el sistema, en orden cronológico.",
        {
            "id": "Identificador del evento",
            "time": "Momento del evento",
            "user_name": "Quién hizo la acción, o Sistema",
            "type": "Tipo de evento",
            "ticket_id": "Ticket relacionado, si lo hay",
            "detail": "Detalle del evento",
            "changes": "Campos modificados, con su valor anterior y nuevo",
            "after_close": "Verdadero si la edición fue posterior al cierre",
            "solution": "Solución registrada al resolver",
        },
    ),
    "database_samples": (
        "Mediciones de PostgreSQL que la API guarda cada pocos minutos para el monitoreo.",
        {
            "id": "Identificador de la medición",
            "time": "Momento de la medición",
            "connections": "Conexiones activas a la base",
            "transactions": "Transacciones acumuladas desde que arrancó el servidor",
            "size_bytes": "Tamaño de la base en bytes",
        },
    ),
    "backups": (
        "Respaldos con pg_dump que se ejecutaron, exitosos o fallidos.",
        {
            "id": "Identificador del respaldo",
            "started_at": "Momento en que empezó",
            "duration_seconds": "Segundos que tardó",
            "status": "Exitoso o Fallido",
            "file_name": "Nombre del archivo de respaldo",
            "size_bytes": "Tamaño del archivo en bytes",
            "sha256": "Huella SHA-256 del archivo",
            "detail": "Motivo de la falla, si falló",
            "retry_of_id": "Respaldo fallido que este repite",
        },
    ),
}


def quote(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "backups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Double(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("file_name", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("retry_of_id", sa.Integer(), nullable=True),
        sa.CheckConstraint("status IN ('Exitoso', 'Fallido')", name="estado_valido"),
        sa.ForeignKeyConstraint(["retry_of_id"], ["backups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_backups_started_at", "backups", ["started_at"], unique=False)

    for table, (description, columns) in TABLES.items():
        op.execute(f"COMMENT ON TABLE {table} IS {quote(description)}")
        for column, text in columns.items():
            op.execute(f"COMMENT ON COLUMN {table}.{column} IS {quote(text)}")


def downgrade() -> None:
    """Downgrade schema."""
    for table, (_, columns) in TABLES.items():
        if table == "backups":
            continue
        op.execute(f"COMMENT ON TABLE {table} IS NULL")
        for column in columns:
            op.execute(f"COMMENT ON COLUMN {table}.{column} IS NULL")
    op.drop_index("ix_backups_started_at", table_name="backups")
    op.drop_table("backups")
