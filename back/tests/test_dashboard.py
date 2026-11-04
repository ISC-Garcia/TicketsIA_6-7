from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.dashboard import buckets
from tests.conftest import NOW, auth_headers
from tests.factories import make_ticket


@pytest.fixture
def coordinator(client: TestClient, demo: Session) -> dict[str, str]:
    return auth_headers(client, "coordinador")


def dashboard(client: TestClient, headers: dict[str, str], period: str = "mes") -> dict:
    response = client.get("/api/dashboard", params={"period": period}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_e6_01_la_tendencia_semanal_cuenta_por_dia_local(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    trend = dashboard(client, coordinator, "semana")["trend"]

    assert trend["subtitle"] == "Última semana, por día"
    assert trend["labels"] == ["Jue 22", "Vie 23", "Sáb 24", "Dom 25", "Lun 26", "Mar 27", "Mié 28"]
    # TCK-200029 es del lunes 26, tres del martes 27 y cuatro del miércoles 28.
    assert trend["created"] == [0, 0, 0, 0, 1, 3, 4]
    assert trend["resolved"] == [0] * 7


def test_e6_01_la_tendencia_mensual_usa_semanas_iso(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    trend = dashboard(client, coordinator)["trend"]

    assert trend["labels"] == ["S40", "S41", "S42", "S43", "S44"]
    assert trend["created"] == [0, 0, 0, 0, 8]


def test_e6_01_la_tendencia_anual_cuenta_creados_y_resueltos_por_mes(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    trend = dashboard(client, coordinator, "año")["trend"]

    assert trend["labels"] == [
        "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct",
    ]  # fmt: skip
    # TCK-115796 se creó y se resolvió en diciembre de 2025.
    assert trend["created"][1] == 1
    assert trend["resolved"][1] == 1
    assert trend["created"][-1] == 8


def test_e6_01_los_kpi_salen_de_la_base(client: TestClient, coordinator: dict[str, str]) -> None:
    kpis = dashboard(client, coordinator)["kpis"]

    assert kpis == {
        "openTickets": 8,
        "openTicketsBefore": 0,
        "criticalOpen": 2,
        "criticalOpenBefore": 0,
        "averageResolutionHours": None,
        "averageResolutionHoursBefore": None,
        "slaCompliance": None,
        "slaComplianceBefore": None,
    }


def test_e6_01_tiempo_y_sla_de_los_ultimos_30_dias(
    client: TestClient, coordinator: dict[str, str], demo: Session
) -> None:
    resolved = NOW - timedelta(days=2)
    demo.add_all(
        [
            # Crítica en 3 h: cumple su SLA de 4 h.
            make_ticket(
                id="TCK-900001",
                priority="Crítica",
                status="Resuelto",
                created_at=resolved - timedelta(hours=3),
                resolved_at=resolved,
                resolution_hours=3,
            ),
            # Alta en 20 h: incumple su SLA de 12 h.
            make_ticket(
                id="TCK-900002",
                priority="Alta",
                status="Resuelto",
                created_at=resolved - timedelta(hours=20),
                resolved_at=resolved,
                resolution_hours=20,
            ),
            # Resuelto hace 40 días: cuenta para la ventana anterior.
            make_ticket(
                id="TCK-900003",
                priority="Media",
                status="Resuelto",
                created_at=NOW - timedelta(days=41),
                resolved_at=NOW - timedelta(days=40),
                resolution_hours=24,
            ),
        ]
    )
    demo.commit()

    kpis = dashboard(client, coordinator)["kpis"]

    assert (kpis["averageResolutionHours"], kpis["slaCompliance"]) == (11.5, 50.0)
    assert (kpis["averageResolutionHoursBefore"], kpis["slaComplianceBefore"]) == (24.0, 100.0)


def test_e6_01_abiertos_hace_una_semana_incluye_lo_resuelto_despues(
    client: TestClient, coordinator: dict[str, str], demo: Session
) -> None:
    demo.add(
        make_ticket(
            id="TCK-900004",
            priority="Crítica",
            status="Resuelto",
            created_at=NOW - timedelta(days=10),
            resolved_at=NOW - timedelta(days=2),
            resolution_hours=192,
        )
    )
    demo.commit()

    kpis = dashboard(client, coordinator)["kpis"]

    assert (kpis["openTicketsBefore"], kpis["criticalOpenBefore"]) == (1, 1)
    assert (kpis["openTickets"], kpis["criticalOpen"]) == (8, 2)


def test_e6_01_distribuciones_y_tiempo_contra_sla(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    body = dashboard(client, coordinator)

    assert body["byPriority"] == [
        {"label": "Crítica", "count": 2},
        {"label": "Alta", "count": 3},
        {"label": "Media", "count": 2},
        {"label": "Baja", "count": 2},
    ]
    assert body["total"] == 9
    counts = [row["count"] for row in body["byDepartment"]]
    assert counts == sorted(counts, reverse=True)
    assert sum(counts) == 9
    assert body["resolutionVsSla"] == [
        {"priority": "Crítica", "averageHours": None, "slaHours": 4},
        {"priority": "Alta", "averageHours": 2.0, "slaHours": 12},
        {"priority": "Media", "averageHours": None, "slaHours": 48},
        {"priority": "Baja", "averageHours": None, "slaHours": 96},
    ]


def test_e6_01_lista_los_criticos_sin_resolver_del_mas_antiguo(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    critical = dashboard(client, coordinator)["critical"]

    assert [ticket["id"] for ticket in critical] == ["TCK-200007", "TCK-200003"]
    assert critical[0]["technician"] == "Roberto García Hernández"


def test_e6_01_un_periodo_desconocido_responde_422(
    client: TestClient, coordinator: dict[str, str]
) -> None:
    response = client.get("/api/dashboard", params={"period": "dia"}, headers=coordinator)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("now", "first", "last"),
    [
        (datetime(2026, 2, 15, 9, 0), ("Mar", datetime(2025, 3, 1)), ("Feb", datetime(2026, 2, 1))),
        (datetime(2026, 1, 3, 9, 0), ("Feb", datetime(2025, 2, 1)), ("Ene", datetime(2026, 1, 1))),
    ],
)
def test_e6_01_los_meses_cruzan_el_cambio_de_año(
    now: datetime, first: tuple[str, datetime], last: tuple[str, datetime]
) -> None:
    unit, cuts = buckets("año", now)

    assert unit == "month"
    assert len(cuts) == 12
    assert (cuts[0].label, cuts[0].start) == first
    assert (cuts[-1].label, cuts[-1].start) == last
