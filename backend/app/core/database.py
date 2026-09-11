import os
from datetime import date, timedelta
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# SQLite database file path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "..", "acl_platform.db")
DATABASE_URL = f"sqlite:///{os.path.abspath(DB_PATH)}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session and ensures closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables and seed with realistic anonymized patient data."""
    from app.models.db_models import Patient, Scan
    from app.services.mesh_export import generate_acl_mesh_glb

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        existing_patient = db.query(Patient).first()
        if existing_patient is not None:
            return

        # Pre-seed realistic anonymized patients
        demo_patients = [
            Patient(
                patient_id="ACL_042",
                surgery_date=date(2024, 8, 10),
                graft_type="Bone-Patellar Tendon-Bone (BPTB)"
            ),
            Patient(
                patient_id="ACL_001",
                surgery_date=date(2024, 3, 15),
                graft_type="Hamstring Tendon Autograft (ST/G)"
            ),
            Patient(
                patient_id="ACL_105",
                surgery_date=date(2025, 1, 20),
                graft_type="Quadriceps Tendon Autograft"
            ),
        ]
        db.add_all(demo_patients)
        db.commit()

        # Seed longitudinal scans for ACL_042 (Primary Demo)
        scans_data = [
            # ACL_042 scans
            {
                "id": "scan-042-m01",
                "patient_id": "ACL_042",
                "scan_date": date(2024, 9, 25),
                "months_post_op": 1.5,
                "volume_mm3": 2310.5,
                "integrity_score": 58.2,
            },
            {
                "id": "scan-042-m03",
                "patient_id": "ACL_042",
                "scan_date": date(2024, 11, 10),
                "months_post_op": 3.0,
                "volume_mm3": 2540.2,
                "integrity_score": 71.4,
            },
            {
                "id": "scan-042-m06",
                "patient_id": "ACL_042",
                "scan_date": date(2025, 2, 10),
                "months_post_op": 6.0,
                "volume_mm3": 2795.0,
                "integrity_score": 84.8,
            },
            # ACL_001 scans
            {
                "id": "scan-001-m01",
                "patient_id": "ACL_001",
                "scan_date": date(2024, 4, 15),
                "months_post_op": 1.0,
                "volume_mm3": 2450.0,
                "integrity_score": 54.0,
            },
            {
                "id": "scan-001-m03",
                "patient_id": "ACL_001",
                "scan_date": date(2024, 6, 15),
                "months_post_op": 3.0,
                "volume_mm3": 2680.0,
                "integrity_score": 67.2,
            },
            {
                "id": "scan-001-m06",
                "patient_id": "ACL_001",
                "scan_date": date(2024, 9, 15),
                "months_post_op": 6.0,
                "volume_mm3": 2830.0,
                "integrity_score": 79.1,
            },
            {
                "id": "scan-001-m12",
                "patient_id": "ACL_001",
                "scan_date": date(2025, 3, 15),
                "months_post_op": 12.0,
                "volume_mm3": 2960.0,
                "integrity_score": 89.5,
            },
            # ACL_105 scans
            {
                "id": "scan-105-m01",
                "patient_id": "ACL_105",
                "scan_date": date(2025, 2, 20),
                "months_post_op": 1.0,
                "volume_mm3": 2180.0,
                "integrity_score": 51.0,
            },
            {
                "id": "scan-105-m03",
                "patient_id": "ACL_105",
                "scan_date": date(2025, 4, 20),
                "months_post_op": 3.0,
                "volume_mm3": 2435.0,
                "integrity_score": 64.5,
            },
        ]

        for s in scans_data:
            model_url = generate_acl_mesh_glb(
                scan_id=s["id"],
                volume_mm3=s["volume_mm3"],
                integrity_score=s["integrity_score"]
            )
            db_scan = Scan(
                id=s["id"],
                patient_id=s["patient_id"],
                scan_date=s["scan_date"],
                months_post_op=s["months_post_op"],
                volume_mm3=s["volume_mm3"],
                integrity_score=s["integrity_score"],
                model_url=model_url
            )
            db.add(db_scan)

        db.commit()
