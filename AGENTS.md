# AGENTS.md — Závazná pravidla pro kódovací agenty

Tento dokument je primárním referenčním bodem a pravidly chování pro všechny AI agenty (Antigravity, Cursor, Claude Code, GitHub Copilot, Windsurf) pracující v tomto repozitáři.

---

## 1. Architektura projektu & Spec-Driven Development

1. **Primární specifikace:**
   - Všechny úpravy API, databáze a datových struktur se **striktně řídí souborem [SPEC.md](SPEC.md)**.
   - Pokud je potřeba změnit kontrakt API nebo přidat nový endpoint, musí být nejprve aktualizován `SPEC.md`.

2. **Oddělení vrstev:**
   - **Backend (`/backend`):** FastAPI (Python 3.11+), SQLite databáze přes SQLAlchemy v `acl_platform.db`, výpočetní jádro v `app/services/` (PyTorch, PyVista, PyRadiomics).
   - **Frontend (`/frontend`):** React 18, Vite 5, **striktní TypeScript**, TailwindCSS pro styly, `<model-viewer>` pro 3D GLB/glTF modely, Recharts pro časové řady.

3. **Ochrana osobních údajů (Privacy by Design):**
   - Databáze ani logy **nesmí nikdy obsahovat PII** (jména, rodná čísla, data narození).
   - Pacienti jsou vedeni výhradně pod anonymizovaným ID ve formátu `ACL_XXX`.

---

## 2. Technologické standardy a mantinely

### Frontend (TypeScript + React)
- **Striktní typovost:**
  - Všechny komponenty, hooky a API volání musí být v TypeScriptu (`.ts`, `.tsx`).
  - Je **zakázáno používat `any`** bez pádného důvodu. Všechny datové struktury musí mít rozhraní v `src/types/index.ts`.
  - Každá komponenta musí mít explicitně typované `Props`.
- **Stylování:**
  - Všechny styly se píší přes TailwindCSS utility classes. Vyhněte se inline CSS stylům v atributu `style` (s výjimkou dynamických hodnot 3D plátna).
- **Konzistence stavu:**
  - Komponenty vytvořené během renderu (např. custom tooltips) musí být deklarovány mimo tělo hlavní komponenty, aby nedocházelo k resetování stavu.

### Backend (Python + FastAPI)
- **Typové anotace:** Všechny funkce a metody musí mít typové anotace vstupů a návratových hodnot.
- **Pydantic modely:** Všechny endpointy musí validovat vstupy a výstupy pomocí Pydantic schémat v `app/models/db_models.py`.
- **Ošetření výjimek:** Je **přísně zakázáno tiché polykání výjimek** (`except: pass` nebo `except Exception: pass` bez zalogování chyby či vyvolání `HTTPException`).
- **3D a grafika:** PyVista generuje glTF/GLB v měřítku mm se středem v tibiálním platě.

---

## 3. Zpětnovazební smyčka pro agenty (Self-Verification Loop)

Agent **nikdy neodevzdá práci bez spuštění automatické verifikace**. Po každé úpravě kódu musí agent spustit následující příkazy:

### Frontend kontroly:
```bash
# 1. Kontrola typů (TypeScript compiler)
npm --prefix frontend run typecheck

# 2. Linter (ESLint flat config)
npm --prefix frontend run lint

# 3. Produkční sestavení (Vite bundle)
npm --prefix frontend run build
```

### Backend kontroly:
```bash
# 1. Linter a kontrola kvality kódu (Ruff)
backend/.venv/Scripts/ruff.exe check backend/app/

# 2. Formátování (pokud je potřeba)
backend/.venv/Scripts/ruff.exe format --check backend/app/
```

> [!IMPORTANT]
> **Pravidlo samočinné opravy (Self-Healing):**
> Pokud kterýkoliv z výše uvedených příkazů vrátí nenulový kód chyby, agent si musí přečíst chybový výstup, analyzovat příčinu, provést opravu a test spustit znovu, dokud všechny kontroly neprojdou čistě.

---

## 4. Git a verzovací workflow

1. **Práce ve větvích:**
   - Větší změny a refaktoring se provádí v dedikované větvi (`feature/<nazev-funkce>`).
   - Do větve `main` se kód merguje až po úspěšném projití všech verifikačních kontrol.
2. **Conventional Commits:**
   - Zprávy commitů musí dodržovat standard:
     * `feat:` nová funkcionalita
     * `fix:` oprava chyby
     * `refactor:` úprava kódu bez změny chování
     * `build:` úprava závislostí, nástrojů a konfigurací
     * `docs:` úprava dokumentace
