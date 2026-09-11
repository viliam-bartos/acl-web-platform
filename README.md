# ACL Web Platform: Longitudinal Remodeling & Analysis

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_(Vite)-61DAFB.svg?logo=react)](https://reactjs.org)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch-EE4C2C.svg?logo=pytorch)](https://pytorch.org)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED.svg?logo=docker)](https://www.docker.com)

Webová platforma navržená pro lékaře a výzkumníky k longitudinálnímu hodnocení integrity a ligamentizace štěpu předního zkříženého vazu (ACL) z magnetické rezonance (MRI).

Systém odděluje těžké výpočetní operace (3D segmentace, radiomika) od uživatelského rozhraní. Umožňuje lékaři nahrát anonymizovaný DICOM/NIfTI sken, okamžitě zkontrolovat 3D rekonstrukci vazu na mobilu či PC a sledovat časový vývoj hojení štěpu.

---

## 🏗️ Architektura systému

1. **Frontend (React + Vite):** Responzivní webové rozhraní s podporou dotykových gest pro rotaci 3D meshů (`<model-viewer>`) a interaktivních grafů časových řad.
2. **Backend (FastAPI):** REST API obsluhující nahrávání dat, asynchronní orchestraci úloh a ukládání metrik do relační databáze (SQLite).
3. **Výpočetní jádro:**
   * **Segmentace:** 3D konvoluční model v PyTorchi generující voxelovou masku vazu.
   * **Radiomická analýza:** Extrakce textur (GLCM/GLRLM) a geometrických deskriptorů štěpu přes PyRadiomics.
   * **3D Surface Processing:** Izolace povrchové sítě a export do formátu GLB přes PyVista pro plynulý běh na klientském GPU.

---

## 🚀 Rychlé spuštění (Local Dev)

### 1. Backend
```bash
cd backend
python -m venv .venv
# Aktivace venv (Windows: .venv\Scripts\activate, Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```

Aplikace je dostupná na `http://localhost:5173` nebo přes lokální IP adresu v síti pro mobilní náhled.

### 3. Docker Compose
```bash
docker-compose up --build
```

---

## 🔒 Ochrana osobních údajů (Privacy by Design)
Systém operuje v striktním režimu bez přítomnosti osobních identifikačních údajů (PII). Lékař pracuje pouze s anonymizovanými identifikátory (`ACL_XXX`), re-identifikační klíč zůstává výhradně na straně nemocnice.
