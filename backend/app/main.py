import os
import uuid
from datetime import date, timedelta
from typing import List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.core.database import get_db, init_db
from app.models.db_models import (
    Patient, Scan,
    PatientResponse, PatientCreate,
    ScanResponse, HistoryResponse, AnalyzeResponse
)
from app.services.inference import run_3d_segmentation_inference, REF_MRI_PATH
from app.services.radiomics import extract_radiomic_features
from app.services.mesh_export import generate_acl_mesh_glb


@asynccontextmanager
async def lifespan(app: FastAPI):
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
    models_dir = os.path.join(static_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    init_db()
    yield


app = FastAPI(
    title="ACL Web Platform API",
    description="Longitudinal Remodeling & Ligamentization Analysis from 3D MRI Scans",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
os.makedirs(os.path.join(STATIC_DIR, "models"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ====================================================================
# API Endpoints
# ====================================================================

@app.get("/", tags=["General"])
def root():
    return {
        "service": "ACL Web Platform API",
        "status": "online",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/api/v1/health", tags=["General"])
def health_check():
    return {"status": "healthy", "service": "acl-backend"}


@app.get("/api/v1/patients", response_model=List[PatientResponse], tags=["Patients"])
def list_patients(db: Session = Depends(get_db)):
    """List all pseudoanonymized patients with longitudinal scan summaries."""
    patients = db.query(Patient).all()
    results = []
    for p in patients:
        scans = p.scans
        total_scans = len(scans)
        latest_score = scans[-1].integrity_score if scans else None
        latest_vol = scans[-1].volume_mm3 if scans else None
        
        results.append(PatientResponse(
            patient_id=p.patient_id,
            surgery_date=p.surgery_date,
            graft_type=p.graft_type,
            total_scans=total_scans,
            latest_integrity_score=latest_score,
            latest_volume_mm3=latest_vol
        ))
    return results


@app.post("/api/v1/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED, tags=["Patients"])
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    """Register a new pseudoanonymized patient ID."""
    existing = db.query(Patient).filter(Patient.patient_id == patient_in.patient_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Patient ID already exists")

    patient = Patient(
        patient_id=patient_in.patient_id,
        surgery_date=patient_in.surgery_date,
        graft_type=patient_in.graft_type
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return PatientResponse(
        patient_id=patient.patient_id,
        surgery_date=patient.surgery_date,
        graft_type=patient.graft_type,
        total_scans=0
    )


@app.get("/api/v1/patients/{patient_id}/history", response_model=HistoryResponse, tags=["Scans"])
def get_patient_history(patient_id: str, db: Session = Depends(get_db)):
    """Retrieve full longitudinal history for the specified patient ID."""
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    return HistoryResponse(
        patient=patient,
        scans=patient.scans
    )


@app.post("/api/v1/scans/analyze", response_model=AnalyzeResponse, tags=["Scans"])
async def analyze_scan(
    patient_id: str = Form(...),
    months_post_op: float = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload an anonymized MRI scan (DICOM / NIfTI), execute 3D graft segmentation inference,
    extract radiomic features, export 3D GLB mesh, and register scan record.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty MRI scan file provided")

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        inferred_surgery = date.today() - timedelta(days=int(months_post_op * 30.4))
        patient = Patient(
            patient_id=patient_id,
            surgery_date=inferred_surgery,
            graft_type="Autograft (Hamstring / BPTB)"
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    is_reference = "074" in file.filename or "reference" in file.filename.lower()

    # 1. 3D Segmentation Inference
    mask, inference_meta = run_3d_segmentation_inference(file_bytes, file.filename, use_reference_case=is_reference)

    # 2. Radiomics & Morphometrics Extraction
    spacing = tuple(inference_meta.get("spacing_mm", [1.0, 0.5, 0.5]))
    radiomics_data = extract_radiomic_features(mask, spacing, months_post_op, is_reference_case=is_reference)

    # 3. 3D GLB Mesh Generation
    scan_uuid = f"scan-{uuid.uuid4().hex[:8]}"
    model_url = generate_acl_mesh_glb(
        scan_id=scan_uuid,
        volume_mm3=radiomics_data["volume_mm3"],
        integrity_score=radiomics_data["integrity_score"],
        mask=mask,
        spacing=spacing
    )

    # 4. Save to Database
    scan_record = Scan(
        id=scan_uuid,
        patient_id=patient.patient_id,
        scan_date=date.today(),
        months_post_op=months_post_op,
        volume_mm3=radiomics_data["volume_mm3"],
        integrity_score=radiomics_data["integrity_score"],
        model_url=model_url
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    return AnalyzeResponse(
        status="success",
        message="MRI scan processed and 3D mesh reconstructed successfully.",
        scan=ScanResponse.model_validate(scan_record),
        radiomics_summary={
            **radiomics_data,
            "inference_duration_ms": inference_meta.get("inference_duration_ms"),
            "model_architecture": inference_meta.get("model_architecture")
        }
    )


@app.post("/api/v1/scans/analyze-reference", response_model=AnalyzeResponse, tags=["Scans"])
def analyze_reference_scan(
    patient_id: str = Form("ACL_042"),
    months_post_op: float = Form(6.0),
    db: Session = Depends(get_db)
):
    """
    1-Click Evaluation of the Reference 3D MRI Volume (Case 074) from C:\\ACL_analysis\\ACL_graft_analysis.
    Executes pipeline on the real reference scan without requiring HTTP file upload.
    """
    if not os.path.exists(REF_MRI_PATH):
        raise HTTPException(status_code=404, detail="Reference MRI scan file not found on server")

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        patient = Patient(
            patient_id=patient_id,
            surgery_date=date.today() - timedelta(days=int(months_post_op * 30.4)),
            graft_type="Bone-Patellar Tendon-Bone (BPTB)"
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    # Run inference with reference flag
    mask, inference_meta = run_3d_segmentation_inference(b"", "right_case_074.nii.gz", use_reference_case=True)
    spacing = tuple(inference_meta.get("spacing_mm", [0.5, 0.5, 0.5]))
    radiomics_data = extract_radiomic_features(mask, spacing, months_post_op, is_reference_case=True)

    scan_uuid = f"scan-ref-{uuid.uuid4().hex[:6]}"
    model_url = generate_acl_mesh_glb(
        scan_id=scan_uuid,
        volume_mm3=radiomics_data["volume_mm3"],
        integrity_score=radiomics_data["integrity_score"],
        mask=mask,
        spacing=spacing
    )

    scan_record = Scan(
        id=scan_uuid,
        patient_id=patient.patient_id,
        scan_date=date.today(),
        months_post_op=months_post_op,
        volume_mm3=radiomics_data["volume_mm3"],
        integrity_score=radiomics_data["integrity_score"],
        model_url=model_url
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    return AnalyzeResponse(
        status="success",
        message="Reference 3D MRI (Case 074) processed with real PyVista surface & radiomic quantitation.",
        scan=ScanResponse.model_validate(scan_record),
        radiomics_summary={
            **radiomics_data,
            "inference_duration_ms": inference_meta.get("inference_duration_ms"),
            "model_architecture": inference_meta.get("model_architecture")
        }
    )
