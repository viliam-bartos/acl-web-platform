# Project Vault & Technical Specification

## 1. Project Goal
Vybudovat modulární webovou platformu pro longitudinální sledování a analýzu remodelace (ligamentizace) vazu ACL po plastice z 3D MRI skenů. Lékař nahrává anonymizovaná data z libovolného zařízení (desktop/mobil), výpočetní jádro provádí segmentaci a radiomickou analýzu, frontend zobrazuje 3D model a časové trendy.

## 2. System Architecture
- **Frontend:** React 18+ (Vite), TailwindCSS, Google `<model-viewer>` pro nativní 3D GLB rendering, Recharts pro grafy. Optimalizováno pro mobilní i desktopové zobrazení.
- **Backend:** FastAPI (Python 3.11+), Uvicorn, SQLite (přes SQLAlchemy/SQLModel).
- **Core Processing:** PyTorch (3D inferenční pipeline), PyRadiomics (extrakce geometrie a textur), PyVista (extrakce izopovrchu a konverze do webového formátu GLB).
- **Komunikační protokol:** REST API přes HTTP + Static file hosting pro vygenerované 3D modely.

## 3. Data & Privacy Constraints
- Striktní pseudoanonymizace: Databáze a backend znají pouze `patient_id` (např. `ACL_042`).
- Žádná jména, rodná čísla ani metadata pacienta z DICOM headerů se neukládají.
- Re-identifikační klíč zůstává lokálně u lékaře.

## 4. API Endpoints
- `POST /api/v1/scans/analyze`: Form-data (`patient_id`, `months_post_op`, `file`). Spustí inferenci, extrahuje radiomiku, uloží `.glb` a vrátí vypočtené skóre + cestu k 3D modelu.
- `GET /api/v1/patients`: Vrátí seznam všech anonymizovaných pacientů.
- `GET /api/v1/patients/{patient_id}/history`: Vrátí časovou řadu všech kontrol daného pacienta pro vykreslení grafu vývoje vazu.
- `GET /static/models/{filename}`: Statické doručování `.glb` modelů pro webový prohlížeč.
