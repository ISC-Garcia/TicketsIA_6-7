import hashlib
from datetime import timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.integrity import digest_of, verify_backup, verify_table
from app.models import Backup, Event, Ticket
from app.seeds.full import seed_full
from app.services.monitoring import wall_clock
from tests.conftest import NOW, auth_headers
from tests.factories import make_ticket

RESOLUTION = {"solution": "Se reinició el nodo y se liberó el bloqueo.", "resolutionHours": 1.75}


def integrity(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.get("/api/database/integrity", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_e9_05_la_semilla_deja_todas_las_huellas_al_dia(client: TestClient, demo: Session) -> None:
    body = integrity(client, auth_headers(client, "auditor"))

    assert body["tables"] == [
        {"name": "tickets", "verified": 9, "mismatched": 0, "examples": []},
        # Los 31 eventos de la semilla y el inicio de sesión del auditor.
        {"name": "events", "verified": 32, "mismatched": 0, "examples": []},
    ]
    assert body["backups"] == []


def test_e9_05_cada_escritura_de_la_api_actualiza_la_huella(
    client: TestClient, demo: Session
) -> None:
    roberto = auth_headers(client, "tecnico")
    coordinator = auth_headers(client, "coordinador")
    client.post("/api/tickets/TCK-200003/attend", headers=roberto)
    client.post("/api/tickets/TCK-200003/resolve", json=RESOLUTION, headers=roberto)
    client.patch("/api/tickets/TCK-200003/resolution", json={"resolutionHours": 2}, headers=roberto)
    client.post("/api/tickets/TCK-200007/assign", json={"technician": "sxala"}, headers=coordinator)

    demo.expire_all()
    assert verify_table(demo, Ticket)["mismatched"] == 0
    assert verify_table(demo, Event)["mismatched"] == 0


def test_e9_05_los_valores_por_omision_cuentan_en_la_huella(db: Session) -> None:
    ticket = make_ticket(id="TCK-900010")
    del ticket.status, ticket.highlights
    ticket.status = None  # pyright: ignore[reportAttributeAccessIssue]
    db.add(ticket)
    db.commit()

    assert ticket.status == "Abierto"
    assert ticket.content_sha256 == digest_of(ticket)
    assert verify_table(db, Ticket)["mismatched"] == 0


def test_e9_05_la_semilla_completa_tambien_lleva_huella(
    db: Session, settings: Settings, trained: Path
) -> None:
    seed_full(db, NOW.tzinfo, trained, NOW)  # pyright: ignore[reportArgumentType]

    report = verify_table(db, Ticket)
    assert report["verified"] > 9
    assert report["mismatched"] == 0


def test_e9_05_detecta_un_cambio_hecho_por_fuera_de_la_api(
    client: TestClient, demo: Session
) -> None:
    response = client.post("/api/test/tamper/TCK-115796")
    assert response.status_code == 204
    demo.execute(text("UPDATE events SET detail = 'otro' WHERE id = 3"))
    demo.commit()

    tables = integrity(client, auth_headers(client, "auditor"))["tables"]

    assert tables[0] == {
        "name": "tickets",
        "verified": 9,
        "mismatched": 1,
        "examples": ["TCK-115796"],
    }
    assert tables[1]["examples"] == ["EV-3"]


def test_e9_05_el_endpoint_de_pruebas_avisa_si_no_existe_el_ticket(client: TestClient) -> None:
    assert client.post("/api/test/tamper/TCK-000001").status_code == 404


def test_e9_05_revisa_los_archivos_de_los_respaldos_exitosos(
    client: TestClient, demo: Session, settings: Settings
) -> None:
    folder = settings.backup_folder
    folder.mkdir(parents=True, exist_ok=True)
    now = wall_clock(NOW.tzinfo)  # pyright: ignore[reportArgumentType]

    def stored(name: str, content: bytes | None, sha: str) -> Backup:
        if content is not None:
            (folder / name).write_bytes(content)
        return Backup(
            started_at=now - timedelta(minutes=len(name)),
            duration_seconds=1,
            status="Exitoso",
            file_name=name,
            size_bytes=1,
            sha256=sha,
        )

    good = hashlib.sha256(b"original").hexdigest()
    demo.add_all(
        [
            stored("bueno.dump", b"original", good),
            stored("cambiado.dump", b"modificado", good),
            stored("perdido.dump", None, good),
            Backup(started_at=now, duration_seconds=1, status="Fallido", file_name="fallido.dump"),
        ]
    )
    demo.commit()

    backups = integrity(client, auth_headers(client, "auditor"))["backups"]

    results = {item["fileName"]: item["result"] for item in backups}
    assert results == {
        "bueno.dump": "Íntegro",
        "cambiado.dump": "Alterado",
        "perdido.dump": "No encontrado",
    }
    for name in ("bueno.dump", "cambiado.dump"):
        (folder / name).unlink()


def test_e9_05_un_respaldo_sin_archivo_no_se_da_por_bueno(tmp_path: Path) -> None:
    backup = Backup(file_name="x.dump", sha256="0" * 64)

    assert verify_backup(backup, tmp_path) == "No encontrado"


def test_e9_05_un_evento_nuevo_tiene_huella_antes_de_tener_id(db: Session) -> None:
    db.add(make_ticket())
    db.flush()
    event = Event(time=NOW, user_name="Sistema", type="Ticket creado", ticket_id="TCK-900001")
    db.add(event)
    db.commit()

    assert event.content_sha256 == digest_of(event)
