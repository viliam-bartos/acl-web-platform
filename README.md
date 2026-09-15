# ACL Web Platform

Web platform for longitudinal assessment of ACL graft remodeling from 3D MRI.

This repository is the thin application. It runs on an ordinary machine (hospital
laptop) and does not compute anything: it contains no PyTorch, MONAI, PyVista or
PyRadiomics. It accepts an anonymized scan, forwards it to a compute worker on a
workstation, stores the measured values, and displays them.

## Architecture

- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, `<model-viewer>` for 3D
  models, Recharts for time series.
- **Backend (this repository):** FastAPI and SQLite. Stores patients, examinations
  and measured values, and forwards uploads to the worker.
- **Compute worker:** separate service in
  [ACL_graft_analysis](https://github.com/viliam-bartos/ACL_graft_analysis)
  (`Source/worker`). Runs segmentation, geometry and radiomics and returns the
  metrics and a 3D GLB model.

```
[Hospital laptop]                        [Workstation / CEITEC]
React + Vite  ------ HTTP ------>  worker
FastAPI, SQLite                     - 5-fold LightUNet3D segmentation
metrics, charts, database           - reorientation to RIA
        <---- metrics + knee.glb -- - geometry and radiomics
```

Keeping the compute separate means the doctor needs only a browser: no CUDA, no
PyTorch, no PyVista installation.

## Running

Three terminals.

Worker, on the machine that computes:

```
C:\ACL_analysis\ACL_graft_analysis\Source\worker\run_worker.bat
```

Backend:

```
cd C:\acl-web-app\backend
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```
cd C:\acl-web-app\frontend
npm run dev
```

Then open http://localhost:5173

Notes:

- `COMPUTE_WORKER_URL` defaults to `http://127.0.0.1:8100`, which matches the worker
  started above. Change it when the worker runs on another machine.
- The Vite dev server proxies `/api` and `/static` to `localhost:8000`, so
  `VITE_API_URL` is not needed in development.
- On first run the database is seeded with three anonymized patient records and no
  examinations. The trend chart stays empty until a scan is analyzed; no sample data
  is generated.
- If the worker is not running, the header reports it as unavailable and analysis
  requests fail with HTTP 503.

## Backend environment variables

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `COMPUTE_WORKER_URL` | `http://127.0.0.1:8100` | worker address |
| `COMPUTE_WORKER_TOKEN` | – | optional `X-API-Token` header |
| `COMPUTE_WORKER_WAIT_S` | `900` | how long to wait for a result |
| `COMPUTE_WORKER_POLL_S` | `1.0` | polling interval |
| `CORS_ORIGINS` | `*` | comma-separated allowed origins |

## Privacy

No personally identifiable information is stored. Patients are identified only by an
anonymized `ACL_XXX` id; the re-identification key stays at the hospital.

An uploaded volume is written only temporarily and deleted once it has been sent to
the worker. Only numeric metrics and the generated 3D model are kept.

## Specification

`SPEC.md` is the binding contract for the API and the database schema. Metric names,
units and meaning are defined in `spec/data-contracts.md` in the `ACL_graft_analysis`
repository.
