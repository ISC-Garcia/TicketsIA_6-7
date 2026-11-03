import os
import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
import joblib
import pandas as pd

# Importaciones de la Base de Datos
from database import engine, get_db
import models
from models import TicketDB, EventDB

# Crear las tablas en PostgreSQL si no existen al arrancar
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Tickets de Soporte Técnico API",
    description="API REST en Python con integración de ML y PostgreSQL",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# CARGA DEL MODELO DE MACHINE LEARNING
# -----------------------------------------------------------------------------
MODEL_PATHS = [
    os.path.join(os.path.dirname(__file__), "modelo_tickets.joblib"),
    os.path.join(os.path.dirname(__file__), "scripts_ml", "modelo_tickets.joblib"),
    os.path.join(os.path.dirname(__file__), "..", "modelo_tickets.joblib"),
]

ml_model = None
for path in MODEL_PATHS:
    if os.path.exists(path):
        try:
            ml_model = joblib.load(path)
            print(f"[INFO] Modelo de ML cargado exitosamente desde: {path}")
            break
        except Exception as e:
            pass

# -----------------------------------------------------------------------------
# MODELOS DE DATOS (PYDANTIC)
# -----------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    name: str
    username: str
    role: str
    active: bool

class AnalysisModel(BaseModel):
    confidence: float
    probabilities: Dict[str, float] = {}
    sentiment: str
    intent: str
    keywords: List[str] = []
    devices: List[str] = []
    errorCodes: List[str] = []

class TicketCreateRequest(BaseModel):
    area: str
    reporter: str
    description: str
    device: Optional[str] = None

class FieldChangeModel(BaseModel):
    field: str
    oldValue: str
    newValue: str

class TicketUpdateRequest(BaseModel):
    priority: Optional[str] = None
    status: Optional[str] = None
    technician: Optional[str] = None
    device: Optional[str] = None
    solution: Optional[str] = None
    resolutionHours: Optional[float] = None
    updatedBy: str

class TicketModel(BaseModel):
    id: str
    priority: str
    area: str
    device: str
    department: str
    status: str
    createdAt: datetime
    reporter: str
    technician: str
    summary: str
    description: str
    analysis: Optional[Dict[str, Any]] = None
    resolutionHours: Optional[float] = None
    resolvedAt: Optional[datetime] = None
    resolvedBy: Optional[str] = None
    solution: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True) # Permite leer desde SQLAlchemy

class EventModel(BaseModel):
    id: int
    time: datetime
    user_name: str
    type: str
    ticketId: Optional[str] = None
    detail: Optional[str] = None
    changes: Optional[List[Dict[str, str]]] = None
    
    model_config = ConfigDict(from_attributes=True)

# Usuarios en RAM (Se pueden migrar a BD después si lo desean)
USERS_DB = [
    {"name": "Roberto García Hernández", "username": "tecnico", "role": "tecnico", "active": True, "password": "demo2026"},
    {"name": "Sarely Xala Hernández", "username": "sxala", "role": "tecnico", "active": True, "password": "demo2026"},
    {"name": "Francisco Alejandro Parra Huerta", "username": "coordinador", "role": "coordinador", "active": True, "password": "demo2026"},
    {"name": "Luis Daniel Morales Villarauz", "username": "auditor", "role": "auditor", "active": True, "password": "demo2026"},
]

# -----------------------------------------------------------------------------
# PROCESAMIENTO DE PNL Y PREDICCIÓN ML
# -----------------------------------------------------------------------------
def analyze_text_nlp(description: str, area_solicitante: str, specified_device: Optional[str] = None):
    text_lower = description.lower()
    
    error_codes = [err for err in ["DEADLOCK_DB", "SSL_EXPIRED", "HIGH_LATENCY"] if err.lower() in text_lower]
    detected_devices = []
    
    if any(k in text_lower for k in ["vpn", "red"]): department = "Redes y Conectividad"
    elif any(k in text_lower for k in ["servidor", "cluster"]): department = "Infraestructura Cloud"
    else: department = "Soporte de Aplicaciones"

    device = specified_device if specified_device else "Estación de Trabajo"
    sentiment = "Negativo" if "urgente" in text_lower or "caída" in text_lower else "Neutral"
    
    priority, confidence = "Media", 80.0
    probs = {"Crítica": 10.0, "Alta": 10.0, "Media": 75.0, "Baja": 5.0}

    if ml_model is not None:
        try:
            input_df = pd.DataFrame([{'descripcion_problema': description, 'area_solicitante': area_solicitante, 'dispositivo_afectado': device, 'departamento_asignado': department, 'sentimiento': sentiment}])
            priority = str(ml_model.predict(input_df)[0])
        except Exception:
            pass

    return priority, department, device, {
        "confidence": confidence,
        "probabilities": probs,
        "sentiment": sentiment,
        "intent": "Reporte de incidente",
        "keywords": ["soporte", "sistema"],
        "devices": [device],
        "errorCodes": error_codes
    }

