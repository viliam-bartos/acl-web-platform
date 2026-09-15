"""
ACL Web Platform – tenká API vrstva.

Tato aplikace **nepočítá**. Přijme anonymizovaný objem, předá ho výpočetnímu
workeru, uloží, co worker naměřil, a vydá to frontendu. Žádná segmentace,
žádná geometrie, žádná radiomika, žádné odhady.

Konfigurace:
    COMPUTE_WORKER_URL       adresa workera (výchozí http://127.0.0.1:8100)
    COMPUTE_WORKER_TOKEN     volitelný X-API-Token
    COMPUTE_WORKER_WAIT_S    jak dlouho čekat na výsledek (výchozí 900)
    COMPUTE_WORKER_POLL_S    interval dotazování (výchozí 1.0)
    CORS_ORIGINS             čárkami oddělené originy (výchozí *)
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.core.database import DB_PATH, get_db, init_db
from app.models.db_models import (
    AnalyzeResponse,
    HistoryResponse,
    Patient,
    PatientCreate,
    PatientResponse,
    Scan,
    ScanMetrics,
    ScanResponse,
)
from app.services import worker_client

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "static"))
MODELS_DIR = os.path.join(STATIC_DIR, "models")
UPLOAD_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data", "uploads"))

#: Prefix pro radiomické příznaky – ukládají se jako JSON, ne jako sloupce.
RADIOMIC_PREFIXES = ("original_firstorder_", "original_glcm_", "original_glrlm_")


@asynccontextmanager
async def lifespan(_: FastAPI):
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    init_db()
    config = worker_client.WorkerConfig.from_env()
    logger.info("Výpočetní worker: %s", config.base_url)
    yield


app = FastAPI(
    title="ACL Web Platform API",
    description=(
        "Tenká API vrstva pro longitudinální sledování ACL štěpu. "
        "Veškerý výpočet dělá samostatný worker."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip() for o in (os.environ.get("CORS_ORIGINS") or "*").split(",") if o.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(MODELS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ====================================================================
# Pomocné funkce
# ====================================================================


def _worker_config() -> worker_client.WorkerConfig:
    return worker_client.WorkerConfig.from_env()


def _scan_response(scan: Scan) -> ScanResponse:
    """Sestaví odpověď včetně metrik pod názvy podle kontraktu."""
    return ScanResponse(
        id=scan.id,
        patient_id=scan.patient_id,
        scan_date=scan.scan_date,
        months_post_op=scan.months_post_op,
        model_url=scan.model_url or "",
        status=scan.status,
        error=scan.error,
        is_demo=bool(scan.is_demo),
        worker_job_id=scan.worker_job_id,
        metrics=ScanMetrics(**scan.metrics()),
    )


def job_compute_info(scan: Scan) -> dict[str, Any]:
    """Odkud výsledek přišel – dohledatelnost pro lékaře i pro ladění."""
    return {
        "worker_job_id": scan.worker_job_id,
        "status": scan.status,
    }


def _get_or_create_patient(db: Session, patient_id: str, months_post_op: float) -> Patient:
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if patient is not None:
        return patient

    patient = Patient(
        patient_id=patient_id,
        # Datum operace se dopočítá z udaného odstupu; jde o evidenci, ne o měření.
        surgery_date=date.today() - timedelta(days=int(months_post_op * 30.4)),
        graft_type="Neuvedeno",
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def _as_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _apply_job_result(
    db: Session, scan: Scan, job: dict[str, Any], config: worker_client.WorkerConfig
) -> list[str]:
    """Uloží metriky a model z dokončené úlohy. Vrací varování pro uživatele."""
    warnings: list[str] = list(job.get("warnings") or [])
    metrics = job.get("metrics") or {}

    for name, attribute in Scan.metric_columns().items():
        setattr(scan, attribute, _as_float(metrics.get(name)))

    radiomics = {
        key: _as_float(value) for key, value in metrics.items() if key.startswith(RADIOMIC_PREFIXES)
    }
    scan.radiomics = radiomics or None
    scan.status = "ready"
    scan.error = None

    # Model stáhneme a uložíme lokálně: prohlížeč ho pak čte z tohoto serveru
    # a vyšetření zůstane zobrazitelné i ve chvíli, kdy worker neběží.
    try:
        payload = worker_client.download_artifact(config, scan.worker_job_id or "", "model")
        target = os.path.join(MODELS_DIR, f"{scan.id}.glb")
        with open(target, "wb") as handle:
            handle.write(payload)
        scan.model_url = f"/static/models/{scan.id}.glb"
    except worker_client.ComputeWorkerError as exc:
        warnings.append(f"3D model se nepodařilo převzít z workera: {exc}")

    db.commit()
    db.refresh(scan)
    return warnings


def _run_job_and_store(
    db: Session, scan: Scan, job_id: str, config: worker_client.WorkerConfig
) -> tuple[Scan, list[str]]:
    """Počká na úlohu a uloží výsledek; při vypršení nechá vyšetření ve stavu `pending`."""
    try:
        job = worker_client.wait_for_job(
            config,
            job_id,
            on_progress=lambda payload: logger.info(
                "Úloha %s: %s (%s)", job_id, payload.get("stage"), payload.get("status")
            ),
        )
    except worker_client.ComputeWorkerTimeout as exc:
        # Výpočet běží dál na workeru; záznam zůstává `pending` a jde dotáhnout.
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "message": str(exc),
                "scan_id": scan.id,
                "worker_job_id": job_id,
                "hint": f"Výsledek dotáhneš přes POST /api/v1/scans/{scan.id}/refresh",
            },
        ) from exc
    except worker_client.ComputeWorkerError as exc:
        scan.status = "failed"
        scan.error = str(exc)[:500]
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    warnings = _apply_job_result(db, scan, job, config)
    return scan, warnings


# ====================================================================
# Obecné endpointy
# ====================================================================


@app.get("/", tags=["General"])
def root() -> dict[str, Any]:
    config = _worker_config()
    return {
        "service": "ACL Web Platform API",
        "status": "online",
        "role": "thin client – veškerý výpočet dělá worker",
        "compute_worker_url": config.base_url,
        "docs": "/docs",
        "version": "2.0.0",
    }


@app.get("/api/v1/health", tags=["General"])
def health_check() -> dict[str, Any]:
    """Stav aplikace **a** dostupnosti výpočetního workera."""
    config = _worker_config()
    worker = worker_client.health(config)
    return {
        "status": "healthy" if worker.get("reachable") else "degraded",
        "service": "acl-backend",
        "compute_worker": worker,
        "compute_worker_url": config.base_url,
    }


# ====================================================================
# Pacienti
# ====================================================================


@app.get("/api/v1/patients", response_model=list[PatientResponse], tags=["Patients"])
def list_patients(db: Session = Depends(get_db)) -> list[PatientResponse]:
    """Seznam pseudoanonymizovaných pacientů s přehledem jejich vyšetření."""
    results: list[PatientResponse] = []
    for patient in db.query(Patient).all():
        scans = sorted(patient.scans, key=lambda s: s.months_post_op)
        latest = scans[-1] if scans else None
        results.append(
            PatientResponse(
                patient_id=patient.patient_id,
                surgery_date=patient.surgery_date,
                graft_type=patient.graft_type,
                total_scans=sum(1 for s in scans if s.status == "ready"),
                latest_acl_volume_mm3=latest.acl_volume_mm3 if latest else None,
                latest_scan_date=latest.scan_date if latest else None,
                has_demo_scans=any(bool(s.is_demo) for s in scans),
            )
        )
    return results


@app.post(
    "/api/v1/patients",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Patients"],
)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)) -> PatientResponse:
    """Zaregistruje nové anonymizované ID pacienta."""
    existing = db.query(Patient).filter(Patient.patient_id == patient_in.patient_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Pacient s tímto ID už existuje")

    patient = Patient(
        patient_id=patient_in.patient_id,
        surgery_date=patient_in.surgery_date,
        graft_type=patient_in.graft_type,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return PatientResponse(
        patient_id=patient.patient_id,
        surgery_date=patient.surgery_date,
        graft_type=patient.graft_type,
        total_scans=0,
    )


@app.get("/api/v1/patients/{patient_id}/history", response_model=HistoryResponse, tags=["Patients"])
def get_patient_history(patient_id: str, db: Session = Depends(get_db)) -> HistoryResponse:
    """Časová řada všech vyšetření pacienta pro graf vývoje štěpu."""
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Pacient {patient_id} nenalezen")

    return HistoryResponse(
        patient=PatientResponse(
            patient_id=patient.patient_id,
            surgery_date=patient.surgery_date,
            graft_type=patient.graft_type,
            total_scans=len(patient.scans),
        ),
        scans=[_scan_response(scan) for scan in patient.scans],
    )


# ====================================================================
# Vyšetření
# ====================================================================


@app.post(
    "/api/v1/scans/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Scans"],
)
async def analyze_scan(
    patient_id: str = Form(...),
    months_post_op: float = Form(...),
    file: UploadFile = File(...),
    laterality: str | None = Form(default=None),
    compute_radiomics: bool = Form(default=True),
    run_inference: bool = Form(default=True),
    db: Session = Depends(get_db),
) -> AnalyzeResponse:
    """Nahraje anonymizovaný sken, nechá ho spočítat workerem a uloží výsledek.

    Nahrávaný objem se ukládá jen dočasně a po odeslání workeru se smaže;
    trvale zůstávají pouze naměřené metriky a vygenerovaný 3D model.
    """
    if laterality not in (None, "", "Left", "Right"):
        raise HTTPException(
            status_code=422, detail="laterality musí být 'Left', 'Right' nebo prázdné"
        )

    filename = os.path.basename(file.filename or "scan.nii.gz")
    upload_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}_{filename}")

    written = 0
    with open(upload_path, "wb") as handle:
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            handle.write(chunk)
    if written == 0:
        os.remove(upload_path)
        raise HTTPException(status_code=400, detail="Nahraný soubor je prázdný")

    patient = _get_or_create_patient(db, patient_id, months_post_op)
    scan = Scan(
        id=f"scan-{uuid.uuid4().hex[:8]}",
        patient_id=patient.patient_id,
        scan_date=date.today(),
        months_post_op=months_post_op,
        model_url="",
        status="pending",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    config = _worker_config()
    try:
        try:
            job_id = worker_client.submit_scan(
                config,
                file_path=upload_path,
                filename=filename,
                patient_id=patient.patient_id,
                months_post_op=months_post_op,
                laterality=laterality or None,
                compute_radiomics=compute_radiomics,
                run_inference=run_inference,
            )
        except worker_client.ComputeWorkerError as exc:
            scan.status = "failed"
            scan.error = str(exc)[:500]
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
            ) from exc

        scan.worker_job_id = job_id
        db.commit()

        scan, warnings = _run_job_and_store(db, scan, job_id, config)
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)

    return AnalyzeResponse(
        status="success",
        message="Sken zpracován výpočetním workerem.",
        scan=_scan_response(scan),
        warnings=warnings,
        compute=job_compute_info(scan),
    )


@app.post("/api/v1/scans/analyze-reference", response_model=AnalyzeResponse, tags=["Scans"])
def analyze_reference_scan(
    patient_id: str = Form(default="ACL_042"),
    months_post_op: float = Form(default=6.0),
    use_inference: bool = Form(default=False),
    compute_radiomics: bool = Form(default=True),
    db: Session = Depends(get_db),
) -> AnalyzeResponse:
    """Nechá worker zhodnotit jeho vestavěný referenční případ 074.

    Slouží k předvedení celé cesty bez vlastních dat. Worker sahá na svůj
    referenční objem sám – tato aplikace žádnou cestu k datům nezná.
    """
    patient = _get_or_create_patient(db, patient_id, months_post_op)
    scan = Scan(
        id=f"scan-{uuid.uuid4().hex[:8]}",
        patient_id=patient.patient_id,
        scan_date=date.today(),
        months_post_op=months_post_op,
        model_url="",
        status="pending",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    config = _worker_config()
    try:
        job_id = worker_client.submit_reference_scan(
            config,
            patient_id=patient.patient_id,
            months_post_op=months_post_op,
            use_inference=use_inference,
            compute_radiomics=compute_radiomics,
        )
    except worker_client.ComputeWorkerError as exc:
        scan.status = "failed"
        scan.error = str(exc)[:500]
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    scan.worker_job_id = job_id
    db.commit()

    scan, warnings = _run_job_and_store(db, scan, job_id, config)

    return AnalyzeResponse(
        status="success",
        message="Referenční případ 074 zpracován workerem.",
        scan=_scan_response(scan),
        warnings=warnings,
        compute=job_compute_info(scan),
    )


@app.post("/api/v1/scans/{scan_id}/refresh", response_model=AnalyzeResponse, tags=["Scans"])
def refresh_scan(scan_id: str, db: Session = Depends(get_db)) -> AnalyzeResponse:
    """Dotáhne výsledek úlohy, která doběhla až po časovém limitu požadavku."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if scan is None:
        raise HTTPException(status_code=404, detail=f"Vyšetření {scan_id} nenalezeno")
    if scan.status == "ready":
        return AnalyzeResponse(
            status="success",
            message="Vyšetření je už hotové.",
            scan=_scan_response(scan),
            warnings=[],
            compute=job_compute_info(scan),
        )
    if not scan.worker_job_id:
        raise HTTPException(status_code=409, detail="Vyšetření nemá ID úlohy u workera")

    config = _worker_config()
    try:
        job = worker_client.get_job(config, scan.worker_job_id)
    except worker_client.ComputeWorkerError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    job_status = job.get("status")
    if job_status == "failed":
        scan.status = "failed"
        scan.error = str(job.get("error"))[:500]
        db.commit()
        raise HTTPException(status_code=502, detail=f"Úloha selhala: {job.get('error')}")
    if job_status != "succeeded":
        # Stále se počítá – vracíme aktuální stav, nikoli chybu.
        return AnalyzeResponse(
            status="pending",
            message=f"Výpočet pokračuje (fáze: {job.get('stage')}).",
            scan=_scan_response(scan),
            warnings=[],
            compute=job_compute_info(scan),
        )

    warnings = _apply_job_result(db, scan, job, config)
    return AnalyzeResponse(
        status="success",
        message="Výsledek dotažen z workera.",
        scan=_scan_response(scan),
        warnings=warnings,
        compute=job_compute_info(scan),
    )


