# Project Vault & Technical Specification

## 1. Project Goal

Vybudovat modulární webovou platformu pro longitudinální sledování a analýzu remodelace
(ligamentizace) vazu ACL po plastice z 3D MRI skenů. Lékař nahrává anonymizovaná data
z libovolného zařízení (desktop/mobil), výpočetní jádro provádí segmentaci a radiomickou
analýzu, frontend zobrazuje 3D model a časové trendy.

**Architektura je rozdělená na dvě části.** Tento repozitář je **tenká aplikace**: běží
na běžném počítači (nemocniční laptop) a **neumí počítat**. Žádná segmentace, žádná
geometrie, žádná radiomika. Umí jen přijmout soubor, předat ho výpočetnímu workeru,
uložit, co worker vrátí, a zobrazit to.

## 2. System Architecture

- **Frontend:** React 18+ (Vite), TailwindCSS, Google `<model-viewer>` pro nativní 3D
  GLB rendering, Recharts pro grafy. Optimalizováno pro mobilní i desktopové zobrazení.
- **Backend (tento repozitář):** FastAPI (Python 3.11+), Uvicorn, SQLite přes SQLAlchemy.
  **Závislosti záměrně neobsahují `torch`, `monai`, `pyvista`, `pyradiomics`, `scipy`
  ani `numpy`** – jejich přítomnost by znamenala, že se výpočet vrátil do tenké vrstvy.
- **Výpočetní worker:** samostatná služba v repozitáři
  `ACL_graft_analysis` (`Source/worker`). Provádí segmentaci 5-Fold ansámblem
  `LightUNet3D`, reorientaci do RIA, geometrii a radiomiku a vrací metriky a GLB model.
  Dokumentace: `Source/worker/README.md`.
- **Komunikační protokol:** REST přes HTTP. Tenká aplikace je klient, worker služba.
- **Konfigurace:** `COMPUTE_WORKER_URL` (povinná), `COMPUTE_WORKER_TOKEN` (volitelná),
  `COMPUTE_WORKER_WAIT_S` (jak dlouho čekat na výsledek), `COMPUTE_WORKER_POLL_S`.

## 3. Data & Privacy Constraints

- Striktní pseudoanonymizace: databáze a backend znají pouze `patient_id` (např. `ACL_042`).
- Žádná jména, rodná čísla ani metadata pacienta z DICOM headerů se neukládají.
- Re-identifikační klíč zůstává lokálně u lékaře.
- Nahrávaný objem se **neukládá** do tohoto repozitáře; předává se workeru a po zpracování
  se smaže. Trvale se ukládají jen číselné metriky a vygenerovaný 3D model.

### 3.1 Ukázková data

Databáze se při prvním spuštění plní ukázkovými pacienty a skeny, aby bylo na čem
ukázat rozhraní. Každý takový sken má `is_demo = true`, **nikdy se nevydává za měření**
a frontend ho zobrazuje s viditelnou značkou. Reálná data mají `is_demo = false`.

## 4. API Endpoints

- `POST /api/v1/scans/analyze`: Form-data (`patient_id`, `months_post_op`, `file`,
  volitelně `laterality`, `compute_radiomics`). Nahraje sken workeru, počká na výsledek,
  uloží metriky a 3D model a vrátí záznam o vyšetření. Vrací `201`.
- `POST /api/v1/scans/analyze-reference`: Form-data (`patient_id`, `months_post_op`,
  volitelně `use_inference`). Nechá worker zhodnotit jeho vestavěný referenční případ 074.
  Slouží k předvedení celé cesty bez potřeby vlastních dat. Vrací `201`.
- `POST /api/v1/scans/{scan_id}/refresh`: Dotáhne výsledek vyšetření, které doběhlo až po
  časovém limitu požadavku. Vrací `status: "pending"`, dokud výpočet běží.
- `GET /api/v1/scans/{scan_id}/model`: Vrátí GLB model daného vyšetření.
- `GET /api/v1/patients`: Vrátí seznam všech anonymizovaných pacientů.
- `POST /api/v1/patients`: Zaregistruje nové anonymizované ID pacienta.
- `GET /api/v1/patients/{patient_id}/history`: Vrátí časovou řadu všech kontrol pacienta
  pro vykreslení grafu vývoje vazu. Pole `patient` má **stejný tvar** jako položka
  v `/patients` (včetně `total_scans`, `latest_acl_volume_mm3`, `has_demo_scans`); užší
  typ odpovědi by přebytečná pole tiše zahodil.
- `GET /api/v1/health`: Stav aplikace **a dostupnost výpočetního workera**.
- `GET /api/v1/database/{stats,records,download}`: Prohlížeč a export databáze.

## 5. Kontrakt metrik

Názvy, jednotky a význam metrik se řídí specifikací
`ACL_graft_analysis/spec/data-contracts.md`. Platí:

```
Staubli_Tibial_pct   Tortuosity_Index      ATT_mm              BH_Length_pct
BH_Depth_pct         angle_to_plateau_deg  sagittal_angle_deg  coronal_angle_deg
acl_volume_mm3       min_dist_to_femur_mm  notch_width_mm
original_firstorder_* / original_glcm_* / original_glrlm_*
```

1. Nespočítaná metrika je `null` (v JSON), nikdy nula – nula je platná naměřená hodnota.
2. **Agregované skóre (např. `integrity_score`) se nepočítá ani nezobrazuje.** Dokud
   neexistuje model natrénovaný na datech, lékař dostává jen objektivní naměřené
   parametry. Nahrazovat je odhadem znamená vyrábět klinicky vypadající čísla z ničeho.
3. Metriky **nikdy nevznikají v této aplikaci**. Přicházejí z workeru; pokud worker
   metriku nepošle, uloží se `null`.
