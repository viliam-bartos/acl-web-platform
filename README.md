# ACL Web Platform: Longitudinal Remodeling & Analysis

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_(Vite)-61DAFB.svg?logo=react)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED.svg?logo=docker)](https://www.docker.com)

Webová platforma navržená pro lékaře a výzkumníky k longitudinálnímu hodnocení integrity
a ligamentizace štěpu předního zkříženého vazu (ACL) z magnetické rezonance (MRI).

**Tento repozitář je tenká aplikace.** Běží na běžném počítači (nemocniční laptop) a
**neumí počítat** – neobsahuje PyTorch, MONAI, PyVistu ani PyRadiomics. Umí přijmout
anonymizovaný sken, předat ho výpočetnímu workeru na výkonném stroji, uložit, co worker
naměřil, a zobrazit to lékaři.

```
[Nemocniční laptop]                          [Výkonný PC / CEITEC workstation]
 React + Vite  ───── HTTP ─────▶  worker (ACL_graft_analysis/Source/worker)
 FastAPI, SQLite                   ├─ segmentace 5-Fold LightUNet3D
 metriky, grafy, databáze          ├─ reorientace do RIA
        ◀──── metriky + knee.glb ──┴─ geometrie a radiomika
```

Proč odděleně: lékař potřebuje otevřít aplikaci na svém počítači, ne na GPU serveru.
Kdyby výpočet běžel u něj, potřeboval by instalaci CUDA, PyTorche a PyVisty – a to je
přesně to, co brání nasazení.

---

## 🏗️ Architektura

1. **Frontend (React + Vite):** responzivní rozhraní s 3D náhledem štěpu
   (`<model-viewer>`) a grafy časových řad.
2. **Backend (tento repozitář, FastAPI):** tenká vrstva – ukládá pacienty, vyšetření a
   naměřené metriky do SQLite a zprostředkovává komunikaci s workerem.
3. **Výpočetní worker:** samostatná služba v repu
   [`ACL_graft_analysis`](https://github.com/viliam-bartos/ACL_graft_analysis)
   (`Source/worker`). Dokumentace: `Source/worker/README.md`.

---

## 🚀 Rychlé spuštění (Local Dev)

### 1. Worker (na stroji, který počítá)

```bash
# v repu ACL_graft_analysis
Source\worker\run_worker.bat          # výchozí http://0.0.0.0:8100
```

Ověření: `curl http://127.0.0.1:8100/api/v1/health`

### 2. Backend (tenká aplikace)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                # Windows
pip install -r requirements.txt
set COMPUTE_WORKER_URL=http://127.0.0.1:8100
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev -- --host
```

Aplikace je dostupná na `http://localhost:5173` nebo přes lokální IP adresu v síti.

### Proměnné prostředí backendu

| Proměnná | Výchozí | Význam |
| :--- | :--- | :--- |
| `COMPUTE_WORKER_URL` | `http://127.0.0.1:8100` | adresa výpočetního workera |
| `COMPUTE_WORKER_TOKEN` | – | volitelný `X-API-Token` |
| `COMPUTE_WORKER_WAIT_S` | `900` | jak dlouho čekat na výsledek |
| `COMPUTE_WORKER_POLL_S` | `1.0` | interval dotazování |
| `CORS_ORIGINS` | `*` | čárkami oddělené povolené originy |

---

## 📊 Naměřené metriky, ne skóre

Aplikace **nepočítá žádné agregované skóre** (`integrity_score` a podobné). Dokud
neexistuje model natrénovaný na datech, dostává lékař pouze objektivní naměřené
parametry, ze kterých se rozhoduje:

```
Staubli_Tibial_pct   Tortuosity_Index      ATT_mm              BH_Length_pct
BH_Depth_pct         angle_to_plateau_deg  sagittal_angle_deg  coronal_angle_deg
acl_volume_mm3       min_dist_to_femur_mm  notch_width_mm      original_* (radiomika)
```

Nespočítaná metrika je `null`, nikdy nula – nula je platná naměřená hodnota.
Názvy a význam se řídí `spec/data-contracts.md` v repu `ACL_graft_analysis`.

---

## 🔒 Ochrana osobních údajů (Privacy by Design)

Systém operuje v striktním režimu bez přítomnosti osobních identifikačních údajů (PII).
Lékař pracuje pouze s anonymizovanými identifikátory (`ACL_XXX`), re-identifikační klíč
zůstává výhradně na straně nemocnice.

Nahraný objem se ukládá jen dočasně a po odeslání workeru se maže; trvale zůstávají
pouze číselné metriky a vygenerovaný 3D model.
