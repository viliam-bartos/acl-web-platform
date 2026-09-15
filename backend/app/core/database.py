import logging
import os
from collections.abc import Generator
from datetime import date

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

logger = logging.getLogger(__name__)

# SQLite database file path – v `data/`, aby ho docker volume skutečně persistoval.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "acl_platform.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session and ensures closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _drop_outdated_schema() -> None:
    """Zahodí tabulky ze staršího schématu.

    Původní schéma ukládalo `volume_mm3` a `integrity_score` – agregát, který
    vznikal jako funkce měsíce od operace, nikoli z obrazu. Takové hodnoty
    nemá smysl migrovat, protože to nejsou měření; databáze se proto znovu
    vytvoří a naplní pouze pacienty (žádná vymyšlená vyšetření).
    """
    inspector = inspect(engine)
    if "scans" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("scans")}
    if "integrity_score" not in columns:
        return

    logger.warning(
        "Nalezeno staré schéma databáze (integrity_score). Nahrazuji ho – "
        "ukládané agregované skóre se už nepočítá, protože nevznikalo z obrazu."
    )
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        for table in ("scans", "patients"):
            connection.execute(text(f"DROP TABLE IF EXISTS {table}"))


def init_db() -> None:
    """Vytvoří tabulky a zaregistruje ukázkové pacienty.

    **Žádná vyšetření se neosévají.** Dřív tu byla řada vymyšlených skenů
    s vymyšlenými objemy a „integritou" (58,2 -> 84,8), ze kterých v grafu
    vycházela přesvědčivá křivka hojení, aniž by za ní stál jakýkoli obraz.
    Databáze má obsahovat jen to, co worker skutečně naměřil.
    """
    from app.models.db_models import Patient, Scan

    Scan.verify_metric_mapping()
    _drop_outdated_schema()
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.query(Patient).first() is not None:
            return

        db.add_all(
            [
                Patient(
                    patient_id="ACL_042",
                    surgery_date=date(2024, 8, 10),
                    graft_type="Bone-Patellar Tendon-Bone (BPTB)",
                ),
                Patient(
                    patient_id="ACL_001",
                    surgery_date=date(2024, 3, 15),
                    graft_type="Hamstring Tendon Autograft (ST/G)",
                ),
                Patient(
                    patient_id="ACL_105",
                    surgery_date=date(2025, 1, 20),
                    graft_type="Quadriceps Tendon Autograft",
                ),
            ]
        )
        db.commit()
        logger.info("Zaregistrováni ukázkoví pacienti (bez vyšetření).")
