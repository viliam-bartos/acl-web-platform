from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
)
from sqlalchemy import (
    inspect as sa_inspect,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

#: Klinické metriky, jejichž názvy se **musí** shodovat s
#: `ACL_graft_analysis/spec/data-contracts.md`. Jsou to zároveň názvy sloupců
#: v databázi – žádné přejmenovávání mezi vrstvami, protože právě na rozjezdu
#: `Staubli_Tibial_pct` vs. `staubli_tibial_pct` se dřív ztrácely naměřené hodnoty.
CLINICAL_METRIC_KEYS: tuple[str, ...] = (
    "Staubli_Tibial_pct",
    "Tortuosity_Index",
    "ATT_mm",
    "BH_Length_pct",
    "BH_Depth_pct",
    "angle_to_plateau_deg",
    "sagittal_angle_deg",
    "coronal_angle_deg",
    "acl_volume_mm3",
    "min_dist_to_femur_mm",
    "notch_width_mm",
)


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
        order_by="Scan.months_post_op",
    )


class Scan(Base):
    """Jedno vyšetření: naměřené metriky od workera a odkaz na 3D model.

    Hodnoty plní **výhradně** výpočetní worker. Tato aplikace do nich nesahá;
    chybějící metrika zůstává `NULL`, protože nula je platná naměřená hodnota
    a nesmí ji zastupovat.
    """

    __tablename__ = "scans"

    id = Column(String(64), primary_key=True, index=True)
    patient_id = Column(String(64), ForeignKey("patients.patient_id"), nullable=False, index=True)
    scan_date = Column(Date, nullable=False)
    months_post_op = Column(Float, nullable=False)

    # Klinické metriky – názvy sloupců jsou shodné s kontraktem.
    staubli_tibial_pct = Column("Staubli_Tibial_pct", Float, nullable=True)
    tortuosity_index = Column("Tortuosity_Index", Float, nullable=True)
    att_mm = Column("ATT_mm", Float, nullable=True)
    bh_length_pct = Column("BH_Length_pct", Float, nullable=True)
    bh_depth_pct = Column("BH_Depth_pct", Float, nullable=True)
    angle_to_plateau_deg = Column(Float, nullable=True)
    sagittal_angle_deg = Column(Float, nullable=True)
    coronal_angle_deg = Column(Float, nullable=True)
    acl_volume_mm3 = Column(Float, nullable=True)
    min_dist_to_femur_mm = Column(Float, nullable=True)
    notch_width_mm = Column(Float, nullable=True)

    #: Texturální příznaky (PyRadiomics) – flexibilní, proto JSON.
    radiomics = Column(JSON, nullable=True)

    #: ID úlohy u workera – umožní dohledat výsledek, i když požadavek vyprší.
    worker_job_id = Column(String(64), nullable=True, index=True)

    model_url = Column(String(256), nullable=False)
    #: `pending` | `ready` | `failed`. Vyšetření se zakládá ještě před výpočtem,
    #: aby se výsledek neztratil, když je segmentace delší než HTTP požadavek.
    status = Column(String(16), nullable=False, default="pending", index=True)
    error = Column(String(512), nullable=True)
    #: Ukázkový sken pro předvedení rozhraní; nikdy se nevydává za měření.
    is_demo = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    patient = relationship("Patient", back_populates="scans")

    @classmethod
    def metric_columns(cls) -> dict[str, str]:
        """Mapování název metriky (dle kontraktu) -> atribut objektu.

        Odvozuje se z mapperu, protože `Column("Staubli_Tibial_pct", Float)`
        přiřazené atributu `staubli_tibial_pct` má v `__table__.columns`
        `key` rovné **názvu sloupce**, nikoli jménu atributu. Naivní čtení
        `column.key` proto vedlo k `setattr(scan, "Staubli_Tibial_pct", …)`,
        což je efemérní atribut instance: hodnota se objevila v odpovědi,
        ale do databáze se nikdy neuložila.
        """
        return {
            column.name: attribute
            for attribute, column in sa_inspect(cls).columns.items()
            if column.name in CLINICAL_METRIC_KEYS
        }

    @classmethod
    def verify_metric_mapping(cls) -> None:
        """Ověří, že každá metrika z kontraktu má svůj sloupec i atribut.

        Kontrola běží při startu aplikace: tichý úbytek metriky je horší než
        pád při startu, protože se projeví až jako chybějící hodnota u pacienta.
        """
        mapping = cls.metric_columns()
        missing = [key for key in CLINICAL_METRIC_KEYS if key not in mapping]
        if missing:
            raise RuntimeError(
                f"Ve schématu chybí sloupce pro metriky: {missing}. Doplň je do modelu Scan."
            )
        for attribute in mapping.values():
            if not hasattr(cls, attribute):
                raise RuntimeError(f"Model Scan nemá atribut {attribute!r} pro metriku.")

    def metrics(self) -> dict[str, float | None]:
        """Vrátí klinické metriky pod názvy podle kontraktu."""
        return {name: getattr(self, attribute) for name, attribute in self.metric_columns().items()}


# ====================================================================
# Pydantic Request & Response Schemas
# ====================================================================


class PatientBase(BaseModel):
    patient_id: str
    surgery_date: date
    graft_type: str

    model_config = ConfigDict(from_attributes=True)


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    total_scans: int = 0
    latest_acl_volume_mm3: float | None = None
    latest_scan_date: date | None = None
    has_demo_scans: bool = False

    model_config = ConfigDict(from_attributes=True)


class ScanMetrics(BaseModel):
    """Klinické metriky pod názvy podle `spec/data-contracts.md`."""

    Staubli_Tibial_pct: float | None = None
    Tortuosity_Index: float | None = None
    ATT_mm: float | None = None
    BH_Length_pct: float | None = None
    BH_Depth_pct: float | None = None
    angle_to_plateau_deg: float | None = None
    sagittal_angle_deg: float | None = None
    coronal_angle_deg: float | None = None
    acl_volume_mm3: float | None = None
    min_dist_to_femur_mm: float | None = None
    notch_width_mm: float | None = None


class ScanResponse(BaseModel):
    id: str
    patient_id: str
    scan_date: date
    months_post_op: float
    model_url: str
    status: str = "ready"
    error: str | None = None
    is_demo: bool = False
    worker_job_id: str | None = None
    metrics: ScanMetrics

    model_config = ConfigDict(from_attributes=True)


class HistoryResponse(BaseModel):
    # `PatientResponse`, ne `PatientBase`: s užším typem Pydantic přebytečná
    # pole tiše zahodí a klient pak čte `undefined`, aniž by cokoli selhalo.
    patient: PatientResponse
    scans: list[ScanResponse]

    model_config = ConfigDict(from_attributes=True)


class AnalyzeResponse(BaseModel):
    status: str
    message: str
    scan: ScanResponse
    warnings: list[str] = []
    compute: dict = {}


class WorkerHealth(BaseModel):
    status: str
    detail: str | None = None
    device: str | None = None
