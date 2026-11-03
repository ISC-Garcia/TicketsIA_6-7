import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import cli
from app.config import Settings
from app.models import Ticket
from app.seeds.full import (
    BATCH_SIZE,
    DATASET_FILE,
    MAX_PARAMETERS,
    MissingDatasetError,
    historic_rows,
    seed_full,
    summarize,
)
from tests.conftest import NOW

FIXTURE = Path(__file__).parent / "fixtures" / "dataset_50.csv"


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    shutil.copy(FIXTURE, tmp_path / DATASET_FILE)
    return tmp_path


def test_e0_03_carga_el_historico_como_resuelto(db: Session, data_dir: Path) -> None:
    added = seed_full(db, NOW.tzinfo, data_dir)  # pyright: ignore[reportArgumentType]

    # 50 filas: una repite ID y otra es TCK-115796, que ya trae la semilla demo.
    assert added == 48
    assert db.scalar(select(func.count()).select_from(Ticket)) == 57
    open_count = db.scalar(select(func.count()).where(Ticket.status != "Resuelto"))
    assert open_count == 8


def test_e0_03_calcula_la_fecha_de_resolucion(db: Session, data_dir: Path) -> None:
    seed_full(db, NOW.tzinfo, data_dir)  # pyright: ignore[reportArgumentType]

    ticket = db.get(Ticket, "TCK-197414")
    assert ticket is not None
    assert ticket.status == "Resuelto"
    assert ticket.reporter == "Sin registro"
    assert ticket.technician_username is None
    assert ticket.analysis is None
    assert ticket.resolution_hours == 34.12
    # 2026-04-03 08:57:12 en la Ciudad de México son las 14:57:12 UTC.
    assert ticket.created_at == datetime(2026, 4, 3, 14, 57, 12, tzinfo=UTC)
    assert ticket.resolved_at == ticket.created_at + timedelta(hours=34.12)


def test_e0_03_conserva_la_version_demo_de_un_id_repetido(db: Session, data_dir: Path) -> None:
    seed_full(db, NOW.tzinfo, data_dir)  # pyright: ignore[reportArgumentType]

    ticket = db.get(Ticket, "TCK-115796")
    assert ticket is not None
    assert ticket.device == "Switch de núcleo"
    duplicated = db.get(Ticket, "TCK-113344")
    assert duplicated is not None
    assert duplicated.priority == "Crítica"


def test_e0_03_se_puede_repetir_sin_duplicar(db: Session, data_dir: Path) -> None:
    seed_full(db, NOW.tzinfo, data_dir)  # pyright: ignore[reportArgumentType]
    seed_full(db, NOW.tzinfo, data_dir)  # pyright: ignore[reportArgumentType]

    assert db.scalar(select(func.count()).select_from(Ticket)) == 57


def test_e0_03_avisa_si_falta_el_csv(db: Session, tmp_path: Path) -> None:
    with pytest.raises(MissingDatasetError, match=r"No se encontró .*tickets_soporte_procesado"):
        seed_full(db, NOW.tzinfo, tmp_path)  # pyright: ignore[reportArgumentType]


def test_e0_03_el_comando_informa_cuantos_cargo(
    db: Session, settings: Settings, data_dir: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cli.main(["seed", "completo"], settings.model_copy(update={"data_dir": data_dir}))

    assert "demo y 48 tickets históricos" in capsys.readouterr().out


def test_e0_03_el_comando_sin_csv_termina_con_el_aviso(
    db: Session, settings: Settings, tmp_path: Path
) -> None:
    with pytest.raises(SystemExit, match="No se encontró"):
        cli.main(["seed", "completo"], settings.model_copy(update={"data_dir": tmp_path}))


def test_e0_03_cada_lote_cabe_en_una_consulta(data_dir: Path) -> None:
    row = next(historic_rows(data_dir / DATASET_FILE, NOW.tzinfo))  # pyright: ignore[reportArgumentType]

    assert BATCH_SIZE * len(row) <= MAX_PARAMETERS


@pytest.mark.parametrize(
    ("description", "summary"),
    [
        ("Texto corto.", "Texto corto."),
        (
            "Tengo problemas para utilizar la Paquetería Office en mi estación de trabajo.",
            "Tengo problemas para utilizar la Paquetería Office en mi…",
        ),
    ],
)
def test_e0_03_el_resumen_corta_en_una_palabra(description: str, summary: str) -> None:
    assert summarize(description) == summary
