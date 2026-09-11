from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


# ====================================================================
# SQLAlchemy Database Models
# ====================================================================

class Patient(Base):
    """Anonymized patient entity. Strictly no PII stored."""
    __tablename__ = "patients"

    patient_id = Column(String(64), primary_key=True, index=True)
    surgery_date = Column(Date, nullable=False)
    graft_type = Column(String(128), nullable=False)

    scans = relationship(
        "Scan",
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="Scan.months_post_op"
    )


class Scan(Base):
    """Longitudinal MRI scan & analysis metrics record."""
    __tablename__ = "scans"

    id = Column(String(64), primary_key=True, index=True)
    patient_id = Column(String(64), ForeignKey("patients.patient_id"), nullable=False, index=True)
    scan_date = Column(Date, nullable=False)
    months_post_op = Column(Float, nullable=False)
    volume_mm3 = Column(Float, nullable=False)
    integrity_score = Column(Float, nullable=False)
    model_url = Column(String(256), nullable=False)

    patient = relationship("Patient", back_populates="scans")


# ====================================================================
# Pydantic Request & Response Schemas
# ====================================================================

class ScanBase(BaseModel):
    patient_id: str
    scan_date: date
    months_post_op: float
    volume_mm3: float
    integrity_score: float
    model_url: str


class ScanResponse(ScanBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class PatientBase(BaseModel):
    patient_id: str
    surgery_date: date
    graft_type: str

    model_config = ConfigDict(from_attributes=True)


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    total_scans: int = 0
    latest_integrity_score: Optional[float] = None
    latest_volume_mm3: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class HistoryResponse(BaseModel):
    patient: PatientBase
    scans: List[ScanResponse]

    model_config = ConfigDict(from_attributes=True)


class AnalyzeResponse(BaseModel):
    status: str
    message: str
    scan: ScanResponse
    radiomics_summary: dict
