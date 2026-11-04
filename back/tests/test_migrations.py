import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import BACK_DIR
from tests.factories import make_ticket


def test_e0_02_la_migracion_crea_las_tablas_con_sus_indices(migrated: Engine) -> None:
    inspector = inspect(migrated)

    assert {"users", "tickets", "events", "alembic_version"} <= set(inspector.get_table_names())
    indexes = {index["name"] for index in inspector.get_indexes("tickets")}
    assert {"ix_tickets_bandeja", "ix_tickets_department", "ix_tickets_created_at"} <= indexes
    columns = {column["name"] for column in inspector.get_columns("tickets")}
    assert {"created_at", "technician_username", "resolution_hours"} <= columns


def test_e0_02_la_base_queda_en_la_ultima_migracion(migrated: Engine) -> None:
    with migrated.connect() as connection:
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()

    head = ScriptDirectory.from_config(Config(BACK_DIR / "alembic.ini")).get_current_head()
    assert version == head


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("priority", "Urgente"),
        ("status", "En proceso"),
        ("department", "Mesa de ayuda"),
        ("area", "Marketing"),
    ],
)
def test_e0_02_la_base_rechaza_valores_fuera_de_catalogo(
    db: Session, field: str, value: str
) -> None:
    db.add(make_ticket(**{field: value}))

    with pytest.raises(IntegrityError):
        db.commit()