@app.get("/api/v1/scans/{scan_id}/model", tags=["Scans"])
def get_scan_model(scan_id: str, db: Session = Depends(get_db)) -> FileResponse:
    """Vrátí GLB model vyšetření; pokud chybí lokálně, zkusí ho převzít z workera."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if scan is None:
        raise HTTPException(status_code=404, detail=f"Vyšetření {scan_id} nenalezeno")

    path = os.path.join(MODELS_DIR, f"{scan.id}.glb")
    if not os.path.exists(path) and scan.worker_job_id:
        config = _worker_config()
        try:
            payload = worker_client.download_artifact(config, scan.worker_job_id, "model")
        except worker_client.ComputeWorkerError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        with open(path, "wb") as handle:
            handle.write(payload)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Model pro toto vyšetření není k dispozici")
    return FileResponse(path, media_type="model/gltf-binary", filename=f"{scan.id}.glb")


# ====================================================================
# Prohlížeč databáze
# ====================================================================


@app.get("/api/v1/database/stats", tags=["Database"])
def get_database_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Statistiky databáze a stav výpočetního workera."""
    config = _worker_config()
    worker = worker_client.health(config)
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0

    return {
        "status": "online",
        "database_file": os.path.abspath(DB_PATH),
        "size_bytes": db_size,
        "size_kb": round(db_size / 1024, 1),
        "total_patients": db.query(Patient).count(),
        "total_scans": db.query(Scan).count(),
        "pending_scans": db.query(Scan).filter(Scan.status == "pending").count(),
        "failed_scans": db.query(Scan).filter(Scan.status == "failed").count(),
        "demo_scans": db.query(Scan).filter(Scan.is_demo.is_(True)).count(),
        "compute_worker": worker,
        "compute_worker_url": config.base_url,
        "last_modified": os.path.getmtime(DB_PATH) if os.path.exists(DB_PATH) else None,
    }


@app.get("/api/v1/database/records", tags=["Database"])
def get_database_records(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Plný obsah tabulek pro prohlížeč databáze."""
    patients = db.query(Patient).all()
    scans = db.query(Scan).order_by(Scan.scan_date.desc()).all()

    return {
        "patients": [
            {
                "patient_id": p.patient_id,
                "surgery_date": str(p.surgery_date),
                "graft_type": p.graft_type,
                "total_scans": len(p.scans),
            }
            for p in patients
        ],
        "scans": [
            {
                "id": s.id,
                "patient_id": s.patient_id,
                "scan_date": str(s.scan_date),
                "months_post_op": s.months_post_op,
                "status": s.status,
                "is_demo": bool(s.is_demo),
                "worker_job_id": s.worker_job_id,
                "model_url": s.model_url,
                "metrics": s.metrics(),
            }
            for s in scans
        ],
    }


@app.get("/api/v1/database/download", tags=["Database"])
def download_database() -> FileResponse:
    """Stáhne databázový soubor (acl_platform.db)."""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="Databázový soubor neexistuje")
    return FileResponse(
        path=DB_PATH, filename="acl_platform.db", media_type="application/x-sqlite3"
    )
