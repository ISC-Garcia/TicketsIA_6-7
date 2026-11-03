from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from database import Base

class TicketDB(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, index=True)
    priority = Column(String, index=True)
    area = Column(String)
    device = Column(String)
    department = Column(String)
    status = Column(String, default="Abierto", index=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    reporter = Column(String)
    technician = Column(String)
    summary = Column(String)
    description = Column(String)
    
    # Aquí guardamos todo el análisis de la IA en formato JSON
    analysis = Column(JSONB) 
    
    resolutionHours = Column(Float, nullable=True)
    resolvedAt = Column(DateTime, nullable=True)
    resolvedBy = Column(String, nullable=True)
    solution = Column(String, nullable=True)

class EventDB(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    time = Column(DateTime, default=datetime.utcnow)
    user_name = Column(String)
    type = Column(String)
    ticketId = Column(String, ForeignKey("tickets.id"), nullable=True)
    detail = Column(String, nullable=True)
    changes = Column(JSONB, nullable=True)