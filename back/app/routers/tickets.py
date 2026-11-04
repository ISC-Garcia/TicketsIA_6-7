from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import StringConstraints

from app.auth import require_roles
from app.config import SettingsDep
from app.db import DbDep
from app.ml.classify import Classification, classify
from app.ml.model import ModelState
from app.models import User
from app.schemas import ApiModel, Page
from app.services import tickets as service
from app.services.tickets import EventOut, TicketDate, TicketOut

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

NOT_FOUND = "Ticket no encontrado."
MAX_PAGE_SIZE = 100

Priority = Literal["Crítica", "Alta", "Media", "Baja"]
Status = Literal["Abierto", "En atención", "Resuelto"]
Department = Literal[
    "Infraestructura Cloud",
    "Seguridad Informática",
    "Redes y Conectividad",
    "Hardware y Soporte Local",
    "Soporte de Aplicaciones",
]

Area = Literal["Ventas", "Contabilidad", "Recursos Humanos", "Sistemas", "Operaciones", "Dirección"]
MODEL_UNAVAILABLE = "El modelo de clasificación no está disponible. Avisa al administrador."


class TicketDraft(ApiModel):
    """Lo que captura el técnico. Las reglas son las del prototipo."""

    area: Area
    reporter: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=20, max_length=1000)
    ]
    device: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None


class AnalysisOut(ApiModel):
    priority: str
    department: str
    device: str
    # True si el dispositivo no se escribió y se tomó de la descripción.
    device_detected: bool
    highlights: list[str]
    analysis: dict[str, Any]


# Las bandejas son del técnico y del coordinador; el detalle también lo consulta el auditor.
inbox_roles = Depends(require_roles("tecnico", "coordinador"))
detail_roles = Depends(require_roles("tecnico", "coordinador", "auditor"))
technician_only = Depends(require_roles("tecnico"))


def classify_draft(request: Request, draft: TicketDraft) -> Classification:
    model: ModelState = request.app.state.model
    if model.pipeline is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=MODEL_UNAVAILABLE)
    return classify(model.pipeline, draft.description, draft.area, draft.device)


@router.post("/analyze", dependencies=[technician_only])
def analyze_ticket(request: Request, draft: TicketDraft) -> AnalysisOut:
    """Clasifica la captura sin guardarla, para que el técnico revise antes de confirmar."""
    result = classify_draft(request, draft)
    return AnalysisOut(
        priority=result.priority,
        department=result.department,
        device=result.device,
        device_detected=result.device_detected,
        highlights=result.entities.highlights,
        analysis=result.analysis(),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model_exclude_none=True)
def create_ticket(
    request: Request,
    draft: TicketDraft,
    user: Annotated[User, technician_only],
    db: DbDep,
    settings: SettingsDep,
) -> TicketOut:
    # Se vuelve a clasificar en el servidor: no se confía en el análisis que mostró el front.
    result = classify_draft(request, draft)
    ticket = service.register_ticket(
        db,
        settings,
        user,
        area=draft.area,
        reporter=draft.reporter,
        description=draft.description,
        result=result,
    )
    created = service.get_ticket(db, ticket.id)
    assert created is not None
    return service.ticket_out(created, settings)


@router.get("", dependencies=[inbox_roles], response_model_exclude_none=True)
def list_tickets(
    db: DbDep,
    settings: SettingsDep,
    priority: Priority | None = None,
    department: Department | None = None,
    status: Status | None = None,
    date: TicketDate | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=MAX_PAGE_SIZE)] = 25,
) -> Page[TicketOut]:
    items, total = service.list_tickets(
        db,
        settings,
        page,
        page_size,
        priority=priority,
        department=department,
        status=status,
        date=date,
        search=search,
    )
    return Page(items=items, total=total)


@router.get("/counts", dependencies=[inbox_roles])
def count_tickets(db: DbDep, resolved: bool = False) -> dict[str, int]:
    return service.count_by_priority(db, resolved)


@router.get("/{ticket_id}", dependencies=[detail_roles], response_model_exclude_none=True)
def get_ticket(ticket_id: str, db: DbDep, settings: SettingsDep) -> TicketOut:
    ticket = service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return service.ticket_out(ticket, settings)


@router.get("/{ticket_id}/events", dependencies=[detail_roles], response_model_exclude_none=True)
def get_ticket_events(ticket_id: str, db: DbDep, settings: SettingsDep) -> list[EventOut]:
    ticket = service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return [service.event_out(event, settings) for event in service.ticket_events(db, ticket.id)]
