# AGENTS.md — Závazná pravidla pro kódovací agenty

Tento dokument je primárním referenčním bodem a pravidly chování pro všechny AI agenty
pracující v tomto repozitáři.

---

## 1. Architektura projektu & Spec-Driven Development

1. **Primární specifikace:**
   - Všechny úpravy API, databáze a datových struktur se **striktně řídí souborem
     [SPEC.md](SPEC.md)**.
   - Pokud je potřeba změnit kontrakt API nebo přidat nový endpoint, musí být nejprve
     aktualizován `SPEC.md`.

2. **Oddělení vrstev — tato aplikace je TENKÁ a neumí počítat:**
   - **Backend (`/backend`):** FastAPI (Python 3.11+), SQLite přes SQLAlchemy.
     Ukládá pacienty, vyšetření a metriky. **Nesmí obsahovat `torch`, `monai`,
     `pyvista`, `pyradiomics`, `scipy` ani `numpy`** – jejich přítomnost by znamenala,
     že se výpočet vrátil tam, odkud jsme ho odstěhovali.
   - **Výpočetní worker:** samostatná služba v repu
     `ACL_graft_analysis` (`Source/worker`), se kterou backend mluví přes HTTP
     (`backend/app/services/worker_client.py`). Kontrakt viz `Source/worker/README.md`.
   - **Frontend (`/frontend`):** React 18, Vite 5, **striktní TypeScript**, TailwindCSS,
     `<model-viewer>` pro 3D GLB/glTF modely, Recharts pro časové řady.

3. **Metriky vznikají výhradně ve workeru:**
   - Backend ani frontend metriky **nepočítají, nedopočítávají ani neodhadují**.
     Co worker nepošle, je `null`.
   - Názvy metrik se řídí `spec/data-contracts.md` v repu `ACL_graft_analysis`
     (`Staubli_Tibial_pct`, `ATT_mm`, `acl_volume_mm3`, …). Sloupce v databázi mají
     shodné názvy, aby nevznikalo místo, kde se mohou rozejít.
   - **Agregované skóre (`integrity_score` apod.) se nepočítá ani nezobrazuje.** Dokud
     neexistuje model natrénovaný na datech, lékař dostává jen objektivní parametry.
   - Zakázáno je cokoli „domýšlet“: žádné `np.random`, žádné konstanty vydávané za
     naměřené hodnoty, žádné `sigmoid(měsíce)`.

4. **Ukázková data musí být označená:**
   - Každý sken, který není skutečným měřením, má `is_demo = true` a frontend ho
     zobrazuje s viditelnou značkou. Nikdy se nevydává za měření.

5. **Ochrana osobních údajů (Privacy by Design):**
   - Databáze ani logy **nesmí nikdy obsahovat PII** (jména, rodná čísla, data narození).
   - Pacienti jsou vedeni výhradně pod anonymizovaným ID ve formátu `ACL_XXX`.
   - Nahraný objem se ukládá jen dočasně a po odeslání workeru se maže.

---

## 2. Technologické standardy a mantinely

### Frontend (TypeScript + React)
- **Striktní typovost:**
  - Všechny komponenty, hooky a API volání musí být v TypeScriptu (`.ts`, `.tsx`).
  - Je **zakázáno používat `any`** bez pádného důvodu. Všechny datové struktury musí mít
    rozhraní v `src/types/index.ts`.
  - Každá komponenta musí mít explicitně typované `Props`.
- **Stylování:**
  - Všechny styly se píší přes TailwindCSS utility classes. Vyhněte se inline CSS stylům
    v atributu `style` (s výjimkou dynamických hodnot 3D plátna).
- **Konzistence stavu:**
  - Komponenty vytvořené během renderu (např. custom tooltips) musí být deklarovány mimo
    tělo hlavní komponenty, aby nedocházelo k resetování stavu.
- **Chybějící metrika:** v UI se zobrazuje jako `—`, nikdy jako `0` ani vymyšlená hodnota.

### Backend (Python + FastAPI)
- **Typové anotace:** Všechny funkce a metody musí mít typové anotace vstupů a návratových
  hodnot.
- **Pydantic modely:** Všechny endpointy musí validovat vstupy a výstupy pomocí Pydantic
  schémat v `app/models/db_models.py`.
- **Ošetření výjimek:** Je **přísně zakázáno tiché polykání výjimek** (`except: pass` nebo
  `except Exception: pass` bez zalogování chyby či vyvolání `HTTPException`).
- **Nedostupný worker** se hlásí jako `503`/`502` srozumitelnou zprávou, nikdy se
  nepředstírá výsledek. Dlouhý výpočet, který překročí časový limit požadavku, nechává
  vyšetření ve stavu `pending` a dotahuje se přes `POST /api/v1/scans/{id}/refresh`.

---

## 3. Zpětnovazební smyčka pro agenty (Self-Verification Loop)

Agent **nikdy neodevzdá práci bez spuštění automatické verifikace**. Po každé úpravě kódu
musí agent spustit následující příkazy:

### Frontend kontroly:
```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

### Backend kontroly:
```bash
backend/.venv/Scripts/ruff.exe check backend/app/
backend/.venv/Scripts/ruff.exe format --check backend/app/
```

> [!NOTE]
> `backend/.venv` obsahuje aktuálně jen `pip` a `ruff`. Pro skutečné spuštění backendu je
> potřeba prostředí s `fastapi`, `uvicorn`, `sqlalchemy`, `httpx` a `python-multipart`
> (`pip install -r backend/requirements.txt`).

> [!IMPORTANT]
> **Pravidlo samočinné opravy (Self-Healing):**
> Pokud kterýkoliv z výše uvedených příkazů vrátí nenulový kód chyby, agent si musí přečíst
> chybový výstup, analyzovat příčinu, provést opravu a test spustit znovu, dokud všechny
> kontroly neprojdou čistě.

---

## 4. Git a verzovací workflow

1. **Commituj průběžně:** po každé ucelené změně, ne na konci všech prací.
   Větší refaktoring patří do dedikované větve (`feature/<nazev-funkce>`); běžné
   přírůstkové změny lze commitovat přímo do `main`.
2. **Nepushuj.** Pokud je push výslovně vyžádán, tak **výhradně na `origin`**
   (profil `viliam-bartos`). Nic se nesmí poslat do jiného repozitáře.
3. **Conventional Commits:**
   - `feat:` nová funkcionalita
   - `fix:` oprava chyby
   - `refactor:` úprava kódu bez změny chování
   - `build:` úprava závislostí, nástrojů a konfigurací
   - `docs:` úprava dokumentace
4. Před commitem zkontroluj `git status` a `git diff --cached`, že v indexu nejsou cizí
   změny.
5. Destruktivní operace (`reset --hard`, `checkout .`, `push --force`) se neprovádějí bez
   výslovného svolení.
