import hashlib
import shutil
import subprocess
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import cli
from app.config import Settings
from app.models import Backup
from app.services import backups as service
from app.services.monitoring import wall_clock
from tests.conftest import NOW, auth_headers


@pytest.fixture
def auditor(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "auditor")


@pytest.fixture
def in_tmp(settings: Settings, tmp_path: Path) -> Settings:
    return settings.model_copy(update={"backup_dir": tmp_path / "respaldos"})


def fake_pg_dump(content: bytes = b"respaldo", code: int = 0, stderr: str = "") -> service.Runner:
    """Imita a pg_dump: escribe el archivo de --file o falla con un mensaje."""

    def run(command: list[str]) -> subprocess.CompletedProcess[str]:
        if code == 0:
            target = next(arg for arg in command if arg.startswith("--file="))
            Path(target.removeprefix("--file=")).write_bytes(content)
        return subprocess.CompletedProcess(command, code, "", stderr)

    return run


def test_e9_02_las_tablas_traen_filas_tamano_fecha_y_descripciones(
    client: TestClient, auditor: dict[str, str]
) -> None:
    response = client.get("/api/database/tables", headers=auditor)

    assert response.status_code == 200
    tables = {table["name"]: table for table in response.json()}
    assert set(tables) == {"users", "tickets", "events", "database_samples", "backups"}
    tickets = tables["tickets"]
    assert tickets["rows"] == 9
    assert tickets["sizeBytes"] > 0
    assert tickets["description"].startswith("Cada ticket de soporte")
    # Su último cambio es el último evento con ticket: la edición de TCK-200011 a las 10:14:08.
    assert tickets["modifiedAt"] == "2026-10-28 10:14:08"
    column = next(item for item in tickets["columns"] if item["name"] == "priority")
    assert column == {
        "name": "priority",
        "type": "character varying(10)",
        "description": "Prioridad: Crítica, Alta, Media o Baja",
    }
    # Una tabla vacía no tiene fecha de modificación.
    assert "modifiedAt" not in tables["backups"]
    assert tables["users"]["rows"] == 4


def test_e9_02_el_respaldo_guarda_el_archivo_y_su_sha256(in_tmp: Settings, db: Session) -> None:
    attempts = service.run_backup(db, in_tmp, fake_pg_dump(b"datos de la base"))

    assert len(attempts) == 1
    backup = attempts[0]
    assert backup.status == "Exitoso"
    assert backup.size_bytes == len(b"datos de la base")
    assert backup.sha256 == hashlib.sha256(b"datos de la base").hexdigest()
    assert (in_tmp.backup_folder / backup.file_name).exists()


def test_e9_02_un_respaldo_fallido_se_reintenta_una_vez(in_tmp: Settings, db: Session) -> None:
    failing = fake_pg_dump(code=1, stderr="pg_dump: aviso\npg_dump: error: conexión rechazada\n")

    attempts = service.run_backup(db, in_tmp, failing)

    assert [item.status for item in attempts] == ["Fallido", "Fallido"]
    assert attempts[0].detail == "pg_dump: error: conexión rechazada"
    assert attempts[1].retry_of_id == attempts[0].id
    assert not any(in_tmp.backup_folder.iterdir())


def test_e9_02_el_reintento_puede_salir_bien(in_tmp: Settings, db: Session) -> None:
    calls: list[int] = []

    def flaky(command: list[str]) -> subprocess.CompletedProcess[str]:
        calls.append(1)
        runner = fake_pg_dump(code=1) if len(calls) == 1 else fake_pg_dump()
        return runner(command)

    attempts = service.run_backup(db, in_tmp, flaky)

    assert [item.status for item in attempts] == ["Fallido", "Exitoso"]
    assert attempts[0].detail == "pg_dump terminó con error y sin mensaje."


def test_e9_02_sin_pg_dump_lo_registra_como_fallido(in_tmp: Settings, db: Session) -> None:
    missing = in_tmp.model_copy(update={"pg_dump": "/no/existe/pg_dump"})

    attempts = service.run_backup(db, missing)

    assert attempts[0].status == "Fallido"
    assert attempts[0].detail.startswith("No se pudo ejecutar /no/existe/pg_dump")


def test_e9_02_si_pg_dump_no_deja_archivo_es_un_fallo(in_tmp: Settings, db: Session) -> None:
    def silent(command: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(command, 0, "", "")

    attempts = service.run_backup(db, in_tmp, silent)

    assert attempts[0].detail == "pg_dump no generó el archivo."


def test_e9_02_la_lista_trae_los_ultimos_7_dias_del_mas_reciente(
    client: TestClient, auditor: dict[str, str], db: Session
) -> None:
    now = wall_clock(NOW.tzinfo)  # pyright: ignore[reportArgumentType]
    old = Backup(started_at=now - timedelta(days=8), duration_seconds=1, status="Exitoso",
                 file_name="viejo.dump")  # fmt: skip
    failed = Backup(started_at=now - timedelta(hours=2), duration_seconds=0.4, status="Fallido",
                    file_name="a.dump", detail="sin espacio")  # fmt: skip
    db.add_all([old, failed])
    db.flush()
    retry = Backup(started_at=now - timedelta(hours=2) + timedelta(seconds=1), duration_seconds=3,
                   status="Exitoso", file_name="b.dump", size_bytes=10, sha256="ab" * 32,
                   retry_of_id=failed.id)  # fmt: skip
    db.add(retry)
    db.commit()

    response = client.get("/api/database/backups", headers=auditor)

    assert response.status_code == 200
    body = response.json()
    assert [item["fileName"] for item in body] == ["b.dump", "a.dump"]
    assert body[0]["retryOfId"] == failed.id
    assert body[0]["sha256"] == "ab" * 32
    assert body[1] == {
        "id": failed.id,
        "startedAt": body[1]["startedAt"],
        "durationSeconds": 0.4,
        "status": "Fallido",
        "fileName": "a.dump",
        "detail": "sin espacio",
    }


def test_e9_02_el_comando_respalda_e_informa(
    in_tmp: Settings, db: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    cli.main(["backup"], in_tmp, fake_pg_dump(b"x"))

    out = capsys.readouterr().out
    assert out.startswith("Exitoso: tickets-")
    assert hashlib.sha256(b"x").hexdigest() in out
    assert db.scalars(select(Backup)).one().status == "Exitoso"


def test_e9_02_el_comando_falla_si_el_reintento_tambien_falla(in_tmp: Settings) -> None:
    with pytest.raises(SystemExit, match=r"Fallido: .*\(sin permiso\)"):
        cli.main(["backup"], in_tmp, fake_pg_dump(code=1, stderr="sin permiso"))


@pytest.mark.skipif(shutil.which("pg_dump") is None, reason="pg_dump no está instalado")
def test_e9_02_un_respaldo_real_con_pg_dump(in_tmp: Settings, demo: Session) -> None:
    attempt = service.run_backup(demo, in_tmp)[-1]

    # El cliente puede ser más viejo que el servidor (como en el CI); entonces falla con motivo.
    if attempt.status == "Fallido":
        assert attempt.detail
        return
    path = in_tmp.backup_folder / attempt.file_name
    assert attempt.sha256 == hashlib.sha256(path.read_bytes()).hexdigest()
