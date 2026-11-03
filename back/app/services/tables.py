"""Estructura real de la base para el auditor (E9-02): filas, tamaño y descripciones."""

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

TABLES = text(
    """
    SELECT c.relname AS name,
           obj_description(c.oid, 'pg_class') AS description,
           pg_total_relation_size(c.oid) AS size_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'alembic_version'
    ORDER BY pg_total_relation_size(c.oid) DESC, c.relname
    """
)

COLUMNS = text(
    """
    SELECT a.attrelid::regclass::text AS table_name,
           a.attname AS name,
           format_type(a.atttypid, a.atttypmod) AS type,
           col_description(a.attrelid, a.attnum) AS description
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attrelid, a.attnum
    """
)

# PostgreSQL no guarda cuándo cambió una tabla: se toma la fecha más reciente de sus datos.
# En los tickets cuenta también su último evento, porque cada cambio deja uno en la bitácora.
LAST_CHANGE = {
    "tickets": """SELECT GREATEST(
        (SELECT max(created_at) FROM tickets),
        (SELECT max(resolved_at) FROM tickets),
        (SELECT max(time) FROM events WHERE ticket_id IS NOT NULL))""",
    "events": "SELECT max(time) FROM events",
    "users": "SELECT max(created_at) FROM users",
    "database_samples": "SELECT max(time) FROM database_samples",
    "backups": "SELECT max(started_at) FROM backups",
}


def last_change(db: Session, table: str) -> datetime | None:
    query = LAST_CHANGE.get(table)
    return db.scalar(text(query)) if query else None


def list_tables(db: Session) -> list[dict]:
    columns: dict[str, list[dict]] = {}
    for row in db.execute(COLUMNS):
        columns.setdefault(row.table_name, []).append(
            {"name": row.name, "type": row.type, "description": row.description}
        )
    tables = []
    for row in db.execute(TABLES).all():
        # El nombre sale del catálogo, no del usuario: se puede usar en la consulta.
        rows = db.scalar(text(f'SELECT count(*) FROM "{row.name}"'))
        tables.append(
            {
                "name": row.name,
                "description": row.description,
                "rows": rows,
                "size_bytes": row.size_bytes,
                "modified_at": last_change(db, row.name),
                "columns": columns.get(row.name, []),
            }
        )
    return tables