# -----------------------------------------------------------------------------
# ENDPOINTS REST API
# -----------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "db": "PostgreSQL Activa"}

@app.post("/api/auth/login", response_model=UserResponse)
def login(req: LoginRequest):
    user = next((u for u in USERS_DB if u["username"].lower() == req.username.strip().lower()), None)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    return user

@app.get("/api/tickets")
def get_tickets(
    db: Session = Depends(get_db),
    priority: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1)
):
    query = db.query(TicketDB)

    if status == "Resuelto": query = query.filter(TicketDB.status == "Resuelto")
    elif status: query = query.filter(TicketDB.status == status)
    else: query = query.filter(TicketDB.status != "Resuelto")

    if priority: query = query.filter(TicketDB.priority == priority)
    
    if search:
        s = f"%{search.lower()}%"
        query = query.filter(or_(TicketDB.id.ilike(s), TicketDB.summary.ilike(s), TicketDB.description.ilike(s)))

    total = query.count()
    tickets = query.order_by(desc(TicketDB.createdAt)).offset((page - 1) * pageSize).limit(pageSize).all()
    
    return {"items": tickets, "total": total}

@app.get("/api/tickets/{ticket_id}", response_model=TicketModel)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id.upper()).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket no encontrado.")
    return ticket

@app.post("/api/tickets", response_model=TicketModel, status_code=status.HTTP_201_CREATED)
def create_ticket(req: TicketCreateRequest, db: Session = Depends(get_db)):
    total = db.query(TicketDB).count()
    new_id = f"TCK-{200000 + total + 1}"
    
    priority, department, device, analysis = analyze_text_nlp(req.description, req.area, req.device)
    summary = req.description[:60] + "..."
    
    new_ticket = TicketDB(
        id=new_id, priority=priority, area=req.area, device=device, department=department,
        status="Abierto", reporter=req.reporter, technician="Roberto García Hernández",
        summary=summary, description=req.description, analysis=analysis
    )
    db.add(new_ticket)
    
    ev1 = EventDB(user_name=req.reporter, type="Ticket creado", ticketId=new_id, detail=f"Reportado por {req.reporter}")
    ev2 = EventDB(user_name="Sistema ML", type="Clasificado por IA", ticketId=new_id, detail=f"Prioridad {priority}")
    db.add_all([ev1, ev2])
    
    db.commit()
    db.refresh(new_ticket)
    return new_ticket

@app.put("/api/tickets/{ticket_id}", response_model=TicketModel)
def update_ticket(ticket_id: str, req: TicketUpdateRequest, db: Session = Depends(get_db)):
    ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id.upper()).first()
    if not ticket: raise HTTPException(status_code=404)

    changes = []
    
    if req.status and req.status != ticket.status:
        ticket.status = req.status
        if req.status == "Resuelto":
            ticket.resolvedAt = datetime.now()
            ticket.resolvedBy = req.updatedBy
            ticket.solution = req.solution
            ticket.resolutionHours = req.resolutionHours
            db.add(EventDB(user_name=req.updatedBy, type="Ticket resuelto", ticketId=ticket.id, detail="Resuelto"))
        else:
            db.add(EventDB(user_name=req.updatedBy, type="Cambio de estado", ticketId=ticket.id, detail=f"A {req.status}"))

    if req.priority and req.priority != ticket.priority:
        changes.append({"field": "Prioridad", "oldValue": ticket.priority, "newValue": req.priority})
        ticket.priority = req.priority

    if req.technician and req.technician != ticket.technician:
        db.add(EventDB(user_name=req.updatedBy, type="Reasignación", ticketId=ticket.id, detail=f"A {req.technician}"))
        ticket.technician = req.technician

    if changes:
        db.add(EventDB(user_name=req.updatedBy, type="Edición de datos", ticketId=ticket.id, detail="Edición", changes=changes))

    db.commit()
    db.refresh(ticket)
    return ticket

@app.get("/api/events")
def get_events(ticketId: Optional[str] = None, page: int = Query(1, ge=1), pageSize: int = Query(10, ge=1), db: Session = Depends(get_db)):
    query = db.query(EventDB)
    if ticketId: query = query.filter(EventDB.ticketId.ilike(f"%{ticketId}%"))
    
    total = query.count()
    events = query.order_by(desc(EventDB.time)).offset((page - 1) * pageSize).limit(pageSize).all()
    return {"items": events, "total": total}

@app.get("/api/tickets/{ticket_id}/events", response_model=List[EventModel])
def get_ticket_events(ticket_id: str, db: Session = Depends(get_db)):
    return db.query(EventDB).filter(EventDB.ticketId == ticket_id.upper()).order_by(EventDB.time).all()

# Metricas y Base de datos simuladas para Vista Coordinador
@app.get("/api/model/metrics")
def get_model_metrics(): return {"accuracy": 95.2}

@app.get("/api/model/info")
def get_model_info(): return {"status": "PostgreSQL Operativo"}